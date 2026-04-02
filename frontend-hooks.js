// src/hooks/useAuth.js - Auth Hook

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  
  return context;
};

// ==========================================

// src/hooks/useVideo.js - Video Management Hook

import { useState, useCallback } from 'react';
import { videoAPI, uploadVideoWithProgress } from '../services/api';
import toast from 'react-hot-toast';

export const useVideo = () => {
  const [videos, setVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch all videos
  const fetchVideos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await videoAPI.getVideos();
      setVideos(response.videos || []);
      return response.videos;
    } catch (err) {
      const message = err.message || 'Failed to fetch videos';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch single video
  const fetchVideo = useCallback(async (videoId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await videoAPI.getVideo(videoId);
      setCurrentVideo(response.video);
      return response.video;
    } catch (err) {
      const message = err.message || 'Failed to fetch video';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Upload video
  const uploadVideo = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    setUploadProgress(0);
    
    try {
      const response = await uploadVideoWithProgress(file, setUploadProgress);
      
      // Add to videos list
      setVideos(prev => [response.video, ...prev]);
      
      toast.success('Video uploaded successfully!');
      setUploadProgress(0);
      return response.video;
    } catch (err) {
      const message = err.message || 'Upload failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete video
  const deleteVideo = useCallback(async (videoId) => {
    try {
      await videoAPI.deleteVideo(videoId);
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Video deleted');
      return true;
    } catch (err) {
      const message = err.message || 'Delete failed';
      toast.error(message);
      return false;
    }
  }, []);

  return {
    videos,
    currentVideo,
    isLoading,
    error,
    uploadProgress,
    fetchVideos,
    fetchVideo,
    uploadVideo,
    deleteVideo,
  };
};

// ==========================================

// src/hooks/useProcessing.js - Processing Hook

import { useState, useCallback } from 'react';
import { processingAPI, pollJobStatus } from '../services/api';
import toast from 'react-hot-toast';

export const useProcessing = () => {
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  // Start processing
  const startProcessing = useCallback(async (videoId, features) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      const response = await processingAPI.startProcessing(videoId, features);
      setJob(response.job);
      toast.success('Processing started!');
      return response.job;
    } catch (err) {
      const message = err.message || 'Failed to start processing';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get job status
  const getJobStatus = useCallback(async (jobId) => {
    try {
      const response = await processingAPI.getJobStatus(jobId);
      setJob(response.job);
      setProgress(response.job.progress);
      return response;
    } catch (err) {
      const message = err.message || 'Failed to fetch status';
      setError(message);
    }
  }, []);

  // Poll job until completion
  const pollJob = useCallback(async (jobId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await pollJobStatus(jobId, (updatedJob) => {
        setJob(updatedJob);
        setProgress(updatedJob.progress);
      });
      
      toast.success('Processing completed!');
      return response;
    } catch (err) {
      const message = err.message || 'Processing failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cancel job
  const cancelJob = useCallback(async (jobId) => {
    try {
      await processingAPI.cancelJob(jobId);
      toast.success('Job cancelled');
      return true;
    } catch (err) {
      const message = err.message || 'Failed to cancel';
      toast.error(message);
      return false;
    }
  }, []);

  return {
    job,
    isLoading,
    error,
    progress,
    startProcessing,
    getJobStatus,
    pollJob,
    cancelJob,
  };
};
