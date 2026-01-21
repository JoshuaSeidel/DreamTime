import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { prisma } from '../config/database.js';
import { SessionState } from '../types/enums.js';

// MQTT configuration from environment
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || 'dreamtime';
const MQTT_ENABLED = process.env.MQTT_ENABLED === 'true';

// Home Assistant MQTT Discovery prefix
const HA_DISCOVERY_PREFIX = 'homeassistant';

let client: MqttClient | null = null;

// Track connected state
let isConnected = false;

// Track reconnection attempts to reduce log noise
let reconnectAttempts = 0;
let lastErrorLog = 0;
const ERROR_LOG_INTERVAL = 60000; // Only log errors every 60 seconds

// Session state mapping for MQTT - user-friendly display values
type MqttSessionState = 'Awake' | 'In Crib' | 'Asleep' | 'Awake in Crib';

function mapSessionState(state: string | null): MqttSessionState {
  if (!state) return 'Awake';
  switch (state) {
    case SessionState.PENDING:
      return 'In Crib';
    case SessionState.ASLEEP:
      return 'Asleep';
    case SessionState.AWAKE:
      return 'Awake in Crib';
    case SessionState.COMPLETED:
    default:
      return 'Awake';
  }
}

// Get state topic for a child (used for HA discovery)
function getStateTopic(childId: string): string {
  return `${MQTT_TOPIC_PREFIX}/${childId}/state`;
}

// Get command topic for a child
function getCommandTopic(childId: string): string {
  return `${MQTT_TOPIC_PREFIX}/${childId}/command`;
}

// Slugify child name for HA entity IDs
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Publish Home Assistant MQTT Discovery config for a child
async function publishDiscoveryConfig(childId: string, childName: string): Promise<void> {
  if (!client || !isConnected) {
    // Silently skip - broker is down, will republish on reconnect
    return;
  }

  const slug = slugify(childName);
  const uniqueId = `dreamtime_${slug}_${childId.slice(0, 8)}`;

  // Discovery topic for sensor entity
  const discoveryTopic = `${HA_DISCOVERY_PREFIX}/sensor/${uniqueId}/config`;

  // State topic where we publish updates
  const stateTopic = getStateTopic(childId);
  const commandTopic = getCommandTopic(childId);

  const discoveryPayload = {
    name: `${childName} Sleep Status`,
    unique_id: uniqueId,
    state_topic: stateTopic,
    value_template: '{{ value_json.state }}',
    json_attributes_topic: stateTopic,
    icon: 'mdi:baby-face-outline',
    device: {
      identifiers: [`dreamtime_${childId}`],
      name: `DreamTime - ${childName}`,
      manufacturer: 'DreamTime',
      model: 'Sleep Tracker',
      sw_version: '1.0.0',
    },
    // Include child_id and command_topic as attributes for easy automation
    json_attributes_template: JSON.stringify({
      child_id: '{{ value_json.child_id }}',
      child_name: '{{ value_json.child_name }}',
      session_type: '{{ value_json.session_type }}',
      put_down_at: '{{ value_json.put_down_at }}',
      asleep_at: '{{ value_json.asleep_at }}',
      woke_up_at: '{{ value_json.woke_up_at }}',
      command_topic: commandTopic,
      updated_at: '{{ value_json.updated_at }}',
    }).replace(/"/g, "'").replace(/'/g, '"'), // HA template syntax
  };

  client.publish(discoveryTopic, JSON.stringify(discoveryPayload), { retain: true });
  console.log(`MQTT: Published HA discovery config for ${childName}`);

  // Also publish a select entity for commands
  const selectDiscoveryTopic = `${HA_DISCOVERY_PREFIX}/select/${uniqueId}_action/config`;
  const selectPayload = {
    name: `${childName} Sleep Action`,
    unique_id: `${uniqueId}_action`,
    command_topic: commandTopic,
    state_topic: stateTopic,
    value_template: '{{ value_json.state }}',
    options: ['put_down', 'asleep', 'woke_up', 'out_of_crib'],
    icon: 'mdi:bed',
    device: {
      identifiers: [`dreamtime_${childId}`],
    },
  };

  client.publish(selectDiscoveryTopic, JSON.stringify(selectPayload), { retain: true });
  console.log(`MQTT: Published HA discovery config for ${childName} action select`);
}

// Publish discovery configs for all children
async function publishAllDiscoveryConfigs(): Promise<void> {
  if (!client || !isConnected) return;

  try {
    const children = await prisma.child.findMany({
      select: { id: true, name: true },
    });

    for (const child of children) {
      await publishDiscoveryConfig(child.id, child.name);
      // Also publish initial state
      await publishState(child.id, child.name);
    }

    console.log(`MQTT: Published discovery configs for ${children.length} children`);
  } catch (error) {
    console.error('MQTT: Error publishing discovery configs:', error);
  }
}

// Initialize MQTT connection
export async function initializeMqtt(): Promise<void> {
  if (!MQTT_ENABLED) {
    console.log('MQTT: Disabled (set MQTT_ENABLED=true to enable)');
    return;
  }

  const options: IClientOptions = {
    clientId: `dreamtime-server-${Date.now()}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 5000,
  };

  if (MQTT_USERNAME) {
    options.username = MQTT_USERNAME;
    options.password = MQTT_PASSWORD;
  }

  console.log(`MQTT: Connecting to ${MQTT_BROKER_URL}...`);

  client = mqtt.connect(MQTT_BROKER_URL, options);

  client.on('connect', async () => {
    isConnected = true;
    reconnectAttempts = 0;
    console.log('MQTT: Connected successfully');

    // Publish HA discovery configs for all children
    try {
      await publishAllDiscoveryConfigs();
      await subscribeToCommands();
    } catch (error) {
      console.error('MQTT: Error during post-connect setup:', error);
    }
  });

  client.on('error', (error) => {
    // Only log errors periodically to avoid flooding logs during HA reboots
    const now = Date.now();
    if (now - lastErrorLog > ERROR_LOG_INTERVAL) {
      console.warn(`MQTT: Connection error (will auto-retry): ${error.message}`);
      lastErrorLog = now;
    }
  });

  client.on('offline', () => {
    isConnected = false;
    // Only log first time going offline, not every retry
    if (reconnectAttempts === 0) {
      console.log('MQTT: Offline - will auto-reconnect when broker is available');
    }
  });

  client.on('reconnect', () => {
    reconnectAttempts++;
    // Only log reconnect attempts periodically
    if (reconnectAttempts === 1 || reconnectAttempts % 12 === 0) {
      console.log(`MQTT: Reconnecting... (attempt ${reconnectAttempts})`);
    }
  });

  client.on('close', () => {
    isConnected = false;
  });

  client.on('message', handleMessage);
}

// Subscribe to command topics
async function subscribeToCommands(): Promise<void> {
  if (!client || !isConnected) return;

  try {
    // Subscribe to wildcard for all children
    const wildcardTopic = `${MQTT_TOPIC_PREFIX}/+/command`;
    client.subscribe(wildcardTopic, (err) => {
      if (!err) {
        console.log(`MQTT: Subscribed to command topics (${wildcardTopic})`);
      } else {
        console.error('MQTT: Failed to subscribe to command topics:', err);
      }
    });
  } catch (error) {
    console.error('MQTT: Error subscribing to commands:', error);
  }
}

// Handle incoming MQTT messages (commands from Home Assistant)
async function handleMessage(topic: string, message: Buffer): Promise<void> {
  try {
    const parts = topic.split('/');
    if (parts.length < 3) return;

    const childId = parts[1];
    const subtopic = parts[2];

    if (!childId || !subtopic || subtopic !== 'command') return;

    const command = message.toString().toLowerCase().trim();
    console.log(`MQTT: Received command '${command}' for child ${childId}`);

    // Process the command
    await processCommand(childId, command);
  } catch (error) {
    console.error('MQTT: Error handling message:', error);
  }
}

// Process voice commands from MQTT
async function processCommand(childId: string, command: string): Promise<void> {
  try {
    // Verify child exists
    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { id: true, name: true },
    });

    if (!child) {
      console.error(`MQTT: Child not found: ${childId}`);
      return;
    }

    // Get active session for this child
    const activeSession = await prisma.sleepSession.findFirst({
      where: {
        childId,
        state: { not: SessionState.COMPLETED },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    switch (command) {
      case 'put_down':
      case 'putdown':
      case 'put down':
      case 'in_crib':
      case 'in crib': {
        if (activeSession) {
          console.log(`MQTT: Already have an active session for ${child.name}`);
          return;
        }

        // Create a new NAP session (default - could be NIGHT_SLEEP based on time)
        const hour = now.getHours();
        const sessionType = hour >= 18 || hour < 6 ? 'NIGHT_SLEEP' : 'NAP';

        await prisma.sleepSession.create({
          data: {
            childId,
            sessionType,
            state: SessionState.PENDING,
            putDownAt: now,
          },
        });

        console.log(`MQTT: Created ${sessionType} session for ${child.name}`);
        await publishState(childId, child.name);
        break;
      }

      case 'fell_asleep':
      case 'asleep':
      case 'sleeping': {
        if (!activeSession) {
          console.log(`MQTT: No active session for ${child.name}`);
          return;
        }

        if (activeSession.state !== SessionState.PENDING && activeSession.state !== SessionState.AWAKE) {
          console.log(`MQTT: Cannot transition from ${activeSession.state} to asleep`);
          return;
        }

        await prisma.sleepSession.update({
          where: { id: activeSession.id },
          data: {
            state: SessionState.ASLEEP,
            asleepAt: activeSession.asleepAt || now,
          },
        });

        console.log(`MQTT: ${child.name} fell asleep`);
        await publishState(childId, child.name);
        break;
      }

      case 'woke_up':
      case 'woke up':
      case 'awake':
      case 'waking': {
        if (!activeSession) {
          console.log(`MQTT: No active session for ${child.name}`);
          return;
        }

        if (activeSession.state !== SessionState.ASLEEP) {
          console.log(`MQTT: Cannot wake up from ${activeSession.state}`);
          return;
        }

        await prisma.sleepSession.update({
          where: { id: activeSession.id },
          data: {
            state: SessionState.AWAKE,
            wokeUpAt: now,
          },
        });

        console.log(`MQTT: ${child.name} woke up`);
        await publishState(childId, child.name);
        break;
      }

      case 'out_of_crib':
      case 'out of crib':
      case 'out':
      case 'up': {
        if (!activeSession) {
          console.log(`MQTT: No active session for ${child.name}`);
          return;
        }

        // Calculate durations
        const wokeUpAt = activeSession.wokeUpAt || now;
        const asleepAt = activeSession.asleepAt;
        const putDownAt = activeSession.putDownAt;

        let sleepMinutes: number | null = null;
        let totalMinutes: number | null = null;
        let settlingMinutes: number | null = null;
        let postWakeMinutes: number | null = null;

        if (asleepAt && wokeUpAt) {
          sleepMinutes = Math.max(0, Math.round((wokeUpAt.getTime() - asleepAt.getTime()) / 60000));
        }

        if (putDownAt) {
          totalMinutes = Math.max(0, Math.round((now.getTime() - putDownAt.getTime()) / 60000));
        }

        if (putDownAt && asleepAt) {
          settlingMinutes = Math.max(0, Math.round((asleepAt.getTime() - putDownAt.getTime()) / 60000));
        }

        if (wokeUpAt) {
          postWakeMinutes = Math.max(0, Math.round((now.getTime() - wokeUpAt.getTime()) / 60000));
        }

        const awakeCribMinutes = (settlingMinutes ?? 0) + (postWakeMinutes ?? 0);
        const qualifiedRestMinutes = Math.round((awakeCribMinutes / 2) + (sleepMinutes ?? 0));

        await prisma.sleepSession.update({
          where: { id: activeSession.id },
          data: {
            state: SessionState.COMPLETED,
            wokeUpAt: activeSession.wokeUpAt || now,
            outOfCribAt: now,
            sleepMinutes,
            totalMinutes,
            settlingMinutes,
            postWakeMinutes,
            awakeCribMinutes,
            qualifiedRestMinutes,
          },
        });

        console.log(`MQTT: ${child.name} out of crib (slept ${sleepMinutes ?? 0} min)`);
        await publishState(childId, child.name);
        break;
      }

      case 'status':
      case 'state': {
        await publishState(childId, child.name);
        break;
      }

      default:
        console.log(`MQTT: Unknown command: ${command}`);
    }
  } catch (error) {
    console.error('MQTT: Error processing command:', error);
  }
}

// Publish current state for a child
export async function publishState(childId: string, childName?: string): Promise<void> {
  if (!client || !isConnected) {
    // Silently skip - broker is down, state will sync on reconnect
    return;
  }

  try {
    // Get the child name if not provided
    let name = childName;
    if (!name) {
      const child = await prisma.child.findUnique({
        where: { id: childId },
        select: { name: true },
      });
      name = child?.name || 'Unknown';
    }

    // Get active session
    const activeSession = await prisma.sleepSession.findFirst({
      where: {
        childId,
        state: { not: SessionState.COMPLETED },
      },
      orderBy: { createdAt: 'desc' },
    });

    const state = mapSessionState(activeSession?.state || null);
    const stateTopic = getStateTopic(childId);

    // Publish state as JSON with all attributes for HA
    const statePayload = {
      state,
      child_id: childId,
      child_name: name,
      session_type: activeSession?.sessionType || null,
      put_down_at: activeSession?.putDownAt?.toISOString() || null,
      asleep_at: activeSession?.asleepAt?.toISOString() || null,
      woke_up_at: activeSession?.wokeUpAt?.toISOString() || null,
      command_topic: getCommandTopic(childId),
      updated_at: new Date().toISOString(),
    };

    client.publish(stateTopic, JSON.stringify(statePayload), { retain: true });
    console.log(`MQTT: Published state '${state}' for ${name}`);
  } catch (error) {
    console.error('MQTT: Error publishing state:', error);
  }
}

// Publish discovery config when a new child is created
export async function publishChildDiscovery(childId: string, childName: string): Promise<void> {
  if (!client || !isConnected) {
    // Silently skip - will be published on next connect
    return;
  }
  try {
    await publishDiscoveryConfig(childId, childName);
    await publishState(childId, childName);
  } catch (error) {
    // Don't throw - MQTT is optional, don't break child creation
    console.warn('MQTT: Failed to publish child discovery (non-critical):', error);
  }
}

// Disconnect MQTT client
export async function disconnectMqtt(): Promise<void> {
  if (client) {
    return new Promise((resolve) => {
      client!.end(false, {}, () => {
        console.log('MQTT: Disconnected');
        client = null;
        isConnected = false;
        resolve();
      });
    });
  }
}

// Check if MQTT is enabled and connected
export function isMqttConnected(): boolean {
  return isConnected;
}

// Check if MQTT is enabled
export function isMqttEnabled(): boolean {
  return MQTT_ENABLED;
}

// Helper to get the MQTT client for external use
export function getMqttClient(): MqttClient | null {
  return client;
}
