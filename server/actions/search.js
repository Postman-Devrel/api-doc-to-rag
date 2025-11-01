import { db } from '../db/index.js';
import { cosineDistance, desc, gt, sql, eq } from 'drizzle-orm';
import { embeddings } from '../db/schema/embeddings.js';
import { resources } from '../db/schema/resources.js';
import { websites } from '../db/schema/websites.js';
import { generateEmbedding } from '../services/embeddings.js';
import { DatabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const findRelevantContent = async (userQuery, url = null, limit = 4) => {
    try {
        const userQueryEmbedded = await generateEmbedding(userQuery);
        const similarity = sql`1 - (${cosineDistance(embeddings.embedding, userQueryEmbedded)})`;

        // filter by similarity and optionally by URL
        const conditions = [gt(similarity, 0.5)];
        if (url) {
            conditions.push(eq(websites.url, url));
        }

        const similarGuides = await db
            .select({
                content: resources.content, // Return the full content of the resource
                tags: resources.tags,
                description: resources.description,
                curlCommand: resources.curlCommand,
                parameters: resources.parameters,
                similarity,
                url: websites.url,
                websiteName: websites.name,
            })
            .from(embeddings)
            .innerJoin(resources, eq(embeddings.resourceId, resources.id))
            .innerJoin(websites, eq(resources.websiteId, websites.id))
            .where(sql`${conditions.length > 1 ? sql.join(conditions, sql` AND `) : conditions[0]}`)
            .orderBy(t => desc(t.similarity))
            .limit(limit);

        logger.debug(`Found ${similarGuides.length} relevant results`, { query: userQuery, url });

        return similarGuides;
    } catch (error) {
        logger.error('Failed to find relevant content', {
            query: userQuery,
            url,
            error: error.message,
        });
        throw new DatabaseError('Could not search documentation', error);
    }
};
