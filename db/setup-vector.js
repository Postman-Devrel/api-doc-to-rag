import { env } from "../env.mjs";
import postgres from "postgres";

const setupVector = async () => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = postgres(env.DATABASE_URL, { max: 1 });

  try {
    console.log("⏳ Checking pgvector extension...");

    // Check if extension exists
    const result = await connection`
      SELECT * FROM pg_available_extensions WHERE name = 'vector';
    `;

    if (result.length === 0) {
      console.log("❌ pgvector extension is NOT installed on your PostgreSQL server.");
      console.log("\nTo install pgvector, follow these steps:");
      console.log("\n📦 Installation instructions:");
      console.log("\nFor macOS (using Homebrew):");
      console.log("  brew install pgvector");
      console.log("\nFor Ubuntu/Debian:");
      console.log("  sudo apt install postgresql-15-pgvector");
      console.log("\nFor Docker:");
      console.log("  Use the image: pgvector/pgvector:pg16");
      console.log("\nFor other systems, visit: https://github.com/pgvector/pgvector#installation");
      process.exit(1);
    }

    console.log("✅ pgvector extension is available");

    // Try to enable it
    console.log("⏳ Enabling pgvector extension...");
    await connection`CREATE EXTENSION IF NOT EXISTS vector;`;
    
    console.log("✅ pgvector extension enabled successfully!");

    // Verify it's enabled
    const enabled = await connection`
      SELECT * FROM pg_extension WHERE extname = 'vector';
    `;

    if (enabled.length > 0) {
      console.log("✅ Vector extension is active and ready to use!");
    }

  } catch (err) {
    console.error("❌ Setup failed:");
    console.error(err.message);
    
    if (err.code === '42501') {
      console.log("\n⚠️  Permission denied. You need superuser privileges to create extensions.");
      console.log("Ask your database administrator to run:");
      console.log("  CREATE EXTENSION IF NOT EXISTS vector;");
    }
    
    process.exit(1);
  } finally {
    await connection.end();
  }
};

setupVector();

