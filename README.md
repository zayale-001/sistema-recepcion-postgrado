# Sistema de Recepción y Seguimiento Documental - Unidad de Postgrado

Sistema integral para el control, recepción y seguimiento del cumplimiento de requisitos documentales por cada curso y programa ofertado por la Unidad de Postgrado (Doctorados, Maestrías, Especialidades, Diplomados y Cursos/Seminarios).

---

## 🎯 Objetivo Principal

Permitir a la dirección y a los distintos **coordinadores encargados** supervisar en tiempo real:
- Qué maestrante/postulante ya subió toda su documentación.
- Quiénes faltan por entregar documentos (y exactamente qué requisitos les faltan).
- Qué expedientes tienen observaciones (ej. escaneos ilegibles, falta de legalización) para su subsanación.
- Exportar matrices y reportes consolidados en formato **Excel (.xlsx)**.

---

## 📂 Estructura del Proyecto

```text
sistema-recepcion-postgrado/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── auth.py          # Autenticación JWT y perfiles
│   │   │       │   ├── catalogos.py     # Categorías (6 imágenes), áreas y requisitos
│   │   │       │   ├── coordinadores.py # Asignación de coordinadores a cursos
│   │   │       │   ├── seguimiento.py   # Seguimiento de avance y aprobación de documentos
│   │   │       │   ├── documentos.py    # Subida segura y streaming de archivos
│   │   │       │   └── reportes.py      # Generador de reportes Excel
│   │   │       └── router.py
│   │   ├── core/                        # Configuración, Base de Datos y Seguridad
│   │   ├── models/                      # Modelos SQLAlchemy (Usuarios, Cursos, Requisitos, Expedientes)
│   │   ├── schemas/                     # Esquemas de validación Pydantic
│   │   ├── services/                    # Lógica de cálculo de estados y porcentajes
│   │   └── main.py                      # Punto de entrada FastAPI
│   ├── uploads/                         # Archivos subidos organizados por curso y CI
│   ├── semilla_datos.py                 # Poblador con toda la oferta de las 6 imágenes
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/                  # Navbar, Sidebar con las categorías de Postgrado
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx            # Login con accesos rápidos de prueba
│   │   │   ├── DashboardCoordinador.tsx # Tarjetas de cursos y métricas de avance
│   │   │   ├── SeguimientoCurso.tsx     # Tabla de estudiantes, faltantes y filtros
│   │   │   ├── DetalleExpedienteModal.tsx # Visor de requisitos y aprobación/observación
│   │   │   └── EstudiantePortal.tsx     # Portal del postulante para subir sus PDFs
│   │   ├── services/                    # Clientes API con Axios y JWT
│   │   ├── types/                       # Interfaces TypeScript
│   │   ├── App.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
│
├── iniciar_local.bat                    # Script para levantar Backend y Frontend con 1 clic
├── instalar_dependencias.bat            # Script para instalar todo automáticamente
└── README.md
```

---

## 🚀 Puesta en Marcha Rápida (Windows)

### Opción 1: Con los Scripts .bat (Recomendado)
1. Haz doble clic en `iniciar_local.bat`.
2. Se abrirán dos terminales (Backend en puerto `8001` y Frontend en puerto `5174`) y se abrirá el navegador automáticamente en:
   👉 **http://127.0.0.1:5174**

*(Si es la primera vez o necesitas reinstalar dependencias, ejecuta primero `instalar_dependencias.bat`).*

---

## 🔑 Credenciales de Acceso Rápidas

El sistema cuenta con usuarios de prueba pre-cargados que cubren todos los roles:

Estas credenciales son solo para la base de datos de demostración local. No ejecutes el sembrado de datos de demostración en producción ni reutilices estas claves.

| Rol | Correo / CI | Contraseña | Descripción |
| :--- | :--- | :--- | :--- |
| **Director / SuperAdmin** | `admin@example.invalid` | `admin123` | Control total de todos los niveles, cursos y coordinadores. |
| **Coord. Doctorados** | `coord.doctorado@example.invalid` | `coord123` | Supervisa los programas de Doctorado. |
| **Coord. Maestrías** | `coord.maestria@example.invalid` | `coord123` | Supervisa las Maestrías en sus distintas áreas. |
| **Coord. Diplomados** | `coord.diplomados@example.invalid` | `coord123` | Supervisa los Diplomados ofertados. |
| **Postulante / Maestrante** | `postulante1@example.invalid` | `estudiante123` | Sube sus documentos y revisa observaciones. |

**

---

## 📑 Oferta Académica Incluida (Según las Capturas)

1. **Doctorados:**
   - Investigación Transdisciplinar (1ra Versión - 1ra Edición)
   - Doctorado en Gestión Pública y Ciencias Empresariales
   - Doctorado en Derecho Constitucional, DD.HH. y Cortes Internacionales
2. **Maestrías (con Áreas):**
   - Ciencias Sociales, Económicas, Jurídicas, Salud, Exactas/Tecnología, Agrícolas y UPI Santa Cruz.
3. **Especialidades:**
   - Especialidad en Nutriología.
4. **Diplomados:**
   - Fundamentos Empresariales, Marketing y Ventas, IA Aplicada, Ciberseguridad, Innovación, Derecho de Familia, Exportación/Importación, Agronegocios, Educación Parvularia, Educación Superior Disruptiva.
5. **Cursos y Seminarios:**
   - Seminarios, Cursos de Actualización, Planta de Petróleo/Gas, Estadística, Inglés Técnico.


## Respaldo local de la base de datos

La base SQLite se puede respaldar mientras el sistema esta en uso. Desde PowerShell:

```powershell
cd backend
python backup_database.py
```

Los respaldos se guardan en `backend/backups` y se conservan los 14 mas recientes. El backend crea una clave local de sesion en `backend/.secret_key`; no la borres mientras existan sesiones activas.

Para ejecutar las pruebas del flujo del postulante:

```powershell
cd backend
python -m unittest discover -s tests -v
```


## Seguridad de acceso y recuperacion

- Tras 3 intentos incorrectos se bloquea el identificador durante 3 minutos. Si vuelve a fallar en los siguientes grupos de 3 intentos, el bloqueo sube a 6, 12, 24 y 48 minutos. Un inicio de sesion correcto reinicia el contador.
- La recuperacion de contrasena necesita un servidor SMTP. Copia `backend/.env.example` como `backend/.env`, completa los datos SMTP y la URL del frontend, e instala las dependencias actualizadas con `pip install -r backend/requirements.txt`. No compartas el archivo `.env`.
- Las solicitudes de recuperacion aparecen en Ajustes para el SuperAdmin. Si SMTP esta configurado, tambien se envia una notificacion a `PASSWORD_RECOVERY_ADMIN_EMAIL` (por defecto `superadmin@example.invalid`).
- El enlace enviado por correo vence en 30 minutos y se usa una sola vez.
- En Ajustes, el SuperAdmin puede buscar cuentas de postulantes y generar una clave temporal. La clave actual nunca se muestra; el postulante debe reemplazar la temporal al iniciar sesion.
