import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger.js';

// Redis connection
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

connection.on('error', error => {
    logger.error('Redis connection error', { error: error.message });
});

connection.on('connect', () => {
    logger.info('Redis connected successfully');
});

// Queue for curl generation
export const curlQueue = new Queue('curl-generation', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
        },
    },
});

// Queue for embeddings generation
export const embeddingsQueue = new Queue('embeddings-generation', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
        },
    },
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing queues...');
    await curlQueue.close();
    await embeddingsQueue.close();
    await connection.quit();
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing queues...');
    await curlQueue.close();
    await embeddingsQueue.close();
    await connection.quit();
    process.exit(0);
});

logger.info('Queues initialized', {
    curlQueue: curlQueue.name,
    embeddingsQueue: embeddingsQueue.name,
});
