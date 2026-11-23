@echo off
chcp 65001 >nul
echo =====================================================================
echo    AEROSCAN — EXTENSIÓN DE MODO MONITOR PROMISCUO (WSL2 + SCAPY)
echo    Facultad de Ingeniería Estadística e Informática — UNA PUNO
echo =====================================================================
echo.
echo [*] Este instalador automatizado configurará el entorno necesario para
echo     capturar tramas 802.11 en Modo Monitor Promiscuo (Data, RTS/CTS, ACK)
echo     utilizando el subsistema Linux WSL2 y USB/IP en Windows.
echo.

:: 1. Comprobar permisos de Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Solicitando elevacion de privilegios de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [1/4] Verificando Subsistema de Windows para Linux (WSL2)...
wsl.exe --status >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Instalando WSL2 y distribucion Ubuntu oficial...
    wsl.exe --install -d Ubuntu --no-launch
    if %errorLevel% neq 0 (
        echo [!] Nota: Si es la primera vez que se activa WSL2, puede requerir reiniciar Windows.
    )
) else (
    echo [OK] WSL2 ya se encuentra instalado en este equipo.
)

echo.
echo [2/4] Verificando USBIPD-WIN (Passthrough USB de Antenas Wi-Fi)...
where.exe usbipd >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Instalando usbipd-win mediante Windows Package Manager (winget)...
    winget install --exact dorssel.usbipd-win --accept-source-agreements --accept-package-agreements
    if %errorLevel% neq 0 (
        echo [!] Intentando instalacion alternativa de usbipd...
        start https://github.com/dorssel/usbipd-win/releases/latest
    ) else (
        echo [OK] usbipd-win instalado satisfactoriamente.
    )
) else (
    echo [OK] usbipd-win ya se encuentra disponible en el sistema.
)

echo.
echo [3/4] Configurando paquetes de auditoria Scapy en Ubuntu WSL2...
wsl.exe -d Ubuntu -u root bash -c "apt update && apt install -y python3-scapy aircrack-ng wireless-tools tshark net-tools" 2>nul
if %errorLevel% equ 0 (
    echo [OK] Paquetes de captura de radiofrecuencia Scapy instalados en WSL2.
) else (
    echo [*] Si Ubuntu es nuevo, completa la configuracion de usuario inicial de WSL abriendo 'Ubuntu' en el menu inicio.
)

echo.
echo [4/4] Listando adaptadores USB detectados para Modo Monitor:
usbipd list 2>nul

echo.
echo =====================================================================
echo [*] ¡CONFIGURACIÓN COMPLETADA!
echo     Para vincular tu antena USB a WSL2 ejecuta:
echo     usbipd attach --wsl -b <BUSID_DE_TU_ANTENA>
echo.
echo     AeroScan detectará automáticamente el entorno Scapy activo.
echo =====================================================================
pause
