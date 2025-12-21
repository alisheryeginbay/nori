# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nori is an AI-powered code assistant that enables developers to ask questions about GitHub repositories. It uses vector embeddings (VoyageAI), language-aware code chunking, and LLM-based conversation (Claude) to provide intelligent code analysis.

## Development Commands

### Frontend (Next.js 16 + React 19)
```bash
cd frontend
pnpm dev          # Dev server with Turbopack (port 3000)
pnpm build        # Production build
pnpm lint         # ESLint
```

### Backend (FastAPI + Python 3.13)
```bash
cd backend
docker compose up              # Start backend + PostgreSQL
docker compose watch           # Dev mode with auto-restart on file changes
docker compose up postgres     # Start only PostgreSQL (for local Python dev)
```

For local Python development without Docker:
```bash
cd backend
uv sync                        # Install dependencies
granian --host 0.0.0.0 --port 8000 --reload main:app
```

## Architecture

### Monorepo Structure
- `frontend/` - Next.js app with Clerk auth, shadcn/ui components
- `backend/` - FastAPI with async PostgreSQL, Chroma vectorstore, LangChain

### Backend Modules
| Module | Purpose |
|--------|---------|
| `main.py` | FastAPI app, endpoints, lifespan management |
| `streams.py` | SSE streaming for chat (RAG with Claude) |
| `chroma_service.py` | Vectorstore singleton (dev: SQLite, prod: Chroma Cloud) |
| `chunks.py` | Language-aware code chunking (19 languages) |
| `github.py` | Repo cloning and indexing with batch embeddings |
| `db.py` | Async database operations with connection pooling |
| `config.py` | Pydantic Settings for environment config |

### Frontend Organization
- `app/` - Next.js App Router with route groups
- `app/(app)/` - Protected routes (requires auth)
- `components/chat/` - Chat UI (chat-view, chat-input, indexing-view)
- `components/ui/` - shadcn/ui primitives
- `lib/api.ts` - API client with types

### Key Patterns
- **Streaming**: Both indexing and chat use SSE for real-time updates
- **Async-first**: Backend uses asyncpg pools and async/await throughout
- **Batch embeddings**: Parallel processing (5 concurrent batches) for repo indexing
- **Language-aware chunking**: Semantic code splitting per language using LangChain

### Database Schema
Core tables: `users`, `user_api_keys`, `repos`, `chats`, `messages`

## API Endpoints

- `POST /repos/{owner}/{repo}/index` - Index repository (SSE)
- `GET /repos/{owner}/{repo}` - Get repo status
- `POST /chats` - Create chat
- `GET /chats` - List user chats
- `POST /chats/{chat_id}/messages` - Send message (SSE)
- `PUT /users/{user_id}/api-keys` - Set API key
- `POST /webhooks/clerk` - Clerk webhook (svix verified)

## Environment Variables

### Backend (.env)
- `APP_ENV` - dev|prod
- `FRONTEND_URL` - CORS origin
- `VOYAGE_API_KEY` - VoyageAI embeddings
- `DATABASE_URL` - PostgreSQL connection
- `CLERK_WEBHOOK_SECRET` - Webhook verification

### Frontend (.env.local)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_BACKEND_URL`
