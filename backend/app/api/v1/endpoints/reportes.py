from __future__ import annotations
import io
import hashlib
import re
import unicodedata
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.core.database import get_db
from app.models.models import Convocatoria, Requisito, Inscripcion, Documento
from app.api.deps import get_current_user, require_roles, exigir_acceso_convocatoria, exigir_acceso_inscripcion
from app.models.models import RolUsuario, Usuario
from app.services.seguimiento_service import obtener_resumen_convocatorias, obtener_seguimiento_curso

router = APIRouter()


def _obtener_datos_reporte_admin(current_user: Usuario, db: Session):
    cursos = obtener_resumen_convocatorias(current_user, db)
    inscripciones = db.query(Inscripcion).all()
    inscripcion_por_id = {inscripcion.id_inscripcion: inscripcion for inscripcion in inscripciones}
    postulantes = []

    for curso in cursos:
        for estudiante in obtener_seguimiento_curso(curso.edicion_id, db):
            inscripcion = inscripcion_por_id.get(estudiante.inscripcion_id)
            postulantes.append({
                "inscripcion_id": estudiante.inscripcion_id,
                "codigo_inscripcion": estudiante.codigo_inscripcion,
                "ci": estudiante.ci,
                "nombres": estudiante.nombres,
                "apellidos": estudiante.apellidos,
                "email": estudiante.email,
                "telefono": estudiante.telefono,
                "programa_nombre": curso.programa_nombre,
                "categoria_nombre": curso.categoria_nombre,
                "gestion": curso.gestion,
                "estado_nombre": estudiante.estado_nombre,
                "total_requisitos": estudiante.total_requisitos,
                "requisitos_subidos": estudiante.requisitos_subidos,
                "requisitos_aprobados": estudiante.requisitos_aprobados,
                "requisitos_observados": estudiante.requisitos_observados,
                "requisitos_faltantes": estudiante.requisitos_faltantes,
                "porcentaje_avance": estudiante.porcentaje_avance,
                "fecha_solicitud": inscripcion.fecha_solicitud if inscripcion else None,
            })

    return cursos, postulantes


def _filtrar_postulantes(postulantes, categoria: str | None, gestion: str | None, estado: str | None, busqueda: str | None):
    term = (busqueda or "").strip().casefold()
    return [p for p in postulantes if
        (not categoria or p["categoria_nombre"] == categoria) and
        (not gestion or p["gestion"] == gestion) and
        (not estado or p["estado_nombre"] == estado) and
        (not term or term in " ".join(str(p.get(k) or "") for k in ("ci", "nombres", "apellidos", "email", "programa_nombre", "codigo_inscripcion")).casefold())
    ]


@router.get("/admin/resumen")
def obtener_reporte_general_admin(
    current_user: Usuario = Depends(require_roles([RolUsuario.SUPERADMIN.value])),
    db: Session = Depends(get_db)
):
    cursos, postulantes = _obtener_datos_reporte_admin(current_user, db)
    return {"programas": cursos, "postulantes": postulantes}


@router.get("/admin/exportar-excel")
def exportar_reporte_general_admin(
    categoria: str | None = None,
    gestion: str | None = None,
    estado: str | None = None,
    busqueda: str | None = None,
    current_user: Usuario = Depends(require_roles([RolUsuario.SUPERADMIN.value])),
    db: Session = Depends(get_db)
):
    _, postulantes = _obtener_datos_reporte_admin(current_user, db)
    filas = _filtrar_postulantes(postulantes, categoria, gestion, estado, busqueda)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Postulantes"
    headers = ["Código", "CI", "Nombres", "Apellidos", "Correo", "Teléfono", "Programa", "Categoría", "Gestión", "Estado", "Requisitos", "Documentos recibidos", "Aprobados", "Observados", "Faltantes", "Avance (%)", "Fecha de solicitud"]
    ws.append(headers)
    header_fill = PatternFill(start_color="C51D25", end_color="C51D25", fill_type="solid")
    for cell in ws[1]:
        cell.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for p in filas:
        ws.append([
            p["codigo_inscripcion"], p["ci"], p["nombres"], p["apellidos"], p["email"], p["telefono"],
            p["programa_nombre"], p["categoria_nombre"], p["gestion"], p["estado_nombre"], p["total_requisitos"],
            p["requisitos_subidos"], p["requisitos_aprobados"], p["requisitos_observados"], p["requisitos_faltantes"],
            p["porcentaje_avance"], p["fecha_solicitud"].replace(tzinfo=None) if p["fecha_solicitud"] else None
        ])
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    ws.sheet_view.showGridLines = False
    ws.row_dimensions[1].height = 34
    for column, width in {"A": 22, "B": 14, "C": 20, "D": 22, "E": 30, "F": 16, "G": 38, "H": 20, "I": 12, "J": 18, "K": 13, "L": 22, "M": 14, "N": 14, "O": 14, "P": 14, "Q": 20}.items():
        ws.column_dimensions[column].width = width
    for row in range(2, ws.max_row + 1):
        ws.cell(row, 16).number_format = "0.0"
        ws.cell(row, 17).number_format = "dd/mm/yyyy hh:mm"
        if row % 2 == 1:
            for cell in ws[row]:
                cell.fill = PatternFill(start_color="FFF5F5", end_color="FFF5F5", fill_type="solid")
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Reporte_General_Postulantes.xlsx"}
    )

@router.get("/curso/{convocatoria_id}/exportar-excel")
def exportar_seguimiento_excel(
    convocatoria_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles([RolUsuario.COORDINADOR.value, RolUsuario.KARDEX.value]))
):
    conv = db.query(Convocatoria).filter(Convocatoria.id_convocatoria == convocatoria_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada")
    exigir_acceso_convocatoria(current_user, convocatoria_id, db)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Seguimiento Documental"

    # Título institucional
    ws.merge_cells("A1:H1")
    ws["A1"] = "UNIDAD DE POSTGRADO - CONTROL Y SEGUIMIENTO DE INSCRIPCIONES"
    ws["A1"].font = Font(name="Arial", size=14, bold=True, color="FFFFFF")
    ws["A1"].fill = PatternFill(start_color="1A365D", end_color="1A365D", fill_type="solid")
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:H2")
    ws["A2"] = f"Programa: {conv.programa.nombre} ({conv.version} - {conv.edicion}) - Gestión {conv.gestion}"
    ws["A2"].font = Font(name="Arial", size=11, italic=True)
    ws["A2"].alignment = Alignment(horizontal="center")

    requisitos = db.query(Requisito).filter(Requisito.id_programa == conv.id_programa).order_by(Requisito.orden).all()

    headers = ["N°", "CÓDIGO INSCRIPCIÓN", "C.I.", "POSTULANTE / MAESTRANTE", "TELÉFONO", "ESTADO", "% AVANCE"]
    for r in requisitos:
        headers.append(r.nombre)

    header_font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="2B6CB0", end_color="2B6CB0", fill_type="solid")
    border_thin = Border(
        left=Side(style='thin', color='D0D0D0'),
        right=Side(style='thin', color='D0D0D0'),
        top=Side(style='thin', color='D0D0D0'),
        bottom=Side(style='thin', color='D0D0D0')
    )

    ws.row_dimensions[4].height = 25
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    inscripciones = db.query(Inscripcion).filter(Inscripcion.id_convocatoria == convocatoria_id).all()
    current_row = 5

    for idx, ins in enumerate(inscripciones, 1):
        persona = ins.persona
        docs = db.query(Documento).filter(Documento.id_inscripcion == ins.id_inscripcion).all()
        doc_map = {d.id_requisito: d for d in docs}

        subidos = sum(1 for r in requisitos if doc_map.get(r.id_requisito) and doc_map[r.id_requisito].ruta_archivo)
        total_req = len(requisitos)
        porcentaje = f"{(subidos / total_req * 100):.1f}%" if total_req > 0 else "100%"

        ws.cell(row=current_row, column=1, value=idx).alignment = Alignment(horizontal="center")
        ws.cell(row=current_row, column=2, value=ins.codigo_inscripcion)
        ws.cell(row=current_row, column=3, value=persona.nro_documento)
        ws.cell(row=current_row, column=4, value=persona.nombre_completo)
        ws.cell(row=current_row, column=5, value=persona.telefono or "S/N")
        ws.cell(row=current_row, column=6, value=ins.estado_actual.nombre if ins.estado_actual else "Registrada")
        ws.cell(row=current_row, column=7, value=porcentaje).alignment = Alignment(horizontal="center")

        col_pos = 8
        for r in requisitos:
            d = doc_map.get(r.id_requisito)
            celda_doc = ws.cell(row=current_row, column=col_pos)
            if d and d.estado_revision == "Válido":
                val = "VÁLIDO"
                if d.cotejado_fisico:
                    val += " (COTEJADO)"
                celda_doc.value = val
                celda_doc.fill = PatternFill(start_color="C6F6D5", end_color="C6F6D5", fill_type="solid")
            elif d and d.estado_revision == "Observado":
                celda_doc.value = "OBSERVADO"
                celda_doc.fill = PatternFill(start_color="FED7D7", end_color="FED7D7", fill_type="solid")
            elif d and d.ruta_archivo:
                celda_doc.value = "EN REVISIÓN"
                celda_doc.fill = PatternFill(start_color="BEE3F8", end_color="BEE3F8", fill_type="solid")
            else:
                celda_doc.value = "FALTA"
                celda_doc.fill = PatternFill(start_color="FEFCBF", end_color="FEFCBF", fill_type="solid")
            celda_doc.alignment = Alignment(horizontal="center")
            celda_doc.border = border_thin
            col_pos += 1

        for c in range(1, col_pos):
            ws.cell(row=current_row, column=c).border = border_thin

        current_row += 1

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    base = unicodedata.normalize("NFKD", f"Seguimiento_{conv.programa.nombre[:20]}_{conv.gestion}")
    base = base.encode("ascii", "ignore").decode("ascii")
    nombre_archivo = re.sub(r"[^A-Za-z0-9_.-]", "_", base) + ".xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={nombre_archivo}"}
    )

@router.get("/inscripcion/{inscripcion_id}/comprobante-pdf")
def descargar_comprobante_pdf(
    inscripcion_id: str,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inscripcion = db.query(Inscripcion).filter(Inscripcion.id_inscripcion == inscripcion_id).first()
    if not inscripcion:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada.")
    exigir_acceso_inscripcion(current_user, inscripcion, db)

    persona = inscripcion.persona
    conv = inscripcion.convocatoria
    prog = conv.programa

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#1E3A8A'),
        alignment=1,
        fontName='Helvetica-Bold'
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#64748B'),
        alignment=1,
        fontName='Helvetica'
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0F172A'),
        fontName='Helvetica'
    )
    body_bold = ParagraphStyle(
        'DocBodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    elements = []

    # Encabezado oficial UPI - FINI
    elements.append(Paragraph("UNIDAD DE POSTGRADO (UPI) - FINI", title_style))
    elements.append(Paragraph("SISTEMA DE GESTIÓN DE INSCRIPCIONES", subtitle_style))
    elements.append(Paragraph("CONSTANCIA DE RECEPCIÓN Y HABILITACIÓN DOCUMENTAL", ParagraphStyle(
        'CertHeader', parent=title_style, fontSize=12, leading=15, textColor=colors.HexColor('#0284C7'), spaceBefore=8
    )))
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E3A8A'), spaceBefore=2, spaceAfter=14))

    # Datos oficiales de inscripción
    codigo_verif = hashlib.sha256(f"{inscripcion.codigo_inscripcion}-{persona.nro_documento}".encode()).hexdigest()[:16].upper()

    datos_tabla = [
        [Paragraph("<b>Postulante:</b>", body_style), Paragraph(persona.nombre_completo, body_bold),
         Paragraph("<b>C.I. / Documento:</b>", body_style), Paragraph(persona.nro_documento, body_bold)],
        [Paragraph("<b>Programa:</b>", body_style), Paragraph(prog.nombre, body_bold),
         Paragraph("<b>Código Inscripción:</b>", body_style), Paragraph(f"<font color='#1E3A8A'><b>{inscripcion.codigo_inscripcion}</b></font>", body_bold)],
        [Paragraph("<b>Convocatoria:</b>", body_style), Paragraph(f"{conv.version} - {conv.edicion} ({conv.gestion})", body_style),
         Paragraph("<b>Hash Verificación:</b>", body_style), Paragraph(f"<code>{codigo_verif}</code>", body_style)],
        [Paragraph("<b>Estado Actual:</b>", body_style), Paragraph(f"<font color='#16A34A'><b>{inscripcion.estado_actual.nombre}</b></font>", body_bold),
         Paragraph("<b>Fecha Solicitud:</b>", body_style), Paragraph(inscripcion.fecha_solicitud.strftime("%d/%m/%Y %H:%M"), body_style)]
    ]

    t_info = Table(datos_tabla, colWidths=[120, 190, 110, 110])
    t_info.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_info)
    elements.append(Spacer(1, 16))

    # Tabla de requisitos presentados
    elements.append(Paragraph("<b>DETALLE DE REQUISITOS Y DOCUMENTOS PRESENTADOS:</b>", body_bold))
    elements.append(Spacer(1, 6))

    docs = db.query(Documento).filter(Documento.id_inscripcion == inscripcion.id_inscripcion).all()
    
    header_docs = [
        Paragraph("<b>N°</b>", body_bold),
        Paragraph("<b>Requisito Exigido</b>", body_bold),
        Paragraph("<b>Estado Revisión</b>", body_bold),
        Paragraph("<b>Cotejo Físico</b>", body_bold),
        Paragraph("<b>Fecha Carga</b>", body_bold)
    ]
    filas_docs = [header_docs]

    for idx, d in enumerate(docs, 1):
        est_revision = d.estado_revision
        cotejo_txt = "COTEJADO [✓]" if d.cotejado_fisico else "PENDIENTE"
        f_carga = d.fecha_carga.strftime("%d/%m/%Y") if d.fecha_carga else "N/D"

        filas_docs.append([
            Paragraph(str(idx), body_style),
            Paragraph(d.requisito.nombre, body_style),
            Paragraph(f"<font color='{'#16A34A' if d.estado_revision == 'Válido' else '#CA8A04'}'>{est_revision}</font>", body_style),
            Paragraph(f"<font color='{'#16A34A' if d.cotejado_fisico else '#64748B'}'>{cotejo_txt}</font>", body_style),
            Paragraph(f_carga, body_style)
        ])

    t_docs = Table(filas_docs, colWidths=[25, 235, 95, 95, 80])
    t_docs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2B6CB0')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_docs)
    elements.append(Spacer(1, 35))

    firmas_data = [
        [
            Paragraph("____________________________<br/><b>Personal Revisor / Kárdex</b><br/>Recepción y Cotejo Físico", ParagraphStyle('F1', parent=body_style, alignment=1)),
            Paragraph("____________________________<br/><b>Coordinador del Programa</b><br/>Unidad de Posgrado - FINI", ParagraphStyle('F2', parent=body_style, alignment=1))
        ]
    ]
    t_firmas = Table(firmas_data, colWidths=[265, 265])
    elements.append(t_firmas)

    doc.build(elements)
    buffer.seek(0)

    nombre_pdf = f"Conformidad_Inscripcion_{inscripcion.codigo_inscripcion}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={nombre_pdf}"}
    )
