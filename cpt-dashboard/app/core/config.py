from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://cpt:cpt@127.0.0.1:5432/cpt"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:8787,http://localhost:8787"
    seed_on_startup: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
