@echo off
chcp 65001 > nul
title Sistema de Recepción Documental - Unidad de Postgrado
echo =======================================================================
echo     UNIDAD DE POSTGRADO - CONTROL Y RECEPCIÓN DOCUMENTAL
echo =======================================================================
echo.

set PYTHON_CMD=python
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set PYTHON_CMD="%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set PYTHON_CMD="%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
)

netstat -ano | findstr ":8001" | findstr "LISTENING" > nul
if not errorlevel 1 (
    echo El puerto 8001 ya esta ocupado. Cierra la ventana anterior del backend antes de iniciar este proyecto.
    pause
    exit /b 1
)
netstat -ano | findstr ":5174" | findstr "LISTENING" > nul
if not errorlevel 1 (
    echo El puerto 5174 ya esta ocupado. Cierra la ventana anterior del frontend antes de iniciar este proyecto.
    pause
    exit /b 1
)

echo [1/2] Iniciando Backend FastAPI (http://127.0.0.1:8001)...
start "Postgrado Backend (FastAPI)" cmd /k "cd /d %~dp0backend && %PYTHON_CMD% -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"

echo [2/2] Iniciando Frontend React (http://127.0.0.1:5174)...
start "Postgrado Frontend (React Vite)" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

timeout /t 3 > nul
echo.
echo =======================================================================
echo   SISTEMA EN EJECUCIÓN:
echo    - Frontend: http://127.0.0.1:5174
echo    - Backend:  http://127.0.0.1:8001
echo    - Docs API: http://127.0.0.1:8001/docs
echo.
echo   CREDENCIALES DE PRUEBA:
echo    - Director/SuperAdmin:  admin@example.invalid   / admin123
echo    - Coord. Doctorados:    coord.doctorado@example.invalid / coord123
echo    - Coord. Maestrías:     coord.maestria@example.invalid  / coord123
echo    - Coord. Diplomados:    coord.diplomados@example.invalid / coord123
echo    - Postulante/Estudiante: postulante1@example.invalid / estudiante123
echo =======================================================================
echo.
start http://127.0.0.1:5174
pause
