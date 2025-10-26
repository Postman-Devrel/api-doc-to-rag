# API Documentation to RAG Knowledge Base

An AI Agent that that generates a knowledge base for any API documentation, given it's url.

It uses the OpenAI browser use model to control an headless chromium browser, and peruses the entirely of any given API documentation. It generates embeddings for each page or section of the documentation it encounters and stores these embeddings in a pgvector database. It exposes an endpoint that can be used to do a similarity search on the embeddings, and therefore usable in RAG (Retrieval-Augmented Generation) knowledge base systems

## 🏗️ Architecture

```
┌─────────────────┐
│  Browser Agent  │ (CUA + Playwright)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Curl Doc Gen   │ (Structured curls and documentation extraction)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Embeddings     │ (Text-embedding-ada-002)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  PostgreSQL +   │ (Vector storage with pgvector)
│    pgvector     │
└─────────────────┘
```

## 📋 Prerequisites

- **Node.js**: v18 or higher
- **PostgreSQL**: v15+ with pgvector extension
- **OpenAI API Key**: For AI-powered extraction and embeddings
- **Yarn**: Package manager

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Postman-Devrel/api-doc-to-rag.git
cd api-doc-to-rag
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root director. See `.env.examples` for examples.

### 4. Set Up Database

```bash
# [Install pgvector extension](https://github.com/pgvector/pgvector#installation) in PostgreSQL
# Run this in your PostgreSQL console:
# `CREATE EXTENSION IF NOT EXISTS vector;`

# Set up vector extension support
yarn db:setup

# Run migrations
yarn db:migrate
```

### 5. Start the Server

```bash
# Development mode (with hot reload)
yarn dev

OR

yarn start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## 📚 API Endpoints

### Health Check

```http
GET /health
```

### Generate Knowledge Base

Scrapes an API documentation website and stores it in the knowledge base.

```http
POST /knowledge-base
Content-Type: application/json

{
  "url": "https://docs.example.com"
}
```

### Search Documentation

Performs semantic search on the knowledge base.

```http
GET /documentation/search?query=authentication&url=https://docs.example.com
```

### Generate OpenAPI Specification

Generates an OpenAPI specification from stored documentation.

```http
GET /documentation/openapi?url=https://docs.example.com
```

### Project Structure

```
├── actions/          # Business logic
│   ├── openapi.js    # OpenAPI generation
│   ├── resources.js  # Resource management
│   └── search.js     # Semantic search
├── agents/           # AI agents
│   ├── browser.js    # Browser automation agent
│   ├── curl.js       # Curl documentation extractor
│   └── openapi.js    # OpenAPI generator agent
├── browser/          # Browser automation
│   ├── action.js     # Browser action handlers
│   ├── index.js      # Browser initialization
│   └── start.js      # Browser startup
├── constants/        # Configuration
│   ├── prompt.js     # AI prompts
│   └── schema.js     # Data schemas
├── db/               # Database
│   ├── index.js      # Database client
│   ├── migrate.js    # Migration runner
│   ├── schema/       # Drizzle schemas
│   └── migrations/   # SQL migrations
├── middleware/       # Express middleware
│   └── errorHandler.js
├── services/         # External services
│   ├── embeddings.js # Embedding generation
│   └── openai.js     # OpenAI client
├── utils/            # Utilities
│   ├── errors.js     # Custom error classes
│   ├── logger.js     # Logging utility
│   └── utils.js      # Helper functions
└── server.js         # Express server
```

## 📊 Database Schema

### Tables

- **websites**: Stores website metadata
- **resources**: Stores extracted documentation content
- **embeddings**: Stores vector embeddings for semantic search

### Indexes

- HNSW index on embeddings for fast vector similarity search

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details
