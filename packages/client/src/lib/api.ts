import { useAuthStore } from '@/store/authStore';

const API_URL = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string | null,
  retryOnUnauthorized = true
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // If unauthorized and we should retry, try refreshing the token
  if (response.status === 401 && retryOnUnauthorized && accessToken) {
    const refreshed = await useAuthStore.getState().refreshAccessToken();
    if (refreshed) {
      // Retry with new token
      const newAccessToken = useAuthStore.getState().accessToken;
      return fetchWithAuth<T>(endpoint, options, newAccessToken, false);
    }
    // Refresh failed, return the error
  }

  const data = await response.json();
  return data;
}

// Children API
export interface Child {
  id: string;
  name: string;
  birthDate: string;
  photoUrl: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export async function getChildren(accessToken: string): Promise<ApiResponse<Child[]>> {
  return fetchWithAuth<Child[]>('/children', { method: 'GET' }, accessToken);
}

export async function createChild(
  accessToken: string,
  data: { name: string; birthDate: string }
): Promise<ApiResponse<Child>> {
  return fetchWithAuth<Child>(
    '/children',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    accessToken
  );
}

export async function deleteChild(
  accessToken: string,
  childId: string
): Promise<ApiResponse<void>> {
  return fetchWithAuth<void>(
    `/children/${childId}`,
    { method: 'DELETE' },
    accessToken
  );
}

export async function updateChild(
  accessToken: string,
  childId: string,
  data: { name?: string; birthDate?: string }
): Promise<ApiResponse<Child>> {
  return fetchWithAuth<Child>(
    `/children/${childId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
    accessToken
  );
}

// Caregiver types and API
export interface CaregiverInfo {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  title: string | null;
  isActive: boolean;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface ChildDetail extends Child {
  caregivers: CaregiverInfo[];
}

export async function getChild(
  accessToken: string,
  childId: string
): Promise<ApiResponse<ChildDetail>> {
  return fetchWithAuth<ChildDetail>(
    `/children/${childId}`,
    { method: 'GET' },
    accessToken
  );
}

export async function shareChild(
  accessToken: string,
  childId: string,
  data: { userId?: string; email?: string; role?: 'CAREGIVER' | 'VIEWER' }
): Promise<ApiResponse<CaregiverInfo>> {
  return fetchWithAuth<CaregiverInfo>(
    `/children/${childId}/share`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    accessToken
  );
}

// User Search API
export interface UserSearchResult {
  id: string;
  email: string;
  name: string;
}

export async function searchUsers(
  accessToken: string,
  query: string
): Promise<ApiResponse<UserSearchResult[]>> {
  return fetchWithAuth<UserSearchResult[]>(
    `/users/search?q=${encodeURIComponent(query)}`,
    { method: 'GET' },
    accessToken
  );
}

export async function removeCaregiver(
  accessToken: string,
  childId: string,
  caregiverUserId: string
): Promise<ApiResponse<{ message: string }>> {
  return fetchWithAuth<{ message: string }>(
    `/children/${childId}/caregivers/${caregiverUserId}`,
    { method: 'DELETE' },
    accessToken
  );
}

export async function toggleCaregiverAccess(
  accessToken: string,
  childId: string,
  caregiverUserId: string,
  isActive: boolean
): Promise<ApiResponse<CaregiverInfo>> {
  return fetchWithAuth<CaregiverInfo>(
    `/children/${childId}/caregivers/${caregiverUserId}/access`,
    {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    },
    accessToken
  );
}

export async function updateCaregiverTitle(
  accessToken: string,
  childId: string,
  caregiverUserId: string,
  title: string
): Promise<ApiResponse<CaregiverInfo>> {
  return fetchWithAuth<CaregiverInfo>(
    `/children/${childId}/caregivers/${caregiverUserId}/title`,
    {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    },
    accessToken
  );
}

export async function updateCaregiverRole(
  accessToken: string,
  childId: string,
  caregiverUserId: string,
  role: 'ADMIN' | 'CAREGIVER' | 'VIEWER'
): Promise<ApiResponse<CaregiverInfo>> {
  return fetchWithAuth<CaregiverInfo>(
    `/children/${childId}/caregivers/${caregiverUserId}/role`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
    accessToken
  );
}

// Sessions API
export type NapLocation = 'CRIB' | 'CAR' | 'STROLLER' | 'CARRIER' | 'SWING' | 'PLAYPEN' | 'OTHER';

export interface SleepSession {
  id: string;
  childId: string;
  sessionType: 'NAP' | 'NIGHT_SLEEP';
  state: 'PENDING' | 'ASLEEP' | 'AWAKE' | 'COMPLETED';
  napNumber: number | null;
  // Ad-hoc nap tracking
  isAdHoc: boolean;
  location: NapLocation;
  putDownAt: string | null;
  asleepAt: string | null;
  wokeUpAt: string | null;
  outOfCribAt: string | null;
  cryingMinutes: number | null;
  notes: string | null;
  totalMinutes: number | null;
  sleepMinutes: number | null;
  settlingMinutes: number | null;
  postWakeMinutes: number | null;
  awakeCribMinutes: number | null;
  qualifiedRestMinutes: number | null;
  // Who logged this entry
  createdByUserId: string | null;
  lastUpdatedByUserId: string | null;
  createdByName: string | null;
  lastUpdatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getSessions(
  accessToken: string,
  childId: string
): Promise<ApiResponse<SleepSession[]>> {
  return fetchWithAuth<SleepSession[]>(
    `/children/${childId}/sessions`,
    { method: 'GET' },
    accessToken
  );
}

export async function createSession(
  accessToken: string,
  childId: string,
  data: {
    sessionType: 'NAP' | 'NIGHT_SLEEP';
    napNumber?: number;
    putDownAt: string;
  }
): Promise<ApiResponse<SleepSession>> {
  return fetchWithAuth<SleepSession>(
    `/children/${childId}/sessions`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    accessToken
  );
}

export async function updateSession(
  accessToken: string,
  childId: string,
  sessionId: string,
  data: {
    event?: 'fell_asleep' | 'woke_up' | 'out_of_crib';
    putDownAt?: string;
    asleepAt?: string;
    wokeUpAt?: string;
    outOfCribAt?: string;
    notes?: string;
  }
): Promise<ApiResponse<SleepSession>> {
  return fetchWithAuth<SleepSession>(
    `/children/${childId}/sessions/${sessionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
    accessToken
  );
}

export async function getActiveSession(
  accessToken: string,
  childId: string
): Promise<ApiResponse<SleepSession | null>> {
  const response = await getSessions(accessToken, childId);
  if (response.success && response.data) {
    const activeSession = response.data.find(
      (s) => s.state !== 'COMPLETED'
    );
    return { success: true, data: activeSession || null };
  }
  return { success: true, data: null };
}

// Create ad-hoc nap (car, stroller, etc.)
// Two modes:
// 1. Start mode: location + asleepAt only - starts real-time tracking in ASLEEP state
// 2. Complete mode: location + asleepAt + wokeUpAt - logs completed nap after the fact
export async function createAdHocSession(
  accessToken: string,
  childId: string,
  data: {
    location: Exclude<NapLocation, 'CRIB'>;
    asleepAt: string;
    wokeUpAt?: string; // Optional - if omitted, starts in ASLEEP state
    notes?: string;
  }
): Promise<ApiResponse<SleepSession>> {
  return fetchWithAuth<SleepSession>(
    `/children/${childId}/sessions/adhoc`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    accessToken
  );
}

// Schedule API
export type ScheduleType = 'THREE_NAP' | 'TWO_NAP' | 'ONE_NAP' | 'TRANSITION';

export interface SleepSchedule {
  id: string;
  childId: string;
  type: ScheduleType;
  isActive: boolean;
  wakeWindow1Min: number;
  wakeWindow1Max: number;
  wakeWindow2Min: number | null;
  wakeWindow2Max: number | null;
  wakeWindow3Min: number | null;
  wakeWindow3Max: number | null;
  nap1Earliest: string | null;
  nap1LatestStart: string | null;
  nap1MaxDuration: number | null;
  nap1EndBy: string | null;
  nap2Earliest: string | null;
  nap2LatestStart: string | null;
  nap2MaxDuration: number | null;
  nap2EndBy: string | null;
  nap2ExceptionDuration: number | null;
  bedtimeEarliest: string;
  bedtimeLatest: string;
  bedtimeGoalStart: string | null;
  bedtimeGoalEnd: string | null;
  wakeTimeEarliest: string;
  wakeTimeLatest: string;
  mustWakeBy: string;
  daySleepCap: number;
  napCapMinutes: number;
  minimumCribMinutes: number;
  // Notification settings (lead time in minutes before event)
  napReminderMinutes: number;
  bedtimeReminderMinutes: number;
  wakeDeadlineReminderMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleTransition {
  id: string;
  childId: string;
  fromType: string;
  toType: string;
  startedAt: string;
  currentWeek: number;
  currentNapTime: string;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  type: ScheduleType;
  wakeWindow1Min: number;
  wakeWindow1Max: number;
  wakeWindow2Min?: number;
  wakeWindow2Max?: number;
  wakeWindow3Min?: number;
  wakeWindow3Max?: number;
  nap1Earliest?: string;
  nap1LatestStart?: string;
  nap1MaxDuration?: number;
  nap1EndBy?: string;
  nap2Earliest?: string;
  nap2LatestStart?: string;
  nap2MaxDuration?: number;
  nap2EndBy?: string;
  nap2ExceptionDuration?: number;
  bedtimeEarliest: string;
  bedtimeLatest: string;
  bedtimeGoalStart?: string;
  bedtimeGoalEnd?: string;
  wakeTimeEarliest: string;
  wakeTimeLatest: string;
  daySleepCap: number;
  minimumCribMinutes?: number;
  // Notification settings (lead time in minutes before event)
  napReminderMinutes?: number;
  bedtimeReminderMinutes?: number;
  wakeDeadlineReminderMinutes?: number;
}

export async function getSchedule(
  accessToken: string,
  childId: string
): Promise<ApiResponse<SleepSchedule>> {
  return fetchWithAuth<SleepSchedule>(
    `/children/${childId}/schedule`,
    { method: 'GET' },
    accessToken
  );
}

export async function saveSchedule(
  accessToken: string,
  childId: string,
  data: CreateScheduleInput
): Promise<ApiResponse<SleepSchedule>> {
  return fetchWithAuth<SleepSchedule>(
    `/children/${childId}/schedule`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    accessToken
  );
}

export async function getTransition(
  accessToken: string,
  childId: string
): Promise<ApiResponse<ScheduleTransition>> {
  return fetchWithAuth<ScheduleTransition>(
    `/children/${childId}/transition`,
    { method: 'GET' },
    accessToken
  );
}

export async function startTransition(
  accessToken: string,
  childId: string,
  data: { fromType: 'TWO_NAP'; toType: 'ONE_NAP'; startNapTime: string }
): Promise<ApiResponse<ScheduleTransition>> {
  return fetchWithAuth<ScheduleTransition>(
    `/children/${childId}/transition`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    accessToken
  );
}

export async function updateTransition(
  accessToken: string,
  childId: string,
  data: { newNapTime?: string; currentWeek?: number; notes?: string; complete?: boolean }
): Promise<ApiResponse<ScheduleTransition>> {
  return fetchWithAuth<ScheduleTransition>(
    `/children/${childId}/transition`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
    accessToken
  );
}

export async function cancelTransition(
  accessToken: string,
  childId: string
): Promise<ApiResponse<{ message: string }>> {
  return fetchWithAuth<{ message: string }>(
    `/children/${childId}/transition`,
    { method: 'DELETE' },
    accessToken
  );
}

// Schedule Calculator API
export interface TimeWindow {
  earliest: string;
  latest: string;
  recommended: string;
}

export interface NextActionRecommendation {
  action: 'NAP' | 'BEDTIME' | 'WAIT' | 'WAKE';
  description: string;
  timeWindow: TimeWindow | null;
  napNumber?: number;
  minutesUntilEarliest?: number;
  notes: string[];
}

export async function getNextAction(
  accessToken: string,
  childId: string
): Promise<ApiResponse<NextActionRecommendation>> {
  return fetchWithAuth<NextActionRecommendation>(
    `/children/${childId}/calculator/next-action`,
    { method: 'GET' },
    accessToken
  );
}

// Today's Summary with consultant bedtime logic
export interface TodaySummaryNap {
  napNumber: number;
  duration: number | null;
  asleepAt: string | null;
  wokeUpAt: string | null;
  status: 'completed' | 'in_progress' | 'upcoming';
}

export interface TodaySummaryAdHocNap {
  id: string;
  location: NapLocation;
  asleepAt: string | null;
  wokeUpAt: string | null;
  sleepMinutes: number | null;
  qualifiedRestMinutes: number | null;
}

export interface TodaySummary {
  wakeTime: string | null;
  currentState: 'awake' | 'asleep' | 'pending';
  completedNaps: number;
  naps: TodaySummaryNap[];
  // Ad-hoc naps (car, stroller, etc.)
  adHocNaps: TodaySummaryAdHocNap[];
  totalAdHocMinutes: number;
  totalAdHocCreditMinutes: number;
  adHocBedtimeBumpMinutes: number; // 15 min bump if any ad-hoc nap was 30+ min
  totalNapMinutes: number; // Qualified rest (includes crib time credit)
  totalActualSleepMinutes: number; // Actual sleep time only
  napGoalMinutes: number;
  recommendedBedtime: string;
  bedtimeWindow: {
    earliest: string;
    latest: string;
    recommended: string;
  };
  bedtimeNotes: string[];
  bedtimeStatus: 'finalized' | 'estimated'; // 'finalized' when all required naps are complete
  sleepDebtMinutes: number;
  sleepDebtNote: string | null;
  scheduleType: string;
  isOnOneNapSchedule: boolean;
}

export async function getTodaySummary(
  accessToken: string,
  childId: string
): Promise<ApiResponse<TodaySummary>> {
  return fetchWithAuth<TodaySummary>(
    `/children/${childId}/calculator/today-summary`,
    { method: 'GET' },
    accessToken
  );
}
