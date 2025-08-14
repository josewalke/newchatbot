import { Request, Response, NextFunction } from 'express';

/**
 * Interfaz para errores personalizados
 */
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Clase para errores operacionales de la aplicación
 */
export class OperationalError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware para manejo centralizado de errores
 */
export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log del error
  console.error('❌ Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Determinar el código de estado
  const statusCode = error.statusCode || 500;
  
  // Determinar si es un error operacional o del sistema
  const isOperational = error.isOperational || false;

  // En producción, no exponer detalles internos
  const isProduction = process.env.NODE_ENV === 'production';
  
  let response: any = {
    error: isProduction && !isOperational 
      ? 'Error interno del servidor' 
      : error.message,
  };

  // En desarrollo, incluir más detalles
  if (!isProduction) {
    response.details = {
      stack: error.stack,
      statusCode,
      isOperational,
      timestamp: new Date().toISOString(),
    };
  }

  // Si es un error de validación, incluir detalles específicos
  if (error.name === 'ValidationError') {
    response.error = 'Error de validación';
    response.details = {
      message: error.message,
      statusCode: 400,
    };
  }

  // Si es un error de base de datos
  if (error.message.includes('SQLITE') || error.message.includes('database')) {
    response.error = 'Error de base de datos';
    response.statusCode = 500;
  }

  // Enviar respuesta
  res.status(statusCode).json(response);
}

/**
 * Middleware para capturar errores asíncronos
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware para manejar rutas no encontradas
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Ruta no encontrada',
    details: {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Middleware para manejar errores de sintaxis JSON
 */
export function jsonErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: 'JSON inválido',
      details: {
        message: 'El cuerpo de la petición contiene JSON malformado',
        timestamp: new Date().toISOString(),
      },
    });
  } else {
    next(error);
  }
}
