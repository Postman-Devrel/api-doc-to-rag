/**
 * Worker process that starts all BullMQ workers
 * Run this separately from the main server: node server/queue/start-workers.js
 */
import '../env.mjs'; // Load environment variables
import curlWorker from './workers/curl-worker.js';
import embeddingsWorker from './workers/embeddings-worker.js';
import { logger } from '../utils/logger.js';

logger.info('Starting all BullMQ workers...', {
    workers: ['curl-generation', 'embeddings-generation'],
});

// Graceful shutdown
const shutdown = async signal => {
    logger.info(`${signal} received, shutting down workers...`);

    try {
        await curlWorker.close();
        await embeddingsWorker.close();
        logger.info('All workers closed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Error during worker shutdown', { error: error.message });
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info('All workers started and ready to process jobs');
