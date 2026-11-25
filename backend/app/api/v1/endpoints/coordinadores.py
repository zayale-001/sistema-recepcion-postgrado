from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Usuario, CoordinadorConvocatoria, Convocatoria, RolUsuario
from app.schemas.schemas import UsuarioOut, AsignarCoordinadorIn
from app.api.deps import require_roles

router = APIRouter()

@router.get("/lista", response_model=List[UsuarioOut])
def listar_coordinadores(
    db: Session = Depends(get_db),
    _user = Depends(require_roles([RolUsuario.SUPERADMIN.value, RolUsuario.COORDINADOR.value]))
):
    return db.query(Usuario).filter(Usuario.rol == RolUsuario.COORDINADOR.value, Usuario.activo == True).all()

@router.post("/asignar")
def asignar_coordinador(
    data: AsignarCoordinadorIn,
    db: Session = Depends(get_db),
    _user = Depends(require_roles([RolUsuario.SUPERADMIN.value]))
):
    coord = db.query(Usuario).filter(Usuario.id_usuario == data.coordinador_id).first()
    if not coord:
        raise HTTPException(status_code=404, detail="Coordinador no encontrado.")

    conv = db.query(Convocatoria).filter(Convocatoria.id_convocatoria == data.edicion_curso_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada.")

    existente = db.query(CoordinadorConvocatoria).filter(
        CoordinadorConvocatoria.id_usuario == data.coordinador_id,
        CoordinadorConvocatoria.id_convocatoria == data.edicion_curso_id
    ).first()

    if existente:
        return {"mensaje": "El coordinador ya estaba asignado a esta convocatoria."}

    nueva_asignacion = CoordinadorConvocatoria(
        id_usuario=data.coordinador_id,
        id_convocatoria=data.edicion_curso_id
    )
    db.add(nueva_asignacion)
    db.commit()
    return {"mensaje": f"Coordinador {coord.persona.nombre_completo if coord.persona else coord.nombre_usuario} asignado exitosamente."}
