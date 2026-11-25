from __future__ import annotations
import uuid
from datetime import datetime
import enum
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Enum, Date
from sqlalchemy.orm import relationship
from app.core.database import Base

# ==============================================================================
# MODELO DE DATOS - PROPUESTA DE SOLUCIÓN TECNOLÓGICA (UPI - FINI)
# Entidades normalizadas según Sección 7, 8 y 9 del informe:
# PERSONAS, USUARIOS, PROGRAMAS, CONVOCATORIAS, INSCRIPCIONES, REQUISITOS,
# DOCUMENTOS, ESTADOS, HISTORIAL_ESTADOS
# ==============================================================================

class RolUsuario(str, enum.Enum):
    SUPERADMIN = "ADMINISTRADOR"
    COORDINADOR = "COORDINADOR"
    KARDEX = "REVISOR"
    ESTUDIANTE = "POSTULANTE"

class Persona(Base):
    """
    PERSONAS: Contiene la información de identificación y contacto de postulantes
    y, cuando corresponda, del personal con cuenta de usuario (Diccionario Pág. 7).
    """
    __tablename__ = "personas"

    id_persona = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombres = Column(String(100), nullable=False)
    apellidos = Column(String(100), nullable=False)
    tipo_documento = Column(String(20), default="CI")
    nro_documento = Column(String(30), unique=True, index=True, nullable=False)
    correo = Column(String(150), unique=True, index=True, nullable=False)
    telefono = Column(String(30), nullable=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    usuario = relationship("Usuario", back_populates="persona", uselist=False, cascade="all, delete-orphan")
    inscripciones = relationship("Inscripcion", back_populates="persona", cascade="all, delete-orphan")

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombres} {self.apellidos}"

class Usuario(Base):
    """
    USUARIOS: Cuentas de acceso del personal autorizado y postulantes.
    Relación 1 a 0..1 con PERSONAS para no duplicar datos (Diccionario Pág. 7).
    """
    __tablename__ = "usuarios"

    id_usuario = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_persona = Column(String(36), ForeignKey("personas.id_persona"), unique=True, nullable=True)
    nombre_usuario = Column(String(60), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(30), default=RolUsuario.ESTUDIANTE.value, nullable=False)
    activo = Column(Boolean, default=True)
    debe_cambiar_contrasena = Column(Boolean, nullable=False, default=False)
    ultimo_acceso = Column(DateTime, nullable=True)

    # Relaciones
    persona = relationship("Persona", back_populates="usuario")
    coordinaciones = relationship("CoordinadorConvocatoria", back_populates="usuario", cascade="all, delete-orphan")
    historiales = relationship("HistorialEstado", back_populates="usuario")

class IntentoAcceso(Base):
    """Contador persistente de intentos fallidos y bloqueos temporales por identificador/IP."""
    __tablename__ = "intentos_acceso"

    clave = Column(String(64), primary_key=True)
    intentos = Column(Integer, nullable=False, default=0)
    nivel_bloqueo = Column(Integer, nullable=False, default=0)
    bloqueado_hasta = Column(DateTime, nullable=True)

class TokenRecuperacion(Base):
    """Tokens de un solo uso para restablecer contraseñas."""
    __tablename__ = "tokens_recuperacion"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_usuario = Column(String(36), ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expira_en = Column(DateTime, nullable=False)
    usado = Column(Boolean, nullable=False, default=False)
    creado_en = Column(DateTime, default=datetime.utcnow, nullable=False)

class SolicitudRecuperacion(Base):
    """Cola administrativa para solicitudes de recuperación aún no atendidas."""
    __tablename__ = "solicitudes_recuperacion"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_usuario = Column(String(36), ForeignKey("usuarios.id_usuario", ondelete="CASCADE"), nullable=False, index=True)
    solicitada_en = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    resuelta = Column(Boolean, nullable=False, default=False, index=True)
    resuelta_en = Column(DateTime, nullable=True)
    usuario = relationship("Usuario")

class Categoria(Base):
    """Catálogo de soporte para los niveles mostrados en las capturas"""
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)
    descripcion = Column(Text, nullable=True)
    icono = Column(String(50), default="school")
    orden = Column(Integer, default=0)

    areas = relationship("Area", back_populates="categoria", cascade="all, delete-orphan")
    programas = relationship("Programa", back_populates="categoria")

class Area(Base):
    """Áreas de conocimiento (ej: Maestrías)"""
    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    nombre = Column(String(150), nullable=False)
    slug = Column(String(150), nullable=False)
    orden = Column(Integer, default=0)

    categoria = relationship("Categoria", back_populates="areas")
    programas = relationship("Programa", back_populates="area")

class Programa(Base):
    """
    PROGRAMAS: Catálogo de programas de posgrado que ofrece la unidad (Diccionario Pág. 7).
    """
    __tablename__ = "programas"

    id_programa = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)
    codigo = Column(String(50), unique=True, nullable=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text, nullable=True)
    nivel = Column(String(50), default="Maestría")  # Doctorado, Maestría, Especialidad, Diplomado, Curso
    duracion = Column(String(50), default="2 años")
    activo = Column(Boolean, default=True)

    # Relaciones
    categoria = relationship("Categoria", back_populates="programas")
    area = relationship("Area", back_populates="programas")
    convocatorias = relationship("Convocatoria", back_populates="programa", cascade="all, delete-orphan")
    requisitos = relationship("Requisito", back_populates="programa", cascade="all, delete-orphan", order_by="Requisito.orden")

class Convocatoria(Base):
    """
    CONVOCATORIAS: Apertura o periodo de inscripción de un programa en una gestión determinada (Diccionario Pág. 8).
    """
    __tablename__ = "convocatorias"

    id_convocatoria = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_programa = Column(String(36), ForeignKey("programas.id_programa"), nullable=False)
    gestion = Column(String(20), nullable=False, default="2024")
    version = Column(String(50), default="1ra. Versión")
    edicion = Column(String(50), default="1ra. Edición")
    fecha_inicio = Column(DateTime, default=datetime.utcnow)
    fecha_fin = Column(DateTime, nullable=True)
    cupo = Column(Integer, default=40)
    estado = Column(String(20), default="Abierta")  # Borrador, Abierta, Cerrada

    # Relaciones
    programa = relationship("Programa", back_populates="convocatorias")
    inscripciones = relationship("Inscripcion", back_populates="convocatoria", cascade="all, delete-orphan")
    coordinadores = relationship("CoordinadorConvocatoria", back_populates="convocatoria", cascade="all, delete-orphan")

    @property
    def titulo_completo(self) -> str:
        return f"{self.programa.nombre} ({self.version} - {self.edicion} - {self.gestion})"

class CoordinadorConvocatoria(Base):
    """Asignación de coordinadores a convocatorias"""
    __tablename__ = "coordinadores_convocatoria"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_usuario = Column(String(36), ForeignKey("usuarios.id_usuario"), nullable=False)
    id_convocatoria = Column(String(36), ForeignKey("convocatorias.id_convocatoria"), nullable=False)
    fecha_asignacion = Column(DateTime, default=datetime.utcnow)

    usuario = relationship("Usuario", back_populates="coordinaciones")
    convocatoria = relationship("Convocatoria", back_populates="coordinadores")

class Estado(Base):
    """
    ESTADOS: Catálogo controlado de estados posibles de una inscripción (Diccionario Pág. 9).
    """
    __tablename__ = "estados"

    id_estado = Column(Integer, primary_key=True)
    nombre = Column(String(40), unique=True, nullable=False)
    descripcion = Column(String(200), nullable=True)
    orden = Column(Integer, default=0)
    estado_final = Column(Boolean, default=False)

    inscripciones = relationship("Inscripcion", back_populates="estado_actual")
    historiales = relationship("HistorialEstado", back_populates="estado")

class Inscripcion(Base):
    """
    INSCRIPCIONES: Solicitud concreta de una persona para una convocatoria (Diccionario Pág. 8).
    Contiene el código único (RF-05).
    """
    __tablename__ = "inscripciones"

    id_inscripcion = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_persona = Column(String(36), ForeignKey("personas.id_persona"), nullable=False)
    id_convocatoria = Column(String(36), ForeignKey("convocatorias.id_convocatoria"), nullable=False)
    codigo_inscripcion = Column(String(40), unique=True, index=True, nullable=False)
    fecha_solicitud = Column(DateTime, default=datetime.utcnow)
    estado_actual_id = Column(Integer, ForeignKey("estados.id_estado"), nullable=False, default=1)
    observacion = Column(Text, nullable=True)

    # Relaciones
    persona = relationship("Persona", back_populates="inscripciones")
    convocatoria = relationship("Convocatoria", back_populates="inscripciones")
    estado_actual = relationship("Estado", back_populates="inscripciones")
    documentos = relationship("Documento", back_populates="inscripcion", cascade="all, delete-orphan")
    historial = relationship("HistorialEstado", back_populates="inscripcion", cascade="all, delete-orphan", order_by="HistorialEstado.fecha_cambio.desc()")

class Requisito(Base):
    """
    REQUISITOS: Documentos o condiciones exigidas para un programa (Diccionario Pág. 8).
    """
    __tablename__ = "requisitos"

    id_requisito = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_programa = Column(String(36), ForeignKey("programas.id_programa"), nullable=False)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text, nullable=True)
    obligatorio = Column(Boolean, default=True)
    formato_permitido = Column(String(100), default="pdf, jpg, png")
    orden = Column(Integer, default=1)

    # Relaciones
    programa = relationship("Programa", back_populates="requisitos")
    documentos = relationship("Documento", back_populates="requisito", cascade="all, delete-orphan")

class Documento(Base):
    """
    DOCUMENTOS: Registra cada documento entregado por una persona dentro de una inscripción (Diccionario Pág. 8).
    """
    __tablename__ = "documentos"

    id_documento = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_inscripcion = Column(String(36), ForeignKey("inscripciones.id_inscripcion"), nullable=False)
    id_requisito = Column(String(36), ForeignKey("requisitos.id_requisito"), nullable=False)
    nombre_archivo = Column(String(255), nullable=True)
    ruta_archivo = Column(String(500), nullable=True)
    fecha_carga = Column(DateTime, nullable=True)
    estado_revision = Column(String(30), default="Pendiente")  # Pendiente, Válido, Observado, Rechazado
    observaciones = Column(Text, nullable=True)

    # Extensión operativa
    cotejado_fisico = Column(Boolean, default=False)
    fecha_cotejo_fisico = Column(DateTime, nullable=True)
    cotejado_por_id = Column(String(36), ForeignKey("usuarios.id_usuario"), nullable=True)

    # Relaciones
    inscripcion = relationship("Inscripcion", back_populates="documentos")
    requisito = relationship("Requisito", back_populates="documentos")
    cotejador = relationship("Usuario", foreign_keys=[cotejado_por_id])
    historial = relationship("HistorialDocumento", back_populates="documento", cascade="all, delete-orphan", order_by="HistorialDocumento.fecha_cambio.desc()")

class HistorialDocumento(Base):
    """Versiones y acciones realizadas sobre los archivos entregados."""
    __tablename__ = "historial_documentos"

    id_historial = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_documento = Column(String(36), ForeignKey("documentos.id_documento"), nullable=False, index=True)
    id_usuario = Column(String(36), ForeignKey("usuarios.id_usuario"), nullable=True)
    accion = Column(String(30), nullable=False)
    nombre_archivo = Column(String(255), nullable=True)
    fecha_cambio = Column(DateTime, default=datetime.utcnow, nullable=False)

    documento = relationship("Documento", back_populates="historial")
    usuario = relationship("Usuario")

class HistorialEstado(Base):
    """
    HISTORIAL_ESTADOS: Trazabilidad de cambios de estado, responsable, fecha y motivo (Diccionario Pág. 9).
    """
    __tablename__ = "historial_estados"

    id_historial = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_inscripcion = Column(String(36), ForeignKey("inscripciones.id_inscripcion"), nullable=False)
    id_estado = Column(Integer, ForeignKey("estados.id_estado"), nullable=False)
    id_usuario = Column(String(36), ForeignKey("usuarios.id_usuario"), nullable=True)
    fecha_cambio = Column(DateTime, default=datetime.utcnow)
    comentario = Column(Text, nullable=True)

    # Relaciones
    inscripcion = relationship("Inscripcion", back_populates="historial")
    estado = relationship("Estado", back_populates="historiales")
    usuario = relationship("Usuario", back_populates="historiales")
