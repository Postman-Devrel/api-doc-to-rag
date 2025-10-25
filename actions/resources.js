import { insertResourceSchema, resources } from '../db/schema/resources.js';
import { websites } from '../db/schema/websites.js';
import { db } from '../db/index.js';
import { generateEmbeddings } from '../services/embeddings.js';
import { embeddings as embeddingsTable } from '../db/schema/embeddings.js';
import { eq } from 'drizzle-orm';

export const createResource = async input => {
    try {
        const { content, url } = insertResourceSchema.parse(input);

        // Find or create website
        let website = await db.select().from(websites).where(eq(websites.url, url)).limit(1);

        if (website.length === 0) {
            // Extract domain name for website name
            const websiteName = new URL(url).hostname;
            [website] = await db.insert(websites).values({ url, name: websiteName }).returning();
            console.log('Website created => ', website);
        } else {
            website = website[0];
        }

        const [resource] = await db
            .insert(resources)
            .values({ content, websiteId: website.id })
            .returning();

        const embeddings = await generateEmbeddings(content);
        await db.insert(embeddingsTable).values(
            embeddings.map(embedding => ({
                resourceId: resource.id,
                ...embedding,
            }))
        );

        return 'Resource successfully created and embedded.';
    } catch (error) {
        return error instanceof Error && error.message.length > 0
            ? error.message
            : 'Error, please try again.';
    }
};
