import asyncio
import json
from collections import defaultdict
from typing import AsyncIterator
from uuid import UUID

import cohere
from langchain_anthropic import ChatAnthropic
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

import db
from config import settings
from errors import log_error


QUERY_GENERATION_PROMPT = """You are an AI assistant helping to generate search queries for a code repository.
Given a user's question about code, generate 3 different search queries that would help find relevant code snippets.
Each query should approach the question from a different angle:
1. A direct technical query using specific terms
2. A conceptual query about the functionality
3. A query focusing on implementation details or patterns

User question: {question}

Output exactly 3 queries, one per line, no numbering or bullets:"""


def reciprocal_rank_fusion(
    result_lists: list[list[Document]], k: int = 60
) -> list[Document]:
    """Combine multiple ranked lists using Reciprocal Rank Fusion."""
    scores: dict[str, float] = defaultdict(float)
    doc_map: dict[str, Document] = {}

    for results in result_lists:
        for rank, doc in enumerate(results):
            doc_id = doc.metadata.get("file", "") + doc.page_content[:100]
            scores[doc_id] += 1 / (k + rank + 1)
            doc_map[doc_id] = doc

    sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [doc_map[doc_id] for doc_id, _ in sorted_docs]


class Sse:
    """Helper class for formatting Server-Sent Events."""

    @staticmethod
    def _format(event: str, data: str) -> dict:
        return {"event": event, "data": data}

    @staticmethod
    def sources(sources: list) -> dict:
        return Sse._format("sources", json.dumps(sources))

    @staticmethod
    def text(content: str) -> dict:
        return Sse._format("text", content)

    @staticmethod
    def error(message: str) -> dict:
        return Sse._format("error", message)

    @staticmethod
    def done() -> dict:
        return Sse._format("done", "")


async def stream_chat_response(
    vectorstore: Chroma,
    repo_id: str,
    messages: list[dict],
    chat_id: UUID,
    anthropic_api_key: str,
) -> AsyncIterator[dict]:
    """Stream chat response with full conversation history."""
    # Get the latest user message for RAG query
    latest_user_message = next(
        (m for m in reversed(messages) if m["role"] == "user"), None
    )

    if not latest_user_message:
        yield Sse.error("No user message found")
        return

    # Build query from last N user messages for better context
    user_messages = [m["content"] for m in messages if m["role"] == "user"]
    last_n_messages = user_messages[-3:]  # Last 3 turns
    query = "\n".join(last_n_messages)

    # Initialize LLM for RAG-Fusion query generation and response
    try:
        llm = ChatAnthropic(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            api_key=anthropic_api_key,
        )
    except Exception as e:
        safe_msg = log_error(e, "llm_init", {"repo_id": repo_id})
        yield Sse.error(safe_msg)
        return

    # RAG-Fusion: Generate multiple query variations
    try:
        query_gen_response = await llm.ainvoke(
            QUERY_GENERATION_PROMPT.format(question=query)
        )
        generated_queries = [
            q.strip() for q in query_gen_response.content.strip().split("\n") if q.strip()
        ]
    except Exception as e:
        safe_msg = log_error(e, "query_generation", {"repo_id": repo_id})
        yield Sse.error(safe_msg)
        return

    # Include original query + generated variations
    all_queries = [query] + generated_queries[:3]

    # Parallel retrieval for all queries
    async def search_query(q: str) -> list[Document]:
        return vectorstore.similarity_search(q, k=10, filter={"repo": repo_id})

    try:
        result_lists = await asyncio.gather(*[search_query(q) for q in all_queries])
    except Exception as e:
        safe_msg = log_error(e, "vector_search", {"repo_id": repo_id})
        yield Sse.error(safe_msg)
        return

    # Reciprocal Rank Fusion to combine results
    fused_results = reciprocal_rank_fusion(result_lists)

    if not fused_results:
        yield Sse.error("No relevant code found")
        return

    # Rerank fused results with Cohere for final precision (graceful degradation)
    if settings.cohere_api_key:
        try:
            co = cohere.Client(api_key=settings.cohere_api_key)
            rerank_response = co.rerank(
                model="rerank-english-v3.0",
                query=latest_user_message["content"],  # Rerank against original query
                documents=[doc.page_content for doc in fused_results[:20]],
                top_n=5,
            )
            results = [fused_results[r.index] for r in rerank_response.results]
        except Exception as e:
            # Log but don't fail - fall back to non-reranked results
            log_error(e, "cohere_rerank", {"repo_id": repo_id})
            results = fused_results[:5]
    else:
        results = fused_results[:5]

    # Extract sources from document metadata
    sources = [doc.metadata for doc in results]
    yield Sse.sources(sources)

    # Build code context
    code_context = "\n\n".join(
        [
            f"### {doc.metadata['file']} ({doc.metadata['name']})\n```\n{doc.page_content}\n```"
            for doc in results
        ]
    )

    system_prompt = f"""You are a helpful assistant that answers questions about a codebase.
Use the provided code snippets to answer the user's questions accurately.
Answer based only on the provided context.
Do not mention missing information or ask for more context.
If information is unavailable, make reasonable assumptions and state them briefly.
Always reference the specific file(s) when citing code.

## Relevant Code from {repo_id}:

{code_context}"""

    # Build conversation history for LangChain
    langchain_messages = [SystemMessage(content=system_prompt)]
    for m in messages:
        if m["role"] == "user":
            langchain_messages.append(HumanMessage(content=m["content"]))
        else:
            langchain_messages.append(AIMessage(content=m["content"]))

    # Accumulate full response
    full_response = ""

    try:
        async for chunk in llm.astream(langchain_messages):
            text = chunk.content
            if text:
                full_response += text
                yield Sse.text(text)
    except Exception as e:
        safe_msg = log_error(e, "llm_stream", {"repo_id": repo_id, "partial_len": len(full_response)})
        if full_response:
            # Partial response was sent - notify client of interruption
            yield Sse.error("Response was interrupted. Partial answer was provided.")
        else:
            yield Sse.error(safe_msg)
        return

    # Save assistant message to database
    try:
        await db.create_message(chat_id, role="assistant", content=full_response)
    except Exception as e:
        # Log but don't fail the stream - message was already sent to client
        log_error(e, "save_message", {"chat_id": str(chat_id)})

    yield Sse.done()
