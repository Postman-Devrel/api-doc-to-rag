import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.mjs';
import { logger } from '../utils/logger.js';

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client);

/**
 * Check database connection health
 * @returns {Promise<boolean>} True if database is healthy
 */
export const checkDatabaseConnection = async () => {
    try {
        await client`SELECT 1`;
        logger.info('Database connection established');
        return true;
    } catch (error) {
        logger.error('Database connection failed', { error: error.message });
        throw new Error('Failed to connect to database: ' + error.message);
    }
};
