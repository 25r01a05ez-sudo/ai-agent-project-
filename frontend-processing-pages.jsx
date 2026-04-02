// src/pages/VideoPage.jsx - Feature Selection & Processing Start

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVideo } from '../hooks/useVideo';
import { useProcessing } from '../hooks/useProcessing';
import { Play, Loader, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const FEATURES = [
  {
    id: 'sceneDetection',
    name: 'Scene Detection',
    description: 'Automatically detects scene changes and creates optimal cuts',
    icon: '✂️',
  },
  {
    id: 'colorGrading',
    name: 'Color Grading',
    description: 'Professional color correction and cinematic look',
    icon: '🎨',
  },
  {
    id: 'speechToText',
    name: 'Speech-to-Text',
    description: 'Auto-generate captions from audio (99% accuracy)',
    icon: '📝',
  },
  {
    id: 'audioEnhancement',
    name: 'Audio Enhancement',
    description: 'Remove background noise and improve audio quality',
    icon: '🔊',
  },
  {
    id: 'multiLanguage',
    name: 'Multi-Language Subtitles',
    description: 'Translate captions to 50+ languages automatically',
    icon: '🌍',
  },
  {
    id: 'autoReframing',
    name: 'Auto-Reframing',
    description: 'Optimize for TikTok, Reels, Instagram, and more',
    icon: '📱',
  },
  {
    id: 'effectSuggestions',
    name: 'Effect Suggestions',
    description: 'AI-recommended effects and transitions',
    icon: '✨',
  },
];

export default function VideoPage() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { currentVideo, fetchVideo, isLoading: videoLoading } = useVideo();
  const { startProcessing, isLoading: processingLoading } = useProcessing();
  const [selectedFeatures, setSelectedFeatures] = useState({
    sceneDetection: true,
    colorGrading: true,
    speechToText: true,
    audioEnhancement: true,
    multiLanguage: true,
    autoReframing: true,
    effectSuggestions: true,
  });
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    fetchVideo(videoId);
  }, [videoId, fetchVideo]);

  const toggleFeature = (featureId) => {
    setSelectedFeatures(prev => ({
      ...prev,
      [featureId]: !prev[featureId],
    }));
  };

  const selectAll = () => {
    const allTrue = Object.values(selectedFeatures).every(v => v);
    const newState = {};
    Object.keys(selectedFeatures).forEach(key => {
      newState[key] = !allTrue;
    });
    setSelectedFeatures(newState);
  };

  const handleStartProcessing = async () => {
    const selectedCount = Object.values(selectedFeatures).filter(Boolean).length;
    
    if (selectedCount === 0) {
      toast.error('Please select at least one feature');
      return;
    }

    setIsStarting(true);
    try {
      const job = await startProcessing(videoId, selectedFeatures);
      navigate(`/processing/${job.id}`);
    } catch (error) {
      console.error('Error starting processing:', error);
      setIsStarting(false);
    }
  };

  if (videoLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (!currentVideo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Video not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:underline"
          >
            Go back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const selectedCount = Object.values(selectedFeatures).filter(Boolean).length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Dashboard
      </button>

      {/* Video Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {currentVideo.original_filename}
        </h1>
        <div className="flex gap-6 text-slate-600">
          <span>Duration: {Math.round(currentVideo.duration)} seconds</span>
          <span>Resolution: {currentVideo.resolution}</span>
          <span>FPS: {currentVideo.fps}</span>
        </div>
      </div>

      {/* Features Selection */}
      <div className="bg-white rounded-lg shadow p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Select Features</h2>
          <button
            onClick={selectAll}
            className="text-sm text-blue-600 hover:underline"
          >
            {Object.values(selectedFeatures).every(v => v) ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {FEATURES.map(feature => (
            <button
              key={feature.id}
              onClick={() => toggleFeature(feature.id)}
              className={`p-4 rounded-lg border-2 transition text-left ${
                selectedFeatures[feature.id]
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedFeatures[feature.id]}
                  onChange={() => {}}
                  className="mt-1"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{feature.name}</h3>
                  <p className="text-sm text-slate-600">{feature.description}</p>
                </div>
                <span className="text-2xl">{feature.icon}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            ⏱ Estimated processing time: <strong>8-12 minutes</strong> for your video
          </p>
        </div>
      </div>

      {/* Start Processing Button */}
      <button
        onClick={handleStartProcessing}
        disabled={isStarting || processingLoading}
        className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition ${
          isStarting || processingLoading
            ? 'bg-slate-400 text-white cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isStarting ? (
          <>
            <Loader size={24} className="animate-spin" />
            Starting Processing...
          </>
        ) : (
          <>
            <Play size={24} />
            Start AI Processing ({selectedCount} features selected)
          </>
        )}
      </button>
    </div>
  );
}

// ====================================================

// src/pages/ProcessingPage.jsx - Real-time Progress Tracking

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProcessing } from '../hooks/useProcessing';
import { Loader, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { downloadFile } from '../services/api';
import toast from 'react-hot-toast';

const FEATURE_NAMES = {
  sceneDetection: 'Scene Detection',
  colorGrading: 'Color Grading',
  speechToText: 'Speech-to-Text',
  audioEnhancement: 'Audio Enhancement',
  multiLanguage: 'Multi-Language Subtitles',
  autoReframing: 'Auto-Reframing',
  effectSuggestions: 'Effect Suggestions',
};

export default function ProcessingPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { job, pollJob, getJobStatus, isLoading } = useProcessing();
  const [isPolling, setIsPolling] = useState(false);
  const [localJob, setLocalJob] = useState(null);

  useEffect(() => {
    const startPolling = async () => {
      setIsPolling(true);
      try {
        // Get initial status
        const response = await getJobStatus(jobId);
        setLocalJob(response.job);

        // If not complete, start polling
        if (response.job.status !== 'completed' && response.job.status !== 'failed') {
          await pollJob(jobId);
        }
      } catch (error) {
        console.error('Polling error:', error);
      } finally {
        setIsPolling(false);
      }
    };

    startPolling();
  }, [jobId, pollJob, getJobStatus]);

  const handleDownload = async (feature) => {
    toast.loading('Preparing download...');
    try {
      const response = await getJobStatus(jobId);
      const result = response.results.find(r => r.feature_name === feature);
      if (result?.s3_output_key) {
        // In a real app, you'd get a signed URL from the backend
        toast.success('Download link ready!');
      }
    } catch (error) {
      toast.error('Failed to download');
    }
  };

  const displayJob = job || localJob;

  if (!displayJob && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading job status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Processing Status</h1>
      <p className="text-slate-600 mb-8">Job ID: {jobId}</p>

      {/* Progress Section */}
      <div className="bg-white rounded-lg shadow p-8 mb-8">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-slate-900">Overall Progress</h2>
            <span className="text-2xl font-bold text-blue-600">{displayJob?.progress || 0}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${displayJob?.progress || 0}%` }}
            />
          </div>
        </div>

        {/* Status */}
        <div className="mt-6 p-4 rounded-lg bg-slate-50">
          <p className="text-sm text-slate-600">
            Status: <span className="font-semibold capitalize text-slate-900">
              {displayJob?.status}
            </span>
          </p>
          {displayJob?.status === 'processing' && (
            <p className="text-sm text-slate-600 mt-2">
              Processing started: {new Date(displayJob?.started_at).toLocaleString()}
            </p>
          )}
          {displayJob?.status === 'completed' && (
            <p className="text-sm text-slate-600 mt-2">
              Completed: {new Date(displayJob?.completed_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      {displayJob?.results && displayJob.results.length > 0 && (
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Results</h2>
          
          <div className="space-y-3">
            {displayJob.results.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  {result.success ? (
                    <CheckCircle size={24} className="text-green-600" />
                  ) : (
                    <AlertCircle size={24} className="text-red-600" />
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {FEATURE_NAMES[result.feature_name] || result.feature_name}
                    </h3>
                    {result.processing_time_seconds && (
                      <p className="text-sm text-slate-600">
                        Processed in {result.processing_time_seconds}s
                      </p>
                    )}
                  </div>
                </div>
                {result.success && result.s3_output_key && (
                  <button
                    onClick={() => handleDownload(result.feature_name)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                  >
                    <Download size={20} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        {displayJob?.status === 'completed' && (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Back to Dashboard
          </button>
        )}
        {displayJob?.status === 'failed' && (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 px-6 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition"
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  );
}
