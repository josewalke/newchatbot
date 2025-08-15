@echo off
title NewChatBot - Iniciando Sistema Completo
echo ========================================
echo    NEWCHATBOT - SISTEMA COMPLETO
echo ========================================
echo.
echo Verificando Ollama...
echo.

REM Verificar si Ollama está ejecutándose
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Ollama no está ejecutándose
    echo Iniciando Ollama...
    start /B ollama serve
    timeout /t 5 /nobreak >nul
    echo Ollama iniciado en segundo plano
) else (
    echo [OK] Ollama ya está ejecutándose
)

echo.
echo Verificando modelos...
ollama list
echo.

echo ========================================
echo Iniciando Backend...
echo ========================================
start "Backend ChatBot" cmd /k "cd /d %~dp0backend && start-backend.bat"

echo.
echo ========================================
echo Iniciando Frontend...
echo ========================================
start "Frontend ChatBot" cmd /k "cd /d %~dp0frontend && start-frontend.bat"

echo.
echo ========================================
echo SISTEMA INICIADO
echo ========================================
echo.
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo Ollama: http://localhost:11434
echo.
echo Presiona cualquier tecla para abrir el navegador...
pause >nul

echo Abriendo navegador...
start http://localhost:5173

echo.
echo ¡ChatBot iniciado correctamente!
echo.
pause
