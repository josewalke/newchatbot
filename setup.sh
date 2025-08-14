#!/bin/bash

echo "🚀 Configurando ChatBot Self-Hosted..."

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor, instala Node.js 18+ LTS primero."
    echo "📥 Descarga desde: https://nodejs.org/"
    exit 1
fi

# Verificar versión de Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js versión $NODE_VERSION detectada. Se requiere Node.js 18+ LTS."
    exit 1
fi

echo "✅ Node.js $(node -v) detectado"

# Verificar si Ollama está instalado
if ! command -v ollama &> /dev/null; then
    echo "⚠️  Ollama no está instalado o no está en el PATH."
    echo "📥 Instala Ollama desde: https://ollama.ai/"
    echo "🔧 Después de instalar, ejecuta: ollama pull llama3.2:3b"
    echo "🔧 Y también: ollama pull nomic-embed-text"
    echo ""
    read -p "¿Continuar con la instalación del proyecto? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Ollama detectado"
fi

# Crear archivo .env si no existe
if [ ! -f "backend/.env" ]; then
    echo "📝 Creando archivo .env en backend..."
    cp backend/env.example backend/.env
    echo "✅ Archivo .env creado. Edítalo según tus necesidades."
fi

# Instalar dependencias del backend
echo "📦 Instalando dependencias del backend..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error al instalar dependencias del backend"
    exit 1
fi
echo "✅ Dependencias del backend instaladas"
cd ..

# Instalar dependencias del frontend
echo "📦 Instalando dependencias del frontend..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error al instalar dependencias del frontend"
    exit 1
fi
echo "✅ Dependencias del frontend instaladas"
cd ..

echo ""
echo "🎉 ¡Instalación completada!"
echo ""
echo "📋 Para ejecutar el proyecto:"
echo ""
echo "1️⃣  Inicia el backend:"
echo "   cd backend"
echo "   npm run dev"
echo ""
echo "2️⃣  En otra terminal, inicia el frontend:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "🌐 El frontend estará disponible en: http://localhost:5173"
echo "🔧 El backend estará disponible en: http://localhost:3000"
echo ""
echo "📚 Para más información, consulta el README.md"
echo ""
echo "🤖 ¡Disfruta de tu ChatBot Self-Hosted!"
