import logging
from functools import lru_cache

from langchain_chroma import Chroma
from langchain_voyageai import VoyageAIEmbeddings

from config import settings
from errors import VectorstoreError

logger = logging.getLogger("nori")


@lru_cache
def get_embeddings() -> VoyageAIEmbeddings:
    """
    Return a singleton VoyageAIEmbeddings client configured for the "voyage-code-3" model.
    
    This function is lru_cache-decorated to provide a single shared embeddings instance per process. It initializes the embeddings client using the configured Voyage API key.
    
    Returns:
        VoyageAIEmbeddings: Embeddings client configured for the "voyage-code-3" model.
    
    Raises:
        VectorstoreError: If the embeddings client cannot be initialized.
    """
    try:
        return VoyageAIEmbeddings(
            model="voyage-code-3",
            voyage_api_key=settings.voyage_api_key,
        )
    except Exception as e:
        logger.error(f"Failed to initialize embeddings: {type(e).__name__}: {e}")
        raise VectorstoreError("Embedding service unavailable") from e


@lru_cache
def get_vectorstore() -> Chroma:
    """
    Provide a singleton LangChain Chroma vectorstore configured for either Chroma Cloud or local persistent storage.
    
    Uses application settings to choose the cloud client (when enabled) or a local persist directory and returns a Chroma instance for the "repos" collection. The function is cached to return a single instance per process.
    
    Returns:
        Chroma: A configured Chroma instance targeting the "repos" collection.
    
    Raises:
        VectorstoreError: If the vectorstore cannot be initialized or the service is unavailable.
    """
    try:
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
    except VectorstoreError:
        raise  # Re-raise our safe exception
    except Exception as e:
        logger.error(f"Failed to initialize vectorstore: {type(e).__name__}: {e}")
        raise VectorstoreError("Vector search service unavailable") from e