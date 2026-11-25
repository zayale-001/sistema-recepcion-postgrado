from __future__ import annotations
import os
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.models.models import (
    Persona, Usuario, Documento, Requisito, Inscripcion, RolUsuario
)
from app.schemas.schemas import DocumentoItemOut
from app.services.seguimiento_service import recalcular_estado_inscripcion, registrar_historial_documento
from app.api.deps import get_current_user, exigir_acceso_inscripcion

router = APIRouter()

@router.delete("/{documento_id}")
def eliminar_documento(
    documento_id: str,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Documento).filter(Documento.id_documento == documento_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    exigir_acceso_inscripcion(current_user, doc.inscripcion, db)
    if current_user.rol != RolUsuario.ESTUDIANTE.value:
        raise HTTPException(status_code=403, detail="Solo el postulante puede eliminar sus archivos.")
    ruta_anterior = doc.ruta_archivo
    nombre_anterior = doc.nombre_archivo
    if not ruta_anterior:
        raise HTTPException(status_code=400, detail="Este requisito no tiene un archivo cargado.")
    registrar_historial_documento(doc.id_documento, current_user.id_usuario, "Eliminado", nombre_anterior, db)
    doc.ruta_archivo = None
    doc.nombre_archivo = None
    doc.fecha_carga = None
    doc.estado_revision = "Pendiente"
    doc.observaciones = None
    db.commit()
    if ruta_anterior and os.path.isfile(ruta_anterior):
        os.remove(ruta_anterior)
    recalcular_estado_inscripcion(doc.id_inscripcion, current_user.id_usuario, db)
    return {"mensaje": "Documento eliminado correctamente."}

@router.post("/subir", response_model=DocumentoItemOut)
async def subir_documento(
    inscripcion_id: str = Form(...),
    requisito_id: str = Form(...),
    archivo: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inscripcion = db.query(Inscripcion).filter(Inscripcion.id_inscripcion == inscripcion_id).first()
    if not inscripcion:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada.")

    # Postulante: solo su inscripción. Personal: solo sus programas asignados.
    exigir_acceso_inscripcion(current_user, inscripcion, db)

    extension_ok = os.path.splitext(archivo.filename or "")[1].lower()
    if extension_ok not in (".pdf", ".jpg", ".jpeg", ".png"):
        raise HTTPException(status_code=400, detail="Formato no permitido. Suba un archivo PDF, JPG o PNG.")

    contenido = await archivo.read(settings.MAX_UPLOAD_SIZE_BYTES + 1)
    if len(contenido) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="El archivo supera el límite de 10 MB.")
    firmas = {
        ".pdf": contenido.startswith(b"%PDF-"),
        ".jpg": contenido.startswith(b"\xff\xd8\xff"),
        ".jpeg": contenido.startswith(b"\xff\xd8\xff"),
        ".png": contenido.startswith(b"\x89PNG\r\n\x1a\n")
    }
    if not firmas[extension_ok]:
        raise HTTPException(status_code=400, detail="El contenido del archivo no coincide con su extensión.")

    requisito = db.query(Requisito).filter(Requisito.id_requisito == requisito_id).first()
    if not requisito or requisito.id_programa != inscripcion.convocatoria.id_programa:
        raise HTTPException(status_code=404, detail="Requisito no encontrado para este programa.")

    persona = inscripcion.persona
    carpeta_destino = settings.UPLOAD_DIR / f"conv_{inscripcion.id_convocatoria}" / f"ci_{persona.nro_documento}"
    carpeta_destino.mkdir(parents=True, exist_ok=True)

    extension = extension_ok
    nombre_guardado = f"req_{requisito.id_requisito[:8]}_{int(datetime.utcnow().timestamp())}{extension}"
    ruta_completa = carpeta_destino / nombre_guardado

    doc = db.query(Documento).filter(
        Documento.id_inscripcion == inscripcion.id_inscripcion,
        Documento.id_requisito == requisito.id_requisito
    ).first()

    if not doc:
        doc = Documento(
            id_inscripcion=inscripcion.id_inscripcion,
            id_requisito=requisito.id_requisito
        )
        db.add(doc)
        db.flush()

    ruta_anterior = doc.ruta_archivo
    nombre_anterior = doc.nombre_archivo
    accion = "Reemplazado" if ruta_anterior else "Subido"
    ruta_completa.write_bytes(contenido)

    doc.ruta_archivo = str(ruta_completa)
    doc.nombre_archivo = archivo.filename
    doc.estado_revision = "Pendiente"  # Listo para revisión
    doc.observaciones = None
    doc.fecha_carga = datetime.utcnow()
    registrar_historial_documento(
        doc.id_documento, current_user.id_usuario, accion,
        nombre_anterior if accion == "Reemplazado" else archivo.filename, db
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        if ruta_completa.exists():
            ruta_completa.unlink()
        raise
    if ruta_anterior and ruta_anterior != str(ruta_completa) and os.path.isfile(ruta_anterior):
        os.remove(ruta_anterior)
    db.refresh(doc)

    # Recalcular estado de la inscripción
    recalcular_estado_inscripcion(inscripcion.id_inscripcion, current_user.id_usuario, db)

    return DocumentoItemOut(
        id_documento=doc.id_documento,
        id_requisito=doc.id_requisito,
        nombre_requisito=requisito.nombre,
        obligatorio=requisito.obligatorio,
        nombre_archivo=doc.nombre_archivo,
        ruta_archivo="disponible" if doc.ruta_archivo else None,
        fecha_carga=doc.fecha_carga,
        estado_revision=doc.estado_revision,
        observaciones=doc.observaciones,
        cotejado_fisico=bool(doc.cotejado_fisico),
        fecha_cotejo_fisico=doc.fecha_cotejo_fisico,
        cotejador_nombre=None,
        historial=[]
    )

@router.get("/ver/{documento_id}")
def ver_o_descargar_archivo(
    documento_id: str,
    descargar: bool = False,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Documento).filter(Documento.id_documento == documento_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    exigir_acceso_inscripcion(current_user, doc.inscripcion, db)
    if not doc.ruta_archivo or not os.path.exists(doc.ruta_archivo):
        raise HTTPException(status_code=404, detail="El archivo solicitado no existe físicamente.")

    ruta = doc.ruta_archivo.lower()
    if ruta.endswith(".pdf"):
        media_type = "application/pdf"
    elif ruta.endswith((".jpg", ".jpeg")):
        media_type = "image/jpeg"
    elif ruta.endswith(".png"):
        media_type = "image/png"
    else:
        media_type = None
    # descargar=true -> se baja el archivo; por defecto se abre en el navegador
    return FileResponse(
        path=doc.ruta_archivo,
        filename=doc.nombre_archivo or "documento.pdf",
        media_type=media_type,
        content_disposition_type="attachment" if descargar else "inline"
    )
