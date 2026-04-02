# AI Video Editor Backend - Complete Deployment Guide

## Quick Start (Development)

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis (or use Docker)
- FFmpeg installed on system

### Step 1: Clone and Setup

```bash
git clone <your-repo>
cd ai-video-editor-backend

# Copy environment variables
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Start Services with Docker

```bash
# Start all services (API, DB, Redis)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Step 4: Initialize Database

```bash
# Run migrations
npm run db:migrate

# Seed test data (optional)
npm run db:seed
```

### Step 5: Test the API

```bash
# Health check
curl http://localhost:3000/health

# Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

---

## Environment Variables Setup

### Required API Keys

```bash
# Claude AI (from Anthropic console)
CLAUDE_API_KEY=sk-ant-...

# Speech-to-Text Services (choose at least one)
DESCRIPT_API_KEY=your_key_here
ASSEMBLYAI_API_KEY=your_key_here

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# AWS (for S3 storage)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1

# Optional: Advanced services
TOPAZ_API_KEY=your_key
RUNWAY_API_KEY=your_key
IZOTOPE_API_KEY=your_key

# Security
JWT_SECRET=long-random-string-change-this
DB_PASSWORD=secure-password-change-this
REDIS_PASSWORD=redis-password-optional
```

### Get API Keys

#### 1. Claude API (Anthropic)
- Go to https://console.anthropic.com
- Create API key
- Add to .env as `CLAUDE_API_KEY`

#### 2. Descript API
- Sign up at https://descript.com/api
- Generate API key
- Add to .env as `DESCRIPT_API_KEY`

#### 3. AssemblyAI
- Sign up at https://www.assemblyai.com
- Get API key from dashboard
- Add to .env as `ASSEMBLYAI_API_KEY`

#### 4. Google Cloud
```bash
# Create service account
gcloud iam service-accounts create ai-video-editor
gcloud iam service-accounts keys create key.json \
  --iam-account=ai-video-editor@PROJECT-ID.iam.gserviceaccount.com

# Add to project
export GOOGLE_APPLICATION_CREDENTIALS=./key.json
```

#### 5. AWS S3
```bash
# Create IAM user with S3 access
# Get Access Key ID and Secret Access Key
# Create S3 bucket
aws s3 mb s3://ai-video-editor-bucket
```

---

## Running the Backend

### Development Mode (with hot reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### With Docker

```bash
# Development
docker-compose up -d

# Production with Nginx
docker-compose --profile production up -d
```

### Run Job Queue Worker

```bash
npm run queue:worker
```

---

## API Endpoints

### Authentication

```bash
# Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "secure_password"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "secure_password"
}

# Response includes JWT token
{
  "user": { "id": "...", "email": "..." },
  "token": "eyJhbGc..."
}
```

### Video Management

```bash
# Upload video
POST /api/videos/upload
Headers: Authorization: Bearer <token>
Body: multipart/form-data with video file

# List videos
GET /api/videos
Headers: Authorization: Bearer <token>

# Get specific video
GET /api/videos/{videoId}
Headers: Authorization: Bearer <token>

# Get video details
GET /api/videos/{videoId}
```

### Processing Jobs

```bash
# Start processing
POST /api/process/start
Headers: Authorization: Bearer <token>
{
  "videoId": "uuid-here",
  "features": {
    "sceneDetection": true,
    "colorGrading": true,
    "speechToText": true,
    "audioEnhancement": true,
    "multiLanguage": true,
    "autoReframing": true,
    "effectSuggestions": true
  }
}

# Get job status
GET /api/process/{jobId}
Headers: Authorization: Bearer <token>

# Download result
GET /api/download/{jobId}/{feature}
Headers: Authorization: Bearer <token>
```

---

## Database Schema

All tables are created automatically via migrations. Key tables:

- **users** - User accounts and authentication
- **videos** - Uploaded video files
- **processing_jobs** - Processing job tracking
- **processing_results** - Results from each processing feature
- **job_queue_events** - Queue event history

---

## Monitoring & Logging

### Logs Location

```bash
# API logs
docker-compose logs -f api

# Database logs
docker-compose logs -f postgres

# Redis logs
docker-compose logs -f redis
```

### Health Checks

```bash
# API health
curl http://localhost:3000/health

# Database
curl http://localhost:5432

# Redis
redis-cli ping
```

### PgAdmin (Database UI)

```bash
# Access at http://localhost:5050
# Default credentials in docker-compose.yml
# Add connection: postgres:5432
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps

# View database logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### API Key Errors

```bash
# Verify .env is loaded
cat .env | grep CLAUDE

# Test API connectivity
curl -H "Authorization: Bearer $CLAUDE_API_KEY" \
  https://api.anthropic.com/v1/models
```

### FFmpeg Not Found

```bash
# Install on macOS
brew install ffmpeg

# Install on Ubuntu
sudo apt-get install ffmpeg

# Verify
ffmpeg -version
```

---

## Scaling for Production

### Horizontal Scaling

```bash
# Scale API service to 3 instances
docker-compose up -d --scale api=3
```

### With Kubernetes

```bash
# Build Docker image
docker build -t ai-video-editor:1.0 .

# Deploy to cluster
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### Load Balancing

```bash
# Use Nginx reverse proxy
docker-compose --profile production up -d

# Configure in nginx.conf for load balancing
```

---

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:watch
```

### Load Testing

```bash
# Install autocannon
npm install -g autocannon

# Run load test
autocannon http://localhost:3000 -d 30 -c 100
```

---

## Deployment Checklist

- [ ] All API keys configured in .env
- [ ] Database migrations run successfully
- [ ] S3 bucket created and configured
- [ ] JWT_SECRET changed from default
- [ ] Database password changed from default
- [ ] HTTPS certificates obtained
- [ ] Environment set to 'production'
- [ ] Health checks passing
- [ ] Logs being collected
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented
- [ ] Rate limiting configured

---

## Security Best Practices

```bash
# Rotate secrets regularly
./scripts/rotate-secrets.sh

# Update dependencies
npm audit fix
npm update

# Use environment variables, never hardcode secrets
# Keep .env out of version control (add to .gitignore)

# Enable HTTPS in production
# Use strong JWT_SECRET (minimum 32 characters)
# Implement rate limiting on all endpoints
# Log security events
# Regular backups of database and uploads
```

---

## Next Steps

1. **Connect Frontend** - Update frontend API_URL to your backend
2. **Configure Webhooks** - Set up event notifications
3. **Add Analytics** - Track usage and performance
4. **Set Up Alerts** - Get notified of failures
5. **Implement Payments** - Add subscription management

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review documentation
3. Open issue on GitHub
4. Contact support team

---

## License

MIT
