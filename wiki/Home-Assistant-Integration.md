# Home Assistant Integration

Integrate DreamTime with Home Assistant for voice control and automations.

## Overview

DreamTime can publish sleep events and status to an MQTT broker, enabling:
- Voice control via Google Home, Alexa, or Siri
- Automations based on sleep state
- Dashboard widgets in Home Assistant
- Smart home coordination (lights, sounds, etc.)

---

## Prerequisites

- Home Assistant installation
- MQTT broker (Mosquitto recommended)
- DreamTime server with MQTT enabled

---

## Server Configuration

### Enable MQTT

Add these environment variables to your DreamTime server:

```env
MQTT_ENABLED=true
MQTT_BROKER_URL=mqtt://homeassistant.local:1883
MQTT_USERNAME=dreamtime
MQTT_PASSWORD=your_mqtt_password
MQTT_TOPIC_PREFIX=dreamtime
```

### Docker Compose Example

```yaml
services:
  server:
    environment:
      - MQTT_ENABLED=true
      - MQTT_BROKER_URL=mqtt://homeassistant.local:1883
      - MQTT_USERNAME=${MQTT_USERNAME}
      - MQTT_PASSWORD=${MQTT_PASSWORD}
      - MQTT_TOPIC_PREFIX=dreamtime
```

---

## MQTT Topics

### Published Topics

DreamTime publishes to these topics:

| Topic | Payload | When |
|-------|---------|------|
| `dreamtime/{childId}/state` | `awake`, `in_crib`, `asleep`, `awake_in_crib` | State changes |
| `dreamtime/{childId}/session/start` | JSON | Session starts |
| `dreamtime/{childId}/session/end` | JSON | Session ends |
| `dreamtime/{childId}/recommendation` | JSON | Recommendation updates |

### State Topic Payloads

**State Values:**
```
awake          - Baby is out of crib, awake
in_crib        - Baby placed in crib (settling)
asleep         - Baby is sleeping
awake_in_crib  - Baby woke but still in crib
```

### Session Start Payload

```json
{
  "childId": "uuid",
  "childName": "Oliver",
  "sessionId": "uuid",
  "type": "NAP",
  "napNumber": 1,
  "putDownAt": "2024-01-15T09:00:00Z",
  "location": "CRIB"
}
```

### Session End Payload

```json
{
  "childId": "uuid",
  "childName": "Oliver",
  "sessionId": "uuid",
  "type": "NAP",
  "napNumber": 1,
  "duration": 90,
  "qualifiedRest": 95,
  "outOfCribAt": "2024-01-15T10:35:00Z"
}
```

### Recommendation Payload

```json
{
  "childId": "uuid",
  "childName": "Oliver",
  "type": "NAP",
  "napNumber": 2,
  "status": "READY",
  "targetTime": "2024-01-15T12:30:00Z",
  "message": "Oliver is ready for Nap 2"
}
```

### Subscribed Topics

DreamTime listens on these topics for commands:

| Topic | Payload | Action |
|-------|---------|--------|
| `dreamtime/{childId}/command/put_down` | `{}` | Start session |
| `dreamtime/{childId}/command/fell_asleep` | `{}` | Mark asleep |
| `dreamtime/{childId}/command/woke_up` | `{}` | Mark woke up |
| `dreamtime/{childId}/command/out_of_crib` | `{}` | End session |

---

## Home Assistant Setup

### Step 1: Configure MQTT Broker

If not already configured, add Mosquitto to Home Assistant:

```yaml
# configuration.yaml
mqtt:
  broker: localhost
  port: 1883
  username: homeassistant
  password: your_password
```

### Step 2: Create MQTT Sensors

Add sensors for each child:

```yaml
# configuration.yaml
mqtt:
  sensor:
    - name: "Oliver Sleep State"
      state_topic: "dreamtime/oliver-child-id/state"
      icon: mdi:sleep

    - name: "Oliver Next Sleep"
      state_topic: "dreamtime/oliver-child-id/recommendation"
      value_template: "{{ value_json.message }}"
      icon: mdi:clock-outline

    - name: "Oliver Sleep Status"
      state_topic: "dreamtime/oliver-child-id/recommendation"
      value_template: "{{ value_json.status }}"
      icon: mdi:information
```

### Step 3: Create Input Buttons

Create buttons for voice control:

```yaml
# configuration.yaml
input_button:
  oliver_put_down:
    name: "Oliver Put Down"
    icon: mdi:baby-carriage

  oliver_fell_asleep:
    name: "Oliver Fell Asleep"
    icon: mdi:sleep

  oliver_woke_up:
    name: "Oliver Woke Up"
    icon: mdi:alarm

  oliver_out_of_crib:
    name: "Oliver Out of Crib"
    icon: mdi:exit-run
```

### Step 4: Create Automations

Link buttons to MQTT commands:

```yaml
# automations.yaml
- alias: "Oliver Put Down Button"
  trigger:
    platform: state
    entity_id: input_button.oliver_put_down
  action:
    service: mqtt.publish
    data:
      topic: "dreamtime/oliver-child-id/command/put_down"
      payload: "{}"

- alias: "Oliver Fell Asleep Button"
  trigger:
    platform: state
    entity_id: input_button.oliver_fell_asleep
  action:
    service: mqtt.publish
    data:
      topic: "dreamtime/oliver-child-id/command/fell_asleep"
      payload: "{}"

- alias: "Oliver Woke Up Button"
  trigger:
    platform: state
    entity_id: input_button.oliver_woke_up
  action:
    service: mqtt.publish
    data:
      topic: "dreamtime/oliver-child-id/command/woke_up"
      payload: "{}"

- alias: "Oliver Out of Crib Button"
  trigger:
    platform: state
    entity_id: input_button.oliver_out_of_crib
  action:
    service: mqtt.publish
    data:
      topic: "dreamtime/oliver-child-id/command/out_of_crib"
      payload: "{}"
```

---

## Voice Control

### Google Home / Alexa via Routines

Create voice routines that trigger the input buttons:

**Example (Google Home):**
1. Open Google Home app
2. Go to Routines
3. Create new routine
4. Trigger: "Oliver is in the crib"
5. Action: Control device > Oliver Put Down button

**Example voice commands:**
- "Hey Google, Oliver is in the crib" → Triggers put_down
- "Hey Google, Oliver fell asleep" → Triggers fell_asleep
- "Hey Google, Oliver woke up" → Triggers woke_up
- "Hey Google, Oliver is out of the crib" → Triggers out_of_crib

### Siri via HomeKit

If using HomeKit integration:
1. Expose input buttons to HomeKit
2. Create Siri Shortcuts for each button
3. Use voice commands like "Hey Siri, Oliver is sleeping"

---

## Automations

### Nursery Light Dimming

Dim nursery lights when baby goes in crib:

```yaml
- alias: "Dim Nursery When Baby In Crib"
  trigger:
    platform: mqtt
    topic: "dreamtime/oliver-child-id/state"
    payload: "in_crib"
  action:
    service: light.turn_on
    target:
      entity_id: light.nursery
    data:
      brightness_pct: 10
      transition: 30
```

### White Noise Control

Turn on white noise when baby is placed in crib:

```yaml
- alias: "White Noise On When In Crib"
  trigger:
    platform: mqtt
    topic: "dreamtime/oliver-child-id/state"
    payload: "in_crib"
  action:
    service: media_player.play_media
    target:
      entity_id: media_player.nursery_speaker
    data:
      media_content_id: "http://nas.local/sounds/white_noise.mp3"
      media_content_type: "music"

- alias: "White Noise Off When Out of Crib"
  trigger:
    platform: mqtt
    topic: "dreamtime/oliver-child-id/state"
    payload: "awake"
  action:
    service: media_player.stop
    target:
      entity_id: media_player.nursery_speaker
```

### Nap Reminder Announcement

Announce nap time on speakers:

```yaml
- alias: "Announce Nap Time"
  trigger:
    platform: mqtt
    topic: "dreamtime/oliver-child-id/recommendation"
  condition:
    - condition: template
      value_template: "{{ trigger.payload_json.status == 'READY' }}"
    - condition: template
      value_template: "{{ trigger.payload_json.type == 'NAP' }}"
  action:
    service: tts.google_translate_say
    target:
      entity_id: media_player.living_room
    data:
      message: "{{ trigger.payload_json.message }}"
```

### Bedtime Mode

Activate bedtime mode for the house:

```yaml
- alias: "Activate Bedtime Mode"
  trigger:
    platform: mqtt
    topic: "dreamtime/oliver-child-id/state"
    payload: "asleep"
  condition:
    - condition: time
      after: "18:00:00"
      before: "22:00:00"
  action:
    - service: scene.turn_on
      target:
        entity_id: scene.evening_quiet
    - service: notify.mobile_app
      data:
        message: "Oliver is asleep. House entering quiet mode."
```

---

## Dashboard Cards

### Lovelace Dashboard

Create a baby monitoring dashboard:

```yaml
# Lovelace card
type: entities
title: Oliver Sleep Tracker
entities:
  - entity: sensor.oliver_sleep_state
    name: Current State
  - entity: sensor.oliver_next_sleep
    name: Recommendation
  - type: buttons
    entities:
      - entity: input_button.oliver_put_down
        name: Put Down
        icon: mdi:baby-carriage
      - entity: input_button.oliver_fell_asleep
        name: Asleep
        icon: mdi:sleep
      - entity: input_button.oliver_woke_up
        name: Woke
        icon: mdi:alarm
      - entity: input_button.oliver_out_of_crib
        name: Out
        icon: mdi:exit-run
```

### Conditional Cards

Show different cards based on state:

```yaml
type: conditional
conditions:
  - entity: sensor.oliver_sleep_state
    state: "asleep"
card:
  type: markdown
  content: |
    ## 😴 Oliver is sleeping
    Shh... keep it quiet!
```

---

## Finding Your Child ID

The MQTT topics require your child's ID. To find it:

### Method 1: Browser Dev Tools

1. Open DreamTime in a browser
2. Open Developer Tools (F12)
3. Go to Network tab
4. Look for API requests to `/api/children`
5. The ID is in the response

### Method 2: API Request

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-dreamtime.com/api/children
```

Response includes the child ID.

---

## Troubleshooting

### MQTT Not Connecting

1. Verify broker URL is correct
2. Check username/password
3. Ensure port is accessible (1883 or 8883 for TLS)
4. Check DreamTime server logs

### Messages Not Publishing

1. Verify `MQTT_ENABLED=true`
2. Check topic prefix matches your subscriptions
3. Use MQTT Explorer to monitor topics
4. Restart DreamTime server after config changes

### Commands Not Working

1. Verify topic matches exactly (including child ID)
2. Ensure payload is valid JSON (`{}` for commands)
3. Check DreamTime server logs for errors
4. Verify there's an active session for state transitions

### Home Assistant Not Receiving

1. Check MQTT integration is configured
2. Verify sensor topics match publish topics
3. Use Developer Tools > MQTT to test
4. Check Home Assistant logs

---

## Security

### MQTT with TLS

For production, use TLS:

```env
MQTT_BROKER_URL=mqtts://homeassistant.local:8883
```

### Separate MQTT User

Create a dedicated MQTT user for DreamTime with limited permissions:

```
user dreamtime
topic write dreamtime/#
topic read dreamtime/+/command/#
```

### Firewall

Only allow MQTT from DreamTime server:
- Block external access to port 1883/8883
- Use internal network only

