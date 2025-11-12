import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import curlDocsGenerator from '../../agents/curl.js';
import { logger } from '../../utils/logger.js';

const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

/**
 * Worker for generating curl documentation from screenshots
 * Jobs are queued from browser agent as pages are scraped
 */
const curlWorker = new Worker(
    'curl-generation',
    async job => {
        const { screenshot, previousResponseId, jobIndex, totalJobs } = job.data;

        try {
            logger.info(`Processing curl generation job ${job.id}`, {
                jobIndex,
                totalJobs,
            });

            // Generate curl docs using AI
            const result = await curlDocsGenerator(screenshot, previousResponseId);

            logger.info(`Curl generation completed for job ${job.id}`, {
                docsCount: result.curlObj?.curlDocs?.length || 0,
                jobIndex,
            });

            // Return result to be stored in job
            return {
                success: true,
                responseId: result.responseId,
                curlObj: result.curlObj,
            };
        } catch (error) {
            logger.error(`Curl generation failed for job ${job.id}`, {
                error: error.message,
                jobIndex,
            });

            // Return empty structure so the job completes
            return {
                success: false,
                error: error.message,
                responseId: previousResponseId,
                curlObj: { curlDocs: [], url: '' },
            };
        }
    },
    {
        connection,
        concurrency: 3, // Process 3 curl generation jobs in parallel
        limiter: {
            max: 5, // Max 5 jobs per second
            duration: 1000,
        },
    }
);

curlWorker.on('completed', job => {
    logger.debug(`Curl job ${job.id} completed`);
});

curlWorker.on('failed', (job, err) => {
    logger.error(`Curl job ${job.id} failed`, { error: err.message });
});

curlWorker.on('error', err => {
    logger.error('Curl worker error', { error: err.message });
});

logger.info('Curl generation worker started', { concurrency: 3 });

export default curlWorker;
