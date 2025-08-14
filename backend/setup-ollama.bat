@echo off
echo ========================================
echo    CONFIGURACION OPTIMIZADA DE OLLAMA
echo ========================================
echo.

echo [1/5] Verificando si Ollama esta instalado...
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Ollama no esta instalado. Descargando...
    echo Por favor, descarga Ollama desde: https://ollama.ai/download
    echo Despues ejecuta este script nuevamente.
    pause
    exit /b 1
) else (
    echo ✅ Ollama ya esta instalado
)

echo.
echo [2/5] Descargando modelo optimizado llama3.1:3b...
ollama pull llama3.1:3b
if %errorlevel% neq 0 (
    echo ❌ Error al descargar el modelo
    pause
    exit /b 1
)

echo.
echo [3/5] Creando modelo personalizado con configuracion optimizada...
ollama create chatbot-optimized -f Modelfile
if %errorlevel% neq 0 (
    echo ❌ Error al crear modelo personalizado
    pause
    exit /b 1
)

echo.
echo [4/5] Verificando que el modelo funcione...
ollama run chatbot-optimized "Hola, ¿como estas?"
if %errorlevel% neq 0 (
    echo ❌ Error al probar el modelo
    pause
    exit /b 1
)

echo.
echo [5/5] Configuracion completada!
echo.
echo ✅ Ollama configurado correctamente
echo ✅ Modelo llama3.1:3b descargado
echo ✅ Modelo personalizado creado
echo ✅ Configuracion optimizada aplicada
echo.
echo Ahora puedes ejecutar: npm run dev
echo.
pause
