#!/usr/bin/env python3
"""
UNIDAD DE POSGRADO (UPI) - FINI
Sistema de Gestión de Inscripciones para Programas de Posgrado
Controlador integral para iniciar, detener y administrar el sistema.
"""
from __future__ import annotations
import os
import sys
import time
import socket
import shutil
import subprocess
import webbrowser

os.system('')

nodejs_path = r"C:\Program Files\nodejs"
if os.path.isdir(nodejs_path) and nodejs_path not in os.environ.get("PATH", ""):
    os.environ["PATH"] = f"{nodejs_path};" + os.environ.get("PATH", "")

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

BACKEND_PORT = 8001
FRONTEND_PORT = 5174

BANNER = f"""{Colors.OKBLUE}
╔═════════════════════════════════════════════════════════════════════════╗
║                                                                         ║
║                    UNIDAD DE POSGRADO (UPI) - FINI                      ║
║          Sistema de Gestión de Inscripciones para Posgrado             ║
║                                                                         ║
╚═════════════════════════════════════════════════════════════════════════╝{Colors.ENDC}"""

def get_base_dir() -> str:
    return os.path.dirname(os.path.abspath(__file__))

def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def port_is_in_use(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.25):
            return True
    except OSError:
        return False

def find_python() -> str:
    local_appdata = os.environ.get("LOCALAPPDATA", "")
    rutas_candidatas = [
        os.path.join(local_appdata, "Programs", "Python", "Python312", "python.exe"),
        os.path.join(local_appdata, "Programs", "Python", "Python311", "python.exe"),
        os.path.join(local_appdata, "Programs", "Python", "Python310", "python.exe"),
        r"C:\Program Files\Python312\python.exe",
        r"C:\Program Files\Python311\python.exe",
    ]
    for r in rutas_candidatas:
        if os.path.isfile(r):
            return r

    py_which = shutil.which("python")
    if py_which and "WindowsApps" not in py_which:
        return py_which

    py_launcher = shutil.which("py")
    if py_launcher:
        return py_launcher

    return sys.executable

def find_npm() -> str | None:
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        candidato = os.path.join(nodejs_path, "npm.cmd")
        if os.path.isfile(candidato):
            return candidato
    return npm

backend_proc: subprocess.Popen | None = None
frontend_proc: subprocess.Popen | None = None

def start_system():
    global backend_proc, frontend_proc
    base_dir = get_base_dir()
    py_exe = find_python()
    npm_exe = find_npm()

    print(f"\n{Colors.BOLD}🔍 Verificando entorno para UPI - FINI...{Colors.ENDC}")

    if not npm_exe:
        print(f"{Colors.FAIL}❌ No se encontró 'npm' (Node.js) en el sistema.{Colors.ENDC}")
        input("\nPresione Enter para volver...")
        return

    backend_dir = os.path.join(base_dir, "backend")
    frontend_dir = os.path.join(base_dir, "frontend")

    puertos_ocupados = [port for port in (BACKEND_PORT, FRONTEND_PORT) if port_is_in_use(port)]
    if puertos_ocupados:
        print(f"{Colors.FAIL}No se puede iniciar: los puertos {', '.join(map(str, puertos_ocupados))} ya estan ocupados.{Colors.ENDC}")
        print("Cierra la instancia anterior del sistema y vuelve a elegir Iniciar Sistema.")
        input("\nPresione Enter para volver al menu...")
        return

    db_file = os.path.join(backend_dir, "postgrado_docs.db")
    if not os.path.isfile(db_file):
        print(f"{Colors.WARNING}⚠️ Base de datos no encontrada. Inicializando esquema oficial de la UPI...{Colors.ENDC}")
        init_database()

    print(f"{Colors.OKGREEN}🚀 Iniciando Backend FastAPI en puerto {BACKEND_PORT}...{Colors.ENDC}")
    backend_cmd = f'"{py_exe}" -m uvicorn app.main:app --host 127.0.0.1 --port {BACKEND_PORT} --reload'
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=backend_dir,
        shell=True
    )

    print(f"{Colors.OKCYAN}🎨 Iniciando Frontend React (Vite en puerto {FRONTEND_PORT})...{Colors.ENDC}")
    frontend_cmd = f'"{npm_exe}" run dev'
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_dir,
        shell=True
    )

    for _ in range(20):
        if port_is_in_use(BACKEND_PORT) and port_is_in_use(FRONTEND_PORT):
            break
        time.sleep(0.5)
    print_access_info()

    if port_is_in_use(FRONTEND_PORT):
        webbrowser.open(f"http://127.0.0.1:{FRONTEND_PORT}")
    else:
        print(f"{Colors.FAIL}El frontend no inicio. Revisa el mensaje de Vite y vuelve a intentarlo.{Colors.ENDC}")

def stop_system():
    global backend_proc, frontend_proc
    print(f"\n{Colors.WARNING}🛑 Deteniendo servicios en ejecución...{Colors.ENDC}")
    if backend_proc:
        try:
            subprocess.run(f"taskkill /F /T /PID {backend_proc.pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
        backend_proc = None

    if frontend_proc:
        try:
            subprocess.run(f"taskkill /F /T /PID {frontend_proc.pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
        frontend_proc = None

    print(f"{Colors.OKGREEN}✓ Todos los servicios fueron detenidos.{Colors.ENDC}")

def print_access_info():
    print("\n" + "="*65)
    print(f"{Colors.OKGREEN}  SISTEMA ACTIVO (UPI - FINI){Colors.ENDC}")
    print("="*65)
    print(f"  🌐 Frontend Web:  {Colors.BOLD}http://127.0.0.1:{FRONTEND_PORT}{Colors.ENDC}")
    print(f"  ⚙️ Backend API:   http://127.0.0.1:{BACKEND_PORT}")
    print(f"  📚 Swagger Docs:  http://127.0.0.1:{BACKEND_PORT}/docs")
    print("-" * 65)
    print("  👥 Credenciales de Acceso:")
    print("     • Administrador:          admin@example.invalid   / admin123")
    print("     • Coord. Doctorados:      coord.doctorado@example.invalid / coord123")
    print("     • Coord. Maestrías:       coord.maestria@example.invalid  / coord123")
    print("     • Coord. Diplomados:      coord.diplomados@example.invalid / coord123")
    print("     • Postulante:             postulante1@example.invalid   / estudiante123")
    print("="*65)
    print("  Presione CTRL+C en cualquier momento para volver al menú principal.")
    print("="*65 + "\n")

def init_database():
    base_dir = get_base_dir()
    py_exe = find_python()
    backend_dir = os.path.join(base_dir, "backend")
    print(f"\n{Colors.BOLD}🗄️ Sembrando catálogo oficial de estados, programas y personas...{Colors.ENDC}")
    subprocess.run(f'"{py_exe}" semilla_datos.py', cwd=backend_dir, shell=True)
    print(f"{Colors.OKGREEN}✓ Base de datos sincronizada con éxito.{Colors.ENDC}")

def install_all_dependencies():
    base_dir = get_base_dir()
    py_exe = find_python()
    npm_exe = find_npm()

    print(f"\n{Colors.BOLD}📦 INSTALADOR DE DEPENDENCIAS{Colors.ENDC}")
    print("-" * 55)

    backend_dir = os.path.join(base_dir, "backend")
    print("1. Instalando dependencias de Python (Backend)...")
    subprocess.run(f'"{py_exe}" -m pip install -r requirements.txt', cwd=backend_dir, shell=True)

    frontend_dir = os.path.join(base_dir, "frontend")
    print("\n2. Instalando módulos de Node.js (Frontend)...")
    if npm_exe:
        subprocess.run(f'"{npm_exe}" install', cwd=frontend_dir, shell=True)
    else:
        print(f"{Colors.FAIL}❌ No se encontró npm.cmd en el sistema.{Colors.ENDC}")

    print(f"\n{Colors.OKGREEN}✅ Todas las dependencias quedaron instaladas.{Colors.ENDC}")

def main():
    while True:
        os.system('cls' if os.name == 'nt' else 'clear')
        print(BANNER)
        print(" Seleccione una opción:")
        print(f"  {Colors.OKGREEN}1. ▶ Iniciar Sistema (Backend + Frontend){Colors.ENDC}")
        print("  2. 🛑 Detener Servicios")
        print("  3. 🗄️ Re-sembrar Base de Datos (Restablecer esquema oficial)")
        print("  4. 📦 Instalar / Actualizar Dependencias")
        print("  5. 🌐 Abrir Frontend en el Navegador")
        print("  0. 🚪 Salir")
        print("-" * 65)

        opcion = input(" 👉 Ingrese opción: ").strip()

        if opcion == '1':
            start_system()
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print(f"\n{Colors.WARNING}Regresando al menú...{Colors.ENDC}")
                stop_system()
                time.sleep(1)
        elif opcion == '2':
            stop_system()
            input("\nPresione Enter para continuar...")
        elif opcion == '3':
            init_database()
            input("\nPresione Enter para continuar...")
        elif opcion == '4':
            install_all_dependencies()
            input("\nPresione Enter para continuar...")
        elif opcion == '5':
            if port_is_in_use(FRONTEND_PORT):
                webbrowser.open(f"http://127.0.0.1:{FRONTEND_PORT}")
            else:
                print("El frontend aun no esta iniciado. Selecciona primero Iniciar Sistema.")
                input("\nPresione Enter para volver al menu...")
        elif opcion == '0':
            stop_system()
            print(f"\n{Colors.OKBLUE}¡Hasta pronto!{Colors.ENDC}")
            break
        else:
            print(f"{Colors.FAIL}Opción no válida.{Colors.ENDC}")
            time.sleep(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        stop_system()
        sys.exit(0)
