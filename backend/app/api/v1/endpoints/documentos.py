from __future__ import annotations
import io
import os
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse, Response
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


@router.post("/comprimir-pdf")
async def comprimir_pdf(
    archivo: UploadFile = File(...),
    nivel: str = Form("media"),
    current_user: Usuario = Depends(get_current_user),
):
    """Optimiza y reduce el tamaño de un archivo PDF para facilitar su carga."""
    extension = os.path.splitext(archivo.filename or "")[1].lower()
    if extension != ".pdf":
        raise HTTPException(status_code=400, detail="Solo se pueden ajustar archivos PDF.")

    max_input = 50 * 1024 * 1024
    contenido = await archivo.read(max_input + 1)
    if len(contenido) > max_input:
        raise HTTPException(status_code=413, detail="El PDF de entrada supera el máximo de 50 MB.")
    if not contenido.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="El archivo seleccionado no es un PDF válido.")

    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise HTTPException(status_code=501, detail="El compresor de PDF no está disponible en el servidor.")

    nivel_norm = (nivel or "media").lower()
    if nivel_norm not in ("ligera", "media", "alta"):
        nivel_norm = "media"

    doc_in = fitz.open(stream=contenido, filetype="pdf")
    try:
        # 1) Compresión estructural sin pérdida
        buf_estructural = io.BytesIO()
        doc_in.save(buf_estructural, garbage=4, deflate=True, clean=True)
        mejor_bytes = buf_estructural.getvalue()

        # 2) Para compresión media/alta, rasterizar páginas a JPEG optimizado si reduce tamaño
        if nivel_norm in ("media", "alta"):
            from PIL import Image

            dpi = 130 if nivel_norm == "media" else 96
            calidad = 72 if nivel_norm == "media" else 52
            doc_out = fitz.open()
            try:
                zoom = dpi / 72.0
                matriz = fitz.Matrix(zoom, zoom)
                for page in doc_in:
                    pix = page.get_pixmap(matrix=matriz, alpha=False)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    img_buf = io.BytesIO()
                    img.save(img_buf, format="JPEG", quality=calidad, optimize=True)
                    img_bytes = img_buf.getvalue()

                    rect = page.rect
                    new_page = doc_out.new_page(width=rect.width, height=rect.height)
                    new_page.insert_image(rect, stream=img_bytes)

                buf_raster = io.BytesIO()
                doc_out.save(buf_raster, garbage=4, deflate=True)
                raster_bytes = buf_raster.getvalue()
                if len(raster_bytes) < len(mejor_bytes):
                    mejor_bytes = raster_bytes
            finally:
                doc_out.close()

        if len(mejor_bytes) > len(contenido):
            mejor_bytes = contenido
    finally:
        doc_in.close()

    nombre_base = os.path.splitext(os.path.basename(archivo.filename or "documento.pdf"))[0]
    nombre_salida = f"{nombre_base}_optimizado.pdf"
    return Response(
        content=mejor_bytes,
        media_type="application/pdf",
        headers={
            "X-Original-Size": str(len(contenido)),
            "X-Compressed-Size": str(len(mejor_bytes)),
            "Access-Control-Expose-Headers": "X-Original-Size, X-Compressed-Size",
            "Content-Disposition": f'inline; filename="{nombre_salida}"',
        },
    )


@router.post("/unir-imagenes-pdf")
async def unir_imagenes_pdf(
    archivos: list[UploadFile] = File(...),
    current_user: Usuario = Depends(get_current_user),
):
    """Combina varias imágenes (JPG/PNG) en un único archivo PDF optimizado."""
    if not archivos:
        raise HTTPException(status_code=400, detail="Selecciona al menos una imagen JPG o PNG.")
    if len(archivos) > 20:
        raise HTTPException(status_code=400, detail="Puedes unir hasta 20 imágenes por documento.")

    try:
        from PIL import Image
    except ImportError:
        raise HTTPException(status_code=501, detail="La conversión de imágenes a PDF no está disponible en el servidor.")

    imagenes_rgb = []
    total_bytes = 0
    for archivo in archivos:
        ext = os.path.splitext(archivo.filename or "")[1].lower()
        if ext not in (".jpg", ".jpeg", ".png"):
            raise HTTPException(status_code=400, detail=f"Archivo no válido ({archivo.filename}). Solo se permiten JPG o PNG.")
        data = await archivo.read(15 * 1024 * 1024 + 1)
        if len(data) > 15 * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"La imagen {archivo.filename} supera los 15 MB.")
        total_bytes += len(data)
        try:
            img = Image.open(io.BytesIO(data)).convert("RGB")
            imagenes_rgb.append(img)
        except Exception:
            raise HTTPException(status_code=400, detail=f"No se pudo leer la imagen {archivo.filename}.")

    pdf_buf = io.BytesIO()
    try:
        primera, resto = imagenes_rgb[0], imagenes_rgb[1:]
        primera.save(pdf_buf, format="PDF", save_all=True, append_images=resto, resolution=130.0)
    finally:
        for img in imagenes_rgb:
            img.close()

    pdf_bytes = pdf_buf.getvalue()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "X-Original-Size": str(total_bytes),
            "X-Compressed-Size": str(len(pdf_bytes)),
            "Access-Control-Expose-Headers": "X-Original-Size, X-Compressed-Size",
            "Content-Disposition": 'inline; filename="documento_unido.pdf"',
        },
    )
