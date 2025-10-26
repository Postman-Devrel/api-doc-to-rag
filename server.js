import express from 'express';
import { config } from 'dotenv';
import { browserAgent } from './agents/browser.js';
import { findRelevantContent } from './actions/search.js';
import { generateOpenApiFromUrl } from './actions/openapi.js';
import { isValidUrl } from './utils/utils.js';

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// use agent to generate knowledge base from a documentation URL
app.post('/knowledge-base', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                error: 'URL is required',
                message: 'Please provide a url in the request body',
            });
        }

        if (!isValidUrl(url)) {
            return res.status(400).json({
                error: 'Invalid URL format',
                message: 'Please provide a valid URL',
            });
        }

        console.log(`Starting knowledge base generation for: ${url}`);

        // Start browser agent to extract curl documentation
        const { curlDocs, page, browser } = await browserAgent(url);

        // Close browser resources
        await page.close();
        console.log('Page closed');
        await browser.close();
        console.log('Browser closed');

        res.json({
            url,
            data: curlDocs,
        });
    } catch (error) {
        res.status(500).json({
            error: 'An error occurred while generating the knowledge base',
            message: error.message,
        });
    }
});

// search the knowledge base for relevant content
app.get('/documentation/search', async (req, res) => {
    try {
        const { query, url } = req.query;

        if (!query) {
            return res.status(400).json({
                error: 'Query parameter is required',
                message: 'Please provide a query parameter (e.g., ?query=your search)',
            });
        }

        console.log(`Searching for: ${query}${url ? ` in ${url}` : ''}`);

        // Do a similarity search to find relevant content
        const results = await findRelevantContent(query, url);

        res.json({
            query,
            url,
            results,
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to search documentation',
            message: error.message,
        });
    }
});

// Generate OpenAPI definition from the knowledge base
app.get('/documentation/openapi', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL is required',
                message: 'Please provide a url in the request body',
            });
        }

        if (!isValidUrl(url)) {
            return res.status(400).json({
                error: 'Invalid URL format',
                message: 'Please provide a valid URL',
            });
        }

        console.log(`Generating OpenAPI definition for: ${url}`);

        const { openApi, resourceCount } = await generateOpenApiFromUrl(url);

        res.json({
            resourceCount,
            openApi,
        });
    } catch (error) {
        console.error('Error generating OpenAPI definition:', error);

        res.status(500).json({
            error: 'Failed to generate OpenAPI definition',
            message: error.message,
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});

export default app;
