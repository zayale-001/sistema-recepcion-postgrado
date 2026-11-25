from __future__ import annotations
from typing import Generator, List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import ALGORITHM
from app.models.models import Usuario, RolUsuario
from app.schemas.schemas import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
    token_header: Optional[str] = Depends(oauth2_scheme),
) -> Usuario:
    token = token_header
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales de acceso.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenPayload(sub=user_id)
    except JWTError:
        raise credentials_exception

    user = db.query(Usuario).filter(Usuario.id_usuario == token_data.sub).first()
    if user is None:
        raise credentials_exception
    if not user.activo:
        raise HTTPException(status_code=400, detail="Usuario inactivo.")
    return user

def require_roles(roles_permitidos: List[str]):
    def role_checker(current_user: Usuario = Depends(get_current_user)) -> Usuario:
        if current_user.rol not in roles_permitidos and current_user.rol != RolUsuario.SUPERADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos suficientes para realizar esta acción."
            )
        return current_user
    return role_checker


ROLES_PERSONAL = (RolUsuario.COORDINADOR.value, RolUsuario.KARDEX.value)


def es_admin(user: Usuario) -> bool:
    return user.rol == RolUsuario.SUPERADMIN.value


def convocatorias_permitidas(user: Usuario, db: Session) -> Optional[List[str]]:
    """None = acceso a todas (administrador). Lista = solo las convocatorias asignadas."""
    from app.models.models import CoordinadorConvocatoria
    if es_admin(user):
        return None
    filas = db.query(CoordinadorConvocatoria.id_convocatoria).filter(
        CoordinadorConvocatoria.id_usuario == user.id_usuario
    ).all()
    return [f[0] for f in filas]


def exigir_acceso_convocatoria(user: Usuario, convocatoria_id: str, db: Session) -> None:
    """El personal solo opera sobre sus programas asignados; el postulante, solo sobre su propia inscripción."""
    if es_admin(user):
        return
    if user.rol in ROLES_PERSONAL:
        permitidas = convocatorias_permitidas(user, db) or []
        if convocatoria_id in permitidas:
            return
    raise HTTPException(status_code=403, detail="No tienes acceso a este programa.")


def exigir_acceso_inscripcion(user: Usuario, inscripcion, db: Session) -> None:
    if es_admin(user):
        return
    if user.rol == RolUsuario.ESTUDIANTE.value:
        if inscripcion.id_persona == user.id_persona:
            return
        raise HTTPException(status_code=403, detail="No puedes acceder al expediente de otro postulante.")
    exigir_acceso_convocatoria(user, inscripcion.id_convocatoria, db)
