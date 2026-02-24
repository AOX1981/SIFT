import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';

interface AuthState {
  token: string | null;
  user: any | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sift_token'));
  const [user, setUser] = useState<any | null>(() => {
    const stored = localStorage.getItem('sift_user');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (token) {
      api.setToken(token);
    }
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setToken(result.data.token);
    setUser(result.data.user);
    localStorage.setItem('sift_token', result.data.token);
    localStorage.setItem('sift_user', JSON.stringify(result.data.user));
    api.setToken(result.data.token);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const result = await api.register(email, password, name);
    setToken(result.data.token);
    setUser(result.data.user);
    localStorage.setItem('sift_token', result.data.token);
    localStorage.setItem('sift_user', JSON.stringify(result.data.user));
    api.setToken(result.data.token);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('sift_token');
    localStorage.removeItem('sift_user');
    api.setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
