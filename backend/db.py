from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncIterator
from uuid import UUID

import asyncpg

from config import settings

# Global connection pool
_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(settings.database_url)
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_connection() -> AsyncIterator[asyncpg.Connection]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_api_keys (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    api_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS repos (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    chunks_count INT,
    indexed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id),
    repo_id TEXT NOT NULL REFERENCES repos(id),
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_repo_id ON chats(repo_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
"""


async def init_db():
    async with get_connection() as conn:
        await conn.execute(SCHEMA)


# User operations
async def get_user(user_id: str) -> dict | None:
    async with get_connection() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return dict(row) if row else None


async def create_user(
    user_id: str,
    email: str | None = None,
    name: str | None = None,
    avatar_url: str | None = None,
) -> dict:
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO users (id, email, name, avatar_url)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET
                email = COALESCE(EXCLUDED.email, users.email),
                name = COALESCE(EXCLUDED.name, users.name),
                avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
                updated_at = NOW()
            RETURNING *
            """,
            user_id,
            email,
            name,
            avatar_url,
        )
        return dict(row)


async def delete_user(user_id: str) -> bool:
    async with get_connection() as conn:
        # Delete user's chats first (messages cascade automatically)
        await conn.execute("DELETE FROM chats WHERE user_id = $1", user_id)
        # Now delete the user (api_keys cascade automatically)
        result = await conn.execute("DELETE FROM users WHERE id = $1", user_id)
        return result == "DELETE 1"


async def get_or_create_user(
    user_id: str,
    email: str | None = None,
    name: str | None = None,
    avatar_url: str | None = None,
) -> dict:
    """Lazy sync - get existing user or create if not found."""
    user = await get_user(user_id)
    if not user:
        user = await create_user(user_id, email, name, avatar_url)
    return user


# API Key operations
async def get_user_api_key(user_id: str, provider: str) -> str | None:
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT api_key FROM user_api_keys WHERE user_id = $1 AND provider = $2",
            user_id,
            provider,
        )
        return row["api_key"] if row else None


async def get_user_api_keys(user_id: str) -> dict[str, str]:
    """Get all API keys for a user as {provider: key} dict."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            "SELECT provider, api_key FROM user_api_keys WHERE user_id = $1",
            user_id,
        )
        return {row["provider"]: row["api_key"] for row in rows}


async def set_user_api_key(user_id: str, provider: str, api_key: str) -> None:
    async with get_connection() as conn:
        await conn.execute(
            """
            INSERT INTO user_api_keys (user_id, provider, api_key)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, provider) DO UPDATE SET
                api_key = EXCLUDED.api_key,
                updated_at = NOW()
            """,
            user_id,
            provider,
            api_key,
        )


async def delete_user_api_key(user_id: str, provider: str) -> bool:
    async with get_connection() as conn:
        result = await conn.execute(
            "DELETE FROM user_api_keys WHERE user_id = $1 AND provider = $2",
            user_id,
            provider,
        )
        return result == "DELETE 1"


# Repo operations
async def get_repo(repo_id: str) -> dict | None:
    async with get_connection() as conn:
        row = await conn.fetchrow("SELECT * FROM repos WHERE id = $1", repo_id)
        return dict(row) if row else None


async def create_repo(repo_id: str) -> dict:
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO repos (id, status) VALUES ($1, 'pending')
            ON CONFLICT (id) DO UPDATE SET status = repos.status
            RETURNING *
            """,
            repo_id,
        )
        return dict(row)


async def update_repo_status(
    repo_id: str,
    status: str,
    chunks_count: int | None = None,
    error: str | None = None,
):
    async with get_connection() as conn:
        if status == "ready":
            await conn.execute(
                """
                UPDATE repos SET status = $2, chunks_count = $3, indexed_at = NOW()
                WHERE id = $1
                """,
                repo_id,
                status,
                chunks_count,
            )
        elif status == "error":
            await conn.execute(
                "UPDATE repos SET status = $2, error = $3 WHERE id = $1",
                repo_id,
                status,
                error,
            )
        else:
            await conn.execute(
                "UPDATE repos SET status = $2 WHERE id = $1", repo_id, status
            )


# Chat operations
async def create_chat(user_id: str, repo_id: str, title: str | None = None) -> dict:
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO chats (user_id, repo_id, title)
            VALUES ($1, $2, $3)
            RETURNING *
            """,
            user_id,
            repo_id,
            title,
        )
        return dict(row)


async def get_chat(chat_id: UUID) -> dict | None:
    async with get_connection() as conn:
        row = await conn.fetchrow("SELECT * FROM chats WHERE id = $1", chat_id)
        return dict(row) if row else None


async def get_user_chats(user_id: str) -> list[dict]:
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM chats WHERE user_id = $1
            ORDER BY updated_at DESC
            """,
            user_id,
        )
        return [dict(row) for row in rows]


async def delete_chat(chat_id: UUID) -> bool:
    async with get_connection() as conn:
        result = await conn.execute("DELETE FROM chats WHERE id = $1", chat_id)
        return result == "DELETE 1"


async def update_chat_timestamp(chat_id: UUID):
    async with get_connection() as conn:
        await conn.execute(
            "UPDATE chats SET updated_at = NOW() WHERE id = $1", chat_id
        )


# Message operations
async def create_message(chat_id: UUID, role: str, content: str) -> dict:
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO messages (chat_id, role, content)
            VALUES ($1, $2, $3)
            RETURNING *
            """,
            chat_id,
            role,
            content,
        )
        # Update chat timestamp
        await conn.execute(
            "UPDATE chats SET updated_at = NOW() WHERE id = $1", chat_id
        )
        return dict(row)


async def get_chat_messages(chat_id: UUID) -> list[dict]:
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM messages WHERE chat_id = $1
            ORDER BY created_at ASC
            """,
            chat_id,
        )
        return [dict(row) for row in rows]
