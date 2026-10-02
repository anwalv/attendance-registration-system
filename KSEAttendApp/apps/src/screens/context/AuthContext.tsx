import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const API_BASE = 'https://attendance-registration-system-1.onrender.com';

export type AppRole = 'student' | 'teacher' | 'admin' | 'none';

export interface AuthUser {
  user_id: number;
  email: string;
  name?: string;
  global_role: string;
}

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  availableRoles: AppRole[];
  activeRole: AppRole;
  switchRole: (role: AppRole) => void;
  setToken: (token: string) => void;
  logout: () => void;
  authHeader: () => { Authorization: string } | {};
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  isLoading: true,
  user: null,
  setUser: () => {},
  availableRoles: [],
  activeRole: 'none',
  switchRole: () => {},
  setToken: () => {},
  logout: () => {},
  authHeader: () => ({}),
});

export function parseJwt(token: string): AuthUser | null {
  try {
    let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      if (pad === 1) throw new Error('Invalid base64');
      base64 += new Array(5 - pad).join('=');
    }
    const json = decodeURIComponent(
      atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(json) as AuthUser;
  } catch (e) {
    console.error('[AuthContext] parseJwt error:', e);
    return null;
  }
}

async function resolveAvailableRoles(
  parsed: AuthUser,
  token: string
): Promise<{ roles: AppRole[]; defaultRole: AppRole }> {
  if (parsed.global_role === 'admin') {
    return { roles: ['admin'], defaultRole: 'admin' };
  }

  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.warn('[AuthContext] /users/me failed:', res.status);
      return { roles: ['none'], defaultRole: 'none' };
    }

    const me = await res.json();
    const enrollments: { role: string; course_id: number; course_name: string }[] =
      me.enrollments ?? [];

    const hasStudent = enrollments.some((e) => e.role === 'student');
    const hasTeacher = enrollments.some((e) => e.role === 'teacher');

    let roles: AppRole[] = [];
    if (hasStudent) roles.push('student');
    if (hasTeacher) roles.push('teacher');

    if (roles.length === 0) {
      return { roles: ['none'], defaultRole: 'none' };
    }

    const defaultRole: AppRole = hasTeacher ? 'teacher' : 'student';

    return { roles, defaultRole };
  } catch (e) {
    console.error('[AuthContext] resolveAvailableRoles error:', e);
    return { roles: ['none'], defaultRole: 'none' }; // Безпечний фолбек
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole>('none');
  const [isLoading, setIsLoading] = useState(true);
  
  const applyToken = async (newToken: string) => {
    const parsed = parseJwt(newToken);
    setTokenState(newToken);
    setUser(parsed);
    await AsyncStorage.setItem('jwt_token', newToken);

    if (parsed) {
      const { roles, defaultRole } = await resolveAvailableRoles(parsed, newToken);
      setAvailableRoles(roles);
      setActiveRole(defaultRole);
      await AsyncStorage.setItem('active_role', defaultRole);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'web') {
        const url = window.location.href;
        const match = url.match(/[?&]token=([^&#]+)/);
        if (match?.[1]) {
          window.history.replaceState({}, document.title, window.location.pathname);
          await applyToken(match[1]);
          setIsLoading(false);
          return;
        }
      }
      const stored = await AsyncStorage.getItem('jwt_token');
      if (stored) {
        const parsed = parseJwt(stored);
        setTokenState(stored);
        setUser(parsed);
        if (parsed) {
          const { roles, defaultRole } = await resolveAvailableRoles(parsed, stored);
          setAvailableRoles(roles);
          const savedRole = (await AsyncStorage.getItem('active_role')) as AppRole | null;
          const active = savedRole && roles.includes(savedRole) ? savedRole : defaultRole;
          setActiveRole(active);
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const setToken = (t: string) => applyToken(t);

  const switchRole = async (role: AppRole) => {
    if (availableRoles.includes(role)) {
      setActiveRole(role);
      await AsyncStorage.setItem('active_role', role);
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['jwt_token', 'active_role']);
    setTokenState(null);
    setUser(null);
    setAvailableRoles([]);
    setActiveRole('none');
  };

  const authHeader = () =>
    token ? { Authorization: `Bearer ${token}` } : {};

  return (
    <AuthContext.Provider value={{
      token, 
      isLoading,
      user, 
      setUser,
      availableRoles, 
      activeRole,
      switchRole, 
      setToken, 
      logout, 
      authHeader,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);