@echo off
echo Iniciando Backend del ChatBot...
echo.
cd /d "%~dp0"
echo Directorio actual: %CD%
echo.
echo Instalando dependencias...
call npm install
echo.
echo Iniciando servidor en modo desarrollo...
call npm run dev
pause
