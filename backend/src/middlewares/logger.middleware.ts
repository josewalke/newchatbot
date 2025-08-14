import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de logging personalizado
 * Registra información detallada de cada petición HTTP
 */
export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Capturar el cuerpo de la respuesta original
  const originalSend = res.send;
  
  // Interceptar la respuesta para calcular el tiempo
  res.send = function(body: any) {
    const duration = Date.now() - startTime;
    
    // Log de la petición completada
    logRequest(req, res, duration);
    
    // Llamar al método original
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Función para registrar la información de la petición
 */
function logRequest(req: Request, res: Response, duration: number): void {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const statusCode = res.statusCode;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';
  
  // Determinar el emoji según el código de estado
  const statusEmoji = getStatusEmoji(statusCode);
  
  // Determinar el color según el método HTTP
  const methodColor = getMethodColor(method);
  
  // Log formateado
  console.log(
    `${statusEmoji} ${timestamp} | ${methodColor}${method.padEnd(7)}${'\x1b[0m'} | ` +
    `${url.padEnd(50)} | ${statusCode} | ${duration}ms | ${ip} | ${userAgent.substring(0, 50)}`
  );
  
  // Log detallado para errores
  if (statusCode >= 400) {
    console.error(`❌ Error en ${method} ${url}:`, {
      statusCode,
      duration,
      ip,
      userAgent,
      body: req.body,
      query: req.query,
      params: req.params,
    });
  }
}

/**
 * Obtiene el emoji según el código de estado HTTP
 */
function getStatusEmoji(statusCode: number): string {
  if (statusCode >= 500) return '💥'; // Error del servidor
  if (statusCode >= 400) return '⚠️';  // Error del cliente
  if (statusCode >= 300) return '🔄';  // Redirección
  if (statusCode >= 200) return '✅';  // Éxito
  return '❓'; // Desconocido
}

/**
 * Obtiene el color ANSI según el método HTTP
 */
function getMethodColor(method: string): string {
  switch (method) {
    case 'GET':
      return '\x1b[32m'; // Verde
    case 'POST':
      return '\x1b[34m'; // Azul
    case 'PUT':
      return '\x1b[33m'; // Amarillo
    case 'DELETE':
      return '\x1b[31m'; // Rojo
    case 'PATCH':
      return '\x1b[35m'; // Magenta
    default:
      return '\x1b[37m'; // Blanco
  }
}

/**
 * Middleware para logging de errores específicos
 */
export function errorLoggerMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';
  
  console.error(`💥 ${timestamp} | Error en ${method} ${url}:`, {
    error: error.message,
    stack: error.stack,
    ip,
    body: req.body,
    query: req.query,
    params: req.params,
  });
  
  next(error);
}

/**
 * Middleware para logging de peticiones lentas
 */
export function slowRequestLogger(thresholdMs: number = 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    const originalSend = res.send;
    
    res.send = function(body: any) {
      const duration = Date.now() - startTime;
      
      if (duration > thresholdMs) {
        console.warn(`🐌 Petición lenta detectada:`, {
          method: req.method,
          url: req.url,
          duration: `${duration}ms`,
          threshold: `${thresholdMs}ms`,
          timestamp: new Date().toISOString(),
        });
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
}
