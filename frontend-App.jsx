// src/App.jsx - Main Application Component with Routing

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import VideoPage from './pages/VideoPage';
import ProcessingPage from './pages/ProcessingPage';
import NotFound from './pages/NotFound';

// Components
import Header from './components/Common/Header';
import Sidebar from './components/Common/Sidebar';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Layout Components
const PublicLayout = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
    <Header />
    {children}
  </div>
);

const ProtectedLayout = ({ children }) => (
  <div className="min-h-screen bg-slate-50">
    <Header />
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 pt-20">
        {children}
      </main>
    </div>
  </div>
);

// Main App Component
export default function App() {
  const { user, isLoading, checkAuth } = useAuth();

  useEffect(() => {
    // Check if user is still authenticated on app load
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" />
      
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={
          <PublicLayout>
            <HomePage />
          </PublicLayout>
        } />
        
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" /> : (
            <PublicLayout>
              <LoginPage />
            </PublicLayout>
          )
        } />
        
        <Route path="/register" element={
          user ? <Navigate to="/dashboard" /> : (
            <PublicLayout>
              <RegisterPage />
            </PublicLayout>
          )
        } />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ProtectedLayout>
                <DashboardPage />
              </ProtectedLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/video/:videoId"
          element={
            <ProtectedRoute>
              <ProtectedLayout>
                <VideoPage />
              </ProtectedLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/processing/:jobId"
          element={
            <ProtectedRoute>
              <ProtectedLayout>
                <ProcessingPage />
              </ProtectedLayout>
            </ProtectedRoute>
          }
        />

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
