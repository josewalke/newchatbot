import { z } from 'zod';

/**
 * Esquemas de validación usando Zod
 */

// Chat
export const chatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  meta: z.object({
    channel: z.enum(['web', 'telegram', 'wp']).optional(),
    userId: z.string().optional(),
  }).optional(),
});

// Citas
export const appointmentBookSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(1).max(20).optional(),
  serviceId: z.number().int().positive(),
  datetimeISO: z.string().datetime(),
  durationMin: z.number().int().positive().optional(),
});

export const appointmentRescheduleSchema = z.object({
  id: z.number().int().positive(),
  newDatetimeISO: z.string().datetime(),
  durationMin: z.number().int().positive().optional(),
});

export const appointmentCancelSchema = z.object({
  id: z.number().int().positive(),
});

export const appointmentConfirmSchema = z.object({
  id: z.number().int().positive(),
});

export const availabilityQuerySchema = z.object({
  fromISO: z.string().datetime(),
  toISO: z.string().datetime(),
  serviceId: z.number().int().positive().optional(),
});

// Servicios
export const serviceSchema = z.object({
  name: z.string().min(1).max(100),
  durationMin: z.number().int().positive(),
  priceCents: z.number().int().min(0),
  active: z.boolean().default(true),
});

// Conocimiento
export const knowledgeUploadSchema = z.object({
  source: z.string().min(1).max(255),
  content: z.string().min(1),
});

export const knowledgeSearchSchema = z.object({
  q: z.string().min(1),
  k: z.number().int().min(1).max(20).default(5),
});

// Cliente
export const customerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(1).max(20).optional(),
});

// Tipos inferidos
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type AppointmentBook = z.infer<typeof appointmentBookSchema>;
export type AppointmentReschedule = z.infer<typeof appointmentRescheduleSchema>;
export type AppointmentCancel = z.infer<typeof appointmentCancelSchema>;
export type AppointmentConfirm = z.infer<typeof appointmentConfirmSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type Service = z.infer<typeof serviceSchema>;
export type KnowledgeUpload = z.infer<typeof knowledgeUploadSchema>;
export type KnowledgeSearch = z.infer<typeof knowledgeSearchSchema>;
export type Customer = z.infer<typeof customerSchema>;

/**
 * Valida un objeto contra un esquema y retorna el resultado
 * @param schema Esquema Zod
 * @param data Datos a validar
 * @returns Objeto con success y data/error
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors.map(e => e.message).join(', ') 
      };
    }
    return { success: false, error: 'Error de validación desconocido' };
  }
}
