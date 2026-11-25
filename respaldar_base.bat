@echo off
chcp 65001 > nul
title Respaldo de la base de datos de Postgrado
cd /d "%~dp0backend"
python backup_database.py
pause
