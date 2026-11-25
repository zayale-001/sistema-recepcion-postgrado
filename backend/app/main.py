from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.core.config import settings
from app.core.database import Base, engine
from app.api.v1.router import api_router

# Crear las tablas automáticamente si no existen
Base.metadata.create_all(bind=engine)

# Incorpora la marca de cambio obligatorio a las bases SQLite ya existentes.
if "debe_cambiar_contrasena" not in {col["name"] for col in inspect(engine).get_columns("usuarios")}:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE usuarios ADD COLUMN debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT FALSE"))


def _retirar_categorias_obsoletas() -> None:
    """Elimina 'Biblioteca Virtual UPI' y 'Otros' de bases de datos ya existentes.
    Solo se borran si no tienen programas asociados."""
    from app.core.database import SessionLocal
    from app.models.models import Categoria, Programa
    db = SessionLocal()
    try:
        for slug in ("biblioteca-virtual-upi", "otros"):
            cat = db.query(Categoria).filter(Categoria.slug == slug).first()
            if cat and db.query(Programa).filter(Programa.categoria_id == cat.id).count() == 0:
                db.delete(cat)
        db.commit()
    finally:
        db.close()


_retirar_categorias_obsoletas()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API para la Recepción y Seguimiento Documental de la Unidad de Postgrado"
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar routers
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "sistema": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "estado": "Operativo"
    }
