@echo off
echo ========================================
echo   Setup Mejorado para NewChatBot
echo ========================================
echo.

echo [1/5] Verificando Ollama...
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Ollama no está instalado o no está en el PATH
    echo Por favor instala Ollama desde: https://ollama.ai
    pause
    exit /b 1
)
echo ✓ Ollama está instalado

echo.
echo [2/5] Descargando modelo principal qwen2.5:14b-instruct...
echo Esto puede tomar varios minutos dependiendo de tu conexión...
ollama pull qwen2.5:14b-instruct
if %errorlevel% neq 0 (
    echo ERROR: No se pudo descargar qwen2.5:14b-instruct
    echo Intentando con modelo alternativo llama3.1:8b-instruct...
    ollama pull llama3.1:8b-instruct
    if %errorlevel% neq 0 (
        echo ERROR: No se pudo descargar ningún modelo
        pause
        exit /b 1
    )
    echo ✓ Modelo alternativo descargado
) else (
    echo ✓ Modelo principal descargado
)

echo.
echo [3/5] Descargando modelo de embeddings...
ollama pull nomic-embed-text
if %errorlevel% neq 0 (
    echo ERROR: No se pudo descargar nomic-embed-text
    pause
    exit /b 1
)
echo ✓ Modelo de embeddings descargado

echo.
echo [4/5] Verificando que Ollama esté ejecutándose...
ollama list >nul 2>&1
if %errorlevel% neq 0 (
    echo Iniciando Ollama...
    start "" ollama serve
    timeout /t 10 /nobreak >nul
    echo Esperando a que Ollama esté listo...
    timeout /t 5 /nobreak >nul
)

echo.
echo [5/5] Verificando modelos disponibles...
ollama list
echo.

echo ========================================
echo   Setup completado exitosamente!
echo ========================================
echo.
echo Modelos disponibles:
ollama list
echo.
echo Para iniciar el backend:
echo   cd backend
echo   npm install
echo   npm run dev
echo.
echo Para iniciar el frontend:
echo   cd frontend
echo   npm install
echo   npm run dev
echo.
pause
