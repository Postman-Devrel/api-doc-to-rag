import { sql } from 'drizzle-orm';
import { text, varchar, timestamp, pgTable, jsonb } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { nanoid } from '../../utils/utils.js';
import { websites } from './websites.js';

export const resources = pgTable('resources', {
    id: varchar('id', { length: 191 })
        .primaryKey()
        .$defaultFn(() => nanoid()),
    content: text('content').notNull(),
    tags: text('tags'),
    description: text('description'),
    curlCommand: text('curl_command'),
    parameters: jsonb('parameters'), // Store parameters as JSONB for flexibility
    websiteId: varchar('website_id', { length: 191 })
        .notNull()
        .references(() => websites.id, {
            onDelete: 'cascade',
        }),

    createdAt: timestamp('created_at')
        .notNull()
        .default(sql`now()`),
    updatedAt: timestamp('updated_at')
        .notNull()
        .default(sql`now()`),
});

// Schema for resources - used to validate API requests
// Accepts url as input to find/create website, but doesn't store it in resources table
export const insertResourceSchema = createSelectSchema(resources)
    .extend({
        url: z.string().url(), // Input parameter to find/create website
        parameters: z
            .array(
                z.object({
                    name: z.string(),
                    type: z.string(),
                    required: z.boolean(),
                    description: z.string(),
                })
            )
            .optional(),
    })
    .omit({
        id: true,
        createdAt: true,
        updatedAt: true,
        websiteId: true, // Computed internally from url
    });
