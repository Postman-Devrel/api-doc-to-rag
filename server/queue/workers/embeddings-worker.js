import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { generateEmbeddings } from '../../services/embeddings.js';
import { embeddings as embeddingsTable } from '../../db/schema/embeddings.js';
import { db } from '../../db/index.js';
import { logger } from '../../utils/logger.js';

const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

/**
 * Worker for generating and storing embeddings for resources
 * Jobs are queued after resources are created in the database
 * Note: Does not send SSE events as the session may be closed
 */
const embeddingsWorker = new Worker(
    'embeddings-generation',
    async job => {
        const { resourceId, content, jobIndex, totalJobs } = job.data;

        try {
            logger.info(`Processing embeddings generation job ${job.id}`, {
                resourceId,
                jobIndex,
                totalJobs,
            });

            // Generate embeddings for the content
            const embeddings = await generateEmbeddings(content);

            // Store embeddings in database
            if (embeddings.length > 0) {
                await db.insert(embeddingsTable).values(
                    embeddings.map(embedding => ({
                        resourceId: resourceId,
                        ...embedding,
                    }))
                );
            }

            logger.info(`Embeddings generated for job ${job.id}`, {
                resourceId,
                embeddingsCount: embeddings.length,
                jobIndex,
            });

            return {
                success: true,
                resourceId,
                embeddingsCount: embeddings.length,
            };
        } catch (error) {
            logger.error(`Embeddings generation failed for job ${job.id}`, {
                error: error.message,
                resourceId,
                jobIndex,
            });

            throw error; // Re-throw so BullMQ can retry
        }
    },
    {
        connection,
        concurrency: 5, // Process 5 embedding jobs in parallel
        limiter: {
            max: 10, // Max 10 jobs per second
            duration: 1000,
        },
    }
);

embeddingsWorker.on('completed', job => {
    logger.debug(`Embeddings job ${job.id} completed`);
});

embeddingsWorker.on('failed', (job, err) => {
    logger.error(`Embeddings job ${job.id} failed`, { error: err.message });
});

embeddingsWorker.on('error', err => {
    logger.error('Embeddings worker error', { error: err.message });
});

logger.info('Embeddings generation worker started', { concurrency: 5 });

export default embeddingsWorker;
