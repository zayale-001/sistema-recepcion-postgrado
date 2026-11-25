from __future__ import annotations
import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import (
    Persona, Usuario, Programa, Convocatoria, Inscripcion, Requisito, Documento,
    Estado, HistorialEstado, HistorialDocumento, CoordinadorConvocatoria, RolUsuario
)
from app.schemas.schemas import EstudianteSeguimientoItem, CursoResumenSeguimiento

def generar_codigo_inscripcion(convocatoria_id: str, db: Session) -> str:
    conv = db.query(Convocatoria).filter(Convocatoria.id_convocatoria == convocatoria_id).first()
    gestion = conv.gestion if conv else str(datetime.utcnow().year)
    prefijo = f"INS-{gestion}-"
    codigos = db.query(Inscripcion.codigo_inscripcion).filter(
        Inscripcion.codigo_inscripcion.like(f"{prefijo}%")
    ).all()
    mayor_secuencia = 0
    for (codigo,) in codigos:
        try:
            mayor_secuencia = max(mayor_secuencia, int(codigo.rsplit("-", 1)[1]))
        except (AttributeError, IndexError, ValueError):
            continue
    secuencia = mayor_secuencia + 1
    codigo_nuevo = f"{prefijo}{secuencia:04d}"
    while db.query(Inscripcion.id_inscripcion).filter(
        Inscripcion.codigo_inscripcion == codigo_nuevo
    ).first():
        secuencia += 1
        codigo_nuevo = f"{prefijo}{secuencia:04d}"
    return codigo_nuevo

def registrar_historial_documento(documento_id: str, usuario_id: str | None, accion: str, nombre_archivo: str | None, db: Session) -> None:
    ultimo = db.query(HistorialDocumento).filter(
        HistorialDocumento.id_documento == documento_id
    ).order_by(HistorialDocumento.fecha_cambio.desc()).first()
    ahora = datetime.utcnow()
    if ultimo and ahora <= ultimo.fecha_cambio:
        ahora = ultimo.fecha_cambio + timedelta(microseconds=1)
    db.add(HistorialDocumento(
        id_documento=documento_id,
        id_usuario=usuario_id,
        accion=accion,
        nombre_archivo=nombre_archivo,
        fecha_cambio=ahora
    ))

def registrar_cambio_estado(inscripcion_id: str, nuevo_estado_id: int, usuario_id: str | None, comentario: str | None, db: Session):
    inscripcion = db.query(Inscripcion).filter(Inscripcion.id_inscripcion == inscripcion_id).first()
    if not inscripcion:
        return
    
    inscripcion.estado_actual_id = nuevo_estado_id
    h = HistorialEstado(
        id_inscripcion=inscripcion_id,
        id_estado=nuevo_estado_id,
        id_usuario=usuario_id,
        fecha_cambio=datetime.utcnow(),
        comentario=comentario
    )
    db.add(h)
    db.commit()

def recalcular_estado_inscripcion(inscripcion_id: str, usuario_id: str | None, db: Session):
    inscripcion = db.query(Inscripcion).filter(Inscripcion.id_inscripcion == inscripcion_id).first()
    if not inscripcion:
        return

    requisitos = db.query(Requisito).filter(
        Requisito.id_programa == inscripcion.convocatoria.id_programa,
        Requisito.obligatorio == True
    ).all()
    total_req = len(requisitos)

    if total_req == 0:
        registrar_cambio_estado(inscripcion_id, 4, usuario_id, "Programa sin requisitos. Marcado como Completo.", db)
        return

    docs = db.query(Documento).filter(Documento.id_inscripcion == inscripcion_id).all()
    doc_map = {d.id_requisito: d for d in docs}

    subidos = 0
    aprobados = 0
    observados = 0

    for r in requisitos:
        d = doc_map.get(r.id_requisito)
        if d and d.ruta_archivo:
            subidos += 1
            if d.estado_revision == "Válido":
                aprobados += 1
            elif d.estado_revision == "Observado":
                observados += 1

    # Estados: 1: Registrada, 2: Incompleta, 3: En Revisión, 4: Completa, 5: Observada, 6: Habilitada
    if observados > 0:
        nuevo_id = 5  # Observada
        coment = f"El expediente tiene {observados} documento(s) con observaciones."
    elif aprobados == total_req:
        nuevo_id = 6  # Habilitada / Aprobada
        coment = "100% de los requisitos aprobados satisfactoriamente."
    elif subidos == total_req:
        nuevo_id = 4  # Completa
        coment = "Todos los documentos han sido subidos por el postulante."
    elif subidos > 0:
        nuevo_id = 2  # Incompleta
        coment = f"Se han subido {subidos} de {total_req} requisitos."
    else:
        nuevo_id = 1  # Registrada
        coment = "Inscripción registrada. Sin documentos aún."

    if inscripcion.estado_actual_id != nuevo_id:
        registrar_cambio_estado(inscripcion_id, nuevo_id, usuario_id, coment, db)

def obtener_seguimiento_curso(convocatoria_id: str, db: Session) -> list[EstudianteSeguimientoItem]:
    inscripciones = db.query(Inscripcion).filter(Inscripcion.id_convocatoria == convocatoria_id).all()
    conv = db.query(Convocatoria).filter(Convocatoria.id_convocatoria == convocatoria_id).first()
    if not conv:
        return []

    requisitos = db.query(Requisito).filter(
        Requisito.id_programa == conv.id_programa,
        Requisito.obligatorio == True
    ).all()
    total_requisitos = len(requisitos)

    resultados: list[EstudianteSeguimientoItem] = []

    for ins in inscripciones:
        persona = ins.persona
        docs = db.query(Documento).filter(Documento.id_inscripcion == ins.id_inscripcion).all()
        doc_map = {d.id_requisito: d for d in docs}

        subidos = 0
        aprobados = 0
        observados = 0
        cotejados_fisicos = 0
        faltantes_nombres = []

        for req in requisitos:
            doc = doc_map.get(req.id_requisito)
            if doc and doc.ruta_archivo:
                subidos += 1
                if doc.estado_revision == "Válido":
                    aprobados += 1
                elif doc.estado_revision == "Observado":
                    observados += 1
                if doc.cotejado_fisico:
                    cotejados_fisicos += 1
            else:
                faltantes_nombres.append(req.nombre)

        porcentaje = round((subidos / total_requisitos * 100), 1) if total_requisitos > 0 else 100.0

        resultados.append(EstudianteSeguimientoItem(
            inscripcion_id=ins.id_inscripcion,
            id_persona=persona.id_persona,
            codigo_inscripcion=ins.codigo_inscripcion,
            ci=persona.nro_documento,
            nombres=persona.nombres,
            apellidos=persona.apellidos,
            email=persona.correo,
            telefono=persona.telefono,
            estado_id=ins.estado_actual.id_estado if ins.estado_actual else 1,
            estado_nombre=ins.estado_actual.nombre if ins.estado_actual else "Registrada",
            total_requisitos=total_requisitos,
            requisitos_subidos=subidos,
            requisitos_aprobados=aprobados,
            requisitos_observados=observados,
            requisitos_faltantes=len(faltantes_nombres),
            requisitos_cotejados_fisico=cotejados_fisicos,
            porcentaje_avance=porcentaje,
            documentos_faltantes_nombres=faltantes_nombres
        ))

    return resultados

def obtener_resumen_convocatorias(usuario: Usuario, db: Session) -> list[CursoResumenSeguimiento]:
    if usuario.rol == RolUsuario.SUPERADMIN.value:
        convocatorias = db.query(Convocatoria).all()
    elif usuario.rol == RolUsuario.ESTUDIANTE.value:
        convocatorias = []
    else:
        asignaciones = db.query(CoordinadorConvocatoria).filter(CoordinadorConvocatoria.id_usuario == usuario.id_usuario).all()
        conv_ids = [a.id_convocatoria for a in asignaciones]
        convocatorias = db.query(Convocatoria).filter(Convocatoria.id_convocatoria.in_(conv_ids)).all()

    now = datetime.utcnow()
    resumen_list = []
    for conv in convocatorias:
        inscripciones = db.query(Inscripcion).filter(Inscripcion.id_convocatoria == conv.id_convocatoria).all()
        total_estudiantes = len(inscripciones)
        
        # Estados: 4: Completa, 6: Habilitada
        completos = sum(1 for i in inscripciones if i.estado_actual_id in [4, 6])
        aprobados = sum(1 for i in inscripciones if i.estado_actual_id == 6)
        observados = sum(1 for i in inscripciones if i.estado_actual_id == 5)
        faltantes = sum(1 for i in inscripciones if i.estado_actual_id in [1, 2, 3])

        coordinador_rel = db.query(CoordinadorConvocatoria).filter(CoordinadorConvocatoria.id_convocatoria == conv.id_convocatoria).first()
        coordinador_nombre = coordinador_rel.usuario.persona.nombre_completo if (coordinador_rel and coordinador_rel.usuario.persona) else "Sin Asignar"

        dias_restantes = None
        estado_plazo = "VIGENTE"
        if conv.fecha_fin:
            diff = (conv.fecha_fin - now).days
            dias_restantes = diff
            if diff < 0 or conv.estado == "Cerrada":
                estado_plazo = "VENCIDO"
            elif diff <= 3:
                estado_plazo = "POR_VENCER"
            else:
                estado_plazo = "VIGENTE"

        resumen_list.append(CursoResumenSeguimiento(
            edicion_id=conv.id_convocatoria,
            programa_nombre=conv.programa.nombre,
            categoria_nombre=conv.programa.categoria.nombre if conv.programa.categoria else conv.programa.nivel,
            version_edicion=f"{conv.version} - {conv.edicion}",
            gestion=conv.gestion,
            fecha_fin=conv.fecha_fin,
            dias_restantes=dias_restantes,
            estado_plazo=estado_plazo,
            total_estudiantes=total_estudiantes,
            estudiantes_completos=completos,
            estudiantes_faltantes=faltantes,
            estudiantes_observados=observados,
            estudiantes_aprobados=aprobados,
            coordinador_encargado=coordinador_nombre
        ))

    return resumen_list
