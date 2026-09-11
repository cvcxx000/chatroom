import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'chatroom_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: unwrap { success, data } / { success, error, code }
api.interceptors.response.use(
  (response) => {
    const body = response.data;
    // File downloads / raw responses
    if (response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer') {
      return response;
    }
    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success) {
        return body.data;
      }
      const err = new ApiError(body.error || '请求失败', body.code, response.status);
      // Handle 403 banned
      if (body.code === 'USER_BANNED' || response.status === 403) {
        setToken(null);
        localStorage.removeItem('chatroom_user');
        if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/admin')) {
          location.href = '/login?banned=1';
        }
      }
      return Promise.reject(err);
    }
    return body;
  },
  (error: AxiosError<any>) => {
    const status = error.response?.status;
    const body = error.response?.data;
    const message =
      (body && typeof body === 'object' && body.error) ||
      error.message ||
      '网络错误，请稍后重试';
    const code = (body && typeof body === 'object' && body.code) || undefined;

    if (status === 401) {
      setToken(null);
      localStorage.removeItem('chatroom_user');
      if (
        !location.pathname.startsWith('/login') &&
        !location.pathname.startsWith('/register') &&
        !location.pathname.startsWith('/setup') &&
        !location.pathname.startsWith('/admin')
      ) {
        location.href = '/login?expired=1';
      }
    }
    if (status === 403) {
      setToken(null);
      localStorage.removeItem('chatroom_user');
      if (!location.pathname.startsWith('/admin')) {
        location.href = '/admin/login?banned=1';
      }
    }
    return Promise.reject(new ApiError(message, code, status));
  },
);

export default api;
