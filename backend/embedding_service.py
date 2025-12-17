import voyageai

from config import settings


def get_voyage_client() -> voyageai.Client:
    return voyageai.Client(api_key=settings.voyage_api_key)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts using Voyage voyage-code-3"""
    client = get_voyage_client()
    result = client.embed(texts, model="voyage-code-3", input_type="document")
    return result.embeddings


def embed_query(query: str) -> list[float]:
    """Embed a single query using Voyage voyage-code-3"""
    client = get_voyage_client()
    result = client.embed([query], model="voyage-code-3", input_type="query")
    return result.embeddings[0]
