import asyncio
import io
import unittest
from fastapi import HTTPException, UploadFile
from PIL import Image
import fitz

from app.api.v1.endpoints.documentos import comprimir_pdf, unir_imagenes_pdf
from app.models.models import Usuario, RolUsuario


def _fake_user() -> Usuario:
    return Usuario(
        id_usuario="user-test-1",
        nombre_usuario="tester",
        rol=RolUsuario.SUPERADMIN.value,
        activo=True,
    )


def _sample_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    page.insert_text((40, 60), "Documento de prueba UPI - FINI")
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def _sample_png_bytes(color=(200, 40, 40)) -> bytes:
    img = Image.new("RGB", (120, 120), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestMejorasEndpoints(unittest.TestCase):
    def test_comprimir_pdf_valido(self):
        upload = UploadFile(filename="prueba.pdf", file=io.BytesIO(_sample_pdf_bytes()))
        res = asyncio.run(comprimir_pdf(archivo=upload, nivel="media", current_user=_fake_user()))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.media_type, "application/pdf")
        self.assertTrue(res.body.startswith(b"%PDF-"))

    def test_comprimir_pdf_rechaza_no_pdf(self):
        upload = UploadFile(filename="nota.txt", file=io.BytesIO(b"hola"))
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(comprimir_pdf(archivo=upload, nivel="media", current_user=_fake_user()))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_unir_imagenes_pdf(self):
        uploads = [
            UploadFile(filename="pag1.png", file=io.BytesIO(_sample_png_bytes((200, 30, 30)))),
            UploadFile(filename="pag2.png", file=io.BytesIO(_sample_png_bytes((30, 120, 200)))),
        ]
        res = asyncio.run(unir_imagenes_pdf(archivos=uploads, current_user=_fake_user()))
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.body.startswith(b"%PDF-"))
        doc = fitz.open(stream=res.body, filetype="pdf")
        self.assertEqual(len(doc), 2)
        doc.close()


if __name__ == "__main__":
    unittest.main()
