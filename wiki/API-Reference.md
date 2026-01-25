# API Reference

Complete REST API documentation for DreamTime.

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

DreamTime uses JWT-based authentication with refresh tokens.

### Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Token Lifecycle

| Token | Expiry | Purpose |
|-------|--------|---------|
| Access Token | 15 minutes | API authentication |
| Refresh Token | 7 days | Obtain new access tokens |

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Authentication Endpoints

### Register

Create a new user account.

```
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "timezone": "America/New_York"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "timezone": "America/New_York"
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

### Login

Authenticate with email and password.

```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "timezone": "America/New_York",
      "onboardingCompleted": true
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

### Refresh Token

Get a new access token using refresh token.

```
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_token",
    "refreshToken": "new_refresh_token"
  }
}
```

### Logout

Invalidate refresh token.

```
POST /auth/logout
```

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

---

## User Endpoints

### Get Current User

Get authenticated user's profile.

```
GET /users/me
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "timezone": "America/New_York",
    "onboardingCompleted": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### Update User

Update user profile.

```
PATCH /users/me
```

**Request Body:**
```json
{
  "name": "John Smith",
  "timezone": "America/Los_Angeles"
}
```

### Complete Onboarding

Mark onboarding wizard as completed.

```
POST /users/me/onboarding-complete
```

**Response:**
```json
{
  "success": true,
  "data": {
    "onboardingCompleted": true
  }
}
```

---

## Child Endpoints

### List Children

Get all children for the current user.

```
GET /children
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Oliver",
      "birthDate": "2023-03-15",
      "role": "ADMIN",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Get Child

Get a specific child.

```
GET /children/:childId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Oliver",
    "birthDate": "2023-03-15",
    "role": "ADMIN",
    "schedule": { ... },
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### Create Child

Create a new child profile.

```
POST /children
```

**Request Body:**
```json
{
  "name": "Oliver",
  "birthDate": "2023-03-15"
}
```

### Update Child

Update child details.

```
PATCH /children/:childId
```

**Request Body:**
```json
{
  "name": "Ollie"
}
```

### Delete Child

Delete a child profile.

```
DELETE /children/:childId
```

---

## Schedule Endpoints

### Get Schedule

Get a child's sleep schedule configuration.

```
GET /children/:childId/schedule
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "childId": "uuid",
    "type": "TWO_NAP",
    "wakeWindow1Min": 120,
    "wakeWindow1Max": 150,
    "wakeWindow2Min": 150,
    "wakeWindow2Max": 210,
    "wakeWindow3Min": 210,
    "wakeWindow3Max": 270,
    "nap1Earliest": "08:30",
    "nap1LatestStart": "09:00",
    "nap1MaxDuration": 120,
    "nap1EndBy": "11:00",
    "nap2Earliest": "12:00",
    "nap2LatestStart": "13:00",
    "nap2MaxDuration": 120,
    "nap2EndBy": "15:00",
    "bedtimeEarliest": "17:30",
    "bedtimeLatest": "19:30",
    "bedtimeGoalStart": "19:00",
    "bedtimeGoalEnd": "19:30",
    "wakeTimeEarliest": "06:30",
    "wakeTimeLatest": "07:30",
    "mustWakeBy": "07:30",
    "daySleepCap": 210,
    "minimumCribMinutes": 60
  }
}
```

### Update Schedule

Update a child's schedule configuration.

```
PUT /children/:childId/schedule
```

**Request Body:**
```json
{
  "type": "TWO_NAP",
  "wakeWindow1Min": 120,
  "wakeWindow1Max": 150,
  ...
}
```

---

## Sleep Session Endpoints

### List Sessions

Get sleep sessions for a child.

```
GET /children/:childId/sessions
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Filter from date (ISO 8601) |
| `endDate` | string | Filter to date (ISO 8601) |
| `type` | string | Filter by type: `NAP`, `NIGHT` |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "childId": "uuid",
      "type": "NAP",
      "napNumber": 1,
      "status": "COMPLETED",
      "putDownAt": "2024-01-15T09:00:00Z",
      "asleepAt": "2024-01-15T09:15:00Z",
      "wokeUpAt": "2024-01-15T10:30:00Z",
      "outOfCribAt": "2024-01-15T10:35:00Z",
      "location": "CRIB",
      "qualifiedRest": 82,
      "sleepDuration": 75,
      "cribDuration": 95
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Get Session

Get a specific sleep session.

```
GET /children/:childId/sessions/:sessionId
```

### Create Session (Put Down)

Start a new sleep session.

```
POST /children/:childId/sessions
```

**Request Body:**
```json
{
  "type": "NAP",
  "putDownAt": "2024-01-15T09:00:00Z",
  "location": "CRIB"
}
```

**Location Options:** `CRIB`, `CAR_SEAT`, `STROLLER`, `CARRIER`, `SWING`, `PLAYPEN`, `OTHER`

### Update Session

Update a sleep session (record events).

```
PATCH /children/:childId/sessions/:sessionId
```

**Request Body (Fell Asleep):**
```json
{
  "asleepAt": "2024-01-15T09:15:00Z"
}
```

**Request Body (Woke Up):**
```json
{
  "wokeUpAt": "2024-01-15T10:30:00Z"
}
```

**Request Body (Out of Crib):**
```json
{
  "outOfCribAt": "2024-01-15T10:35:00Z"
}
```

### Delete Session

Delete a sleep session.

```
DELETE /children/:childId/sessions/:sessionId
```

### Get Active Session

Get the currently active sleep session.

```
GET /children/:childId/sessions/active
```

---

## Night Sleep Endpoints

### Start Night Sleep

Begin tracking night sleep (bedtime).

```
POST /children/:childId/night-sleep
```

**Request Body:**
```json
{
  "putDownAt": "2024-01-15T19:00:00Z"
}
```

### Record Night Wake

Log a wake-up during night sleep.

```
POST /children/:childId/night-sleep/:sessionId/wakes
```

**Request Body:**
```json
{
  "wokeUpAt": "2024-01-16T02:30:00Z",
  "asleepAt": "2024-01-16T02:45:00Z"
}
```

### End Night Sleep

Complete the night sleep session (morning wake).

```
PATCH /children/:childId/night-sleep/:sessionId/end
```

**Request Body:**
```json
{
  "outOfCribAt": "2024-01-16T06:45:00Z"
}
```

---

## Recommendation Endpoints

### Get Current Recommendation

Get the next sleep recommendation.

```
GET /children/:childId/recommendation
```

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "NAP",
    "napNumber": 2,
    "status": "READY",
    "targetTime": "2024-01-15T12:30:00Z",
    "earliestTime": "2024-01-15T12:00:00Z",
    "latestTime": "2024-01-15T13:00:00Z",
    "currentWakeWindow": 165,
    "wakeWindowMin": 150,
    "wakeWindowMax": 210,
    "sleepDebt": 15,
    "message": "Oliver is ready for Nap 2"
  }
}
```

**Status Values:**
| Status | Description |
|--------|-------------|
| `WAIT` | Not ready for sleep yet |
| `READY` | Within sleep window |
| `URGENT` | Past optimal window |
| `SLEEPING` | Currently asleep |
| `WAKE` | Should wake baby |

### Get Today's Bedtime

Get calculated bedtime for today.

```
GET /children/:childId/bedtime
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendedTime": "2024-01-15T18:45:00Z",
    "earliestTime": "2024-01-15T17:30:00Z",
    "latestTime": "2024-01-15T19:30:00Z",
    "sleepDebt": 30,
    "adjustment": -15,
    "message": "Bedtime moved 15 min earlier due to sleep debt"
  }
}
```

---

## Analytics Endpoints

### Get Daily Summary

Get sleep summary for a specific day.

```
GET /children/:childId/analytics/daily
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | string | Date (ISO 8601), default: today |

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "totalSleep": 165,
    "totalQualifiedRest": 180,
    "napCount": 2,
    "naps": [
      {
        "napNumber": 1,
        "duration": 90,
        "qualifiedRest": 95,
        "putDownAt": "2024-01-15T08:45:00Z",
        "outOfCribAt": "2024-01-15T10:30:00Z"
      }
    ],
    "nightSleep": {
      "duration": 660,
      "wakeCount": 1,
      "bedtime": "2024-01-14T19:00:00Z",
      "wakeTime": "2024-01-15T06:30:00Z"
    },
    "sleepDebt": 15,
    "daySleepCap": 210,
    "daySleepRemaining": 45
  }
}
```

### Get Weekly Summary

Get sleep summary for the past week.

```
GET /children/:childId/analytics/weekly
```

**Response:**
```json
{
  "success": true,
  "data": {
    "startDate": "2024-01-08",
    "endDate": "2024-01-14",
    "averageDaySleep": 175,
    "averageNightSleep": 655,
    "averageNapCount": 2,
    "averageBedtime": "19:05",
    "averageWakeTime": "06:42",
    "dailySummaries": [...]
  }
}
```

---

## Caregiver Endpoints

### List Caregivers

Get all caregivers for a child.

```
GET /children/:childId/caregivers
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "CAREGIVER",
      "status": "ACTIVE"
    }
  ]
}
```

### Invite Caregiver

Send a caregiver invitation.

```
POST /children/:childId/caregivers/invite
```

**Request Body:**
```json
{
  "email": "grandma@example.com",
  "role": "VIEWER"
}
```

**Role Options:** `CAREGIVER`, `VIEWER`

### Accept Invitation

Accept a caregiver invitation.

```
POST /caregivers/invitations/:invitationId/accept
```

### Remove Caregiver

Remove a caregiver from a child.

```
DELETE /children/:childId/caregivers/:caregiverId
```

---

## Push Notification Endpoints

### Subscribe

Register a push subscription.

```
POST /push/subscribe
```

**Request Body:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "base64_key",
      "auth": "base64_auth"
    }
  }
}
```

### Unsubscribe

Remove a push subscription.

```
DELETE /push/subscribe
```

### Get VAPID Key

Get the public VAPID key for push registration.

```
GET /push/vapid-public-key
```

---

## WebAuthn Endpoints

### Start Registration

Begin passkey registration.

```
POST /auth/webauthn/register/start
```

**Response:**
```json
{
  "success": true,
  "data": {
    "options": {
      "challenge": "base64_challenge",
      "rp": { "name": "DreamTime", "id": "example.com" },
      "user": { ... },
      "pubKeyCredParams": [...],
      "timeout": 60000,
      "attestation": "none"
    }
  }
}
```

### Finish Registration

Complete passkey registration.

```
POST /auth/webauthn/register/finish
```

**Request Body:**
```json
{
  "credential": { ... }
}
```

### Start Authentication

Begin passkey authentication.

```
POST /auth/webauthn/authenticate/start
```

### Finish Authentication

Complete passkey authentication.

```
POST /auth/webauthn/authenticate/finish
```

---

## Nap Transition Endpoints

### Get Transition Status

Get the current nap transition status.

```
GET /children/:childId/transition
```

**Response:**
```json
{
  "success": true,
  "data": {
    "active": true,
    "startDate": "2024-01-01",
    "currentWeek": 3,
    "targetWeeks": 6,
    "currentNapTarget": "12:00",
    "goalNapTarget": "12:30",
    "pushIntervalDays": 5,
    "lastPushDate": "2024-01-10",
    "nextPushDate": "2024-01-15",
    "progress": 50
  }
}
```

### Start Transition

Begin the 2-to-1 nap transition.

```
POST /children/:childId/transition/start
```

**Request Body:**
```json
{
  "pace": "standard",
  "targetWeeks": 6
}
```

**Pace Options:** `standard`, `fast-track`

### Adjust Transition

Modify transition settings.

```
PATCH /children/:childId/transition
```

**Request Body:**
```json
{
  "pushIntervalDays": 7,
  "targetWeeks": 8
}
```

### End Transition

Complete or cancel the transition.

```
DELETE /children/:childId/transition
```

---

## Health Endpoint

### Health Check

Check API server status.

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00Z",
  "version": "1.0.0"
}
```

---

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| Authentication | 10 requests/minute |
| General API | 100 requests/minute |
| Push Notifications | 50 requests/minute |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705316400
```

---

## Webhooks (Coming Soon)

DreamTime will support webhooks for:
- Sleep session events
- Schedule changes
- Caregiver updates

