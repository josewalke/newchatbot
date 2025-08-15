@echo off
echo ========================================
echo    CONFIGURACION DEL SISTEMA MEJORADO
echo ========================================
echo.

echo [1/5] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo Error al instalar dependencias
    pause
    exit /b 1
)

echo [2/5] Actualizando esquema de base de datos...
node src/db/update-schema.sql
if %errorlevel% neq 0 (
    echo Error al actualizar esquema
    pause
    exit /b 1
)

echo [3/5] Poblando base de datos con datos simulados...
node src/db/seed-database.js
if %errorlevel% neq 0 (
    echo Error al poblar base de datos
    pause
    exit /b 1
)

echo [4/5] Verificando configuración...
node verify-schema.js
if %errorlevel% neq 0 (
    echo Error en verificación de esquema
    pause
    exit /b 1
)

echo [5/5] Configuración completada exitosamente!
echo.
echo ========================================
echo    SISTEMA LISTO PARA USAR
echo ========================================
echo.
echo Funcionalidades disponibles:
echo - Sistema completo de citas (agendar, cancelar, mover, confirmar)
echo - Atención al cliente mejorada con tickets de soporte
echo - Sistema de ventas por uno con carrito de compras
echo - Base de datos simulada con productos y citas reales
echo.
echo Para iniciar el backend:
echo   start-backend.bat
echo.
echo Para iniciar el frontend:
echo   start-frontend.bat
echo.
pause
