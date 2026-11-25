@echo off
chcp 65001 > nul
title Instalador de Dependencias - Sistema de Postgrado
echo =======================================================================
echo    INSTALANDO DEPENDENCIAS (BACKEND + FRONTEND + SEMILLA DE DATOS)
echo =======================================================================
echo.

set PYTHON_CMD=python
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set PYTHON_CMD="%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set PYTHON_CMD="%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
)

echo [1/3] Instalando dependencias de Python (Backend)...
cd /d %~dp0backend
%PYTHON_CMD% -m pip install -r requirements.txt

echo.
echo [2/3] Generando base de datos inicial y cargando oferta academica (Semilla)...
%PYTHON_CMD% semilla_datos.py

echo.
echo [3/3] Instalando modulos de Node.js (Frontend)...
cd /d %~dp0frontend
call npm.cmd install

echo.
echo =======================================================================
echo  INSTALACIÓN COMPLETADA EXITOSAMENTE!
echo  Ahora puedes ejecutar 'iniciar_local.bat' para abrir el sistema.
echo =======================================================================
pause
