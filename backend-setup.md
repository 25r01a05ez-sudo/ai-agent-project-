# AI Video Editing Agent - Backend Setup Guide

## Project Structure

```
ai-video-editor-backend/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── redis.js
│   │   └── env.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Video.js
│   │   └── ProcessingJob.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── videos.js
│   │   └── jobs.js
│   ├── services/
│   │   ├── videoService.js
│   │   ├── sceneDetectionService.js
│   │   ├── transcriptionService.js
│   │   ├── audioEnhancementService.js
│   │   ├── colorGradingService.js
│   │   ├── reframingService.js
│   │   ├── translationService.js
│   │   └── effectService.js
│   ├── processors/
│   │   └── videoProcessor.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── validation.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── cloudStorage.js
│   └── server.js
├── .env.example
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## Installation Steps

### 1. Install Node.js Dependencies

```bash
npm init -y
npm install express cors dotenv axios bull redis pg sequelize jsonwebtoken bcryptjs multer aws-sdk fluent-ffmpeg
npm install --save-dev nodemon jest supertest
```

### 2. Create .env file

```bash
# Server
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_video_editor
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_URL=redis://localhost:6379

# File Storage
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=ai-video-editor-videos
LOCAL_STORAGE=./uploads

# Descript API
DESCRIPT_API_KEY=your_descript_api_key

# AssemblyAI
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=./config/google-credentials.json

# AWS Services
AWS_TRANSCRIBE_REGION=us-east-1

# Claude AI
CLAUDE_API_KEY=your_anthropic_api_key

# Topaz Video AI (for color grading)
TOPAZ_API_KEY=your_topaz_api_key

# Runway ML (for effects)
RUNWAY_API_KEY=your_runway_api_key

# iZotope (for audio)
IZOTOPE_API_KEY=your_izotope_api_key
```

## Key Technologies

- **Framework**: Express.js
- **Database**: PostgreSQL + Sequelize ORM
- **Job Queue**: Bull + Redis
- **Authentication**: JWT + bcryptjs
- **Video Processing**: FFmpeg (native binary)
- **File Storage**: AWS S3 (or local filesystem)
- **External APIs**:
  - Descript (premium transcription)
  - AssemblyAI (accurate speech-to-text)
  - Google Cloud Speech-to-Text (fallback)
  - Google Translate API (multi-language)
  - Topaz Video AI (color grading)
  - Runway ML (effects & reframing)
  - iZotope RX (audio enhancement)

## Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  file_size BIGINT,
  duration FLOAT,
  resolution VARCHAR(20),
  fps INTEGER,
  s3_key VARCHAR(255),
  status VARCHAR(50) DEFAULT 'uploaded',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  job_type VARCHAR(50), -- 'full_process' or individual feature
  status VARCHAR(50) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  features_enabled JSONB,
  results JSONB,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE processing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES processing_jobs(id),
  feature_name VARCHAR(100),
  s3_output_key VARCHAR(255),
  metadata JSONB,
  processing_time_seconds INTEGER,
  success BOOLEAN DEFAULT true,
  error_details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_queue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES processing_jobs(id),
  event_type VARCHAR(100),
  event_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Running the Backend

```bash
# Development with hot reload
npm run dev

# Production
npm start

# With Docker
docker-compose up -d
```

All detailed service implementations follow in the next files.
