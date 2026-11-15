import { useState, useEffect } from 'react';
import { apiFetch, API_URL } from '../utils/api';
import { AuthContext } from './AuthContextInstance';

export { AuthContext };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Silent Refresh on Mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = localStorage.getItem('userInfo');
        if (storedUser) {
          try {
            JSON.parse(storedUser);
          } catch {
            localStorage.removeItem('userInfo');
            setLoading(false);
            return;
          }
          
          // Attempt silent refresh to get access token
          const res = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'GET',
            credentials: 'include'
          });

          if (res.ok) {
            const data = await res.json();
            login(data);
          } else {
            logout(); // Refresh failed, clear state
          }
        }
      } catch (e) {
        console.error("Auth init error:", e);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = (userData) => {
    // DO NOT store the token in localStorage for security (XSS prevention)
    const safeUserData = { ...userData };
    delete safeUserData.token;
    localStorage.setItem('userInfo', JSON.stringify(safeUserData));
    
    // Store full userData (including token) in React state
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiFetch(`${API_URL}/api/auth/logout`, { 
        method: 'POST'
      }, null, null, null);
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('userInfo');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
