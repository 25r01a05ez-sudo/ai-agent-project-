// src/context/AuthContext.jsx - Global Authentication State

import React, { createContext, useState, useCallback } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check authentication status on load
  const checkAuth = useCallback(async () => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  // Register new user
  const register = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authAPI.register(email, password);
      
      const { user: userData, token: userToken } = response;
      
      // Save to localStorage
      localStorage.setItem('token', userToken);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Update state
      setUser(userData);
      setToken(userToken);
      
      toast.success('Registration successful!');
      return userData;
    } catch (err) {
      const message = err.message || 'Registration failed';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Login user
  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authAPI.login(email, password);
      
      const { user: userData, token: userToken } = response;
      
      // Save to localStorage
      localStorage.setItem('token', userToken);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Update state
      setUser(userData);
      setToken(userToken);
      
      toast.success('Login successful!');
      return userData;
    } catch (err) {
      const message = err.message || 'Login failed';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout user
  const logout = useCallback(() => {
    authAPI.logout();
    setUser(null);
    setToken(null);
    setError(null);
    toast.success('Logged out successfully');
  }, []);

  // Check if user is authenticated
  const isAuthenticated = !!user && !!token;

  const value = {
    user,
    token,
    isLoading,
    error,
    register,
    login,
    logout,
    checkAuth,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
