from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Annotated

import anthropic
import chromadb
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from streams import stream_repo_query
from github import index_repo
from anthropic_service import get_anthropic_client
from chroma_service import (
    get_chroma_client,
    get_repos_collection,
)
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from sentence_transformers import SentenceTransformer


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_model()  # Pre-load embedding model at startup
    yield


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


@lru_cache
def get_model() -> SentenceTransformer:
    return SentenceTransformer("nomic-ai/nomic-embed-text-v1.5", trust_remote_code=True)


ChromaClientDep = Annotated[chromadb.HttpClient, Depends(get_chroma_client)]
ModelDep = Annotated[SentenceTransformer, Depends(get_model)]
ReposDep = Annotated[chromadb.Collection, Depends(get_repos_collection)]
AnthropicDep = Annotated[anthropic.AsyncAnthropic, Depends(get_anthropic_client)]


@app.get("/")
async def root():
    return {"message": "Hello from backend!!!"}


@app.get("/health")
async def health(client: ChromaClientDep):
    try:
        heartbeat = client.heartbeat()
        return {"status": "ok", "chroma": heartbeat}
    except Exception:
        return {"status": "degraded", "chroma": "unavailable"}


@app.post("/add")
async def test(text: str, model: ModelDep, repos: ReposDep):
    repos.add(
        ids=[str(hash(text))],
        embeddings=[model.encode(text).tolist()],
        documents=[text],
    )


class ChatRequest(BaseModel):
    query: str


@app.post("/github/{owner}/{repo}")
async def github(
    owner: str,
    repo: str,
    body: ChatRequest,
    model: ModelDep,
    repos: ReposDep,
    anthropic: AnthropicDep,
):
    chunks = await index_repo(f"https://github.com/{owner}/{repo}.git")
    for chunk in chunks:
        repos.add(
            ids=[f"{owner}::{repo}::{chunk['file']}::{chunk['name']}"],
            embeddings=[model.encode(chunk["content"]).tolist()],
            documents=[chunk["content"]],
            metadatas=[
                {
                    "repo": f"{owner}/{repo}",
                    "file": chunk["file"],
                    "type": chunk["type"],
                    "name": chunk["name"],
                }
            ],
        )

    return EventSourceResponse(
        stream_repo_query(
            repos, anthropic, model, repo_id=f"{owner}/{repo}", query=body.query
        ),
        media_type="text/event-stream",
    )
