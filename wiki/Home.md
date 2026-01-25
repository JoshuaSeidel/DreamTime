# DreamTime - Baby Sleep Tracker

Welcome to the DreamTime wiki! DreamTime is a Progressive Web App (PWA) designed to help parents track their baby's sleep, follow sleep consultant schedules, and get personalized recommendations.

## Quick Links

### Getting Started
- **[Getting Started](Getting-Started)** - New user guide and first-time setup
- **[Installation & Setup](Installation-and-Setup)** - Deploy DreamTime on your server
- **[Configuration](Configuration)** - Environment variables and settings

### Features
- **[Features Overview](Features-Overview)** - Complete list of app capabilities
- **[Dashboard](Dashboard)** - Main tracking interface
- **[Schedule Configuration](Schedule-Configuration)** - Set up sleep schedules
- **[2-to-1 Nap Transition](Nap-Transition)** - Managing the transition from 2 naps to 1
- **[Analytics & History](Analytics-and-History)** - Track progress over time
- **[Caregiver Sharing](Caregiver-Sharing)** - Share access with family members

### Sleep Training
- **[Sleep Training Concepts](Sleep-Training-Concepts)** - Wake windows, crib time, sleep debt
- **[Schedule Types](Schedule-Types)** - 3-nap, 2-nap, 1-nap schedules explained

### Technical
- **[API Reference](API-Reference)** - REST API documentation
- **[Database Schema](Database-Schema)** - Data model reference
- **[PWA & Offline](PWA-and-Offline)** - Service worker and caching
- **[Push Notifications](Push-Notifications)** - Notification setup
- **[Home Assistant Integration](Home-Assistant-Integration)** - MQTT voice control

### Help
- **[Troubleshooting](Troubleshooting)** - Common issues and solutions
- **[FAQ](FAQ)** - Frequently asked questions

---

## What is DreamTime?

DreamTime helps parents:

1. **Track Sleep Events** - Record when baby goes down, falls asleep, wakes up, and gets out of crib
2. **Follow Schedules** - Configure age-appropriate wake windows and nap times
3. **Get Recommendations** - Receive smart suggestions for next nap or bedtime
4. **Share with Caregivers** - Let partners, grandparents, or babysitters track sleep too
5. **Analyze Patterns** - View trends and optimize the schedule over time

## Key Features

| Feature | Description |
|---------|-------------|
| Quick Action Buttons | Large, touch-friendly buttons for tracking sleep state |
| Smart Recommendations | AI-powered suggestions based on wake windows and sleep debt |
| 2-to-1 Transition | Guided 4-6 week transition from 2 naps to 1 |
| Multi-Caregiver | Share access with family members with role-based permissions |
| Push Notifications | Get reminders before nap time and bedtime |
| Offline Support | Works without internet, syncs when connected |
| Passkey Login | Use Face ID or Touch ID for quick access |

## Technology

- **Backend**: Node.js + Fastify + Prisma (SQLite or PostgreSQL)
- **Frontend**: React + Vite + Tailwind CSS
- **PWA**: Service worker with Workbox for offline support
- **Notifications**: Web Push API with VAPID
- **Authentication**: JWT + WebAuthn (passkeys)

## Support

- **Issues**: [GitHub Issues](https://github.com/JoshuaSeidel/DreamTime/issues)
- **Discussions**: [GitHub Discussions](https://github.com/JoshuaSeidel/DreamTime/discussions)

---

*DreamTime is designed with sleep consultant principles in mind, implementing wake windows, minimum crib time rules, and gradual transition strategies.*
