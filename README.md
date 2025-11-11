# API Documentation to RAG Knowledge Base

An AI Agent that generates a knowledge base for any API documentation, given its URL.

It uses the OpenAI browser use model to control a headless chromium browser, and peruses the entirety of any given API documentation. It generates embeddings for each page or section of the documentation it encounters and stores these embeddings in a pgvector database. It exposes an endpoint that can be used to do a similarity search on the embeddings, and therefore usable in RAG (Retrieval-Augmented Generation) knowledge base systems.

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

## 📁 Project Structure

```
doc-collection-gen/
├── client/                    # Vue.js Frontend
│   └── package.json
├── server/                    # Express Backend
│   ├── agents/               # AI agents
│   ├── actions/              # Business logic
│   ├── db/                   # Database
│   ├── package.json
│   └── drizzle.config.js
├── package.json              # Root workspace manager
└── yarn.lock                 # Yarn lockfile
```

## 📋 Prerequisites

- **Node.js**: v18 or higher
- **Yarn**: v1.22+ (Classic)
- **PostgreSQL**: v15+ with pgvector extension
- **Redis**: For background job processing
- **OpenAI API Key**: For AI-powered extraction and embeddings

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

This single command installs dependencies for all workspaces (root, client, server).

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...
ORGANIZATIONAL_ID=your_org_id_here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Redis (for background jobs)
REDIS_HOST=localhost
REDIS_PORT=6379

# Browser Configuration
DISPLAY_WIDTH=1280
DISPLAY_HEIGHT=800
SCREENSHOT_QUALITY=60
```

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

### 5. Set Up Redis (for Background Jobs)

**macOS (Homebrew)**:

```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian**:

```bash
sudo apt install redis-server
sudo systemctl start redis
```

**Docker** (easiest):

```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

**Verify Redis is running**:

```bash
redis-cli ping  # Should return: PONG
```

### 6. Start the Background Workers

In a **separate terminal**, start the BullMQ workers:

```bash
# Production mode
yarn workers

# Or development mode (with auto-reload)
yarn workers:dev
```

You should see:

```
Curl generation worker started
Embeddings generation worker started
All workers started and ready to process jobs
```

> **Important**: Keep this terminal running! The workers process curl generation and embeddings in the background, making the scraping much faster.

### 7. Start the Server

```bash
# Development mode (with hot reload)
yarn dev

# Or production mode
yarn start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### 8. Start the Frontend (Optional)

```bash
# In a separate terminal
yarn client:dev
```

The client will start on `http://localhost:5173`.

## 📝 Available Commands

```bash
# Server
yarn start              # Start production server
yarn dev                # Start dev server with hot reload

# Background Workers (Required for scraping!)
yarn workers            # Start workers in production
yarn workers:dev        # Start workers with auto-reload

# Client
yarn client:dev         # Start Vite dev server
yarn client:build       # Build for production

# Database
yarn db:setup           # Setup pgvector extension
yarn db:migrate         # Run migrations
yarn db:push            # Push schema changes
yarn db:studio          # Open Drizzle Studio
yarn db:generate        # Generate migrations

# Utilities
yarn format             # Format code with Prettier
yarn format:check       # Check code formatting
```

## 📚 API Endpoints

### Generate Knowledge Base

Scrapes an API documentation website and stores it in the knowledge base.

```http
POST /knowledge-base
Content-Type: application/json

{
  "url": "https://docs.example.com"
}
```

### Stream Progress (SSE)

Get real-time progress updates while generating documentation.

```http
GET /knowledge-base/stream?url=https://docs.example.com
```

### Search Documentation

Performs semantic search on the knowledge base.

```http
GET /api/search?query=authentication&url=https://docs.example.com
```

### Generate Postman Collection

Generates a Postman collection from stored documentation.

```http
GET /documentation/postman?url=https://docs.example.com&useAI=false
```

### Health Check

```http
GET /health
```

## 🎯 Workspace Commands

```bash
# Run command in specific workspace
yarn workspace server <command>
yarn workspace client <command>

# Install package to specific workspace
yarn workspace server add <package>
yarn workspace client add <package>

# Example: Add a package to server
yarn workspace server add express-rate-limit
```

## 🔧 Environment Variables

```

## 🛠️ Tech Stack

**Frontend:**

- Vue 3 (Composition API)
- Vite
- Tailwind CSS
- Server-Sent Events (SSE)

**Backend:**

- Express.js
- OpenAI API (Computer Use + Embeddings)
- Playwright (browser automation)
- BullMQ + Redis (background job processing)
- Drizzle ORM + PostgreSQL + pgvector
- Winston (logging)

**Monorepo:**

- Yarn Workspaces
- Single lockfile
- Shared dependencies

## ⚡ Background Job Processing

This application uses **BullMQ** with **Redis** for high-performance background processing:

### How It Works

```

Browser Agent → Queue Curl Jobs → Curl Workers (parallel)
↓
Server ← Results ← Complete
↓
Create Resources in DB
↓
Queue Embeddings → Embeddings Workers (parallel) → Store in DB

```

### Performance Benefits

- **~15x faster scraping**: No waiting for curl/embeddings during scraping
- **Parallel processing**: 3 curl + 5 embeddings jobs at once
- **Resilient**: Automatic retries with exponential backoff
- **Real-time updates**: SSE events track job progress

### Setup

1. **Install Redis** (see step 5 in Quick Start)
2. **Start workers** in a separate terminal: `yarn workers`
3. **Start server**: `yarn dev`

For detailed information, see [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md).

### Example Use Case

This can be used as a RAG database to provide an in-memory context to an LLM, or the APIs can be exposed as a tool in an MCP Server.
This example shows how you can use [Postman's Agent Mode](https://www.postman.com/product/agent-mode/) to generate an MCP server from these APIs and use that MCP server to provide additional context to Agent Mode.

**Step 1:** Fork the collection <br />
[<img src="https://run.pstmn.io/button.svg" alt="Run In Postman" style="width: 128px; height: 32px;">](https://god.gw.postman.com/run-collection/21505573-fb56bc16-9711-47c8-8cfc-f13de56ba0d2?action=collection%2Ffork&source=rip_markdown&collection-url=entityId%3D21505573-fb56bc16-9711-47c8-8cfc-f13de56ba0d2%26entityType%3Dcollection%26workspaceId%3D1ee78290-27f9-489e-8c05-6ba1885fa187)

**Step 2:** Generate an MCP Server using [Postman's MCP Server Generator](https://www.postman.com/explore/mcp-generator).

**Step 3:** Connect Agent Mode to the generated MCP Server
<img width="901" height="785" alt="Screenshot 2025-10-30 at 18 51 30" src="https://github.com/user-attachments/assets/28b342ff-7aca-4a6d-8c17-c04446ccef22" />


**Step 4:** Prompt Agent mode and watch it use its tools to query its knowledge base
<img width="901" height="818" alt="Screenshot 2025-10-30 at 18 58 37" src="https://github.com/user-attachments/assets/e80a6953-461e-49e2-83b4-e6f74ffaaeda" />



## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and formatting: `yarn format`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details
```
