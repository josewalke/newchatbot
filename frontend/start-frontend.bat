@echo off
echo Iniciando Frontend del ChatBot...
echo.
cd /d "%~dp0"
echo Directorio actual: %CD%
echo.
echo Instalando dependencias...
call npm install
echo.
echo Iniciando servidor de desarrollo...
call npm run dev
pause
