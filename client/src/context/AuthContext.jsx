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
    await loadProfile();
    return data.user;
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

  // Quick switch for demonstration during the hackathon
  async function quickSwitchDemo(role) {
    if (role === 'admin') {
      return login('admin@lavaja.co.mz', 'admin123');
    } else if (role === 'employee') {
      return login('funcionario@lavaja.co.mz', 'func123');
    } else if (role === 'customer') {
      return login('cliente@lavaja.co.mz', 'cliente123');
    }
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
        quickSwitchDemo,
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
