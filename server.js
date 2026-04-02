// src/server.js - Main Express Server

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');
const Redis = require('redis');
const Queue = require('bull');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const AWS = require('aws-sdk');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

dotenv.config();

// Initialize Express
const app = express();

// ==================== SECURITY MIDDLEWARE ====================

app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

// General rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later' },
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ==================== DATABASE & QUEUE ====================

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

// Input validation helper - simple and ReDoS-safe
function validateEmail(email) {
  if (typeof email !== 'string' || email.length > 320) return false;
  const atIdx = email.indexOf('@');
  if (atIdx <= 0 || atIdx === email.length - 1) return false;
  const domain = email.slice(atIdx + 1);
  return domain.includes('.');
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

// 1. AUTHENTICATION ROUTES
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(password, 12);

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

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

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

// ==================== MULTER SETUP ====================

const ALLOWED_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_MB || '500') * 1024 * 1024;

const UPLOAD_DIR = path.resolve(process.env.LOCAL_STORAGE || './uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: mp4, mov, avi, mkv, webm'));
    }
  },
});

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Safely delete a temp upload file (only accepts multer-generated hex filenames)
function safeDeleteUpload(filename) {
  try {
    // Strip everything except hex chars; multer names files with hex strings only
    const safeFilename = String(filename || '').replace(/[^a-f0-9]/g, '');
    if (!safeFilename || safeFilename !== String(filename)) return;
    const fullPath = path.join(UPLOAD_DIR, safeFilename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (_) {
    // Ignore cleanup errors
  }
}

// 2. VIDEO UPLOAD & MANAGEMENT ROUTES
app.post('/api/videos/upload', authenticateToken, (req, res) => {
  upload.single('video')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { originalname, size, mimetype } = req.file;
    const userId = req.user.userId;

    // Multer generates hex filenames; sanitize it to strip any directory traversal
    const uploadedFilename = req.file.filename;
    const safeUploadedFilename = String(uploadedFilename || '').replace(/[^a-f0-9]/g, '');
    if (!safeUploadedFilename || safeUploadedFilename !== uploadedFilename) {
      return res.status(400).json({ error: 'Invalid file reference' });
    }
    const tempFilePath = path.join(UPLOAD_DIR, safeUploadedFilename);

    try {
      // Extract video metadata using FFmpeg
      const ffmpegFluent = require('fluent-ffmpeg');

      const probeData = await new Promise((resolve, reject) => {
        ffmpegFluent.ffprobe(tempFilePath, (probeErr, data) => {
          if (probeErr) reject(probeErr);
          else resolve(data);
        });
      });

      const videoStream = probeData.streams.find(s => s.codec_type === 'video');
      if (!videoStream) {
        safeDeleteUpload(safeUploadedFilename);
        return res.status(400).json({ error: 'File contains no video stream' });
      }

      const duration = probeData.format.duration;
      const resolution = `${videoStream.width}x${videoStream.height}`;

      // Safely evaluate fractional frame rate (e.g. "30000/1001")
      let fps = 30;
      if (videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        fps = parts.length === 2 ? parseFloat(parts[0]) / parseFloat(parts[1]) : parseFloat(parts[0]);
      }

      // Sanitize original filename: strip path, collapse multiple dots, allow only safe chars
      const basename = path.basename(originalname);
      const ext = path.extname(basename).toLowerCase();
      const nameOnly = path.basename(basename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeFilename = `${nameOnly}${ext}`;
      const s3Key = `videos/${userId}/${Date.now()}-${safeFilename}`;

      const fileContent = fs.readFileSync(tempFilePath);
      const s3Params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: fileContent,
        ContentType: mimetype,
      };

      await new Promise((resolve, reject) => {
        s3.upload(s3Params, (uploadErr, data) => {
          if (uploadErr) reject(uploadErr);
          else resolve(data);
        });
      });

      // Save to database
      const videoResult = await pool.query(
        `INSERT INTO videos (user_id, original_filename, file_size, duration, resolution, fps, s3_key, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [userId, safeFilename, size, duration, resolution, fps, s3Key, 'uploaded']
      );

      // Clean up local file
      safeDeleteUpload(safeUploadedFilename);

      res.status(201).json({
        video: videoResult.rows[0],
        message: 'Video uploaded successfully',
      });
    } catch (error) {
      // Clean up local file on error
      safeDeleteUpload(safeUploadedFilename);
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });
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

    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    // Merge requested features with defaults; only allow known feature keys
    const allowedFeatures = Object.keys(allFeaturesDefault);
    const sanitizedFeatures = { ...allFeaturesDefault };
    if (features && typeof features === 'object') {
      allowedFeatures.forEach((key) => {
        if (typeof features[key] === 'boolean') {
          sanitizedFeatures[key] = features[key];
        }
      });
    }

    // Verify video belongs to user
    const videoResult = await pool.query(
      'SELECT id FROM videos WHERE id = $1 AND user_id = $2',
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
      [videoId, userId, 'full_process', JSON.stringify(sanitizedFeatures), 'queued']
    );

    const job = jobResult.rows[0];

    // Add to Bull Queue
    await req.videoQueue.add(
      {
        jobId: job.id,
        videoId,
        userId,
        features: sanitizedFeatures,
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

    if (!s3Key) {
      return res.status(404).json({ error: 'No output file available for this result' });
    }

    // Generate S3 signed URL (valid for 1 hour)
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Expires: 3600,
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

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

module.exports = app;
