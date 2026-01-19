// Enum types for database values
// These match the string values stored in SQLite

export const Role = {
  ADMIN: 'ADMIN',
  CAREGIVER: 'CAREGIVER',
  VIEWER: 'VIEWER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const InviteStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
} as const;

export type InviteStatus = (typeof InviteStatus)[keyof typeof InviteStatus];

export const ScheduleType = {
  THREE_NAP: 'THREE_NAP',
  TWO_NAP: 'TWO_NAP',
  ONE_NAP: 'ONE_NAP',
  TRANSITION: 'TRANSITION',
} as const;

export type ScheduleType = (typeof ScheduleType)[keyof typeof ScheduleType];

export const SessionType = {
  NAP: 'NAP',
  NIGHT_SLEEP: 'NIGHT_SLEEP',
} as const;

export type SessionType = (typeof SessionType)[keyof typeof SessionType];

export const SessionState = {
  PENDING: 'PENDING',
  ASLEEP: 'ASLEEP',
  AWAKE: 'AWAKE',
  COMPLETED: 'COMPLETED',
} as const;

export type SessionState = (typeof SessionState)[keyof typeof SessionState];

export const NapLocation = {
  CRIB: 'CRIB',
  CAR: 'CAR',
  STROLLER: 'STROLLER',
  CARRIER: 'CARRIER',
  SWING: 'SWING',
  PLAYPEN: 'PLAYPEN',
  OTHER: 'OTHER',
} as const;

export type NapLocation = (typeof NapLocation)[keyof typeof NapLocation];

// Validation helpers
export function isValidRole(value: string): value is Role {
  return Object.values(Role).includes(value as Role);
}

export function isValidInviteStatus(value: string): value is InviteStatus {
  return Object.values(InviteStatus).includes(value as InviteStatus);
}

export function isValidScheduleType(value: string): value is ScheduleType {
  return Object.values(ScheduleType).includes(value as ScheduleType);
}

export function isValidSessionType(value: string): value is SessionType {
  return Object.values(SessionType).includes(value as SessionType);
}

export function isValidSessionState(value: string): value is SessionState {
  return Object.values(SessionState).includes(value as SessionState);
}

export function isValidNapLocation(value: string): value is NapLocation {
  return Object.values(NapLocation).includes(value as NapLocation);
}

// State machine validation for sleep sessions
// Supports multiple wake/sleep cycles:
// - PENDING can go to ASLEEP (normal) or COMPLETED (baby never fell asleep)
// - ASLEEP can go to AWAKE (baby woke up) or COMPLETED (ad-hoc naps skip AWAKE)
// - AWAKE can go to ASLEEP (baby fell back asleep) or COMPLETED (taken out)
const validStateTransitions: Record<SessionState, SessionState[]> = {
  [SessionState.PENDING]: [SessionState.ASLEEP, SessionState.COMPLETED],
  [SessionState.ASLEEP]: [SessionState.AWAKE, SessionState.COMPLETED], // COMPLETED for ad-hoc naps
  [SessionState.AWAKE]: [SessionState.ASLEEP, SessionState.COMPLETED],
  [SessionState.COMPLETED]: [],
};

export function isValidStateTransition(
  currentState: SessionState,
  newState: SessionState
): boolean {
  return validStateTransitions[currentState].includes(newState);
}
