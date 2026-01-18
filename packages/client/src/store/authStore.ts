import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setAccessToken: (token: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const API_URL = '/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Login failed');
          }

          const data = await response.json();
          const { user, tokens } = data.data;

          get().setAuth(user, tokens.accessToken, tokens.refreshToken);
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (name: string, email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Registration failed');
          }

          const data = await response.json();
          const { user, tokens } = data.data;

          get().setAuth(user, tokens.accessToken, tokens.refreshToken);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        // Optionally call logout endpoint to invalidate refresh token
        const { refreshToken } = get();
        if (refreshToken) {
          fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          }).catch(() => {
            // Ignore errors on logout
          });
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'dreamtime-auth',
      version: 1,
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // Migration from version 0 (without accessToken) to version 1
        if (version === 0) {
          // Clear old auth state since we don't have the accessToken
          return {
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          };
        }
        return persistedState as {
          user: User | null;
          accessToken: string | null;
          refreshToken: string | null;
          isAuthenticated: boolean;
        };
      },
    }
  )
);
