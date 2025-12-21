import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Annotated, AsyncIterator
from uuid import UUID

from langchain_chroma import Chroma
from langchain_core.documents import Document
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from streams import stream_chat_response
from github import index_repo
from chroma_service import get_vectorstore
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from config import settings
import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    yield
    await db.close_pool()


app = FastAPI(title="Nori API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


VectorStoreDep = Annotated[Chroma, Depends(get_vectorstore)]


@app.get("/")
async def root():
    return {"message": "Hello from backend!!!"}


@app.get("/health")
async def health(vectorstore: VectorStoreDep):
    try:
        # Quick check that vectorstore is accessible
        vectorstore._collection.count()
        return {"status": "ok", "chroma": "connected"}
    except Exception:
        return {"status": "degraded", "chroma": "unavailable"}


@app.post("/add")
async def test(text: str, vectorstore: VectorStoreDep):
    doc = Document(page_content=text, id=str(hash(text)))
    vectorstore.add_documents([doc])


# --- Repos Endpoints ---


MAX_REPO_SIZE_MB = 500  # Temporary limit


async def index_repo_stream(
    owner: str,
    repo: str,
    vectorstore: Chroma,
) -> AsyncIterator[dict]:
    """Stream repo indexing progress as SSE events."""
    import json
    import httpx

    repo_id = f"{owner}/{repo}"

    # Check if already indexed
    existing = await db.get_repo(repo_id)
    if existing and existing["status"] == "ready":
        yield {
            "event": "done",
            "data": json.dumps(
                {
                    "status": "ready",
                    "chunks_count": existing["chunks_count"],
                    "indexed_at": existing["indexed_at"].isoformat()
                    if existing["indexed_at"]
                    else None,
                    "cached": True,
                }
            ),
        }
        return

    # Check repo size before cloning
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"https://api.github.com/repos/{owner}/{repo}")
            if response.status_code == 200:
                repo_data = response.json()
                size_kb = repo_data.get("size", 0)
                size_mb = size_kb / 1024
                if size_mb > MAX_REPO_SIZE_MB:
                    yield {
                        "event": "error",
                        "data": json.dumps(
                            {
                                "message": f"Repository is too large ({size_mb:.0f}MB). Maximum allowed size is {MAX_REPO_SIZE_MB}MB."
                            }
                        ),
                    }
                    return
            elif response.status_code == 404:
                yield {
                    "event": "error",
                    "data": json.dumps(
                        {
                            "message": "Repository not found. Please check the URL and make sure it's a public repository."
                        }
                    ),
                }
                return
    except Exception:
        pass  # Continue anyway if we can't check size

    # Create or get repo record
    await db.create_repo(repo_id)
    await db.update_repo_status(repo_id, "indexing")

    yield {"event": "status", "data": json.dumps({"stage": "cloning", "progress": 0})}

    try:
        # Clone and parse
        chunks = await index_repo(f"https://github.com/{owner}/{repo}.git")

        yield {
            "event": "status",
            "data": json.dumps(
                {
                    "stage": "parsing",
                    "progress": 30,
                    "files_found": len(set(c["file"] for c in chunks)),
                }
            ),
        }

        if not chunks:
            await db.update_repo_status(repo_id, "error", error="No code found in repo")
            yield {
                "event": "error",
                "data": json.dumps({"message": "No code found in repo"}),
            }
            return

        yield {
            "event": "status",
            "data": json.dumps(
                {
                    "stage": "embedding",
                    "progress": 50,
                    "chunks": len(chunks),
                }
            ),
        }

        # Build LangChain documents
        docs = [
            Document(
                page_content=chunk["content"],
                metadata={
                    "repo": repo_id,
                    "file": chunk["file"],
                    "type": chunk["type"],
                    "name": chunk["name"],
                    "line": chunk["line"],
                },
                id=f"{owner}::{repo}::{chunk['file']}::{chunk['name']}::{chunk['line']}",
            )
            for chunk in chunks
        ]

        yield {
            "event": "status",
            "data": json.dumps(
                {
                    "stage": "storing",
                    "progress": 80,
                }
            ),
        }

        # Store in vectorstore in parallel batches for speed
        BATCH_SIZE = 500
        MAX_PARALLEL = 5  # Process 5 batches concurrently

        batches = [docs[i : i + BATCH_SIZE] for i in range(0, len(docs), BATCH_SIZE)]

        async def process_batches():
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor(max_workers=MAX_PARALLEL) as executor:
                tasks = [
                    loop.run_in_executor(executor, vectorstore.add_documents, batch)
                    for batch in batches
                ]
                await asyncio.gather(*tasks)

        await process_batches()

        # Update repo status
        await db.update_repo_status(repo_id, "ready", chunks_count=len(chunks))

        yield {
            "event": "done",
            "data": json.dumps(
                {
                    "status": "ready",
                    "chunks_count": len(chunks),
                    "cached": False,
                }
            ),
        }

    except Exception as e:
        await db.update_repo_status(repo_id, "error", error=str(e))
        yield {"event": "error", "data": json.dumps({"message": str(e)})}


class IndexRepoRequest(BaseModel):
    user_id: str


@app.post("/repos/{owner}/{repo}/index")
async def index_repo_endpoint(
    owner: str,
    repo: str,
    body: IndexRepoRequest,
    vectorstore: VectorStoreDep,
):
    return EventSourceResponse(
        index_repo_stream(owner, repo, vectorstore),
        media_type="text/event-stream",
    )


@app.get("/repos/{owner}/{repo}")
async def get_repo_status(owner: str, repo: str):
    repo_id = f"{owner}/{repo}"
    repo_data = await db.get_repo(repo_id)
    if not repo_data:
        raise HTTPException(status_code=404, detail="Repo not found")
    return repo_data


# --- Chat Endpoints ---


class CreateChatRequest(BaseModel):
    repo_id: str  # "owner/repo"
    user_id: str  # from Clerk


class SendMessageRequest(BaseModel):
    content: str
    user_id: str  # from Clerk


@app.post("/chats")
async def create_chat(body: CreateChatRequest):
    # Check if repo is indexed
    repo = await db.get_repo(body.repo_id)
    if not repo or repo["status"] != "ready":
        raise HTTPException(status_code=400, detail="Repo not indexed")

    chat = await db.create_chat(user_id=body.user_id, repo_id=body.repo_id)
    return chat


@app.get("/chats")
async def list_chats(user_id: str):
    chats = await db.get_user_chats(user_id)
    return chats


@app.get("/chats/{chat_id}")
async def get_chat(chat_id: UUID):
    chat = await db.get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = await db.get_chat_messages(chat_id)
    return {**chat, "messages": messages}


@app.delete("/chats/{chat_id}")
async def delete_chat(chat_id: UUID):
    deleted = await db.delete_chat(chat_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"deleted": True}


@app.post("/chats/{chat_id}/messages")
async def send_message(
    chat_id: UUID,
    body: SendMessageRequest,
    vectorstore: VectorStoreDep,
):
    # Get chat
    chat = await db.get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Get user's Anthropic key (required)
    anthropic_key = await db.get_user_api_key(body.user_id, "anthropic")
    if not anthropic_key:
        raise HTTPException(
            status_code=400,
            detail="Anthropic API key required. Please add your API key in settings.",
        )

    # Save user message
    await db.create_message(chat_id, role="user", content=body.content)

    # Get all messages for context
    messages = await db.get_chat_messages(chat_id)

    return EventSourceResponse(
        stream_chat_response(
            vectorstore=vectorstore,
            repo_id=chat["repo_id"],
            messages=messages,
            chat_id=chat_id,
            anthropic_api_key=anthropic_key,
        ),
        media_type="text/event-stream",
    )


# --- User Endpoints ---


class UpdateApiKeysRequest(BaseModel):
    anthropic_api_key: str | None = None


@app.get("/users/{user_id}")
async def get_user(user_id: str):
    user = await db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    has_anthropic_key = await db.get_user_api_key(user_id, "anthropic") is not None
    return {
        **user,
        "has_anthropic_key": has_anthropic_key,
    }


@app.put("/users/{user_id}/api-keys")
async def update_api_keys(user_id: str, body: UpdateApiKeysRequest):
    user = await db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.anthropic_api_key is not None:
        if body.anthropic_api_key:
            await db.set_user_api_key(user_id, "anthropic", body.anthropic_api_key)
        else:
            await db.delete_user_api_key(user_id, "anthropic")

    has_anthropic_key = await db.get_user_api_key(user_id, "anthropic") is not None
    return {"has_anthropic_key": has_anthropic_key}


@app.get("/users/{user_id}/recent-repos")
async def get_user_recent_repos(user_id: str, limit: int = 6):
    """Get repos the user has recently chatted with."""
    repos = await db.get_user_recent_repos(user_id, limit)
    return repos


# --- Clerk Webhook ---


@app.post("/webhooks/clerk")
async def clerk_webhook(request: Request):
    from svix.webhooks import Webhook, WebhookVerificationError

    if not settings.clerk_webhook_secret:
        # Skip verification in dev if no secret configured
        payload = await request.json()
    else:
        # Verify webhook signature
        headers = dict(request.headers)
        payload_bytes = await request.body()

        try:
            wh = Webhook(settings.clerk_webhook_secret)
            payload = wh.verify(payload_bytes, headers)
        except WebhookVerificationError:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = payload.get("type")
    data = payload.get("data", {})

    if event_type == "user.created":
        await db.create_user(
            user_id=data["id"],
            email=data.get("email_addresses", [{}])[0].get("email_address"),
            name=f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
            or None,
            avatar_url=data.get("image_url"),
        )
    elif event_type == "user.updated":
        await db.create_user(  # Upsert
            user_id=data["id"],
            email=data.get("email_addresses", [{}])[0].get("email_address"),
            name=f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
            or None,
            avatar_url=data.get("image_url"),
        )
    elif event_type == "user.deleted":
        await db.delete_user(data["id"])

    return {"received": True}
