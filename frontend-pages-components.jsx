// src/pages/HomePage.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Zap, Play, Layers, Globe, Sparkles } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          AI-Powered Video Editing
        </h1>
        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          Automatically enhance your videos with AI. Scene detection, color grading, transcription, 
          and more—all in one platform.
        </p>

        <div className="flex gap-4 justify-center mb-12">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Go to Dashboard
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-8 py-3 border border-white text-white rounded-lg font-semibold hover:bg-white hover:text-slate-900 transition"
              >
                Sign Up Free
              </button>
            </>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-slate-800 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Powerful AI Features
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Feature
              icon={<Layers size={32} />}
              title="Scene Detection"
              description="Automatically detect scene changes and create optimal cuts"
            />
            <Feature
              icon={<Play size={32} />}
              title="Color Grading"
              description="Professional color correction and cinematic look"
            />
            <Feature
              icon={<Zap size={32} />}
              title="Speech-to-Text"
              description="99% accurate auto-generated captions"
            />
            <Feature
              icon={<Globe size={32} />}
              title="Multi-Language"
              description="Translate to 50+ languages automatically"
            />
            <Feature
              icon={<Sparkles size={32} />}
              title="Audio Enhancement"
              description="Remove noise and improve audio quality"
            />
            <Feature
              icon={<Play size={32} />}
              title="Auto-Reframing"
              description="Optimize for TikTok, Reels, Instagram"
            />
            <Feature
              icon={<Zap size={32} />}
              title="Effects"
              description="AI-suggested effects and transitions"
            />
            <Feature
              icon={<Globe size={32} />}
              title="Cloud Storage"
              description="Secure S3 storage for all your videos"
            />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 text-center">
        <h2 className="text-4xl font-bold text-white mb-6">
          Ready to Get Started?
        </h2>
        <p className="text-xl text-gray-300 mb-8">
          Transform your videos with AI in just a few clicks
        </p>

        {!isAuthenticated && (
          <button
            onClick={() => navigate('/register')}
            className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition"
          >
            Create Free Account
          </button>
        )}
      </div>
    </div>
  );
}

function Feature({ icon, title, description }) {
  return (
    <div className="text-center">
      <div className="text-blue-400 mb-4 flex justify-center">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-300">{description}</p>
    </div>
  );
}

// ====================================================

// src/pages/NotFound.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-2xl text-gray-300 mb-8">Page Not Found</p>
        <p className="text-gray-400 mb-8">The page you're looking for doesn't exist.</p>

        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}

// ====================================================

// src/components/Common/Header.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Menu } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-md z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            AI
          </div>
          <h1 className="text-xl font-bold text-slate-900">AI Video Editor</h1>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-slate-600">
                {user?.email}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <LogOut size={18} />
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ====================================================

// src/components/Common/Sidebar.jsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, HelpCircle } from 'lucide-react';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  { id: 'help', label: 'Help', icon: HelpCircle, path: '/help' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-20 w-64 h-full bg-white border-r border-slate-200">
      <nav className="p-6 space-y-2">
        {MENU_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
