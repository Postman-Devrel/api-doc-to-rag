import { sql } from 'drizzle-orm';
import { text, varchar, timestamp, pgTable } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { nanoid } from '../../utils/utils.js';

export const websites = pgTable('websites', {
    id: varchar('id', { length: 191 })
        .primaryKey()
        .$defaultFn(() => nanoid()),
    url: text('url').notNull().unique(),
    name: text('name'),

    createdAt: timestamp('created_at')
        .notNull()
        .default(sql`now()`),
    updatedAt: timestamp('updated_at')
        .notNull()
        .default(sql`now()`),
});

export const insertWebsiteSchema = createSelectSchema(websites).extend({}).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
