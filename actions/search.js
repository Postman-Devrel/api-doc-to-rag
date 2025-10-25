import { db } from '../db/index.js';
import { cosineDistance, desc, gt, sql, eq } from 'drizzle-orm';
import { embeddings } from '../db/schema/embeddings.js';
import { resources } from '../db/schema/resources.js';
import { websites } from '../db/schema/websites.js';
import { generateEmbedding } from '../services/embeddings.js';

export const findRelevantContent = async (userQuery, url = null) => {
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
            similarity,
            url: websites.url,
            websiteName: websites.name,
        })
        .from(embeddings)
        .innerJoin(resources, eq(embeddings.resourceId, resources.id))
        .innerJoin(websites, eq(resources.websiteId, websites.id))
        .where(sql`${conditions.length > 1 ? sql.join(conditions, sql` AND `) : conditions[0]}`)
        .orderBy(t => desc(t.similarity))
        .limit(4);
    return similarGuides;
};
