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
  accessToken?: string | null
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

// Sessions API
export interface SleepSession {
  id: string;
  childId: string;
  sessionType: 'NAP' | 'NIGHT_SLEEP';
  state: 'PENDING' | 'ASLEEP' | 'AWAKE' | 'COMPLETED';
  napNumber: number | null;
  putDownAt: string | null;
  asleepAt: string | null;
  wokeUpAt: string | null;
  outOfCribAt: string | null;
  sleepMinutes: number | null;
  qualifiedRestMinutes: number | null;
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
    event: 'fell_asleep' | 'woke_up' | 'out_of_crib';
    asleepAt?: string;
    wokeUpAt?: string;
    outOfCribAt?: string;
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
