# Despliegue de UPI FINI

La configuracion recomendada publica el frontend en Vercel y mantiene el API FastAPI en un servicio con almacenamiento persistente. El sistema recibe expedientes de hasta 10 MB; las Vercel Functions limitan el cuerpo de una solicitud a 4.5 MB y su filesystem no conserva escrituras. Por eso el API de carga documental no se debe desplegar con la carpeta SQLite/uploads local.

## 1. Publicar el API

Usa un proveedor que admita FastAPI, PostgreSQL y un disco persistente para los documentos. Configura el directorio de trabajo como `backend` y el comando de inicio como:

```sh
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Crea una base PostgreSQL y asigna en el entorno del API las variables del archivo `backend/.env.example`:

- `DATABASE_URL`: URL de PostgreSQL del proveedor.
- `SECRET_KEY`: valor aleatorio largo y privado.
- `UPLOAD_DIR`: ruta del disco persistente asignado por el proveedor.
- `BACKEND_CORS_ORIGINS`: lista JSON con el dominio publicado de Vercel, por ejemplo `["https://upi-fini.vercel.app"]`.
- `FRONTEND_URL`: dominio publicado de Vercel.
- Variables `SMTP_*` para correo de recuperación. `PASSWORD_RECOVERY_ADMIN_EMAIL` ya tiene el correo del SuperAdmin.

Las cuentas y documentos existentes en `postgrado_docs.db` no se copian automáticamente a PostgreSQL; deben migrarse aparte antes de abrir el sistema a usuarios.

## 2. Publicar el frontend en Vercel

1. Sube este repositorio a un repositorio privado de GitHub. El `.gitignore` raíz excluye `.env`, secretos, bases de datos, archivos subidos, dependencias y compilaciones locales.
2. En Vercel selecciona **Add New → Project** e importa el repositorio.
3. Configura **Root Directory** como `frontend` y el framework como **Vite**.
4. Usa `npm install` para instalar, `npm run build` como Build Command y `dist` como Output Directory.
5. Agrega la variable de entorno `VITE_API_BASE_URL` con la URL pública del API más `/api/v1`, por ejemplo `https://upi-api.example.com/api/v1`.
6. Despliega. Cada cambio enviado a GitHub actualizará el sitio.

`frontend/vercel.json` configura el fallback SPA para que las rutas del cliente carguen desde `index.html`.

## 3. Comprobaciones después del despliegue

- Abrir `https://<dominio-api>/docs` y comprobar que la API responde.
- Iniciar sesión desde el dominio Vercel.
- Probar una carga, visualización y eliminación de documento; comprobar que el archivo persista tras reiniciar el API.
- Probar reportes y solicitudes de recuperación.
- Confirmar que Vercel y el proveedor del API no contienen secretos en el repositorio ni en archivos estáticos.

## Vercel para el API

Vercel admite FastAPI, pero esta aplicación guarda los documentos en `UPLOAD_DIR` y permite archivos mayores que el límite de cuerpo de Vercel Functions. Para ejecutar también el API en Vercel primero se debe adaptar el almacenamiento a un object storage y hacer que el navegador cargue archivos grandes directamente allí; configurar solamente FastAPI no basta para una instalación funcional.
