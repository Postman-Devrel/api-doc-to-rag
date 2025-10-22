import express from 'express';
import { config } from 'dotenv';
import { browserAgent } from './agents/browser.js';
import { findRelevantContent } from './utils/embeddings.js';

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

const isValidUrl = urlString => {
    const pattern =
        /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    return pattern.test(urlString);
};

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
            success: true,
            message: 'Knowledge base generated successfully',
            data: {
                url,
                descriptions: curlDocs,
            },
        });
    } catch (error) {
        console.error('Error generating knowledge base:', error);
        res.status(500).json({
            error: 'Failed to generate knowledge base',
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

        // Perform semantic search, optionally filtered by URL
        const results = await findRelevantContent(query, url);

        res.json({
            success: true,
            data: { query, url, results },
        });
    } catch (error) {
        console.error('Error searching documentation:', error);
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
                error: 'URL parameter is required',
                message: 'Please provide a url parameter (e.g., ?url=https://example.com)',
            });
        }

        // Get documentation using the browserAgent (same process as index.js)
        const { curlDocs, page, browser } = await browserAgent(url);

        // Close browser resources
        await page.close();
        await browser.close();

        // Generate OpenAPI documentation from the crawled docs
        const openApi = await openApiGenerator(curlDocs);

        res.json({
            success: true,
            message: 'OpenAPI definition generated successfully',
            data: {
                url,
                openApi,
            },
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
