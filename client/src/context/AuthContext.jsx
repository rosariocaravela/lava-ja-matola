import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('lavaja_token');
    if (token) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadProfile() {
    try {
      const data = await apiRequest('/auth/me');
      setUser(data.user);
      setLoyalty(data.loyalty);
      return data.user;
    } catch (err) {
      console.warn('Sessão expirada:', err);
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('lavaja_token', data.token);
    setUser(data.user);
    return await loadProfile();
  }

  async function register(name, email, password, phone) {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone }),
    });
    localStorage.setItem('lavaja_token', data.token);
    setUser(data.user);
    await loadProfile();
    return data.user;
  }

  function logout() {
    localStorage.removeItem('lavaja_token');
    setUser(null);
    setLoyalty(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loyalty,
        loading,
        login,
        register,
        logout,
        refreshProfile: loadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
