from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field


class Settings(BaseSettings):
    app_env: str = "dev"
    frontend_url: str = "http://127.0.0.1:3000"
    anthropic_api_key: str
    voyage_api_key: str

    # Chroma local (dev)
    chroma_host: str = "chromadb"
    chroma_port: int = 8000

    # Chroma Cloud (prod)
    chroma_cloud_api_key: str | None = None
    chroma_cloud_tenant: str | None = None
    chroma_cloud_database: str | None = None

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        extra="ignore",
    )

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.app_env == "prod"

    @computed_field
    @property
    def use_chroma_cloud(self) -> bool:
        return self.is_production and all([
            self.chroma_cloud_api_key,
            self.chroma_cloud_tenant,
            self.chroma_cloud_database,
        ])


settings = Settings()
