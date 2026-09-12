import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../api/auth';
import { getToken, setToken } from '../api/client';
import type { User } from '../types';

const USER_KEY = 'chatroom_user';
const ADMIN_KEY = 'chatroom_admin';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<User>;
  adminLogin: (username: string, password: string) => Promise<User>;
  loginWithToken: (token: string, user: User) => Promise<User>;
  register: (payload: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }) => Promise<User>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function normalizeUser(raw: any): User {
  if (!raw) return raw;
  return {
    ...raw,
    displayName: raw.displayName ?? raw.display_name ?? '',
    avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
    isAdmin: raw.isAdmin ?? raw.is_admin ?? false,
    isBanned: raw.isBanned ?? raw.is_banned ?? false,
    isVerified: raw.isVerified ?? raw.is_verified ?? false,
  };
}

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [loading, setLoading] = useState<boolean>(!getToken());

  const persist = useCallback((t: string | null, u: User | null) => {
    setToken(t);
    setTokenState(t);
    if (u) {
      const norm = normalizeUser(u);
      localStorage.setItem(USER_KEY, JSON.stringify(norm));
      setUser(norm);
    } else {
      localStorage.removeItem(USER_KEY);
      setUser(null);
    }
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const { token, user } = await authApi.login({ username, password });
      persist(token, user);
      return normalizeUser(user);
    },
    [persist],
  );

  const adminLogin = useCallback(
    async (username: string, password: string) => {
      const { token, user } = await authApi.adminLogin({ username, password });
      const norm = normalizeUser(user);
      if (!norm.isAdmin) {
        throw new Error('该账号不是管理员');
      }
      localStorage.setItem(ADMIN_KEY, '1');
      persist(token, norm);
      return norm;
    },
    [persist],
  );

  const loginWithToken = useCallback(
    async (token: string, user: User) => {
      persist(token, user);
      return normalizeUser(user);
    },
    [persist],
  );

  const register = useCallback(
    async (payload: { username: string; email: string; password: string; displayName?: string }) => {
      const { token, user } = await authApi.register(payload);
      persist(token, user);
      return normalizeUser(user);
    },
    [persist],
  );

  const logout = useCallback(() => {
    persist(null, null);
    localStorage.removeItem(ADMIN_KEY);
  }, [persist]);

  const refreshMe = useCallback(async () => {
    if (!getToken()) return;
    try {
      const me = await authApi.me();
      persist(getToken(), me);
    } catch {
      // ignore; interceptor will redirect on 401
    } finally {
      setLoading(false);
    }
  }, [persist]);

  // On mount, if we have a token, fetch /me to validate.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await authApi.me();
        if (!cancelled) {
          const norm = normalizeUser(me);
          const raw = getToken();
          setToken(raw);
          setTokenState(raw);
          localStorage.setItem(USER_KEY, JSON.stringify(norm));
          setUser(norm);
        }
      } catch {
        if (!cancelled) {
          persist(null, null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persist]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      isAdmin: Boolean(user?.isAdmin),
      login,
      adminLogin,
      loginWithToken,
      register,
      logout,
      refreshMe,
    }),
    [user, token, loading, login, adminLogin, loginWithToken, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
