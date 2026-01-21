# DreamTime Home Assistant Integration

This folder contains Home Assistant configuration templates for integrating DreamTime with Alexa voice control.

## Prerequisites

1. **MQTT Broker**: Home Assistant's built-in Mosquitto add-on or external MQTT broker
2. **DreamTime MQTT**: Enabled in your DreamTime `.env` file:
   ```env
   MQTT_ENABLED=true
   MQTT_BROKER_URL=mqtt://YOUR_HA_IP:1883
   MQTT_USERNAME=dreamtime
   MQTT_PASSWORD=your_secure_password
   ```
3. **Alexa Integration**: Home Assistant Cloud (Nabu Casa) or manual Alexa Smart Home skill

## Setup Instructions

### 1. Configure MQTT User

In Home Assistant, go to **Settings > Add-ons > Mosquitto broker > Configuration** and add a user:
```yaml
logins:
  - username: dreamtime
    password: your_secure_password
```

### 2. Add Configuration Files

Copy the contents of the YAML files in this folder to your Home Assistant configuration:

- `configuration.yaml` - Add the template sensors and input helpers
- `automations.yaml` - Add the Alexa voice command automations
- `scripts.yaml` - Add the sleep tracking scripts

### 3. Restart Home Assistant

After adding the configuration, restart Home Assistant to load the changes.

### 4. Expose to Alexa

In Home Assistant, go to **Settings > Voice Assistants > Alexa** and expose:
- The sleep action input_select entities
- The sleep status sensor entities

## Voice Commands

Once configured, you can use these Alexa commands:

| Command | Action |
|---------|--------|
| "Alexa, tell Home Assistant baby is in crib" | Records put down time |
| "Alexa, tell Home Assistant baby fell asleep" | Records asleep time |
| "Alexa, tell Home Assistant baby woke up" | Records wake time |
| "Alexa, tell Home Assistant baby is out of crib" | Completes sleep session |
| "Alexa, ask Home Assistant baby sleep status" | Reports current state |

## How It Works

1. **MQTT Discovery**: DreamTime automatically publishes Home Assistant MQTT Discovery configs when it starts, creating sensor entities for each child
2. **Voice Commands**: Alexa triggers Home Assistant automations that publish MQTT commands
3. **State Updates**: DreamTime processes commands and publishes state updates back via MQTT
4. **Entity Sync**: Home Assistant sensors update automatically via MQTT

## Troubleshooting

### Entities Not Appearing
- Check that MQTT is connected in DreamTime logs
- Verify MQTT credentials are correct
- Check Home Assistant MQTT integration is working

### Voice Commands Not Working
- Ensure entities are exposed to Alexa
- Check automation triggers match your Alexa phrases
- Verify MQTT topics in automations match DreamTime's topic prefix

### State Not Updating
- Check DreamTime server logs for MQTT publish errors
- Verify MQTT retain flag is working (retained messages should persist)
