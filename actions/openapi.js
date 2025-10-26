import { db } from '../db/index.js';
import { resources } from '../db/schema/resources.js';
import { websites } from '../db/schema/websites.js';
import { eq } from 'drizzle-orm';
import openApiGenerator from '../agents/openapi.js';
import { NotFoundError, DatabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const generateOpenApiFromUrl = async url => {
    try {
        // Find the website by URL
        const website = await db.select().from(websites).where(eq(websites.url, url)).limit(1);

        if (website.length === 0) {
            throw new NotFoundError(
                'Website',
                `${url}. Please scrape the website first using POST /knowledge-base`
            );
        }

        // Get all resources for this website
        const websiteResources = await db
            .select()
            .from(resources)
            .where(eq(resources.websiteId, website[0].id));

        if (websiteResources.length === 0) {
            throw new NotFoundError('Documentation resources', url);
        }

        logger.info(`Found ${websiteResources.length} resources`, { url });

        // Accumulate all content into an array
        const contentArray = websiteResources.map(resource => resource.content);

        // Generate OpenAPI documentation from the accumulated content
        const openApi = await openApiGenerator(contentArray);

        return {
            openApi,
            resourceCount: websiteResources.length,
        };
    } catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to generate OpenAPI from URL', { url, error: error.message });
        throw new DatabaseError('Could not retrieve resources', error);
    }
};
