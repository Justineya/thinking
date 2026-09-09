from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://cpt:cpt@127.0.0.1:5432/cpt"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:8787,http://localhost:8787"
    seed_on_startup: bool = True
    session_secret: str = "cpt-dev-session-secret-change-me"
    admin_username: str = "admin"
    admin_password: str = "123456"  # bootstrap only; never expose in UI

    # Futu OpenD — run locally next to FutuOpenD.exe (default 127.0.0.1:11111)
    futu_opend_host: str = "127.0.0.1"
    futu_opend_port: int = 11111
    futu_trd_env: str = "REAL"  # REAL | SIMULATE
    futu_unlock_password: str = ""  # optional; needed if OpenD requires unlock for positions
    futu_default_market: str = "US"
    futu_watchlist_group: str = "CPT"  # custom 自选 group name (must exist in Futu app)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
