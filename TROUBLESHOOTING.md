# 🐛 Guía de Troubleshooting - NewChatbot

## 📋 Resumen Ejecutivo

Este documento contiene todos los problemas encontrados durante el desarrollo del sistema NewChatbot, junto con sus causas raíz y soluciones implementadas. Es una referencia rápida para futuras implementaciones y para resolver problemas similares.

## 🚨 Problemas Críticos y Soluciones

### 1. Error de Importación de Módulos

**❌ Problema**: 
```
node:internal/modules/cjs/loader:1228
Error: Cannot find module './db'
```

**🔍 Causa**: 
- Sintaxis incorrecta de importación en scripts de migración
- Confusión entre archivos `.ts` y `.js` compilados
- Ruta incorrecta al módulo de base de datos

**✅ Solución**:
```javascript
// ❌ INCORRECTO
const dbManager = require('./db').default;
const dbManager = require('./db');

// ✅ CORRECTO
const { dbManager } = require('./dist/db/db');
```

**📝 Explicación**: 
- Los archivos TypeScript se compilan a `dist/`
- El módulo exporta `{ dbManager }` no `dbManager.default`
- Siempre usar la ruta al archivo compilado

---

### 2. Tablas de Base de Datos No Existentes

**❌ Problema**: 
```
SqliteError: no such table: pharmaceutical_products
SqliteError: no such table: support_tickets
```

**🔍 Causa**: 
- Las tablas no se crearon durante la migración inicial
- Script de migración falló o no se ejecutó
- Orden incorrecto de creación de tablas

**✅ Solución**:
```bash
# 1. Verificar que el servidor esté funcionando
netstat -an | findstr :3000

# 2. Ejecutar migración completa
node migrate-schema.js

# 3. Verificar tablas creadas
node check-tables.js
```

**📝 Explicación**: 
- El script `migrate-schema.js` crea todas las tablas en el orden correcto
- Resuelve dependencias entre tablas automáticamente
- Incluye datos iniciales y índices

---

### 3. Conflictos de Rutas en Express

**❌ Problema**: 
```
GET /api/appointments/stats → {"success":false,"message":"Cita no encontrada"}
```

**🔍 Causa**: 
- Orden incorrecto de rutas en `appointments.routes.ts`
- Rutas específicas (`/stats`) interceptadas por parámetros dinámicos (`/:id`)
- Express interpreta `/stats` como `/:appointmentId` con valor "stats"

**✅ Solución**:
```typescript
// ❌ INCORRECTO - Rutas con parámetros primero
router.get('/:appointmentId', appointmentsController.getAppointment);
router.get('/stats', appointmentsController.getAppointmentStats);

// ✅ CORRECTO - Rutas específicas primero
router.get('/stats', appointmentsController.getAppointmentStats);
router.get('/:appointmentId', appointmentsController.getAppointment);
```

**📝 Explicación**: 
- Express evalúa rutas en orden de definición
- Las rutas más específicas deben ir antes que las genéricas
- Siempre colocar rutas estáticas antes de rutas con parámetros

---

### 4. Errores de Columna en Base de Datos

**❌ Problema**: 
```
SqliteError: no such column: scheduled
SqliteError: no such column: abierto
```

**🔍 Causa**: 
- Esquema de base de datos desactualizado
- Código intenta acceder a columnas que no existen
- Migración parcial o fallida

**✅ Solución**:
```sql
-- ❌ INCORRECTO
SELECT COUNT(*) FROM appointments WHERE status = 'scheduled';

-- ✅ CORRECTO
SELECT COUNT(*) FROM appointments WHERE status = 'scheduled';
-- O usar el esquema correcto:
SELECT COUNT(*) FROM appointments_new WHERE status = 'scheduled';
```

**📝 Explicación**: 
- Verificar que el esquema esté actualizado
- Usar nombres de columnas correctos del esquema actual
- Ejecutar migración completa si es necesario

---

### 5. Problemas de PowerShell en Windows

**❌ Problema**: 
```
npm error code ENOENT
npm error syscall open
npm error path C:\Users\Usuario\Desktop\NewChatbot\newchatbot\package.json
```

**🔍 Causa**: 
- Operador `&&` no reconocido en PowerShell
- Comandos de bash ejecutados en PowerShell
- Directorio de trabajo incorrecto

**✅ Solución**:
```bash
# ❌ INCORRECTO en PowerShell
cd backend && npm run build

# ✅ CORRECTO en PowerShell
cd backend
npm run build

# O usar separador de PowerShell
cd backend; npm run build
```

**📝 Explicación**: 
- PowerShell no soporta operador `&&` de bash
- Usar comandos separados o separador `;`
- Verificar directorio de trabajo antes de ejecutar comandos

---

### 6. Base de Datos No Inicializada

**❌ Problema**: 
```
Cannot read properties of null (reading 'exec')
dbManager.run is not a function
```

**🔍 Causa**: 
- Base de datos no inicializada antes de usar
- Conexión no establecida
- Módulo de base de datos no configurado correctamente

**✅ Solución**:
```javascript
// ❌ INCORRECTO
const { dbManager } = require('./dist/db/db');
dbManager.run('CREATE TABLE...'); // Error: no inicializada

// ✅ CORRECTO
const { dbManager } = require('./dist/db/db');
dbManager.initialize(); // Inicializar primero
dbManager.run('CREATE TABLE...'); // Ahora funciona
```

**📝 Explicación**: 
- Siempre llamar `dbManager.initialize()` antes de usar métodos
- La base de datos se inicializa automáticamente en el servidor
- Para scripts independientes, inicializar manualmente

---

### 7. Errores de Sintaxis SQL

**❌ Problema**: 
```
SqliteError: near "para": syntax error
```

**🔍 Causa**: 
- Comentarios SQL con caracteres especiales
- Sintaxis SQL incorrecta
- Archivos SQL ejecutados directamente con Node.js

**✅ Solución**:
```javascript
// ❌ INCORRECTO - Ejecutar SQL directamente
node src/db/update-schema.sql

// ✅ CORRECTO - Usar script de migración
node migrate-schema.js
```

**📝 Explicación**: 
- Node.js no puede ejecutar archivos `.sql` directamente
- Usar scripts JavaScript que lean y ejecuten SQL
- Los comentarios SQL pueden causar problemas de parsing

---

## 🔧 Scripts de Diagnóstico

### Verificar Estado del Sistema
```bash
# 1. Verificar servidores
netstat -an | findstr :3000  # Backend
netstat -an | findstr :5173  # Frontend

# 2. Verificar base de datos
node check-tables.js

# 3. Verificar endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/sales/products
```

### Scripts de Recuperación
```bash
# 1. Reconstruir sistema
cd backend
npm run build
node migrate-schema.js

# 2. Reiniciar servicios
# Terminal 1
npm start

# Terminal 2
cd ../frontend
npm run dev
```

## 📊 Checklist de Verificación

### ✅ Sistema Funcionando
- [ ] Backend responde en puerto 3000
- [ ] Frontend responde en puerto 5173
- [ ] Base de datos conectada
- [ ] Todas las tablas creadas
- [ ] Datos iniciales insertados
- [ ] Endpoints de API responden

### ⚠️ Problemas Comunes
- [ ] Errores de importación de módulos
- [ ] Tablas de base de datos faltantes
- [ ] Conflictos de rutas en Express
- [ ] Errores de columna en consultas
- [ ] Problemas de PowerShell en Windows
- [ ] Base de datos no inicializada

## 🚀 Prevención de Problemas

### 1. Orden de Ejecución
```bash
# Siempre seguir este orden:
1. npm install
2. npm run build
3. node migrate-schema.js
4. npm start (backend)
5. npm run dev (frontend)
```

### 2. Verificaciones Previas
```bash
# Antes de ejecutar scripts:
- Verificar directorio de trabajo
- Verificar que dependencias estén instaladas
- Verificar que el servidor esté funcionando
- Verificar que la base de datos esté inicializada
```

### 3. Logs y Debugging
```bash
# Habilitar logs detallados:
- Revisar consola del servidor
- Verificar logs de nodemon
- Usar console.log para debugging
- Verificar respuestas de API
```

## 📚 Recursos Adicionales

### Documentación Oficial
- [Express.js Routing](https://expressjs.com/en/guide/routing.html)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Node.js Modules](https://nodejs.org/api/modules.html)
- [PowerShell vs Bash](https://docs.microsoft.com/en-us/powershell/)

### Herramientas de Debugging
- **SQLite Browser**: Para inspeccionar base de datos
- **Postman/Insomnia**: Para probar endpoints de API
- **Chrome DevTools**: Para debugging del frontend
- **VS Code Debugger**: Para debugging del backend

---

**Última actualización**: 15 de Agosto, 2025
**Versión**: 1.0.0
**Estado**: ✅ Documentación completa de problemas y soluciones
