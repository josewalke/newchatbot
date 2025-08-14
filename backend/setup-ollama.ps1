# Script de configuración optimizada de Ollama para PowerShell
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CONFIGURACION OPTIMIZADA DE OLLAMA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si Ollama está instalado
Write-Host "[1/5] Verificando si Ollama está instalado..." -ForegroundColor Yellow
try {
    $ollamaVersion = ollama --version
    Write-Host "✅ Ollama ya está instalado: $ollamaVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Ollama no está instalado" -ForegroundColor Red
    Write-Host "Por favor, descarga Ollama desde: https://ollama.ai/download" -ForegroundColor Yellow
    Write-Host "Después ejecuta este script nuevamente." -ForegroundColor Yellow
    Read-Host "Presiona Enter para continuar"
    exit 1
}

# Descargar modelo optimizado
Write-Host ""
Write-Host "[2/5] Descargando modelo optimizado llama3.1:3b..." -ForegroundColor Yellow
try {
    ollama pull llama3.1:3b
    Write-Host "✅ Modelo llama3.1:3b descargado correctamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error al descargar el modelo" -ForegroundColor Red
    Read-Host "Presiona Enter para continuar"
    exit 1
}

# Crear modelo personalizado
Write-Host ""
Write-Host "[3/5] Creando modelo personalizado con configuración optimizada..." -ForegroundColor Yellow
try {
    ollama create chatbot-optimized -f Modelfile
    Write-Host "✅ Modelo personalizado creado correctamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error al crear modelo personalizado" -ForegroundColor Red
    Read-Host "Presiona Enter para continuar"
    exit 1
}

# Verificar que el modelo funcione
Write-Host ""
Write-Host "[4/5] Verificando que el modelo funcione..." -ForegroundColor Yellow
try {
    $testResponse = ollama run chatbot-optimized "Hola, ¿cómo estás?"
    Write-Host "✅ Modelo probado correctamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error al probar el modelo" -ForegroundColor Red
    Read-Host "Presiona Enter para continuar"
    exit 1
}

# Configuración completada
Write-Host ""
Write-Host "[5/5] Configuración completada!" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Ollama configurado correctamente" -ForegroundColor Green
Write-Host "✅ Modelo llama3.1:3b descargado" -ForegroundColor Green
Write-Host "✅ Modelo personalizado creado" -ForegroundColor Green
Write-Host "✅ Configuración optimizada aplicada" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora puedes ejecutar: npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "MEJORAS APLICADAS:" -ForegroundColor Yellow
Write-Host "• Temperature: 0.1 (respuestas más consistentes)" -ForegroundColor White
Write-Host "• Top-p: 0.7 (mejor calidad)" -ForegroundColor White
Write-Host "• Contexto: 2048 tokens (más rápido)" -ForegroundColor White
Write-Host "• Respuestas: máximo 512 tokens (más concisas)" -ForegroundColor White
Write-Host "• Timeout: 15 segundos (más rápido)" -ForegroundColor White
Write-Host ""
Read-Host "Presiona Enter para continuar"
