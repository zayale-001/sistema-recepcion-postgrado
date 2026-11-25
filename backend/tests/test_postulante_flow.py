from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.catalogos import actualizar_convocatoria
from app.api.v1.endpoints.documentos import eliminar_documento, subir_documento
from app.api.v1.endpoints.seguimiento import inscribirse_a_convocatoria, listar_convocatorias_abiertas
from app.api.deps import require_roles
from app.core.config import settings
from app.core.database import Base
from app.models.models import (
    Categoria, Convocatoria, Documento, Estado, HistorialDocumento, Inscripcion,
    Persona, Programa, Requisito, RolUsuario, Usuario
)
from app.schemas.schemas import ConvocatoriaUpdateIn


class FakeUploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content

    async def read(self, limit: int) -> bytes:
        return self.content[:limit]


def run_immediate(coroutine):
    """Ejecuta el endpoint async con un archivo de prueba que no necesita I/O."""
    try:
        coroutine.send(None)
    except StopIteration as result:
        return result.value
    raise AssertionError("El endpoint de prueba realizó I/O asíncrono inesperado")


class FlujoPostulanteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.temp_dir = tempfile.TemporaryDirectory()
        self.upload_dir_original = settings.UPLOAD_DIR
        self.max_upload_original = settings.MAX_UPLOAD_SIZE_BYTES
        settings.UPLOAD_DIR = Path(self.temp_dir.name) / "uploads"
        self.db = self.Session()

        categoria = Categoria(nombre="Maestrías", slug="maestrias", icono="school", orden=1)
        persona = Persona(nombres="Ada", apellidos="Lovelace", nro_documento="123456", correo="ada@test.local")
        programa = Programa(nombre="Maestría de prueba", nivel="Maestría", duracion="2 años", activo=True)
        self.db.add_all([categoria, persona])
        self.db.flush()
        programa.categoria_id = categoria.id
        self.db.add(programa)
        self.db.add(Estado(id_estado=1, nombre="Registrada", orden=1, estado_final=False))
        self.db.flush()
        self.convocatoria = Convocatoria(id_programa=programa.id_programa, gestion="2026", cupo=5, estado="Abierta")
        self.requisito = Requisito(id_programa=programa.id_programa, nombre="Título", orden=1)
        self.usuario = Usuario(id_persona=persona.id_persona, nombre_usuario="ada@test.local", password_hash="x", rol=RolUsuario.ESTUDIANTE.value, activo=True)
        self.db.add_all([self.convocatoria, self.requisito, self.usuario])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        settings.UPLOAD_DIR = self.upload_dir_original
        settings.MAX_UPLOAD_SIZE_BYTES = self.max_upload_original
        self.temp_dir.cleanup()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def registrar(self):
        return inscribirse_a_convocatoria(self.convocatoria.id_convocatoria, self.usuario, self.db)

    def test_lista_y_registra_una_convocatoria_y_evitar_duplicados(self):
        abiertas = listar_convocatorias_abiertas(1, None, self.usuario, self.db)
        self.assertEqual(len(abiertas), 1)
        inscripcion = self.registrar()
        self.assertEqual(self.db.query(Inscripcion).count(), 1)
        self.assertEqual(self.db.query(Documento).count(), 1)
        with self.assertRaises(HTTPException) as error:
            self.registrar()
        self.assertEqual(error.exception.status_code, 409)

    def test_subir_reemplazar_y_eliminar_documento_deja_historial(self):
        inscripcion_id = self.registrar()["inscripcion_id"]
        pdf = b"%PDF-1.7\ncontenido"
        primera = run_immediate(subir_documento(
            inscripcion_id, self.requisito.id_requisito,
            FakeUploadFile("titulo.pdf", pdf), self.usuario, self.db
        ))
        run_immediate(subir_documento(
            inscripcion_id, self.requisito.id_requisito,
            FakeUploadFile("titulo_nuevo.pdf", pdf), self.usuario, self.db
        ))
        resultado = eliminar_documento(primera.id_documento, self.usuario, self.db)
        documento = self.db.query(Documento).filter_by(id_documento=primera.id_documento).one()
        self.assertEqual(resultado["mensaje"], "Documento eliminado correctamente.")
        self.assertIsNone(documento.ruta_archivo)
        self.assertEqual([h.accion for h in documento.historial], ["Eliminado", "Reemplazado", "Subido"])

    def test_postulante_no_puede_eliminar_archivo_de_otra_persona(self):
        inscripcion_id = self.registrar()["inscripcion_id"]
        pdf = b"%PDF-1.7\ncontenido"
        documento = run_immediate(subir_documento(
            inscripcion_id, self.requisito.id_requisito,
            FakeUploadFile("titulo.pdf", pdf), self.usuario, self.db
        ))
        otra_persona = Persona(nombres="Grace", apellidos="Hopper", nro_documento="654321", correo="grace@test.local")
        self.db.add(otra_persona)
        self.db.flush()
        otro_postulante = Usuario(id_persona=otra_persona.id_persona, nombre_usuario="grace@test.local", password_hash="x", rol=RolUsuario.ESTUDIANTE.value, activo=True)
        self.db.add(otro_postulante)
        self.db.commit()
        with self.assertRaises(HTTPException) as error:
            eliminar_documento(documento.id_documento, otro_postulante, self.db)
        self.assertEqual(error.exception.status_code, 403)

    def test_rechaza_archivo_mayor_a_10mb(self):
        inscripcion_id = self.registrar()["inscripcion_id"]
        settings.MAX_UPLOAD_SIZE_BYTES = 16
        contenido = b"%PDF-1.7\n" + b"x" * 16
        with self.assertRaises(HTTPException) as error:
            run_immediate(subir_documento(
                inscripcion_id, self.requisito.id_requisito,
                FakeUploadFile("grande.pdf", contenido), self.usuario, self.db
            ))
        self.assertEqual(error.exception.status_code, 413)

    def test_rechaza_extension_que_no_coincide_con_el_contenido(self):
        inscripcion_id = self.registrar()["inscripcion_id"]
        with self.assertRaises(HTTPException) as error:
            run_immediate(subir_documento(
                inscripcion_id, self.requisito.id_requisito,
                FakeUploadFile("falso.pdf", b"no es PDF"), self.usuario, self.db
            ))
        self.assertEqual(error.exception.status_code, 400)

    def test_admin_actualiza_estado_cupo_y_cierre(self):
        admin = Usuario(id_usuario="admin", nombre_usuario="admin", password_hash="x", rol=RolUsuario.SUPERADMIN.value, activo=True)
        validar_admin = require_roles([RolUsuario.SUPERADMIN.value])
        with self.assertRaises(HTTPException) as error:
            validar_admin(self.usuario)
        self.assertEqual(error.exception.status_code, 403)
        self.assertIs(validar_admin(admin), admin)
        actualizado = actualizar_convocatoria(
            self.convocatoria.id_convocatoria,
            ConvocatoriaUpdateIn(estado="Cerrada", cupo=8), self.db, admin
        )
        self.assertEqual(actualizado.estado, "Cerrada")
        self.assertEqual(actualizado.cupo, 8)


if __name__ == "__main__":
    unittest.main()
