const { config } = require('dotenv');
const path = require('path');

// Load .env from root directory
config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
    schema: './db/schema',
    dialect: 'postgresql',
    out: './db/migrations',
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
};
