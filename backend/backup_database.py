from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from sqlalchemy.engine import make_url

from app.core.config import BASE_DIR, settings


def create_backup(keep: int = 14) -> Path:
    url = make_url(settings.DATABASE_URL)
    if url.get_backend_name() != "sqlite" or not url.database:
        raise RuntimeError("Este respaldo local solo funciona con una base de datos SQLite.")

    source = Path(url.database).resolve()
    if not source.is_file():
        raise FileNotFoundError(f"No se encontró la base de datos: {source}")

    backup_dir = BASE_DIR / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    destination = backup_dir / f"postgrado_docs_{stamp}.db"

    with sqlite3.connect(source) as source_db, sqlite3.connect(destination) as backup_db:
        source_db.backup(backup_db)

    backups = sorted(backup_dir.glob("postgrado_docs_*.db"), key=lambda path: path.stat().st_mtime, reverse=True)
    for old_backup in backups[keep:]:
        old_backup.unlink()
    return destination


if __name__ == "__main__":
    print(f"Respaldo creado: {create_backup()}")
