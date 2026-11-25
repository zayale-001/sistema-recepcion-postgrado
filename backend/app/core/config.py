from __future__ import annotations
import os
import secrets
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent

def _secret_key_for_local_use() -> str:
    configured = os.getenv("SECRET_KEY")
    if configured:
        return configured
    secret_path = BASE_DIR / ".secret_key"
    if secret_path.exists():
        return secret_path.read_text(encoding="utf-8").strip()
    generated = secrets.token_urlsafe(48)
    secret_path.write_text(generated, encoding="utf-8")
    return generated

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema de Recepción Documental - Unidad de Postgrado"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str = _secret_key_for_local_use()
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 día
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024

    # Recuperación de contraseña: definir estas variables para enviar enlaces por correo.
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None
    PASSWORD_RECOVERY_ADMIN_EMAIL: str | None = None
    INITIAL_ADMIN_SETUP_TOKEN: str | None = None
    FRONTEND_URL: str = "http://localhost:5174"
    
    # Base de datos SQLite por defecto (cero configuración para empezar de inmediato)
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'postgrado_docs.db'}")
    
    # Directorio de subidas
    UPLOAD_DIR: Path = BASE_DIR / "uploads" / "documentos"
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    class Config:
        case_sensitive = True
        env_file = BASE_DIR / ".env"
        env_file_encoding = "utf-8"

settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
