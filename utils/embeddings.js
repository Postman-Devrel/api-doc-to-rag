import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db } from '../db/index.js';
import { cosineDistance, desc, gt, sql, eq } from 'drizzle-orm';
import { embeddings } from '../db/schema/embeddings.js';
import { resources } from '../db/schema/resources.js';

const embeddingModel = openai.embedding('text-embedding-ada-002');

const generateChunks = (input) => {
  return input
    .trim()
    .split('.')
    .filter(i => i !== '');
};

export const generateEmbeddings = async (value) => {
  const chunks = generateChunks(value);
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });
  return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
};

export const generateEmbedding = async (value) => {
  const input = value.replaceAll('\\n', ' ');
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  });
  return embedding;
};

export const findRelevantContent = async (userQuery) => {
  const userQueryEmbedded = await generateEmbedding(userQuery);
  const similarity = sql`1 - (${cosineDistance(
    embeddings.embedding,
    userQueryEmbedded,
  )})`;
  const similarGuides = await db
    .select({ 
      content: embeddings.content, 
      similarity,
      url: resources.url 
    })
    .from(embeddings)
    .innerJoin(resources, eq(embeddings.resourceId, resources.id))
    .where(gt(similarity, 0.5))
    .orderBy(t => desc(t.similarity))
    .limit(4);
  return similarGuides;
};