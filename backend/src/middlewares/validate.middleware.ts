import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { OperationalError } from './error.middleware';

/**
 * Middleware de validación usando Zod
 * Valida el body, query o params de la petición según el esquema proporcionado
 */
export function validateRequest(schema: ZodSchema, location: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[location];
      const result = schema.parse(data);
      
      // Reemplazar los datos originales con los validados
      req[location] = result;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new OperationalError(
          `Error de validación en ${location}: ${error.errors.map(e => e.message).join(', ')}`,
          400
        );
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

/**
 * Middleware para validar el body de la petición
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return validateRequest(schema, 'body');
}

/**
 * Middleware para validar los query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return validateRequest(schema, 'query');
}

/**
 * Middleware para validar los path parameters
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return validateRequest(schema, 'params');
}

/**
 * Middleware para validar múltiples ubicaciones
 */
export function validateMultiple(validations: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validar body si se especifica
      if (validations.body) {
        req.body = validations.body.parse(req.body);
      }
      
      // Validar query si se especifica
      if (validations.query) {
        req.query = validations.query.parse(req.query);
      }
      
      // Validar params si se especifica
      if (validations.params) {
        req.params = validations.params.parse(req.params);
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new OperationalError(
          `Error de validación: ${error.errors.map(e => e.message).join(', ')}`,
          400
        );
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

/**
 * Middleware para validar archivos subidos
 */
export function validateFileUpload(options: {
  maxSize?: number; // en bytes
  allowedTypes?: string[];
  maxFiles?: number;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        throw new OperationalError('No se han subido archivos', 400);
      }
      
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files);
      
      // Validar número máximo de archivos
      if (options.maxFiles && files.length > options.maxFiles) {
        throw new OperationalError(
          `Máximo ${options.maxFiles} archivo(s) permitido(s)`,
          400
        );
      }
      
      // Validar cada archivo
      for (const file of files) {
        // Validar tamaño
        if (options.maxSize && file.size > options.maxSize) {
          throw new OperationalError(
            `El archivo ${file.name} excede el tamaño máximo de ${options.maxSize} bytes`,
            400
          );
        }
        
        // Validar tipo
        if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
          throw new OperationalError(
            `El tipo de archivo ${file.mimetype} no está permitido`,
            400
          );
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware para validar límites de rate limiting
 */
export function validateRateLimit(options: {
  maxRequests: number;
  windowMs: number;
}) {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    const userRequests = requests.get(ip);
    
    if (!userRequests || now > userRequests.resetTime) {
      // Reset o primera petición
      requests.set(ip, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      next();
    } else if (userRequests.count < options.maxRequests) {
      // Incrementar contador
      userRequests.count++;
      next();
    } else {
      // Límite excedido
      const error = new OperationalError(
        'Demasiadas peticiones. Inténtalo de nuevo más tarde.',
        429
      );
      next(error);
    }
  };
}
