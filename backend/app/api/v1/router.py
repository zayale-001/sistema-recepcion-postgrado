from __future__ import annotations
from fastapi import APIRouter
from app.api.v1.endpoints import auth, catalogos, seguimiento, documentos, coordinadores, reportes

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(catalogos.router, prefix="/catalogos", tags=["Catálogos y Requisitos"])
api_router.include_router(seguimiento.router, prefix="/seguimiento", tags=["Seguimiento de Coordinadores"])
api_router.include_router(documentos.router, prefix="/documentos", tags=["Recepción y Archivos"])
api_router.include_router(coordinadores.router, prefix="/coordinadores", tags=["Gestión de Coordinadores"])
api_router.include_router(reportes.router, prefix="/reportes", tags=["Reportes Excel"])
