# Caregiver Sharing

Share access to your child's sleep tracking with family members and caregivers.

## Overview

DreamTime allows you to share your child's profile with other users. Each person has their own login but can view and track the same child, with permissions based on their role.

---

## Roles

### Admin

The child's owner (person who created the profile).

| Permission | Allowed |
|------------|---------|
| View sleep data | Yes |
| Track sleep (put down, asleep, etc.) | Yes |
| Edit schedule | Yes |
| View analytics | Yes |
| Invite caregivers | Yes |
| Remove caregivers | Yes |
| Delete child | Yes |

### Caregiver

Full tracking permissions without admin access.

| Permission | Allowed |
|------------|---------|
| View sleep data | Yes |
| Track sleep (put down, asleep, etc.) | Yes |
| Edit schedule | No |
| View analytics | Yes |
| Invite caregivers | No |
| Remove caregivers | No |
| Delete child | No |

### Viewer

Read-only access to see sleep data.

| Permission | Allowed |
|------------|---------|
| View sleep data | Yes |
| Track sleep (put down, asleep, etc.) | No |
| Edit schedule | No |
| View analytics | Yes |
| Invite caregivers | No |
| Remove caregivers | No |
| Delete child | No |

---

## Inviting Caregivers

### Step 1: Access Caregiver Settings

1. Open DreamTime
2. Select your child from the dropdown
3. Tap the **Settings** tab
4. Scroll to **Caregivers** section

### Step 2: Send Invitation

```
┌─────────────────────────────────────┐
│  👥 Caregivers                      │
├─────────────────────────────────────┤
│                                     │
│  Current Caregivers:                │
│  • You (Admin)                      │
│  • Jane Doe (Caregiver)             │
│                                     │
│  ─────────────────────────          │
│                                     │
│  [+ Invite Caregiver]               │
│                                     │
└─────────────────────────────────────┘
```

1. Tap **+ Invite Caregiver**
2. Enter the caregiver's email address
3. Select their role (Caregiver or Viewer)
4. Tap **Send Invitation**

### Step 3: Invitation Email

The invited person receives an email:

```
Subject: You've been invited to track Oliver's sleep

Hi!

[Your Name] has invited you to help track Oliver's sleep
on DreamTime.

Click the link below to accept:
[Accept Invitation]

If you don't have a DreamTime account, you'll be
prompted to create one.
```

---

## Accepting Invitations

### For New Users

1. Click the link in the invitation email
2. Create a DreamTime account
3. The child is automatically added to your dashboard
4. Start tracking!

### For Existing Users

1. Click the link in the invitation email
2. Log in to your existing account (if not already logged in)
3. The child appears in your child selector
4. Your permissions match your assigned role

---

## Managing Caregivers

### Viewing Caregivers

As an Admin, you can see all caregivers:

```
┌─────────────────────────────────────┐
│  Caregivers for Oliver              │
├─────────────────────────────────────┤
│                                     │
│  👤 You                             │
│     Admin • Owner                   │
│                                     │
│  👤 Jane Doe                        │
│     Caregiver • jane@example.com    │
│     [Change Role] [Remove]          │
│                                     │
│  👤 Grandma                         │
│     Viewer • grandma@example.com    │
│     [Change Role] [Remove]          │
│                                     │
│  ⏳ Pending Invitations             │
│     uncle@example.com (Caregiver)   │
│     [Cancel]                        │
│                                     │
└─────────────────────────────────────┘
```

### Changing Roles

1. Find the caregiver in the list
2. Tap **Change Role**
3. Select the new role
4. Confirm the change

Role changes take effect immediately.

### Removing Caregivers

1. Find the caregiver in the list
2. Tap **Remove**
3. Confirm removal

The child will no longer appear in their dashboard.

### Canceling Invitations

1. Find the pending invitation
2. Tap **Cancel**
3. The invitation link becomes invalid

---

## Using Multiple Children

### As an Admin

If you're the admin for multiple children, each child has its own caregiver list. Inviting someone to one child does not give them access to others.

### As a Caregiver

If you're a caregiver for multiple children:

1. All children appear in your child selector
2. Your role may differ per child
3. Switch between children using the dropdown

```
[Oliver ▼]
├── Oliver (Caregiver)
├── Emma (Viewer)
└── + Add Child
```

---

## Synchronization

### Real-Time Updates

All caregivers see updates in real-time:

- Sleep events (put down, asleep, woke up, out of crib)
- Schedule changes (admin only can edit)
- Analytics updates

### Conflict Resolution

If two people tap a button simultaneously:

1. First action is recorded
2. Second person sees updated state
3. No duplicate events are created

### Offline Handling

When a caregiver is offline:

1. Actions are queued locally
2. Sync occurs when reconnected
3. Server timestamp determines order
4. Conflicts resolved automatically

---

## Notifications

### Who Gets Notifications

| Notification Type | Admin | Caregiver | Viewer |
|-------------------|-------|-----------|--------|
| Nap reminder | Yes | Yes | No |
| Bedtime reminder | Yes | Yes | No |
| Wake deadline | Yes | Yes | No |
| Nap cap warning | Yes | Yes | No |

### Configuring Notifications

Each user controls their own notification preferences:

1. Go to **Settings** > **Notifications**
2. Enable/disable notification types
3. Set reminder intervals

Notification settings are per-user, not shared.

---

## Best Practices

### Communication

- Discuss the sleep schedule with all caregivers
- Ensure everyone understands wake windows
- Share the Getting Started guide

### Consistency

- Use the same tracking flow (put down → asleep → woke up → out)
- Log times promptly (or use time adjustment)
- Follow the app's recommendations

### Roles

- Give **Caregiver** role to active trackers (partners, nannies)
- Give **Viewer** role to interested family members
- Review caregiver list periodically

---

## Privacy & Security

### Data Access

Caregivers can only see:
- Sleep sessions for shared children
- Schedule configuration (view only unless admin)
- Analytics for shared children

Caregivers cannot see:
- Your account details
- Your other children (unless shared)
- Other caregivers' account details

### Removing Access

When you remove a caregiver:
- Immediate loss of access
- No notification sent to them
- Their historical actions remain logged

### Leaving a Child

Caregivers can remove themselves:

1. Go to **Settings**
2. Find the child
3. Tap **Leave**
4. Confirm removal

---

## Troubleshooting

### Invitation Not Received

1. Check spam/junk folder
2. Verify the email address was entered correctly
3. Cancel and resend the invitation
4. Try a different email address

### Can't See Child After Accepting

1. Log out and log back in
2. Pull to refresh the dashboard
3. Check that invitation wasn't canceled
4. Contact the admin to verify

### Wrong Role Assigned

1. Contact the admin
2. Admin can change your role in Settings
3. Changes take effect immediately

### Tracking Buttons Disabled

You may have **Viewer** role:
1. Check your role in Settings
2. Ask admin to upgrade to **Caregiver**
3. Viewers can only view, not track

