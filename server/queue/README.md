# Background Job Processing with BullMQ

This project uses BullMQ with Redis for background job processing. This significantly improves performance by offloading curl generation and embeddings creation to background workers.

## Architecture

- **Main Server** (`server/index.js`): Handles HTTP requests and queues jobs
- **Workers** (`server/queue/workers/`): Process jobs in the background
- **Redis**: Message broker for job queues

## Jobs

### 1. Curl Generation (`curl-generation` queue)

- **Purpose**: Generate curl documentation from screenshots using AI
- **Concurrency**: 3 jobs in parallel
- **Rate Limit**: 5 jobs per second
- **Retry**: 3 attempts with exponential backoff

### 2. Embeddings Generation (`embeddings-generation` queue)

- **Purpose**: Generate and store embeddings for documentation
- **Concurrency**: 5 jobs in parallel
- **Rate Limit**: 10 jobs per second
- **Retry**: 3 attempts with exponential backoff

## Setup

### 1. Install Redis

**macOS (Homebrew)**:

```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian**:

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

**Docker**:

```bash
docker run -d -p 6379:6379 redis:alpine
```

### 2. Configure Environment Variables

Add to your `.env` file:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Start the Workers

In a **separate terminal**:

```bash
yarn workers
```

Or for development with auto-reload:

```bash
yarn workers:dev
```

### 4. Start the Server

In your main terminal:

```bash
yarn dev
```

## How It Works

1. **Browser Agent** scrapes pages and queues curl generation jobs
2. **Curl Workers** process screenshots and generate documentation
3. **Server** creates resource records in the database
4. **Embeddings Workers** generate and store embeddings asynchronously

### Flow Diagram

```
Browser Agent → Queue Curl Jobs → Curl Workers
                                      ↓
Server ← Wait for Results ← Complete Curl Jobs
   ↓
Create Resources in DB
   ↓
Queue Embeddings Jobs → Embeddings Workers → Store in DB
```

## Progress Tracking

The system emits Server-Sent Events (SSE) for real-time progress:

- `curl_progress` - Status: `queued`, `processing`, `completed`, `error`
- `embedding_progress` - Status: `start`, `complete`, `error`

## Monitoring

Check job status programmatically:

```javascript
import { curlQueue, embeddingsQueue } from './server/queue/config.js';

// Get job counts
const curlCounts = await curlQueue.getJobCounts();
const embeddingsCounts = await embeddingsQueue.getJobCounts();

console.log(curlCounts); // { waiting, active, completed, failed }
```

## Scaling

To increase performance:

1. **Increase Worker Concurrency**:
   Edit `server/queue/workers/curl-worker.js`:

    ```javascript
    concurrency: 5, // Increase from 3
    ```

2. **Run Multiple Worker Processes**:

    ```bash
    # Terminal 1
    yarn workers

    # Terminal 2
    yarn workers
    ```

3. **Use Redis Cluster** for high throughput

## Troubleshooting

**Redis connection refused**:

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Start Redis
brew services start redis  # macOS
sudo systemctl start redis # Linux
```

**Jobs not processing**:

1. Ensure workers are running: `yarn workers`
2. Check Redis connection in logs
3. Check worker logs for errors

**Out of memory**:

- Increase `removeOnComplete` and `removeOnFail` counts
- Or decrease retention times in `server/queue/config.js`
