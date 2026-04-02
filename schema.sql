-- schema.sql - Full database schema for AI Video Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== TABLES ====================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename VARCHAR(500) NOT NULL,
  file_size         BIGINT NOT NULL,
  duration          NUMERIC(10, 3),
  resolution        VARCHAR(20),
  fps               NUMERIC(6, 3),
  s3_key            VARCHAR(1000) NOT NULL,
  status            VARCHAR(50) NOT NULL DEFAULT 'uploaded',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id         UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_type         VARCHAR(100) NOT NULL DEFAULT 'full_process',
  features_enabled JSONB NOT NULL DEFAULT '{}',
  status           VARCHAR(50) NOT NULL DEFAULT 'queued',
  progress         INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message    TEXT,
  started_at       TIMESTAMP WITH TIME ZONE,
  completed_at     TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing results table
CREATE TABLE IF NOT EXISTS processing_results (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
  feature_name  VARCHAR(100) NOT NULL,
  s3_output_key VARCHAR(1000),
  metadata      JSONB NOT NULL DEFAULT '{}',
  success       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_videos_user_id     ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status       ON videos(status);
CREATE INDEX IF NOT EXISTS idx_jobs_video_id       ON processing_jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id        ON processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status         ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_results_job_id      ON processing_results(job_id);
CREATE INDEX IF NOT EXISTS idx_results_feature_name ON processing_results(feature_name);

-- ==================== TRIGGERS ====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON processing_jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON processing_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
