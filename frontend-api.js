// src/services/api.js - API Client for Backend Communication

import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    return Promise.reject({ message, status: error.response?.status });
  }
);

// ==================== AUTH ENDPOINTS ====================

export const authAPI = {
  register: (email, password) =>
    api.post('/api/auth/register', { email, password }),
  
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};

// ==================== VIDEO ENDPOINTS ====================

export const videoAPI = {
  uploadVideo: (file) => {
    const formData = new FormData();
    formData.append('video', file);
    
    return api.post('/api/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        return percentCompleted;
      },
    });
  },
  
  getVideos: () =>
    api.get('/api/videos'),
  
  getVideo: (videoId) =>
    api.get(`/api/videos/${videoId}`),
  
  deleteVideo: (videoId) =>
    api.delete(`/api/videos/${videoId}`),
};

// ==================== PROCESSING ENDPOINTS ====================

export const processingAPI = {
  startProcessing: (videoId, features) =>
    api.post('/api/process/start', {
      videoId,
      features,
    }),
  
  getJobStatus: (jobId) =>
    api.get(`/api/process/${jobId}`),
  
  getJobProgress: (jobId) => {
    // Poll for progress updates
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        try {
          const response = await api.get(`/api/process/${jobId}`);
          resolve(response);
          clearInterval(interval);
        } catch (error) {
          // Continue polling on error
        }
      }, 5000); // Poll every 5 seconds
    });
  },
  
  downloadResult: (jobId, feature) =>
    api.get(`/api/download/${jobId}/${feature}`),
  
  cancelJob: (jobId) =>
    api.post(`/api/process/${jobId}/cancel`),
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Upload video with progress tracking
 */
export const uploadVideoWithProgress = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('video', file);
  
  try {
    const response = await axios.post(`${API_URL}/api/videos/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress?.(percentCompleted);
      },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || error.message;
  }
};

/**
 * Poll job status until completion
 */
export const pollJobStatus = async (jobId, onProgress, maxAttempts = 240) => {
  let attempts = 0;
  
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        clearInterval(interval);
        reject(new Error('Processing timeout'));
        return;
      }
      
      try {
        const response = await processingAPI.getJobStatus(jobId);
        onProgress?.(response.job);
        
        if (response.job.status === 'completed') {
          clearInterval(interval);
          resolve(response);
        } else if (response.job.status === 'failed') {
          clearInterval(interval);
          reject(new Error(response.job.error_message || 'Processing failed'));
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 5000); // Poll every 5 seconds (= 20 min max with 240 attempts)
  });
};

/**
 * Download file from URL
 */
export const downloadFile = (url, filename) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default api;
