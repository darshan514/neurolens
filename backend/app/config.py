from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # extra="ignore": backend/.env also carries keys for other modules
    # (GEMINI_API_KEY, SUPABASE_*) that this Settings object doesn't declare.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", env_prefix="")
    """Application settings, overridable via environment variables."""

    app_name: str = "NeuroLens AI API"
    version: str = "0.1.0"

    database_url: str = "postgresql+psycopg://neurolens:neurolens@localhost:5432/neurolens"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    cors_origins: str = '["http://localhost:5173", "http://localhost:3000"]'


settings = Settings()
