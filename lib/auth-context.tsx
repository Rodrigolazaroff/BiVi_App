'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: User | null;
  signup: (email: string, firstName: string, lastName: string, password: string) => void;
  login: (email: string, password: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('bivi_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load user:', e);
      }
    }
    setIsLoading(false);
  }, []);

  const signup = (email: string, firstName: string, lastName: string, password: string) => {
    // Mock: just store in localStorage
    const newUser: User = { email, firstName, lastName };
    localStorage.setItem('bivi_user', JSON.stringify(newUser));
    localStorage.setItem(`bivi_password_${email}`, password); // Mock password storage (not secure!)
    setUser(newUser);
  };

  const login = (email: string, password: string) => {
    // Mock: check localStorage
    const storedPassword = localStorage.getItem(`bivi_password_${email}`);
    if (storedPassword === password) {
      const stored = localStorage.getItem('bivi_user');
      if (stored) {
        const userData = JSON.parse(stored);
        setUser(userData);
        return;
      }
    }
    throw new Error('Email o contraseña incorrectos');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bivi_user');
  };

  return (
    <AuthContext.Provider value={{ user, signup, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
