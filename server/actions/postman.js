import { db } from '../db/index.js';
import { resources } from '../db/schema/resources.js';
import { websites } from '../db/schema/websites.js';
import { eq } from 'drizzle-orm';
import { buildPostmanCollection } from '../utils/postman-builder.js';
import postmanCollectionGenerator from '../agents/collection-generator.js';
import { NotFoundError, DatabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const generateCollection = async (url, useAI = false) => {
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

        logger.info(
            `Found ${websiteResources.length} resources for Postman collection generation`,
            {
                url,
                useAI,
            }
        );

        // Transform resources into structured format for Postman collection generation
        const structuredDocs = websiteResources.map(resource => ({
            tags: resource.tags,
            description: resource.description,
            curlCommand: resource.curlCommand,
            parameters: resource.parameters,
        }));

        let collection, conversionReport;

        if (useAI) {
            // Use AI to generate the collection
            logger.info('Using AI to generate Postman collection');
            collection = await postmanCollectionGenerator(structuredDocs, url);

            // Create a simple report for AI generation
            conversionReport = {
                total: websiteResources.length,
                successful: websiteResources.length, // Assume all successful since AI handles it
                duplicates: 0,
                failed: 0,
                errors: [],
                generatedBy: 'AI',
            };
        } else {
            // Build Postman collection directly from structured data (default)
            logger.info('Using direct conversion to generate Postman collection');
            const result = await buildPostmanCollection(structuredDocs, url);
            collection = result.collection;
            conversionReport = {
                ...result.conversionReport,
                generatedBy: 'direct',
            };
        }

        logger.info('Postman collection generation completed', {
            url,
            useAI,
            totalResources: websiteResources.length,
            successfulConversions: conversionReport.successful,
            failedConversions: conversionReport.failed,
        });

        return {
            collection,
            resourceCount: websiteResources.length,
            conversionReport,
        };
    } catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to generate Postman collection from URL', {
            url,
            useAI,
            error: error.message,
        });
        throw new DatabaseError('Could not retrieve resources', error);
    }
};
