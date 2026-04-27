import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { refresh, logout as logoutApi } from '../lib/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem('agentid_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
        // Verify session is still valid
        refresh().catch(() => {
          setUser(null);
          localStorage.removeItem('agentid_user');
        });
      } catch {
        localStorage.removeItem('agentid_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem('agentid_user', JSON.stringify(userData));
  }, []);

  const logout = useCallback(async () => {
    try { await logoutApi(); } catch {}
    setUser(null);
    localStorage.removeItem('agentid_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthProvider;
