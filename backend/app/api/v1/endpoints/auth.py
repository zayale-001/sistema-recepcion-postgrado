from __future__ import annotations
from datetime import timedelta, datetime
from email.message import EmailMessage
import hashlib
import secrets
import smtplib
import ssl
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.config import settings
from app.models.models import Persona, Usuario, RolUsuario, IntentoAcceso, TokenRecuperacion, SolicitudRecuperacion
from app.schemas.schemas import Token, UsuarioOut, UsuarioCreate, BootstrapAdminIn, LoginIn, SolicitarRecuperacionIn, RestablecerContrasenaIn, CambiarContrasenaIn
from app.api.deps import get_current_user, require_roles

router = APIRouter()

@router.post("/login", response_model=Token)
def login(login_data: LoginIn, request: Request, db: Session = Depends(get_db)):
    ahora = datetime.utcnow()
    identidad = login_data.email_o_ci.strip().casefold()
    ip = request.client.host if request.client else "desconocida"
    clave = hashlib.sha256(f"{ip}|{identidad}".encode("utf-8")).hexdigest()
    intento = db.query(IntentoAcceso).filter(IntentoAcceso.clave == clave).first()
    if intento and intento.bloqueado_hasta and intento.bloqueado_hasta > ahora:
        segundos = max(1, int((intento.bloqueado_hasta - ahora).total_seconds()))
        raise HTTPException(status_code=429, detail=f"Acceso bloqueado. Intenta nuevamente en {segundos // 60} min {segundos % 60} s.", headers={"Retry-After": str(segundos)})
    if intento and intento.bloqueado_hasta and intento.bloqueado_hasta <= ahora:
        intento.bloqueado_hasta = None

    usuario = db.query(Usuario).filter(Usuario.nombre_usuario == login_data.email_o_ci.strip()).first()
    if not usuario:
        persona = db.query(Persona).filter(
            (Persona.correo == login_data.email_o_ci.strip()) | (Persona.nro_documento == login_data.email_o_ci.strip())
        ).first()
        if persona and persona.usuario:
            usuario = persona.usuario

    if not usuario or not verify_password(login_data.password, usuario.password_hash):
        if not intento:
            intento = IntentoAcceso(clave=clave, intentos=0, nivel_bloqueo=0)
            db.add(intento)
        intento.intentos += 1
        if intento.intentos >= 3:
            # Bloqueos de 3, 6, 12, 24 y 48 minutos (cuatro duplicaciones).
            minutos = 3 * (2 ** min(intento.nivel_bloqueo, 4))
            intento.nivel_bloqueo = min(intento.nivel_bloqueo + 1, 5)
            intento.intentos = 0
            intento.bloqueado_hasta = ahora + timedelta(minutes=minutos)
            db.commit()
            raise HTTPException(status_code=429, detail=f"Se realizaron 3 intentos incorrectos. Acceso bloqueado por {minutos} minutos.", headers={"Retry-After": str(minutos * 60)})
        restantes = 3 - intento.intentos
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Credenciales incorrectas. Quedan {restantes} intentos antes del bloqueo.", headers={"WWW-Authenticate": "Bearer"})
    if not usuario.activo:
        raise HTTPException(status_code=400, detail="El usuario se encuentra inactivo.")

    usuario.ultimo_acceso = ahora
    if intento:
        intento.intentos = 0
        intento.nivel_bloqueo = 0
        intento.bloqueado_hasta = None
    db.commit()
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(usuario.id_usuario, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer", "usuario": usuario}


def _buscar_usuario_por_identificador(db: Session, identificador: str):
    identificador = identificador.strip()
    usuario = db.query(Usuario).filter(Usuario.nombre_usuario == identificador).first()
    if usuario:
        return usuario
    persona = db.query(Persona).filter((Persona.correo == identificador) | (Persona.nro_documento == identificador)).first()
    return persona.usuario if persona else None


@router.get("/admin/postulantes")
def buscar_postulantes_admin(
    buscar: str = "",
    current_user: Usuario = Depends(require_roles([RolUsuario.SUPERADMIN.value])),
    db: Session = Depends(get_db),
):
    consulta = db.query(Usuario).outerjoin(Persona).filter(
        Usuario.rol.in_([RolUsuario.ESTUDIANTE.value, "ESTUDIANTE"])
    )
    termino = buscar.strip()
    if termino:
        patron = f"%{termino}%"
        consulta = consulta.filter(
            (Usuario.nombre_usuario.ilike(patron)) |
            (Persona.correo.ilike(patron)) |
            (Persona.nro_documento.ilike(patron)) |
            (Persona.nombres.ilike(patron)) |
            (Persona.apellidos.ilike(patron))
        )
    return [
        {
            "id_usuario": usuario.id_usuario,
            "nombre_usuario": usuario.nombre_usuario,
            "activo": usuario.activo,
            "nombres": usuario.persona.nombres if usuario.persona else "",
            "apellidos": usuario.persona.apellidos if usuario.persona else "",
            "ci": usuario.persona.nro_documento if usuario.persona else "",
            "correo": usuario.persona.correo if usuario.persona else "",
        }
        for usuario in consulta.order_by(Usuario.nombre_usuario).limit(100).all()
    ]


@router.post("/admin/postulantes/{id_usuario}/clave-temporal")
def generar_clave_temporal_postulante(
    id_usuario: str,
    current_user: Usuario = Depends(require_roles([RolUsuario.SUPERADMIN.value])),
    db: Session = Depends(get_db),
):
    usuario = db.query(Usuario).filter(
        Usuario.id_usuario == id_usuario,
        Usuario.rol.in_([RolUsuario.ESTUDIANTE.value, "ESTUDIANTE"]),
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="No se encontró la cuenta del postulante.")
    clave_temporal = secrets.token_urlsafe(12)
    usuario.password_hash = get_password_hash(clave_temporal)
    usuario.debe_cambiar_contrasena = True
    db.query(TokenRecuperacion).filter(TokenRecuperacion.id_usuario == usuario.id_usuario).delete(synchronize_session=False)
    db.commit()
    return {"usuario": usuario.nombre_usuario, "clave_temporal": clave_temporal}


@router.get("/admin/solicitudes-recuperacion")
def listar_solicitudes_recuperacion(
    current_user: Usuario = Depends(require_roles([RolUsuario.SUPERADMIN.value])),
    db: Session = Depends(get_db),
):
    solicitudes = db.query(SolicitudRecuperacion).join(Usuario).filter(
        SolicitudRecuperacion.resuelta.is_(False),
        Usuario.rol.in_([RolUsuario.ESTUDIANTE.value, "ESTUDIANTE"]),
    ).order_by(SolicitudRecuperacion.solicitada_en.desc()).limit(100).all()
    return [
        {
            "id": solicitud.id,
            "id_usuario": solicitud.id_usuario,
            "usuario": solicitud.usuario.nombre_usuario,
            "nombres": solicitud.usuario.persona.nombres if solicitud.usuario.persona else "",
            "apellidos": solicitud.usuario.persona.apellidos if solicitud.usuario.persona else "",
            "ci": solicitud.usuario.persona.nro_documento if solicitud.usuario.persona else "",
            "correo": solicitud.usuario.persona.correo if solicitud.usuario.persona else "",
            "solicitada_en": solicitud.solicitada_en,
        }
        for solicitud in solicitudes
    ]


@router.post("/admin/solicitudes-recuperacion/{solicitud_id}/resolver")
def resolver_solicitud_recuperacion(
    solicitud_id: str,
    current_user: Usuario = Depends(require_roles([RolUsuario.SUPERADMIN.value])),
    db: Session = Depends(get_db),
):
    solicitud = db.query(SolicitudRecuperacion).filter(
        SolicitudRecuperacion.id == solicitud_id,
        SolicitudRecuperacion.resuelta.is_(False),
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="La solicitud ya fue atendida o no existe.")
    usuario = db.query(Usuario).filter(Usuario.id_usuario == solicitud.id_usuario).first()
    if not usuario or not usuario.activo:
        raise HTTPException(status_code=404, detail="La cuenta del postulante no está disponible.")
    clave_temporal = secrets.token_urlsafe(12)
    usuario.password_hash = get_password_hash(clave_temporal)
    usuario.debe_cambiar_contrasena = True
    db.query(TokenRecuperacion).filter(TokenRecuperacion.id_usuario == usuario.id_usuario).delete(synchronize_session=False)
    solicitud.resuelta = True
    solicitud.resuelta_en = datetime.utcnow()
    db.commit()
    return {"usuario": usuario.nombre_usuario, "clave_temporal": clave_temporal}


@router.post("/cambiar-contrasena")
def cambiar_contrasena(datos: CambiarContrasenaIn, current_user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(datos.contrasena_actual, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña temporal ingresada no es correcta.")
    current_user.password_hash = get_password_hash(datos.nueva_contrasena)
    current_user.debe_cambiar_contrasena = False
    db.commit()
    return {"detail": "Contraseña actualizada correctamente."}


@router.post("/recuperar-contrasena")
def solicitar_recuperacion(datos: SolicitarRecuperacionIn, db: Session = Depends(get_db)):
    respuesta = {"detail": "Si la cuenta existe, la solicitud quedó registrada para que el SuperAdmin la atienda desde Ajustes."}
    usuario = _buscar_usuario_por_identificador(db, datos.email_o_ci)
    correo = usuario.persona.correo if usuario and usuario.persona else None
    if not usuario or not correo or not usuario.activo:
        return respuesta

    solicitud_pendiente = db.query(SolicitudRecuperacion).filter(
        SolicitudRecuperacion.id_usuario == usuario.id_usuario,
        SolicitudRecuperacion.resuelta.is_(False),
    ).first()
    if not solicitud_pendiente:
        db.add(SolicitudRecuperacion(id_usuario=usuario.id_usuario))
        db.commit()
    # Sin SMTP, el SuperAdmin atiende la solicitud desde Ajustes.
    if not (settings.SMTP_HOST and settings.SMTP_FROM and settings.PASSWORD_RECOVERY_ADMIN_EMAIL):
        return respuesta

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    db.query(TokenRecuperacion).filter(TokenRecuperacion.id_usuario == usuario.id_usuario, TokenRecuperacion.usado.is_(False)).delete(synchronize_session=False)
    db.add(TokenRecuperacion(id_usuario=usuario.id_usuario, token_hash=token_hash, expira_en=datetime.utcnow() + timedelta(minutes=30)))
    db.commit()
    enlace = f"{settings.FRONTEND_URL.rstrip('/')}?reset_token={token}"
    mensaje = EmailMessage()
    nombre_postulante = usuario.persona.nombre_completo if usuario.persona else usuario.nombre_usuario
    mensaje["Subject"] = "Solicitud de recuperación de acceso - UPI FINI"
    mensaje["From"] = settings.SMTP_FROM
    mensaje["To"] = settings.PASSWORD_RECOVERY_ADMIN_EMAIL
    mensaje["Reply-To"] = correo
    mensaje.set_content(f"El postulante {nombre_postulante} ({usuario.nombre_usuario}, CI {usuario.persona.nro_documento if usuario.persona else 'no registrada'}) solicitó recuperar el acceso.\n\nEl enlace seguro de un solo uso vence en 30 minutos y permite definir una nueva contraseña:\n\n{enlace}\n\nVerifica la solicitud con el postulante antes de comunicarle cualquier cambio.")
    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=ssl.create_default_context(), timeout=15) as servidor:
                if settings.SMTP_USER:
                    servidor.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
                servidor.send_message(mensaje)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as servidor:
                servidor.starttls(context=ssl.create_default_context())
                if settings.SMTP_USER:
                    servidor.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
                servidor.send_message(mensaje)
    except Exception:
        db.query(TokenRecuperacion).filter(TokenRecuperacion.token_hash == token_hash).delete(synchronize_session=False)
        db.commit()
    return respuesta


@router.post("/restablecer-contrasena")
def restablecer_contrasena(datos: RestablecerContrasenaIn, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(datos.token.encode("utf-8")).hexdigest()
    registro = db.query(TokenRecuperacion).filter(TokenRecuperacion.token_hash == token_hash).first()
    ahora = datetime.utcnow()
    if not registro or registro.usado or registro.expira_en <= ahora:
        raise HTTPException(status_code=400, detail="El enlace no es válido o ha expirado. Solicita uno nuevo.")
    usuario = db.query(Usuario).filter(Usuario.id_usuario == registro.id_usuario).first()
    if not usuario or not usuario.activo:
        raise HTTPException(status_code=400, detail="No se pudo restablecer esta cuenta.")
    usuario.password_hash = get_password_hash(datos.nueva_contrasena)
    usuario.debe_cambiar_contrasena = False
    registro.usado = True
    db.query(TokenRecuperacion).filter(TokenRecuperacion.id_usuario == usuario.id_usuario, TokenRecuperacion.id != registro.id).delete(synchronize_session=False)
    db.query(SolicitudRecuperacion).filter(
        SolicitudRecuperacion.id_usuario == usuario.id_usuario,
        SolicitudRecuperacion.resuelta.is_(False),
    ).update({SolicitudRecuperacion.resuelta: True, SolicitudRecuperacion.resuelta_en: ahora}, synchronize_session=False)
    db.commit()
    return {"detail": "Contraseña restablecida. Ya puedes iniciar sesión."}


@router.get("/me", response_model=UsuarioOut)
def read_current_user(current_user: Usuario = Depends(get_current_user)):
    return current_user

@router.post("/bootstrap-admin", response_model=UsuarioOut)
def bootstrap_admin(datos: BootstrapAdminIn, db: Session = Depends(get_db)):
    token_configurado = settings.INITIAL_ADMIN_SETUP_TOKEN
    if not token_configurado:
        raise HTTPException(status_code=404, detail="La inicialización del administrador no está habilitada.")
    if not secrets.compare_digest(datos.setup_token, token_configurado):
        raise HTTPException(status_code=403, detail="No se pudo autorizar la inicialización.")

    # Serializa inicializaciones simultáneas en PostgreSQL para que solo se cree
    # el primer administrador aunque lleguen dos solicitudes al mismo tiempo.
    if db.bind and db.bind.dialect.name == "postgresql":
        db.execute(text("LOCK TABLE usuarios IN EXCLUSIVE MODE"))
    if db.query(Usuario).count() > 0:
        raise HTTPException(status_code=409, detail="La cuenta inicial ya fue creada.")
    if db.query(Persona).filter(
        (Persona.correo == str(datos.email)) | (Persona.nro_documento == datos.ci)
    ).first():
        raise HTTPException(status_code=409, detail="El correo o documento ya está registrado.")

    persona = Persona(
        nombres=datos.nombres.strip(),
        apellidos=datos.apellidos.strip(),
        nro_documento=datos.ci.strip(),
        correo=str(datos.email).strip().lower(),
        telefono=datos.telefono,
    )
    db.add(persona)
    db.flush()
    usuario = Usuario(
        id_persona=persona.id_persona,
        nombre_usuario=str(datos.email).strip().lower(),
        password_hash=get_password_hash(datos.password),
        rol=RolUsuario.SUPERADMIN.value,
        activo=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.post("/crear-usuario", response_model=UsuarioOut)
def crear_usuario(
    usuario_in: UsuarioCreate,
    current_user: Usuario = Depends(require_roles([RolUsuario.SUPERADMIN.value])),
    db: Session = Depends(get_db),
):
    # Verificar si persona existe
    persona = db.query(Persona).filter(
        (Persona.correo == usuario_in.email) | (Persona.nro_documento == usuario_in.ci)
    ).first()

    if not persona:
        persona = Persona(
            nombres=usuario_in.nombres,
            apellidos=usuario_in.apellidos,
            nro_documento=usuario_in.ci,
            correo=usuario_in.email,
            telefono=usuario_in.telefono
        )
        db.add(persona)
        db.commit()
        db.refresh(persona)

    if persona.usuario:
        raise HTTPException(status_code=400, detail="Esta persona ya tiene una cuenta de usuario asignada.")

    nuevo_usuario = Usuario(
        id_persona=persona.id_persona,
        nombre_usuario=usuario_in.email,
        password_hash=get_password_hash(usuario_in.password),
        rol=usuario_in.rol,
        activo=True
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario
