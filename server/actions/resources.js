import { insertResourceSchema, resources } from '../db/schema/resources.js';
import { websites } from '../db/schema/websites.js';
import { db } from '../db/index.js';
import { generateEmbeddings } from '../services/embeddings.js';
import { embeddings as embeddingsTable } from '../db/schema/embeddings.js';
import { eq } from 'drizzle-orm';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Cache for website lookups to avoid repeated database queries
const websiteCache = new Map();

export const createResource = async input => {
    try {
        const { content, url, tags, description, curlCommand, parameters } =
            insertResourceSchema.parse(input);

        // Check cache first to avoid database lookup
        let website;
        if (websiteCache.has(url)) {
            website = websiteCache.get(url);
            logger.debug('Website found in cache', { url });
        } else {
            // Find or create website
            let websiteResult = await db
                .select()
                .from(websites)
                .where(eq(websites.url, url))
                .limit(1);

            if (websiteResult.length === 0) {
                // Extract domain name for website name
                const websiteName = new URL(url).hostname;
                [website] = await db
                    .insert(websites)
                    .values({ url, name: websiteName })
                    .returning();
                logger.info('Website created', { url, name: websiteName });
            } else {
                website = websiteResult[0];
            }

            // Store in cache for future use
            websiteCache.set(url, website);
            logger.debug('Website cached', { url });
        }

        const [resource] = await db
            .insert(resources)
            .values({
                content,
                websiteId: website.id,
                tags,
                description,
                curlCommand,
                parameters,
            })
            .returning();

        const embeddings = await generateEmbeddings(content);
        await db.insert(embeddingsTable).values(
            embeddings.map(embedding => ({
                resourceId: resource.id,
                ...embedding,
            }))
        );

        logger.debug('Resource created and embedded', { resourceId: resource.id, url });
        return 'Resource successfully created and embedded.';
    } catch (error) {
        if (error.name === 'ZodError') {
            logger.error('Resource validation failed', { error: error.errors });
            throw new ValidationError(
                'Invalid resource data: ' + error.errors.map(e => e.message).join(', ')
            );
        }
        logger.error('Failed to create resource', { error: error.message, input });
        throw new DatabaseError('Could not create resource', error);
    }
};

// Helper function to clear the website cache (useful for testing or cleanup)
export const clearWebsiteCache = () => {
    websiteCache.clear();
    logger.debug('Website cache cleared');
};

/**
 * Create multiple resources in a batch using a transaction
 * Much faster than creating resources one by one
 */
export const createResourcesBatch = async inputs => {
    if (!inputs || inputs.length === 0) {
        logger.warn('No resources to create in batch');
        return 0;
    }

    try {
        const url = inputs[0].url;

        // Get or create website once for all resources
        let website = websiteCache.get(url);
        if (!website) {
            let websiteResult = await db
                .select()
                .from(websites)
                .where(eq(websites.url, url))
                .limit(1);

            if (websiteResult.length === 0) {
                const websiteName = new URL(url).hostname;
                [website] = await db
                    .insert(websites)
                    .values({ url, name: websiteName })
                    .returning();
                logger.info('Website created', { url, name: websiteName });
            } else {
                website = websiteResult[0];
            }
            websiteCache.set(url, website);
        }

        // Use transaction for atomic batch insert
        const result = await db.transaction(async tx => {
            // Bulk insert all resources at once
            const insertedResources = await tx
                .insert(resources)
                .values(
                    inputs.map(({ content, tags, description, curlCommand, parameters }) => ({
                        content,
                        websiteId: website.id,
                        tags,
                        description,
                        curlCommand,
                        parameters,
                    }))
                )
                .returning();

            logger.debug(`Inserted ${insertedResources.length} resources in batch`);

            // Generate embeddings in parallel for all resources
            const allEmbeddingsPromises = insertedResources.map(async (resource, idx) => {
                const embeddings = await generateEmbeddings(inputs[idx].content);
                return embeddings.map(emb => ({ resourceId: resource.id, ...emb }));
            });

            const allEmbeddingsArrays = await Promise.all(allEmbeddingsPromises);
            const allEmbeddings = allEmbeddingsArrays.flat();

            // Bulk insert all embeddings at once
            if (allEmbeddings.length > 0) {
                await tx.insert(embeddingsTable).values(allEmbeddings);
                logger.debug(`Inserted ${allEmbeddings.length} embeddings in batch`);
            }

            return insertedResources.length;
        });

        logger.info(`Batch created ${result} resources successfully`, { url });
        return result;
    } catch (error) {
        logger.error('Failed to create resources batch', {
            error: error.message,
            count: inputs.length,
        });
        throw new DatabaseError('Could not create resources in batch', error);
    }
};

/**
 * Create resources without embeddings (for background job processing)
 * Returns the inserted resources so embeddings can be queued separately
 */
export const createResourcesWithoutEmbeddings = async inputs => {
    if (!inputs || inputs.length === 0) {
        logger.warn('No resources to create');
        return [];
    }

    try {
        const url = inputs[0].url;

        // Get or create website once for all resources
        let website = websiteCache.get(url);
        if (!website) {
            let websiteResult = await db
                .select()
                .from(websites)
                .where(eq(websites.url, url))
                .limit(1);

            if (websiteResult.length === 0) {
                const websiteName = new URL(url).hostname;
                [website] = await db
                    .insert(websites)
                    .values({ url, name: websiteName })
                    .returning();
                logger.info('Website created', { url, name: websiteName });
            } else {
                website = websiteResult[0];
            }
            websiteCache.set(url, website);
        }

        // Insert resources without embeddings
        const insertedResources = await db
            .insert(resources)
            .values(
                inputs.map(({ content, tags, description, curlCommand, parameters }) => ({
                    content,
                    websiteId: website.id,
                    tags,
                    description,
                    curlCommand,
                    parameters,
                }))
            )
            .returning();

        logger.info(`Created ${insertedResources.length} resources without embeddings`, { url });
        return insertedResources;
    } catch (error) {
        logger.error('Failed to create resources', {
            error: error.message,
            count: inputs.length,
        });
        throw new DatabaseError('Could not create resources', error);
    }
};
