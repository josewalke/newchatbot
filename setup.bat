@echo off
chcp 65001 >nul
echo 🚀 Configurando ChatBot Self-Hosted...

REM Verificar si Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js no está instalado. Por favor, instala Node.js 18+ LTS primero.
    echo 📥 Descarga desde: https://nodejs.org/
    pause
    exit /b 1
)

REM Verificar versión de Node.js
for /f "tokens=1,2 delims=." %%a in ('node --version') do set NODE_VERSION=%%a
set NODE_VERSION=%NODE_VERSION:~1%
if %NODE_VERSION% LSS 18 (
    echo ❌ Node.js versión %NODE_VERSION% detectada. Se requiere Node.js 18+ LTS.
    pause
    exit /b 1
)

echo ✅ Node.js detectado

REM Verificar si Ollama está instalado
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Ollama no está instalado o no está en el PATH.
    echo 📥 Instala Ollama desde: https://ollama.ai/
    echo 🔧 Después de instalar, ejecuta: ollama pull llama3.2:3b
    echo 🔧 Y también: ollama pull nomic-embed-text
    echo.
    set /p CONTINUE="¿Continuar con la instalación del proyecto? (y/N): "
    if /i not "%CONTINUE%"=="y" (
        pause
        exit /b 1
    )
) else (
    echo ✅ Ollama detectado
)

REM Crear archivo .env si no existe
if not exist "backend\.env" (
    echo 📝 Creando archivo .env en backend...
    copy "backend\env.example" "backend\.env" >nul
    echo ✅ Archivo .env creado. Edítalo según tus necesidades.
)

REM Instalar dependencias del backend
echo 📦 Instalando dependencias del backend...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Error al instalar dependencias del backend
    pause
    exit /b 1
)
echo ✅ Dependencias del backend instaladas
cd ..

REM Instalar dependencias del frontend
echo 📦 Instalando dependencias del frontend...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Error al instalar dependencias del frontend
    pause
    exit /b 1
)
echo ✅ Dependencias del frontend instaladas
cd ..

echo.
echo 🎉 ¡Instalación completada!
echo.
echo 📋 Para ejecutar el proyecto:
echo.
echo 1️⃣  Inicia el backend:
echo    cd backend
echo    npm run dev
echo.
echo 2️⃣  En otra terminal, inicia el frontend:
echo    cd frontend
echo    npm run dev
echo.
echo 🌐 El frontend estará disponible en: http://localhost:5173
echo 🔧 El backend estará disponible en: http://localhost:3000
echo.
echo 📚 Para más información, consulta el README.md
echo.
echo 🤖 ¡Disfruta de tu ChatBot Self-Hosted!
pause
