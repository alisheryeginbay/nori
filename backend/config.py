from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    frontend_url: str = "http://127.0.0.1:3000"

    class Config:
        env_file = ".env"


settings = Settings()
