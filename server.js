import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { browserAgent } from './agents/browser.js';
import { findRelevantContent } from './actions/search.js';
import { generateCollection } from './actions/postman.js';
import { isValidUrl } from './utils/utils.js';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler.js';
import { ValidationError } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { checkDatabaseConnection } from './db/index.js';

config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
    origin:
        process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') || [] : '*',
    credentials: true,
    optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

app.get(
    '/health',
    asyncHandler(async (req, res) => {
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
        };

        try {
            await checkDatabaseConnection();
            health.database = 'connected';
        } catch (error) {
            health.database = 'disconnected';
            health.status = 'degraded';
            logger.warn('Health check: database disconnected', { error: error.message });
        }

        const statusCode = health.status === 'ok' ? 200 : 503;
        res.status(statusCode).json(health);
    })
);

// use agent to generate knowledge base from a documentation URL
app.post(
    '/knowledge-base',
    asyncHandler(async (req, res) => {
        const { url } = req.body;

        if (!url) {
            throw new ValidationError('URL is required in the request body');
        }

        if (!isValidUrl(url)) {
            throw new ValidationError('Invalid URL format. Please provide a valid URL');
        }

        logger.info('Starting knowledge base generation', { url });

        let browser, page;
        try {
            // Start browser agent to extract curl documentation
            const result = await browserAgent(url);
            browser = result.browser;
            page = result.page;
            const curlDocs = result.curlDocs;

            res.json({
                url,
                data: curlDocs,
            });
        } finally {
            // Ensure browser resources are always closed
            if (page) {
                await page
                    .close()
                    .catch(err => logger.error('Failed to close page', { error: err.message }));
                logger.debug('Page closed');
            }
            if (browser) {
                await browser
                    .close()
                    .catch(err => logger.error('Failed to close browser', { error: err.message }));
                logger.debug('Browser closed');
            }
        }
    })
);

// search the knowledge base for relevant content
app.get(
    '/documentation/search',
    asyncHandler(async (req, res) => {
        const { query, url } = req.query;

        if (!query) {
            throw new ValidationError('Query parameter is required (e.g., ?query=your search)');
        }

        logger.info('Searching documentation', { query, url });

        // Do a similarity search to find relevant content
        const results = await findRelevantContent(query, url);

        res.json({
            query,
            url,
            results,
        });
    })
);

// Generate Postman collection from the knowledge base
app.get(
    '/documentation/postman',
    asyncHandler(async (req, res) => {
        const { url, useAI } = req.query;

        if (!url) {
            throw new ValidationError('URL parameter is required (e.g., ?url=https://example.com)');
        }

        if (!isValidUrl(url)) {
            throw new ValidationError('Invalid URL format. Please provide a valid URL');
        }

        // Parse useAI parameter (default to false)
        const shouldUseAI = useAI === 'true';

        logger.info('Generating Postman collection', { url, useAI: shouldUseAI });

        const { collection, resourceCount, conversionReport } = await generateCollection(
            url,
            shouldUseAI
        );

        res.json({
            collection,
            resourceCount,
            conversionReport: {
                total: conversionReport.total,
                successful: conversionReport.successful,
                duplicates: conversionReport.duplicates,
                failed: conversionReport.failed,
                errors: conversionReport.errors,
                generatedBy: conversionReport.generatedBy,
            },
        });
    })
);

// Handle 404 errors
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Check database connection before starting server
checkDatabaseConnection()
    .then(() => {
        // Start server
        app.listen(PORT, () => {
            logger.info(`Server listening on port ${PORT}`);
        });
    })
    .catch(error => {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    });

export default app;
