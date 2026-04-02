// queueWorker.js - Bull queue worker for background video processing

const Queue = require('bull');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const VideoProcessor = require('./videoProcessor');

dotenv.config();

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Bull queue connection
const videoProcessingQueue = new Queue('video-processing', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
});

const concurrency = parseInt(process.env.QUEUE_CONCURRENCY, 10);
const QUEUE_CONCURRENCY = Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 2;

// ==================== QUEUE WORKER ====================

videoProcessingQueue.process(
  QUEUE_CONCURRENCY,
  async (job) => {
    const { jobId, videoId, userId, features } = job.data;

    console.log(`[Worker] Starting job ${jobId} for video ${videoId}`);

    const processor = new VideoProcessor(pool, jobId, videoId, userId);

    try {
      const result = await processor.processVideo(features);
      console.log(`[Worker] Job ${jobId} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[Worker] Job ${jobId} failed:`, error.message);
      throw error;
    }
  }
);

// ==================== EVENT HANDLERS ====================

videoProcessingQueue.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} finished`);
});

videoProcessingQueue.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`);
});

videoProcessingQueue.on('stalled', (job) => {
  console.warn(`[Worker] Job ${job.id} stalled and will be reprocessed`);
});

videoProcessingQueue.on('progress', (job, progress) => {
  console.log(`[Worker] Job ${job.id} progress: ${progress}%`);
});

videoProcessingQueue.on('error', (error) => {
  console.error('[Worker] Queue error:', error);
});

// ==================== GRACEFUL SHUTDOWN ====================

async function shutdown() {
  console.log('[Worker] Shutting down gracefully...');
  await videoProcessingQueue.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Worker] Queue worker started, waiting for jobs...');
console.log(`[Worker] Concurrency: ${QUEUE_CONCURRENCY}`);
