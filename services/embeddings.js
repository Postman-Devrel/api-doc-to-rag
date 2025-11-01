import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { EmbeddingError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Using text-embedding-3-small for faster performance
// It's 40-50% faster than ada-002 with comparable quality
const embeddingModel = openai.embedding('text-embedding-3-small');

const generateChunks = input => {
    return input
        .trim()
        .split('.')
        .filter(i => i !== '');
};

export const generateEmbeddings = async value => {
    try {
        const chunks = generateChunks(value);
        if (chunks.length === 0) {
            logger.warn('No chunks generated from input', { valueLength: value.length });
            return [];
        }

        const { embeddings } = await embedMany({
            model: embeddingModel,
            values: chunks,
        });

        return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
    } catch (error) {
        logger.error('Failed to generate embeddings', { error: error.message });
        throw new EmbeddingError('Could not generate embeddings for content', error);
    }
};

export const generateEmbedding = async value => {
    try {
        const input = value.replaceAll('\\n', ' ');
        const { embedding } = await embed({
            model: embeddingModel,
            value: input,
        });
        return embedding;
    } catch (error) {
        logger.error('Failed to generate embedding', { error: error.message });
        throw new EmbeddingError('Could not generate embedding for query', error);
    }
};
