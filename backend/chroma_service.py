from functools import lru_cache
import chromadb

from config import settings


@lru_cache
def get_chroma_client():
    if settings.use_chroma_cloud:
        return chromadb.CloudClient(
            tenant=settings.chroma_cloud_tenant,
            database=settings.chroma_cloud_database,
            api_key=settings.chroma_cloud_api_key,
        )
    return chromadb.HttpClient(
        host=settings.chroma_host,
        port=settings.chroma_port,
    )


@lru_cache
def get_repos_collection() -> chromadb.Collection:
    client = get_chroma_client()
    return client.get_or_create_collection("repos")
