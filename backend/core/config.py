from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SECRET_KEY: str = "dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATABASE_URL: str = "sqlite+aiosqlite:///./adk_studio.db"

    LITELLM_BASE_URL: str = "http://localhost:4000"
    LITELLM_API_KEY: str = ""

    ADK_BASE_URL: str = "http://localhost:8000"
    ADK_AGENT_NAME: str = "root_agent"

    FRONTEND_URL: str = "http://localhost:5173"


settings = Settings()
