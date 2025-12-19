from functools import lru_cache

from langchain_chroma import Chroma
from langchain_voyageai import VoyageAIEmbeddings

from config import settings


@lru_cache
def get_embeddings() -> VoyageAIEmbeddings:
    """Get singleton embeddings instance."""
    return VoyageAIEmbeddings(
        model="voyage-code-3",
        voyage_api_key=settings.voyage_api_key,
    )


@lru_cache
def get_vectorstore() -> Chroma:
    """Get LangChain Chroma vectorstore."""
    if settings.use_chroma_cloud:
        import chromadb

        client = chromadb.CloudClient(
            tenant=settings.chroma_cloud_tenant,
            database=settings.chroma_cloud_database,
            api_key=settings.chroma_cloud_api_key,
        )
        return Chroma(
            client=client,
            collection_name="repos",
            embedding_function=get_embeddings(),
        )

    # Dev: Use persistent local storage
    return Chroma(
        collection_name="repos",
        persist_directory=settings.chroma_persist_dir,
        embedding_function=get_embeddings(),
    )
