from __future__ import annotations
import io
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import openpyxl

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.models import (
    Persona, Usuario, Programa, Convocatoria, Inscripcion, Requisito, Documento,
    Estado, HistorialEstado, RolUsuario
)
from app.schemas.schemas import (
    CursoResumenSeguimiento, EstudianteSeguimientoItem, DocumentoItemOut, HistorialDocumentoOut,
    ValidarDocumentoIn, CotejoFisicoIn, MiInscripcionOut, ConvocatoriaOut
)
from app.services.seguimiento_service import (
    obtener_resumen_convocatorias, obtener_seguimiento_curso,
    recalcular_estado_inscripcion, registrar_cambio_estado, generar_codigo_inscripcion,
    registrar_historial_documento
)
from app.api.deps import (
    get_current_user, require_roles, exigir_acceso_convocatoria, exigir_acceso_inscripcion
)

router = APIRouter()

@router.get("/convocatorias-abiertas", response_model=List[ConvocatoriaOut])
def listar_convocatorias_abiertas(
    categoria_id: int | None = Query(default=None),
    area_id: int | None = Query(default=None),
    current_user: Usuario = Depends(require_roles([RolUsuario.ESTUDIANTE.value])),
    db: Session = Depends(get_db)
):
    ahora = datetime.utcnow()
    query = db.query(Convocatoria).join(Programa).filter(
        Convocatoria.estado == "Abierta",
        Programa.activo == True,
        (Convocatoria.fecha_fin.is_(None) | (Convocatoria.fecha_fin >= ahora))
    )
    if categoria_id is not None:
        query = query.filter(Programa.categoria_id == categoria_id)
    if area_id is not None:
        query = query.filter(Programa.area_id == area_id)
    return query.order_by(Programa.nombre, Convocatoria.gestion.desc()).all()

@router.post("/inscribirse/{convocatoria_id}")
def inscribirse_a_convocatoria(
    convocatoria_id: str,
    current_user: Usuario = Depends(require_roles([RolUsuario.ESTUDIANTE.value])),
    db: Session = Depends(get_db)
):
    convocatoria = db.query(Convocatoria).filter(
        Convocatoria.id_convocatoria == convocatoria_id
    ).first()
    if not convocatoria or not convocatoria.programa.activo:
        raise HTTPException(status_code=404, detail="Programa o convocatoria no encontrados.")
    if convocatoria.estado != "Abierta" or (convocatoria.fecha_fin and convocatoria.fecha_fin < datetime.utcnow()):
        raise HTTPException(status_code=400, detail="La convocatoria ya no está abierta.")
    total = db.query(Inscripcion).filter(Inscripcion.id_convocatoria == convocatoria_id).count()
    if convocatoria.cupo and total >= convocatoria.cupo:
        raise HTTPException(status_code=400, detail="La convocatoria alcanzó su cupo máximo.")
    existente = db.query(Inscripcion).filter(
        Inscripcion.id_persona == current_user.id_persona,
        Inscripcion.id_convocatoria == convocatoria_id
    ).first()
    if existente:
        raise HTTPException(status_code=409, detail="Ya estás inscrito en esta convocatoria.")
    codigo = generar_codigo_inscripcion(convocatoria_id, db)
    inscripcion = Inscripcion(
        id_persona=current_user.id_persona,
        id_convocatoria=convocatoria_id,
        codigo_inscripcion=codigo,
        estado_actual_id=1,
        observacion="Inscripción realizada desde el portal del postulante"
    )
    db.add(inscripcion)
    db.flush()
    requisitos = db.query(Requisito).filter(Requisito.id_programa == convocatoria.id_programa).all()
    for requisito in requisitos:
        db.add(Documento(
            id_inscripcion=inscripcion.id_inscripcion,
            id_requisito=requisito.id_requisito,
            estado_revision="Pendiente"
        ))
    db.add(HistorialEstado(
        id_inscripcion=inscripcion.id_inscripcion,
        id_estado=1,
        id_usuario=current_user.id_usuario,
        comentario=f"Inscripción registrada con código {codigo}."
    ))
    db.commit()
    return {"mensaje": "Inscripción creada correctamente.", "inscripcion_id": inscripcion.id_inscripcion}

@router.get("/mis-cursos", response_model=List[CursoResumenSeguimiento])
def ver_mis_cursos(
    current_user: Usuario = Depends(require_roles([RolUsuario.COORDINADOR.value, RolUsuario.KARDEX.value])),
    db: Session = Depends(get_db)
):
    # Administrador: todos los programas. Coordinador/Revisor: solo los asignados.
    return obtener_resumen_convocatorias(current_user, db)

@router.get("/mi-inscripcion", response_model=List[MiInscripcionOut])
def ver_mi_inscripcion(
    current_user: Usuario = Depends(require_roles([RolUsuario.ESTUDIANTE.value])),
    db: Session = Depends(get_db)
):
    """Inscripciones del postulante autenticado (portal del postulante)."""
    inscripciones = db.query(Inscripcion).filter(
        Inscripcion.id_persona == current_user.id_persona
    ).order_by(Inscripcion.fecha_solicitud.desc()).all()

    return [
        MiInscripcionOut(
            inscripcion_id=i.id_inscripcion,
            codigo_inscripcion=i.codigo_inscripcion,
            edicion_id=i.id_convocatoria,
            programa_nombre=i.convocatoria.programa.nombre,
            categoria_nombre=i.convocatoria.programa.categoria.nombre if i.convocatoria.programa.categoria else i.convocatoria.programa.nivel,
            version_edicion=f"{i.convocatoria.version} - {i.convocatoria.edicion}",
            gestion=i.convocatoria.gestion,
            estado_nombre=i.estado_actual.nombre if i.estado_actual else "Registrada",
            fecha_solicitud=i.fecha_solicitud,
            fecha_fin=i.convocatoria.fecha_fin,
            convocatoria_estado=i.convocatoria.estado,
        )
        for i in inscripciones
    ]

@router.get("/curso/{convocatoria_id}/estudiantes", response_model=List[EstudianteSeguimientoItem])
def ver_estudiantes_curso(
    convocatoria_id: str,
    current_user: Usuario = Depends(require_roles([RolUsuario.COORDINADOR.value, RolUsuario.KARDEX.value])),
    db: Session = Depends(get_db)
):
    conv = db.query(Convocatoria).filter(Convocatoria.id_convocatoria == convocatoria_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada.")
    exigir_acceso_convocatoria(current_user, convocatoria_id, db)
    return obtener_seguimiento_curso(convocatoria_id, db)

@router.get("/inscripcion/{inscripcion_id}/expediente", response_model=List[DocumentoItemOut])
def ver_expediente_estudiante(
    inscripcion_id: str,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inscripcion = db.query(Inscripcion).filter(Inscripcion.id_inscripcion == inscripcion_id).first()
    if not inscripcion:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada.")
    exigir_acceso_inscripcion(current_user, inscripcion, db)

    # Asegurar que existan registros de Documento para cada Requisito del programa
    requisitos = db.query(Requisito).filter(Requisito.id_programa == inscripcion.convocatoria.id_programa).all()
    for req in requisitos:
        doc_existente = db.query(Documento).filter(
            Documento.id_inscripcion == inscripcion.id_inscripcion,
            Documento.id_requisito == req.id_requisito
        ).first()
        if not doc_existente:
            nuevo_doc = Documento(
                id_inscripcion=inscripcion.id_inscripcion,
                id_requisito=req.id_requisito,
                estado_revision="Pendiente"
            )
            db.add(nuevo_doc)
    db.commit()

    docs = db.query(Documento).filter(Documento.id_inscripcion == inscripcion.id_inscripcion).all()
    
    resultado = []
    for d in docs:
        resultado.append(DocumentoItemOut(
            id_documento=d.id_documento,
            id_requisito=d.id_requisito,
            nombre_requisito=d.requisito.nombre,
            obligatorio=d.requisito.obligatorio,
            nombre_archivo=d.nombre_archivo,
            ruta_archivo="disponible" if d.ruta_archivo else None,
            fecha_carga=d.fecha_carga,
            estado_revision=d.estado_revision,
            observaciones=d.observaciones,
            cotejado_fisico=bool(d.cotejado_fisico),
            fecha_cotejo_fisico=d.fecha_cotejo_fisico,
            cotejador_nombre=d.cotejador.persona.nombre_completo if (d.cotejador and d.cotejador.persona) else None,
            historial=[HistorialDocumentoOut(
                id_historial=h.id_historial,
                accion=h.accion,
                nombre_archivo=h.nombre_archivo,
                fecha_cambio=h.fecha_cambio,
                usuario_nombre=(h.usuario.persona.nombre_completo if h.usuario and h.usuario.persona
                                else h.usuario.nombre_usuario if h.usuario else "Sistema")
            ) for h in d.historial]
        ))
    return resultado

@router.post("/documento/{documento_id}/validar", response_model=DocumentoItemOut)
def validar_documento(
    documento_id: str,
    validacion: ValidarDocumentoIn,
    current_user: Usuario = Depends(require_roles([RolUsuario.SUPERADMIN.value, RolUsuario.COORDINADOR.value, RolUsuario.KARDEX.value])),
    db: Session = Depends(get_db)
):
    doc = db.query(Documento).filter(Documento.id_documento == documento_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    exigir_acceso_inscripcion(current_user, doc.inscripcion, db)

    if validacion.estado_revision not in ("Válido", "Observado", "Rechazado", "Pendiente"):
        raise HTTPException(status_code=400, detail="Estado de revisión inválido.")

    doc.estado_revision = validacion.estado_revision
    doc.observaciones = validacion.observaciones
    registrar_historial_documento(
        doc.id_documento, current_user.id_usuario,
        f"Revisión: {validacion.estado_revision}", doc.nombre_archivo, db
    )

    db.commit()
    db.refresh(doc)

    # Recalcular y registrar en HISTORIAL_ESTADOS
    recalcular_estado_inscripcion(doc.id_inscripcion, current_user.id_usuario, db)

    return DocumentoItemOut(
        id_documento=doc.id_documento,
        id_requisito=doc.id_requisito,
        nombre_requisito=doc.requisito.nombre,
        obligatorio=doc.requisito.obligatorio,
        nombre_archivo=doc.nombre_archivo,
        ruta_archivo="disponible" if doc.ruta_archivo else None,
        fecha_carga=doc.fecha_carga,
        estado_revision=doc.estado_revision,
        observaciones=doc.observaciones,
        cotejado_fisico=bool(doc.cotejado_fisico),
        fecha_cotejo_fisico=doc.fecha_cotejo_fisico,
        cotejador_nombre=current_user.persona.nombre_completo if current_user.persona else None,
        historial=[]
    )

@router.post("/documento/{documento_id}/cotejo-fisico", response_model=DocumentoItemOut)
def marcar_cotejo_fisico(
    documento_id: str,
    cotejo: CotejoFisicoIn,
    current_user: Usuario = Depends(require_roles([RolUsuario.SUPERADMIN.value, RolUsuario.COORDINADOR.value, RolUsuario.KARDEX.value])),
    db: Session = Depends(get_db)
):
    doc = db.query(Documento).filter(Documento.id_documento == documento_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    exigir_acceso_inscripcion(current_user, doc.inscripcion, db)

    doc.cotejado_fisico = cotejo.cotejado
    if cotejo.cotejado:
        doc.fecha_cotejo_fisico = datetime.utcnow()
        doc.cotejado_por_id = current_user.id_usuario
    else:
        doc.fecha_cotejo_fisico = None
        doc.cotejado_por_id = None

    db.commit()
    db.refresh(doc)

    return DocumentoItemOut(
        id_documento=doc.id_documento,
        id_requisito=doc.id_requisito,
        nombre_requisito=doc.requisito.nombre,
        obligatorio=doc.requisito.obligatorio,
        nombre_archivo=doc.nombre_archivo,
        ruta_archivo="disponible" if doc.ruta_archivo else None,
        fecha_carga=doc.fecha_carga,
        estado_revision=doc.estado_revision,
        observaciones=doc.observaciones,
        cotejado_fisico=bool(doc.cotejado_fisico),
        fecha_cotejo_fisico=doc.fecha_cotejo_fisico,
        cotejador_nombre=current_user.persona.nombre_completo if (current_user.persona and cotejo.cotejado) else None,
        historial=[]
    )

@router.get("/plantilla-estudiantes-excel")
def descargar_plantilla_estudiantes():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Plantilla_Postulantes"
    ws.append(["CI", "NOMBRES", "APELLIDOS", "EMAIL", "TELEFONO"])
    ws.append(["9000005", "Postulante", "Demo", "postulante5@example.invalid", "00000009"])
    ws.append(["9000006", "Postulante", "Demo", "postulante6@example.invalid", "00000010"])
    
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Plantilla_Importar_Postulantes.xlsx"}
    )

@router.post("/curso/{convocatoria_id}/importar-estudiantes")
async def importar_estudiantes_excel(
    convocatoria_id: str,
    archivo: UploadFile = File(...),
    current_user: Usuario = Depends(require_roles([RolUsuario.SUPERADMIN.value, RolUsuario.COORDINADOR.value])),
    db: Session = Depends(get_db)
):
    conv = db.query(Convocatoria).filter(Convocatoria.id_convocatoria == convocatoria_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada.")
    exigir_acceso_convocatoria(current_user, convocatoria_id, db)

    contents = await archivo.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents))
    ws = wb.active

    requisitos = db.query(Requisito).filter(Requisito.id_programa == conv.id_programa).all()

    importados = 0
    ya_existentes = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not row[0]:
            continue
        ci = str(row[0]).strip()
        nombres = str(row[1]).strip() if len(row) > 1 and row[1] else "Postulante"
        apellidos = str(row[2]).strip() if len(row) > 2 and row[2] else ""
        email = str(row[3]).strip() if len(row) > 3 and row[3] else f"post_{ci}@postgrado.edu"
        telefono = str(row[4]).strip() if len(row) > 4 and row[4] else None

        # 1. Buscar o crear PERSONA (Pág. 7)
        persona = db.query(Persona).filter(
            (Persona.nro_documento == ci) | (Persona.correo == email)
        ).first()

        if not persona:
            persona = Persona(
                nombres=nombres,
                apellidos=apellidos,
                nro_documento=ci,
                correo=email,
                telefono=telefono
            )
            db.add(persona)
            db.commit()
            db.refresh(persona)

        # 2. Crear cuenta de usuario si no tiene
        if not persona.usuario:
            usuario = Usuario(
                id_persona=persona.id_persona,
                nombre_usuario=email,
                password_hash=get_password_hash("estudiante123"),
                rol=RolUsuario.ESTUDIANTE.value,
                activo=True,
                debe_cambiar_contrasena=True
            )
            db.add(usuario)
            db.commit()

        # 3. Registrar INSCRIPCIÓN con código único (RF-04 & RF-05)
        inscripcion = db.query(Inscripcion).filter(
            Inscripcion.id_persona == persona.id_persona,
            Inscripcion.id_convocatoria == conv.id_convocatoria
        ).first()

        if not inscripcion:
            codigo = generar_codigo_inscripcion(conv.id_convocatoria, db)
            inscripcion = Inscripcion(
                id_persona=persona.id_persona,
                id_convocatoria=conv.id_convocatoria,
                codigo_inscripcion=codigo,
                estado_actual_id=1,  # Registrada
                observacion="Inscripción importada desde planilla oficial"
            )
            db.add(inscripcion)
            db.commit()
            db.refresh(inscripcion)

            # Generar carpetas de requisitos para el expediente
            for req in requisitos:
                db.add(Documento(
                    id_inscripcion=inscripcion.id_inscripcion,
                    id_requisito=req.id_requisito,
                    estado_revision="Pendiente"
                ))

            # Registrar en HISTORIAL_ESTADOS (RF-09)
            h = HistorialEstado(
                id_inscripcion=inscripcion.id_inscripcion,
                id_estado=1,
                id_usuario=current_user.id_usuario,
                comentario=f"Inscripción registrada con código {codigo}."
            )
            db.add(h)
            db.commit()
            importados += 1
        else:
            ya_existentes += 1

    return {
        "mensaje": "Proceso de importación finalizado.",
        "estudiantes_importados": importados,
        "estudiantes_ya_inscritos": ya_existentes
    }
