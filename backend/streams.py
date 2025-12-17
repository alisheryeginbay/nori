import json
from typing import AsyncIterator
import anthropic
import chromadb
from sentence_transformers import SentenceTransformer


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


async def stream_repo_query(
    repos: chromadb.Collection,
    client: anthropic.AsyncAnthropic,
    model: SentenceTransformer,
    repo_id: str,
    query: str,
) -> AsyncIterator[str]:
    results = repos.query(
        query_embeddings=[model.encode(query).tolist()],
        n_results=5,
        where={"repo": repo_id},
    )

    if not results["documents"][0]:
        yield Sse.error("Repo not indexed or no relevant code found")
        return

    sources = results["metadatas"][0]
    yield Sse.sources(sources)

    system_prompt = """You are a helpful assistant that answers questions about a codebase.
Use the provided code snippets to answer the user's question accurately.
If the answer isn't in the provided context, say so.
Always reference the specific file(s) when citing code."""

    context = "\n\n".join(
        [
            f"### {m['file']} ({m['name']})\n```\n{doc}\n```"
            for doc, m in zip(results["documents"][0], sources)
        ]
    )

    async with client.messages.stream(
        model="claude-sonnet-4-5-20250929",
        max_tokens=2048,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": f"Code:\n\n{context}\n\n---\n\nQuestion: {query}",
            }
        ],
    ) as response:
        async for text in response.text_stream:
            yield Sse.text(text)

    yield Sse.done()
