from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str
    usuario: UsuarioOut

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class LoginIn(BaseModel):
    email_o_ci: str
    password: str

class SolicitarRecuperacionIn(BaseModel):
    email_o_ci: str

class RestablecerContrasenaIn(BaseModel):
    token: str
    nueva_contrasena: str = Field(min_length=8, max_length=128)

class CambiarContrasenaIn(BaseModel):
    contrasena_actual: str
    nueva_contrasena: str = Field(min_length=8, max_length=128)

# Personas (Pág. 7)
class PersonaBase(BaseModel):
    nombres: str
    apellidos: str
    tipo_documento: str = "CI"
    nro_documento: str
    correo: EmailStr
    telefono: Optional[str] = None

class PersonaCreate(PersonaBase):
    pass

class PersonaOut(PersonaBase):
    id_persona: str
    fecha_registro: datetime

    class Config:
        from_attributes = True

# Usuarios (Pág. 7)
class UsuarioBase(BaseModel):
    nombre_usuario: str
    rol: str = "POSTULANTE"
    activo: bool = True

class UsuarioCreate(BaseModel):
    ci: str
    nombres: str
    apellidos: str
    email: EmailStr
    telefono: Optional[str] = None
    password: str
    rol: str = "COORDINADOR"

class UsuarioOut(UsuarioBase):
    id_usuario: str
    id_persona: Optional[str] = None
    ultimo_acceso: Optional[datetime] = None
    debe_cambiar_contrasena: bool = False
    persona: Optional[PersonaOut] = None

    class Config:
        from_attributes = True

# Categorías y Áreas
class AreaOut(BaseModel):
    id: int
    nombre: str
    slug: str

    class Config:
        from_attributes = True

class CategoriaOut(BaseModel):
    id: int
    nombre: str
    slug: str
    icono: str
    orden: int
    areas: List[AreaOut] = []

    class Config:
        from_attributes = True

# Requisitos (Pág. 8)
class RequisitoBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    obligatorio: bool = True
    formato_permitido: str = "pdf"
    orden: int = 1

class RequisitoCreate(RequisitoBase):
    id_programa: str

class RequisitoOut(RequisitoBase):
    id_requisito: str
    id_programa: str

    class Config:
        from_attributes = True

# Convocatorias (Pág. 8)
class ConvocatoriaOut(BaseModel):
    id_convocatoria: str
    id_programa: str
    gestion: str
    version: str
    edicion: str
    fecha_inicio: datetime
    fecha_fin: Optional[datetime] = None
    cupo: int
    estado: str
    titulo_completo: str

    class Config:
        from_attributes = True

class ConvocatoriaUpdateIn(BaseModel):
    estado: Optional[str] = None
    cupo: Optional[int] = None
    fecha_fin: Optional[datetime] = None

class HistorialDocumentoOut(BaseModel):
    id_historial: str
    accion: str
    nombre_archivo: Optional[str] = None
    fecha_cambio: datetime
    usuario_nombre: Optional[str] = None

# Programas (Pág. 7)
class ProgramaOut(BaseModel):
    id_programa: str
    nombre: str
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    nivel: str
    duracion: str
    activo: bool
    convocatorias: List[ConvocatoriaOut] = []
    requisitos: List[RequisitoOut] = []

    class Config:
        from_attributes = True

class ProgramaCreateIn(BaseModel):
    nombre: str
    codigo: Optional[str] = None
    categoria_id: Optional[int] = None
    area_id: Optional[int] = None
    descripcion: Optional[str] = None
    nivel: str = "Maestría"
    duracion: str = "2 años"
    version: str = "1ra. Versión"
    edicion: str = "1ra. Edición"
    gestion: str = "2024"
    cupo: int = 40
    fecha_fin: Optional[datetime] = None
    coordinador_id: Optional[str] = None
    requisitos_nombres: Optional[List[str]] = None

# Estados (Pág. 9)
class EstadoOut(BaseModel):
    id_estado: int
    nombre: str
    descripcion: Optional[str] = None
    orden: int
    estado_final: bool

    class Config:
        from_attributes = True

# Historial de Estados (Pág. 9)
class HistorialEstadoOut(BaseModel):
    id_historial: str
    id_estado: int
    estado_nombre: Optional[str] = None
    fecha_cambio: datetime
    comentario: Optional[str] = None
    usuario_nombre: Optional[str] = None

    class Config:
        from_attributes = True

# Documentos (Pág. 8)
class DocumentoItemOut(BaseModel):
    id_documento: str
    id_requisito: str
    nombre_requisito: str
    obligatorio: bool
    nombre_archivo: Optional[str] = None
    ruta_archivo: Optional[str] = None
    fecha_carga: Optional[datetime] = None
    estado_revision: str  # Pendiente, Válido, Observado, Rechazado
    observaciones: Optional[str] = None
    cotejado_fisico: bool = False
    fecha_cotejo_fisico: Optional[datetime] = None
    cotejador_nombre: Optional[str] = None
    historial: List[HistorialDocumentoOut] = []

    class Config:
        from_attributes = True

class ValidarDocumentoIn(BaseModel):
    estado_revision: str  # Válido u Observado
    observaciones: Optional[str] = None

class CotejoFisicoIn(BaseModel):
    cotejado: bool

# Seguimiento para Coordinador
class EstudianteSeguimientoItem(BaseModel):
    inscripcion_id: str
    id_persona: str
    codigo_inscripcion: str
    ci: str
    nombres: str
    apellidos: str
    email: str
    telefono: Optional[str] = None
    estado_id: int
    estado_nombre: str
    total_requisitos: int
    requisitos_subidos: int
    requisitos_aprobados: int
    requisitos_observados: int
    requisitos_faltantes: int
    requisitos_cotejados_fisico: int = 0
    porcentaje_avance: float
    documentos_faltantes_nombres: List[str] = []

class CursoResumenSeguimiento(BaseModel):
    edicion_id: str  # id_convocatoria
    programa_nombre: str
    categoria_nombre: str
    version_edicion: str
    gestion: str
    fecha_fin: Optional[datetime] = None
    dias_restantes: Optional[int] = None
    estado_plazo: str = "VIGENTE"
    total_estudiantes: int
    estudiantes_completos: int
    estudiantes_faltantes: int
    estudiantes_observados: int
    estudiantes_aprobados: int
    coordinador_encargado: Optional[str] = None


class MiInscripcionOut(BaseModel):
    inscripcion_id: str
    codigo_inscripcion: str
    edicion_id: str  # id_convocatoria
    programa_nombre: str
    categoria_nombre: str
    version_edicion: str
    gestion: str
    estado_nombre: str
    fecha_solicitud: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    convocatoria_estado: str = "Abierta"


# Coordinator assignment
class AsignarCoordinadorIn(BaseModel):
    coordinador_id: str
    edicion_curso_id: str  # maps to id_convocatoria


# Settings / Admin schemas
class ProgramaUpdateIn(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    nivel: Optional[str] = None
    duracion: Optional[str] = None
    activo: Optional[bool] = None


class UsuarioUpdateIn(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    correo: Optional[str] = None
    telefono: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None
    password: Optional[str] = None
