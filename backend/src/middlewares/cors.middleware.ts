import cors from 'cors';
import config from '../utils/env';

/**
 * Configuración de CORS personalizada
 */
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // Permitir requests sin origin (como aplicaciones móviles o Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Lista de orígenes permitidos
    const allowedOrigins = [
      config.corsOrigin,
      'http://localhost:5173', // Frontend dev
      'http://localhost:3000', // Backend dev
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ];
    
    // Verificar si el origin está permitido
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS bloqueado para origin: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true, // Permitir cookies y headers de autorización
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'X-Total-Count',
  ],
  maxAge: 86400, // Cache preflight por 24 horas
};

/**
 * Middleware de CORS configurado
 */
export const corsMiddleware = cors(corsOptions);

/**
 * Middleware de CORS más permisivo para desarrollo
 */
export const devCorsMiddleware = cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['*'],
});

/**
 * Middleware de CORS restrictivo para producción
 */
export const prodCorsMiddleware = cors({
  origin: [config.corsOrigin],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
  ],
});

/**
 * Middleware de CORS específico para el embed de WordPress
 */
export const embedCorsMiddleware = cors({
  origin: '*', // Permitir cualquier origen para embeds
  credentials: false, // No cookies para embeds
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
});

/**
 * Función para obtener el middleware de CORS apropiado según el entorno
 */
export function getCorsMiddleware() {
  if (config.nodeEnv === 'development') {
    return devCorsMiddleware;
  }
  
  if (config.nodeEnv === 'production') {
    return prodCorsMiddleware;
  }
  
  return corsMiddleware;
}
