import "dotenv/config";

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PORT: process.env.PORT || 3000,
};