@echo off
echo ========================================
echo   Ollama Optimizado para Poca RAM
echo ========================================
echo.

echo Configurando Ollama para usar menos memoria...
echo.

REM Configurar variables de entorno para optimizar memoria
set OLLAMA_HOST=127.0.0.1:11434
set OLLAMA_ORIGINS=*
set OLLAMA_NUM_PARALLEL=1
set OLLAMA_KEEP_ALIVE=5m

echo Variables de entorno configuradas:
echo OLLAMA_HOST=%OLLAMA_HOST%
echo OLLAMA_ORIGINS=%OLLAMA_ORIGINS%
echo OLLAMA_NUM_PARALLEL=%OLLAMA_NUM_PARALLEL%
echo OLLAMA_KEEP_ALIVE=%OLLAMA_KEEP_ALIVE%
echo.

echo Iniciando Ollama con configuración optimizada...
echo.

REM Iniciar Ollama con parámetros de memoria optimizados
start "" ollama serve --host 127.0.0.1:11434

echo Esperando a que Ollama esté listo...
timeout /t 10 /nobreak >nul

echo.
echo Ollama iniciado. Verificando estado...
ollama list

echo.
echo ========================================
echo   Configuración Completada
echo ========================================
echo.
echo Ahora puedes probar el modelo:
echo ollama run llama3.1:8b-instruct-q4_K_M "hola"
echo.
pause
