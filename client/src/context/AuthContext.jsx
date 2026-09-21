import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wb_user')) || null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (token, u) => {
    localStorage.setItem('wb_token', token);
    localStorage.setItem('wb_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('wb_token');
    localStorage.removeItem('wb_user');
    setUser(null);
  }, []);

  const isAdmin = user?.role === 'admin';

  return <AuthContext.Provider value={{ user, login, logout, isAdmin }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}