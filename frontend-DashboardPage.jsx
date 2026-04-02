// src/pages/DashboardPage.jsx

import React, { useEffect, useState } from 'react';
import { useVideo } from '../hooks/useVideo';
import { Upload, Play, Trash2, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { videos, fetchVideos, uploadVideo, deleteVideo, isLoading, uploadProgress } = useVideo();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('video/')) {
        await handleUpload(file);
      } else {
        toast.error('Please drop a video file');
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
    } else {
      toast.error('Please select a valid video file');
    }
  };

  const handleUpload = async (file) => {
    setIsUploading(true);
    try {
      const video = await uploadVideo(file);
      setSelectedFile(null);
      // Refresh videos list
      await fetchVideos();
      toast.success('Video uploaded! Ready for processing');
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (videoId) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      const success = await deleteVideo(videoId);
      if (success) {
        await fetchVideos();
      }
    }
  };

  const handleProcess = (videoId) => {
    navigate(`/video/${videoId}`);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-600">Upload and process your videos with AI</p>
      </div>

      {/* Upload Section */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`mb-8 p-12 border-2 border-dashed rounded-lg transition ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400'
        }`}
      >
        <div className="text-center">
          <Upload className="mx-auto mb-4 text-slate-400" size={48} />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Upload a Video
          </h2>
          <p className="text-slate-600 mb-4">
            Drag and drop your video here, or click to select
          </p>

          <label className="inline-block">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
            />
            <span
              className={`inline-block px-6 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isUploading ? 'Uploading...' : 'Select Video'}
            </span>
          </label>

          {selectedFile && !isUploading && (
            <div className="mt-4 p-4 bg-white rounded border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">
                Selected: {selectedFile.name}
              </p>
              <button
                onClick={() => handleUpload(selectedFile)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Confirm Upload
              </button>
            </div>
          )}

          {isUploading && (
            <div className="mt-4 p-4 bg-white rounded border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Loader size={16} className="animate-spin" />
                <span className="text-sm text-slate-600">
                  Uploading: {uploadProgress}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Videos Grid */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Your Videos</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader size={32} className="animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-slate-600">Loading videos...</p>
            </div>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg">
            <p className="text-slate-600">No videos yet. Upload your first video to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="bg-slate-900 h-40 flex items-center justify-center relative group">
                  <Play className="text-white opacity-50" size={48} />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center">
                    <button
                      onClick={() => handleProcess(video.id)}
                      className="opacity-0 group-hover:opacity-100 transition bg-blue-600 text-white px-6 py-2 rounded-lg"
                    >
                      Process
                    </button>
                  </div>
                </div>

                {/* Video Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 truncate mb-1">
                    {video.original_filename}
                  </h3>
                  <p className="text-sm text-slate-600 mb-3">
                    {Math.round(video.duration)} seconds • {video.resolution}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleProcess(video.id)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                    >
                      Process
                    </button>
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="px-3 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
