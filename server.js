// src/server.js - Main Express Server

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');
const Redis = require('redis');
const Queue = require('bull');

dotenv.config();

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Database
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Initialize Redis & Bull Queue
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

const videoProcessingQueue = new Queue('video-processing', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Global middleware to attach instances
app.use((req, res, next) => {
  req.db = pool;
  req.redis = redisClient;
  req.videoQueue = videoProcessingQueue;
  next();
});

// ==================== ROUTES ====================

// 1. AUTHENTICATION ROUTES
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcryptjs = require('bcryptjs');
    const jwt = require('jsonwebtoken');

    // Check if user exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: { id: user.id, email: user.email },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcryptjs = require('bcryptjs');
    const jwt = require('jsonwebtoken');

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcryptjs.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: { id: user.id, email: user.email },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 2. VIDEO UPLOAD & MANAGEMENT ROUTES
app.post('/api/videos/upload', authenticateToken, async (req, res) => {
  try {
    const multer = require('multer');
    const upload = multer({ dest: process.env.LOCAL_STORAGE || './uploads' });

    upload.single('video')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'File upload failed' });
      }

      const { originalname, size, mimetype } = req.file;
      const userId = req.user.userId;

      // Extract video metadata using FFmpeg
      const ffmpeg = require('fluent-ffmpeg');
      const ffprobe = require('ffprobe');

      ffprobe(req.file.path, async (err, probeData) => {
        if (err) {
          return res.status(400).json({ error: 'Invalid video file' });
        }

        const videoStream = probeData.streams.find(s => s.codec_type === 'video');
        const duration = probeData.format.duration;
        const resolution = `${videoStream.width}x${videoStream.height}`;
        const fps = videoStream.r_frame_rate
          ? eval(videoStream.r_frame_rate)
          : 30;

        // Upload to S3
        const AWS = require('aws-sdk');
        const s3 = new AWS.S3();
        const fs = require('fs');

        const fileContent = fs.readFileSync(req.file.path);
        const s3Key = `videos/${userId}/${Date.now()}-${originalname}`;

        const s3Params = {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: s3Key,
          Body: fileContent,
          ContentType: mimetype,
        };

        s3.upload(s3Params, async (err, data) => {
          if (err) {
            return res.status(500).json({ error: 'S3 upload failed' });
          }

          // Save to database
          const videoResult = await pool.query(
            `INSERT INTO videos (user_id, original_filename, file_size, duration, resolution, fps, s3_key, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [userId, originalname, size, duration, resolution, fps, s3Key, 'uploaded']
          );

          // Clean up local file
          fs.unlinkSync(req.file.path);

          res.status(201).json({
            video: videoResult.rows[0],
            message: 'Video uploaded successfully',
          });
        });
      });
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/videos', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM videos WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({ videos: result.rows });
  } catch (error) {
    console.error('Fetch videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.get('/api/videos/:videoId', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM videos WHERE id = $1 AND user_id = $2',
      [videoId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ video: result.rows[0] });
  } catch (error) {
    console.error('Fetch video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// 3. VIDEO PROCESSING ROUTES
app.post('/api/process/start', authenticateToken, async (req, res) => {
  try {
    const { videoId, features } = req.body;
    const userId = req.user.userId;

    // Verify video belongs to user
    const videoResult = await pool.query(
      'SELECT * FROM videos WHERE id = $1 AND user_id = $2',
      [videoId, userId]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Create processing job
    const jobResult = await pool.query(
      `INSERT INTO processing_jobs (video_id, user_id, job_type, features_enabled, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [videoId, userId, 'full_process', JSON.stringify(features || allFeaturesDefault), 'queued']
    );

    const job = jobResult.rows[0];

    // Add to Bull Queue
    await req.videoQueue.add(
      {
        jobId: job.id,
        videoId,
        userId,
        features: features || allFeaturesDefault,
      },
      {
        priority: 1,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      }
    );

    res.status(202).json({
      job: job,
      message: 'Processing job created',
    });
  } catch (error) {
    console.error('Start processing error:', error);
    res.status(500).json({ error: 'Failed to start processing' });
  }
});

app.get('/api/process/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM processing_jobs WHERE id = $1 AND user_id = $2',
      [jobId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];

    // Fetch processing results
    const resultsRes = await pool.query(
      'SELECT * FROM processing_results WHERE job_id = $1',
      [jobId]
    );

    res.json({
      job,
      results: resultsRes.rows,
    });
  } catch (error) {
    console.error('Fetch job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// 4. DOWNLOAD ROUTES
app.get('/api/download/:jobId/:feature', authenticateToken, async (req, res) => {
  try {
    const { jobId, feature } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT pr.* FROM processing_results pr
       JOIN processing_jobs pj ON pr.job_id = pj.id
       WHERE pj.id = $1 AND pj.user_id = $2 AND pr.feature_name = $3`,
      [jobId, userId, feature]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    const processingResult = result.rows[0];
    const s3Key = processingResult.s3_output_key;

    // Generate S3 signed URL
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3();

    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Expires: 3600, // 1 hour
    });

    res.json({ downloadUrl: signedUrl });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to generate download link' });
  }
});

// ==================== MIDDLEWARE ====================

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwt = require('jsonwebtoken');

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

// Default features
const allFeaturesDefault = {
  sceneDetection: true,
  colorGrading: true,
  speechToText: true,
  audioEnhancement: true,
  multiLanguage: true,
  autoReframing: true,
  effectSuggestions: true,
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

module.exports = app;
