import express from 'express';
import { config } from 'dotenv';
import { browserAgent } from './agents/browser.js';
import { findRelevantContent } from './actions/search.js';
import { generateOpenApiFromUrl } from './actions/openapi.js';
import { isValidUrl } from './utils/utils.js';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler.js';
import { ValidationError } from './utils/errors.js';
import { logger } from './utils/logger.js';

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

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

// Generate OpenAPI definition from the knowledge base
app.get(
    '/documentation/openapi',
    asyncHandler(async (req, res) => {
        const { url } = req.query;

        if (!url) {
            throw new ValidationError('URL parameter is required (e.g., ?url=https://example.com)');
        }

        if (!isValidUrl(url)) {
            throw new ValidationError('Invalid URL format. Please provide a valid URL');
        }

        logger.info('Generating OpenAPI definition', { url });

        const { openApi, resourceCount } = await generateOpenApiFromUrl(url);

        res.json({
            resourceCount,
            openApi,
        });
    })
);

// Handle 404 errors
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
});

export default app;
