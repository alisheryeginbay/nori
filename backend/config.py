from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "dev"
    frontend_url: str = "http://127.0.0.1:3000"
    voyage_api_key: str
    database_url: str = "postgresql://nori:nori@localhost:5432/nori"
    clerk_webhook_secret: str | None = None

    # Chroma local (dev)
    chroma_persist_dir: str = ".chroma"

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
        return self.is_production and all(
            [
                self.chroma_cloud_api_key,
                self.chroma_cloud_tenant,
                self.chroma_cloud_database,
            ]
        )


settings = Settings()
