import 'dotenv/config';

export default {
    schema: './db/schema',
    dialect: 'postgresql',
    out: './db/migrations',
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
};
