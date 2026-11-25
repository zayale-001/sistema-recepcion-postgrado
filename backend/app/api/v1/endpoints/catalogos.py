from __future__ import annotations
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import (
    Categoria, Area, Programa, Convocatoria, Requisito, CoordinadorConvocatoria, RolUsuario
)
from app.schemas.schemas import (
    CategoriaOut, AreaOut, ProgramaOut, ConvocatoriaOut, ConvocatoriaUpdateIn, RequisitoOut, RequisitoCreate, ProgramaCreateIn
)
from app.api.deps import require_roles, convocatorias_permitidas

router = APIRouter()

@router.get("/categorias", response_model=List[CategoriaOut])
def listar_categorias(db: Session = Depends(get_db)):
    return db.query(Categoria).order_by(Categoria.orden).all()

@router.get("/areas", response_model=List[AreaOut])
def listar_areas(categoria_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Area)
    if categoria_id:
        query = query.filter(Area.categoria_id == categoria_id)
    return query.order_by(Area.orden).all()

@router.get("/programas", response_model=List[ProgramaOut])
def listar_programas(
    categoria_id: Optional[int] = None,
    area_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Programa).filter(Programa.activo == True)
    if categoria_id:
        query = query.filter(Programa.categoria_id == categoria_id)
    if area_id:
        query = query.filter(Programa.area_id == area_id)
    return query.order_by(Programa.nombre).all()

@router.post("/programas")
def crear_programa(
    datos: ProgramaCreateIn,
    db: Session = Depends(get_db),
    _user = Depends(require_roles([RolUsuario.SUPERADMIN.value]))
):
    codigo = datos.codigo or f"PRG-{uuid.uuid4().hex[:6].upper()}"
    nuevo_programa = Programa(
        categoria_id=datos.categoria_id,
        area_id=datos.area_id,
        codigo=codigo,
        nombre=datos.nombre,
        descripcion=datos.descripcion,
        nivel=datos.nivel,
        duracion=datos.duracion,
        activo=True
    )
    db.add(nuevo_programa)
    db.commit()
    db.refresh(nuevo_programa)

    # Crear convocatoria inicial
    nueva_convocatoria = Convocatoria(
        id_programa=nuevo_programa.id_programa,
        version=datos.version or "1ra. Versión",
        edicion=datos.edicion or "1ra. Edición",
        gestion=datos.gestion or "2024",
        cupo=datos.cupo or 40,
        fecha_fin=datos.fecha_fin,
        estado="Abierta"
    )
    db.add(nueva_convocatoria)
    db.commit()
    db.refresh(nueva_convocatoria)

    # Asignar Coordinador si aplica
    if datos.coordinador_id:
        db.add(CoordinadorConvocatoria(
            id_usuario=datos.coordinador_id,
            id_convocatoria=nueva_convocatoria.id_convocatoria
        ))

    # Requisitos asociados al programa (Pág. 8: id_programa FK)
    if datos.requisitos_nombres and len(datos.requisitos_nombres) > 0:
        for idx, nom in enumerate(datos.requisitos_nombres, 1):
            if nom.strip():
                db.add(Requisito(
                    id_programa=nuevo_programa.id_programa,
                    nombre=nom.strip(),
                    descripcion=f"Documento requerido para {nuevo_programa.nombre}",
                    obligatorio=True,
                    formato_permitido="pdf",
                    orden=idx
                ))
    else:
        reqs_defecto = {
            "doctorado": [
                "Título en Provisión Nacional (Legalizado)",
                "Diploma Académico de Maestría",
                "Cédula de Identidad Vigente",
                "Hoja de Vida Documentada",
                "Perfil de Tesis Doctoral"
            ],
            "maestrias": [
                "Título en Provisión Nacional",
                "Diploma Académico de Licenciatura",
                "Cédula de Identidad Vigente",
                "Currículum Vitae Resumido",
                "Formulario de Admisión"
            ],
            "especialidad": [
                "Título Profesional en Provisión Nacional",
                "Matrícula Profesional / Carnet Colegio",
                "Cédula de Identidad Vigente",
                "Currículum Vitae"
            ],
            "diplomados": [
                "Fotocopia de Título de Licenciatura o Técnico Superior",
                "Fotocopia Cédula de Identidad",
                "Formulario de Inscripción"
            ],
            "cursos": [
                "Fotocopia Cédula de Identidad",
                "Comprobante de Depósito / Matrícula"
            ]
        }
        nivel_key = datos.nivel.lower()
        lista = reqs_defecto.get(nivel_key, reqs_defecto["diplomados"])
        for idx, nom in enumerate(lista, 1):
            db.add(Requisito(
                id_programa=nuevo_programa.id_programa,
                nombre=nom,
                obligatorio=True,
                formato_permitido="pdf",
                orden=idx
            ))

    db.commit()

    return {
        "mensaje": "Programa y convocatoria creados exitosamente.",
        "id_programa": nuevo_programa.id_programa,
        "id_convocatoria": nueva_convocatoria.id_convocatoria,
        "nombre": nuevo_programa.nombre
    }

@router.delete("/programas/{programa_id}")
def desactivar_programa(
    programa_id: str,
    db: Session = Depends(get_db),
    _user = Depends(require_roles([RolUsuario.SUPERADMIN.value]))
):
    prog = db.query(Programa).filter(Programa.id_programa == programa_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Programa no encontrado.")
    prog.activo = False
    db.commit()
    return {"mensaje": "Programa desactivado exitosamente."}

@router.get("/convocatorias", response_model=List[ConvocatoriaOut])
def listar_convocatorias(programa_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Convocatoria)
    if programa_id:
        query = query.filter(Convocatoria.id_programa == programa_id)
    return query.all()

@router.patch("/convocatorias/{convocatoria_id}", response_model=ConvocatoriaOut)
def actualizar_convocatoria(
    convocatoria_id: str,
    cambios: ConvocatoriaUpdateIn,
    db: Session = Depends(get_db),
    _user = Depends(require_roles([RolUsuario.SUPERADMIN.value]))
):
    convocatoria = db.query(Convocatoria).filter(
        Convocatoria.id_convocatoria == convocatoria_id
    ).first()
    if not convocatoria:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada.")
    if cambios.estado is not None:
        if cambios.estado not in ("Borrador", "Abierta", "Cerrada"):
            raise HTTPException(status_code=400, detail="Estado inválido para la convocatoria.")
        convocatoria.estado = cambios.estado
    if cambios.cupo is not None:
        if cambios.cupo < 1:
            raise HTTPException(status_code=400, detail="El cupo debe ser mayor a cero.")
        convocatoria.cupo = cambios.cupo
    if "fecha_fin" in cambios.model_fields_set:
        convocatoria.fecha_fin = cambios.fecha_fin
    db.commit()
    db.refresh(convocatoria)
    return convocatoria

@router.get("/programas/{programa_id}/requisitos", response_model=List[RequisitoOut])
def obtener_requisitos_programa(programa_id: str, db: Session = Depends(get_db)):
    return db.query(Requisito).filter(Requisito.id_programa == programa_id).order_by(Requisito.orden).all()

@router.post("/requisitos", response_model=RequisitoOut)
def crear_requisito(
    req_in: RequisitoCreate,
    db: Session = Depends(get_db),
    _user = Depends(require_roles([RolUsuario.SUPERADMIN.value, RolUsuario.COORDINADOR.value]))
):
    permitidas = convocatorias_permitidas(_user, db)
    if permitidas is not None:
        propio = db.query(Convocatoria).filter(
            Convocatoria.id_programa == req_in.id_programa,
            Convocatoria.id_convocatoria.in_(permitidas)
        ).first()
        if not propio:
            raise HTTPException(status_code=403, detail="No tienes acceso a este programa.")
    nuevo_req = Requisito(
        id_programa=req_in.id_programa,
        nombre=req_in.nombre,
        descripcion=req_in.descripcion,
        obligatorio=req_in.obligatorio,
        formato_permitido=req_in.formato_permitido,
        orden=req_in.orden
    )
    db.add(nuevo_req)
    db.commit()
    db.refresh(nuevo_req)
    return nuevo_req
