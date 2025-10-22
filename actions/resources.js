import { insertResourceSchema, resources } from '../db/schema/resources.js';
import { db } from '../db/index.js';
import { generateEmbeddings } from '../utils/embeddings.js';
import { embeddings as embeddingsTable } from '../db/schema/embeddings.js';

export const createResource = async input => {
    try {
        const { content, url } = insertResourceSchema.parse(input);

        const [resource] = await db.insert(resources).values({ content, url }).returning();

        const embeddings = await generateEmbeddings(content);
        await db.insert(embeddingsTable).values(
            embeddings.map(embedding => ({
                resourceId: resource.id,
                ...embedding,
            }))
        );
        console.log('Embeddings created => ', embeddings);

        return 'Resource successfully created and embedded.';
    } catch (error) {
        return error instanceof Error && error.message.length > 0
            ? error.message
            : 'Error, please try again.';
    }
};
