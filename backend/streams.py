import json
from typing import AsyncIterator
from uuid import UUID

import cohere
from langchain_anthropic import ChatAnthropic
from langchain_chroma import Chroma
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

import db
from config import settings


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

    # Query relevant code chunks using vectorstore
    # Retrieve more candidates for reranking
    query = latest_user_message["content"]
    results = vectorstore.similarity_search(
        query,
        k=20,
        filter={"repo": repo_id},
    )

    if not results:
        yield Sse.error("No relevant code found")
        return

    # Rerank results with Cohere for better precision
    if settings.cohere_api_key:
        co = cohere.Client(api_key=settings.cohere_api_key)
        rerank_response = co.rerank(
            model="rerank-english-v3.0",
            query=query,
            documents=[doc.page_content for doc in results],
            top_n=5,
        )
        results = [results[r.index] for r in rerank_response.results]
    else:
        # Fallback to top 5 without reranking
        results = results[:5]

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
If the answer isn't in the provided context, say so.
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

    # Create LangChain ChatAnthropic client
    llm = ChatAnthropic(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        api_key=anthropic_api_key,
    )

    # Accumulate full response
    full_response = ""

    async for chunk in llm.astream(langchain_messages):
        text = chunk.content
        if text:
            full_response += text
            yield Sse.text(text)

    # Save assistant message to database
    await db.create_message(chat_id, role="assistant", content=full_response)

    yield Sse.done()
