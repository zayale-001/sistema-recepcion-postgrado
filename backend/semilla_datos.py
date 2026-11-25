from __future__ import annotations
import sys
import os
from datetime import datetime
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models.models import (
    Persona, Usuario, RolUsuario, Categoria, Area, Programa, Convocatoria,
    Requisito, Inscripcion, Documento, Estado, HistorialEstado, CoordinadorConvocatoria
)

def ejecutar_semilla():
    print("Iniciando carga de datos según Propuesta Técnica UPI - FINI...")
    
    # Recrear tablas limpias
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Catálogo Oficial de ESTADOS (Pág. 9 del informe)
        # ---------------------------------------------------
        estados_def = [
            (1, "Registrada", "Solicitud de inscripción creada inicialmente", 1, False),
            (2, "Incompleta", "Tiene requisitos pendientes de carga", 2, False),
            (3, "En Revisión", "Documentos en proceso de revisión por coordinación", 3, False),
            (4, "Completa", "Todos los requisitos fueron cargados", 4, False),
            (5, "Observada", "Uno o más documentos tienen observaciones", 5, False),
            (6, "Habilitada", "Expediente aprobado y habilitado para el programa", 6, True),
            (7, "Rechazada", "Solicitud rechazada formalmente", 7, True),
        ]
        for e_id, nom, desc, ordn, e_fin in estados_def:
            est_obj = db.query(Estado).filter(Estado.id_estado == e_id).first()
            if not est_obj:
                db.add(Estado(id_estado=e_id, nombre=nom, descripcion=desc, orden=ordn, estado_final=e_fin))
        db.commit()

        # 2. PERSONAS y USUARIOS (Pág. 7 del informe)
        # ---------------------------------------------------
        personas_usuarios = [
            # Personal Administrativo
            ("1000001", "Admin", "Demo", "admin@example.invalid", "00000001", RolUsuario.SUPERADMIN.value, "admin123"),
            ("1000002", "Coordinador", "Doctorado Demo", "coord.doctorado@example.invalid", "00000002", RolUsuario.COORDINADOR.value, "coord123"),
            ("1000003", "Coordinador", "Maestria Demo", "coord.maestria@example.invalid", "00000003", RolUsuario.COORDINADOR.value, "coord123"),
            ("1000004", "Coordinador", "Diplomados Demo", "coord.diplomados@example.invalid", "00000004", RolUsuario.COORDINADOR.value, "coord123"),
            # Postulantes / Maestrantes
            ("9000001", "Postulante", "Demo Uno", "postulante1@example.invalid", "00000005", RolUsuario.ESTUDIANTE.value, "estudiante123"),
            ("9000002", "Postulante", "Demo Dos", "postulante2@example.invalid", "00000006", RolUsuario.ESTUDIANTE.value, "estudiante123"),
            ("9000003", "Postulante", "Demo Tres", "postulante3@example.invalid", "00000007", RolUsuario.ESTUDIANTE.value, "estudiante123"),
            ("9000004", "Postulante", "Demo Cuatro", "postulante4@example.invalid", "00000008", RolUsuario.ESTUDIANTE.value, "estudiante123"),
        ]

        usuarios_map = {}
        personas_map = {}
        for ci, nom, ape, email, tel, rol, password in personas_usuarios:
            persona = db.query(Persona).filter(Persona.nro_documento == ci).first()
            if not persona:
                persona = Persona(
                    nombres=nom,
                    apellidos=ape,
                    nro_documento=ci,
                    correo=email,
                    telefono=tel
                )
                db.add(persona)
                db.commit()
                db.refresh(persona)
            personas_map[ci] = persona

            usuario = db.query(Usuario).filter(Usuario.id_persona == persona.id_persona).first()
            if not usuario:
                usuario = Usuario(
                    id_persona=persona.id_persona,
                    nombre_usuario=email,
                    password_hash=get_password_hash(password),
                    rol=rol,
                    activo=True
                )
                db.add(usuario)
                db.commit()
                db.refresh(usuario)
            usuarios_map[ci] = usuario

        # 3. CATEGORÍAS (De la oferta académica de la institución)
        # ---------------------------------------------------
        cat_data = [
            ("Doctorado", "doctorado", "school", 1),
            ("Maestrías", "maestrias", "workspace_premium", 2),
            ("Especialidad", "especialidad", "local_hospital", 3),
            ("Diplomados", "diplomados", "card_membership", 4),
            ("Cursos", "cursos", "menu_book", 5),
        ]
        cat_map = {}
        for nom, slug, ico, ordn in cat_data:
            c = db.query(Categoria).filter(Categoria.slug == slug).first()
            if not c:
                c = Categoria(nombre=nom, slug=slug, icono=ico, orden=ordn)
                db.add(c)
                db.commit()
                db.refresh(c)
            cat_map[slug] = c

        # 4. ÁREAS (Maestrías)
        # ---------------------------------------------------
        areas_data = [
            "Área Ciencias Sociales",
            "Área Ciencias Económicas, Administrativas y Financieras",
            "Área Ciencias Jurídicas",
            "Área Ciencias de la Salud",
            "Área Ciencias Exactas y Tecnología",
            "Área Ciencias Agrícolas, Pecuarias y Veterinarias",
            "Maestrías UPI Santa Cruz"
        ]
        areas_map = {}
        for idx, area_nom in enumerate(areas_data, 1):
            slug = area_nom.lower().replace(" ", "-").replace("á", "a").replace("í", "i").replace("é", "e").replace(",", "")
            a = db.query(Area).filter(Area.slug == slug).first()
            if not a:
                a = Area(categoria_id=cat_map["maestrias"].id, nombre=area_nom, slug=slug, orden=idx)
                db.add(a)
                db.commit()
                db.refresh(a)
            areas_map[area_nom] = a

        # 5. PROGRAMAS Y CONVOCATORIAS (Pág. 7 y 8)
        # ---------------------------------------------------
        programas_semilla = [
            ("Investigación Transdisciplinar", "DOC-IT-1", "Doctorado", "3 años", cat_map["doctorado"].id, None, "coord.doctorado"),
            ("Doctorado en Gestión Pública y Ciencias Empresariales", "DOC-GP-1", "Doctorado", "3 años", cat_map["doctorado"].id, None, "coord.doctorado"),
            ("Maestría en Administración de Empresas (MBA)", "MAE-MBA-1", "Maestría", "2 años", cat_map["maestrias"].id, areas_map["Área Ciencias Económicas, Administrativas y Financieras"].id, "coord.maestria"),
            ("Maestría en Tecnologías de la Información y Ciberseguridad", "MAE-TIC-1", "Maestría", "2 años", cat_map["maestrias"].id, areas_map["Área Ciencias Exactas y Tecnología"].id, "coord.maestria"),
            ("Especialidad en Nutriología", "ESP-NUT-1", "Especialidad", "1 año", cat_map["especialidad"].id, None, "coord.maestria"),
            ("Diplomado en Inteligencia Artificial Aplicada a los Negocios", "DIP-IAA-1", "Diplomado", "6 meses", cat_map["diplomados"].id, None, "coord.diplomados"),
            ("Diplomado en Gestión de la Ciberseguridad", "DIP-GCS-1", "Diplomado", "6 meses", cat_map["diplomados"].id, None, "coord.diplomados"),
            ("Curso de Estadística y Diseños Experimentales", "CUR-EST-1", "Curso", "2 meses", cat_map["cursos"].id, None, "coord.diplomados")
        ]

        convocatorias_creadas = []
        for nom, cod, nivel, dur, cat_id, area_id, coord_key in programas_semilla:
            p = db.query(Programa).filter(Programa.codigo == cod).first()
            if not p:
                p = Programa(
                    nombre=nom,
                    codigo=cod,
                    nivel=nivel,
                    duracion=dur,
                    categoria_id=cat_id,
                    area_id=area_id,
                    descripcion=f"Programa oficial de {nivel} en {nom} de la UPI - FINI",
                    activo=True
                )
                db.add(p)
                db.commit()
                db.refresh(p)

            # Requisitos por Programa (RF-06, Pág. 8)
            reqs_existentes = db.query(Requisito).filter(Requisito.id_programa == p.id_programa).count()
            if reqs_existentes == 0:
                if nivel == "Doctorado":
                    reqs_list = [
                        ("Título en Provisión Nacional (Legalizado)", True),
                        ("Diploma Académico de Maestría", True),
                        ("Cédula de Identidad Vigente", True),
                        ("Hoja de Vida Documentada", True),
                        ("Perfil de Tesis Doctoral", True)
                    ]
                elif nivel == "Maestría":
                    reqs_list = [
                        ("Título en Provisión Nacional", True),
                        ("Diploma Académico de Licenciatura", True),
                        ("Cédula de Identidad Vigente", True),
                        ("Currículum Vitae Resumido", True),
                        ("Formulario de Admisión Firmado", True)
                    ]
                else:
                    reqs_list = [
                        ("Fotocopia de Título Profesional", True),
                        ("Cédula de Identidad Vigente", True),
                        ("Formulario de Inscripción", True)
                    ]
                for orden_i, (r_nom, oblig) in enumerate(reqs_list, 1):
                    db.add(Requisito(id_programa=p.id_programa, nombre=r_nom, obligatorio=oblig, orden=orden_i))
                db.commit()

            # Convocatoria (Pág. 8)
            conv = db.query(Convocatoria).filter(Convocatoria.id_programa == p.id_programa).first()
            if not conv:
                conv = Convocatoria(
                    id_programa=p.id_programa,
                    gestion="2024",
                    version="1ra. Versión",
                    edicion="1ra. Edición",
                    cupo=35,
                    estado="Abierta"
                )
                db.add(conv)
                db.commit()
                db.refresh(conv)

                # Asignar coordinador a la convocatoria
                coord_user = None
                if "doctorado" in coord_key:
                    coord_user = usuarios_map["2000001"]
                elif "maestria" in coord_key:
                    coord_user = usuarios_map["2000002"]
                else:
                    coord_user = usuarios_map["2000003"]

                if coord_user:
                    db.add(CoordinadorConvocatoria(id_usuario=coord_user.id_usuario, id_convocatoria=conv.id_convocatoria))
                    db.commit()

            convocatorias_creadas.append((conv, p))

        # 6. INSCRIPCIONES CON CÓDIGO ÚNICO (RF-04, RF-05, Pág. 8)
        # ---------------------------------------------------
        primer_conv, primer_prog = convocatorias_creadas[0] # Investigación Transdisciplinar
        reqs_programa = db.query(Requisito).filter(Requisito.id_programa == primer_prog.id_programa).order_by(Requisito.orden).all()

        # Estudiante 1: Alejandro Suárez -> HABILITADA (Estado 6)
        p1 = personas_map["9000001"]
        ins1 = db.query(Inscripcion).filter(Inscripcion.id_persona == p1.id_persona, Inscripcion.id_convocatoria == primer_conv.id_convocatoria).first()
        if not ins1:
            ins1 = Inscripcion(
                id_persona=p1.id_persona,
                id_convocatoria=primer_conv.id_convocatoria,
                codigo_inscripcion="INS-2024-0001",
                estado_actual_id=6, # Habilitada
                observacion="Expediente completo y validado en ventanilla"
            )
            db.add(ins1)
            db.commit()
            db.refresh(ins1)

            for r in reqs_programa:
                db.add(Documento(
                    id_inscripcion=ins1.id_inscripcion,
                    id_requisito=r.id_requisito,
                    nombre_archivo=f"{r.nombre}.pdf",
                    ruta_archivo="uploads/ejemplo_aprobado.pdf",
                    estado_revision="Válido",
                    cotejado_fisico=True,
                    fecha_cotejo_fisico=datetime.utcnow()
                ))
            db.add(HistorialEstado(id_inscripcion=ins1.id_inscripcion, id_estado=6, comentario="Expediente 100% aprobado y habilitado."))

        # Estudiante 2: Valeria Fernández -> OBSERVADA (Estado 5)
        p2 = personas_map["9000002"]
        ins2 = db.query(Inscripcion).filter(Inscripcion.id_persona == p2.id_persona, Inscripcion.id_convocatoria == primer_conv.id_convocatoria).first()
        if not ins2:
            ins2 = Inscripcion(
                id_persona=p2.id_persona,
                id_convocatoria=primer_conv.id_convocatoria,
                codigo_inscripcion="INS-2024-0002",
                estado_actual_id=5, # Observada
                observacion="Uno de los documentos presenta firma borrosa"
            )
            db.add(ins2)
            db.commit()
            db.refresh(ins2)

            for idx, r in enumerate(reqs_programa):
                est = "Observado" if idx == 0 else "Válido"
                obs = "El escaneo del título no tiene la firma legible." if idx == 0 else None
                db.add(Documento(
                    id_inscripcion=ins2.id_inscripcion,
                    id_requisito=r.id_requisito,
                    nombre_archivo=f"{r.nombre}.pdf",
                    ruta_archivo="uploads/ejemplo.pdf",
                    estado_revision=est,
                    observaciones=obs
                ))
            db.add(HistorialEstado(id_inscripcion=ins2.id_inscripcion, id_estado=5, comentario="Documento observado por ilegibilidad."))

        # Estudiante 3: Jorge Justiniano -> INCOMPLETA (Estado 2)
        p3 = personas_map["9000003"]
        ins3 = db.query(Inscripcion).filter(Inscripcion.id_persona == p3.id_persona, Inscripcion.id_convocatoria == primer_conv.id_convocatoria).first()
        if not ins3:
            ins3 = Inscripcion(
                id_persona=p3.id_persona,
                id_convocatoria=primer_conv.id_convocatoria,
                codigo_inscripcion="INS-2024-0003",
                estado_actual_id=2, # Incompleta
                observacion="Faltan requisitos por subir"
            )
            db.add(ins3)
            db.commit()
            db.refresh(ins3)

            for idx, r in enumerate(reqs_programa):
                if idx < 2:
                    db.add(Documento(
                        id_inscripcion=ins3.id_inscripcion,
                        id_requisito=r.id_requisito,
                        nombre_archivo=f"{r.nombre}.pdf",
                        ruta_archivo="uploads/ejemplo.pdf",
                        estado_revision="Válido"
                    ))
                else:
                    db.add(Documento(
                        id_inscripcion=ins3.id_inscripcion,
                        id_requisito=r.id_requisito,
                        estado_revision="Pendiente"
                    ))
            db.add(HistorialEstado(id_inscripcion=ins3.id_inscripcion, id_estado=2, comentario="Inscripción incompleta: 2 de 5 requisitos subidos."))

        # Estudiante 4: Claudia Mercado -> REGISTRADA (Estado 1)
        p4 = personas_map["9000004"]
        ins4 = db.query(Inscripcion).filter(Inscripcion.id_persona == p4.id_persona, Inscripcion.id_convocatoria == primer_conv.id_convocatoria).first()
        if not ins4:
            ins4 = Inscripcion(
                id_persona=p4.id_persona,
                id_convocatoria=primer_conv.id_convocatoria,
                codigo_inscripcion="INS-2024-0004",
                estado_actual_id=1, # Registrada
                observacion="Recién matriculada. Ningún requisito entregado."
            )
            db.add(ins4)
            db.commit()
            db.refresh(ins4)

            for r in reqs_programa:
                db.add(Documento(
                    id_inscripcion=ins4.id_inscripcion,
                    id_requisito=r.id_requisito,
                    estado_revision="Pendiente"
                ))
            db.add(HistorialEstado(id_inscripcion=ins4.id_inscripcion, id_estado=1, comentario="Inscripción registrada formalmente."))

        db.commit()
        print("¡Base de datos sembrada y alineada con la Propuesta Técnica UPI - FINI exitosamente!")

    except Exception as e:
        db.rollback()
        print(f"Error al sembrar base de datos: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    ejecutar_semilla()
