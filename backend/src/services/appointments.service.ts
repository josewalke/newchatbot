import dbManager from '../db/db';
import { OperationalError } from '../middlewares/error.middleware';
import { hasTimeOverlap, addMinutes, parseISO, formatDateTime } from '../utils/time';
import { AppointmentBook, AppointmentReschedule, AppointmentCancel, AppointmentConfirm } from '../utils/validators';

/**
 * Interfaz para una cita
 */
interface Appointment {
  id: number;
  customer_id: number;
  service_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interfaz para una cita con información del cliente y servicio
 */
interface AppointmentWithDetails extends Appointment {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  service_name: string;
  service_duration: number;
  service_price: number;
}

/**
 * Interfaz para un slot de disponibilidad
 */
interface AvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
}

/**
 * Servicio para gestión de citas
 */
export class AppointmentsService {
  /**
   * Reserva una nueva cita
   */
  async bookAppointment(data: AppointmentBook): Promise<AppointmentWithDetails> {
    try {
      const { name, email, phone, serviceId, datetimeISO, durationMin } = data;
      
      // Verificar que el servicio existe y está activo
      const service = dbManager.queryFirst<{
        id: number;
        name: string;
        duration_min: number;
        price_cents: number;
        active: boolean;
      }>(
        'SELECT id, name, duration_min, price_cents, active FROM services WHERE id = ? AND active = 1',
        [serviceId]
      );

      if (!service) {
        throw new OperationalError('Servicio no encontrado o inactivo', 404);
      }

      // Usar la duración del servicio si no se especifica
      const duration = durationMin || service.duration_min;
      const startTime = parseISO(datetimeISO);
      const endTime = addMinutes(startTime, duration);

      // Verificar que la fecha está en el futuro
      if (startTime <= new Date()) {
        throw new OperationalError('La cita debe estar en el futuro', 400);
      }

      // Verificar disponibilidad (no solapamientos)
      const hasConflict = await this.checkTimeConflict(startTime, endTime, serviceId);
      if (hasConflict) {
        throw new OperationalError('El horario seleccionado no está disponible', 409);
      }

      // Crear o encontrar el cliente
      let customerId: number;
      if (email) {
        const existingCustomer = dbManager.queryFirst<{ id: number }>(
          'SELECT id FROM customers WHERE email = ?',
          [email]
        );
        
        if (existingCustomer) {
          customerId = existingCustomer.id;
          // Actualizar información del cliente si es necesario
          dbManager.run(
            'UPDATE customers SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [name, phone, customerId]
          );
        } else {
          const result = dbManager.run(
            'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)',
            [name, email, phone]
          );
          customerId = Number(result.lastInsertRowid);
        }
      } else {
        // Si no hay email, crear cliente nuevo
        const result = dbManager.run(
          'INSERT INTO customers (name, phone) VALUES (?, ?)',
          [name, phone]
        );
                  customerId = Number(result.lastInsertRowid);
      }

      // Crear la cita
      const appointmentResult = dbManager.run(
        'INSERT INTO appointments (customer_id, service_id, starts_at, ends_at, status) VALUES (?, ?, ?, ?, ?)',
        [customerId, serviceId, startTime.toISOString(), endTime.toISOString(), 'pending']
      );

      const appointmentId = Number(appointmentResult.lastInsertRowid);

      // Obtener la cita creada con detalles
      const appointment = await this.getAppointmentById(appointmentId);
      if (!appointment) {
        throw new OperationalError('Error al crear la cita', 500);
      }

      return appointment;
    } catch (error) {
      if (error instanceof OperationalError) {
        throw error;
      }
      console.error('Error al reservar cita:', error);
      throw new OperationalError('Error interno al reservar la cita', 500);
    }
  }

  /**
   * Reprograma una cita existente
   */
  async rescheduleAppointment(data: AppointmentReschedule): Promise<AppointmentWithDetails> {
    try {
      const { id, newDatetimeISO, durationMin } = data;

      // Obtener la cita actual
      const currentAppointment = dbManager.queryFirst<{
        id: number;
        customer_id: number;
        service_id: number;
        starts_at: string;
        ends_at: string;
        status: string;
      }>(
        'SELECT id, customer_id, service_id, starts_at, ends_at, status FROM appointments WHERE id = ?',
        [id]
      );

      if (!currentAppointment) {
        throw new OperationalError('Cita no encontrada', 404);
      }

      if (currentAppointment.status === 'cancelled') {
        throw new OperationalError('No se puede reprogramar una cita cancelada', 400);
      }

      // Obtener información del servicio
      const service = dbManager.queryFirst<{
        duration_min: number;
      }>(
        'SELECT duration_min FROM services WHERE id = ?',
        [currentAppointment.service_id]
      );

      if (!service) {
        throw new OperationalError('Servicio no encontrado', 404);
      }

      const duration = durationMin || service.duration_min;
      const newStartTime = parseISO(newDatetimeISO);
      const newEndTime = addMinutes(newStartTime, duration);

      // Verificar que la nueva fecha está en el futuro
      if (newStartTime <= new Date()) {
        throw new OperationalError('La nueva fecha debe estar en el futuro', 400);
      }

      // Verificar disponibilidad (excluyendo la cita actual)
      const hasConflict = await this.checkTimeConflict(
        newStartTime,
        newEndTime,
        currentAppointment.service_id,
        id
      );
      
      if (hasConflict) {
        throw new OperationalError('El nuevo horario no está disponible', 409);
      }

      // Actualizar la cita
      dbManager.run(
        'UPDATE appointments SET starts_at = ?, ends_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStartTime.toISOString(), newEndTime.toISOString(), id]
      );

      // Obtener la cita actualizada
      const updatedAppointment = await this.getAppointmentById(id);
      if (!updatedAppointment) {
        throw new OperationalError('Error al actualizar la cita', 500);
      }

      return updatedAppointment;
    } catch (error) {
      if (error instanceof OperationalError) {
        throw error;
      }
      console.error('Error al reprogramar cita:', error);
      throw new OperationalError('Error interno al reprogramar la cita', 500);
    }
  }

  /**
   * Cancela una cita
   */
  async cancelAppointment(data: AppointmentCancel): Promise<{ success: boolean; message: string }> {
    try {
      const { id } = data;

      // Verificar que la cita existe
      const appointment = dbManager.queryFirst<{
        id: number;
        status: string;
        starts_at: string;
      }>(
        'SELECT id, status, starts_at FROM appointments WHERE id = ?',
        [id]
      );

      if (!appointment) {
        throw new OperationalError('Cita no encontrada', 404);
      }

      if (appointment.status === 'cancelled') {
        return { success: true, message: 'La cita ya estaba cancelada' };
      }

      // Verificar si se puede cancelar (más de 24 horas antes)
      const startTime = parseISO(appointment.starts_at);
      const now = new Date();
      const hoursUntilAppointment = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilAppointment < 24) {
        throw new OperationalError(
          'Solo se pueden cancelar citas con más de 24 horas de anticipación',
          400
        );
      }

      // Cancelar la cita
      dbManager.run(
        'UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['cancelled', id]
      );

      return { success: true, message: 'Cita cancelada exitosamente' };
    } catch (error) {
      if (error instanceof OperationalError) {
        throw error;
      }
      console.error('Error al cancelar cita:', error);
      throw new OperationalError('Error interno al cancelar la cita', 500);
    }
  }

  /**
   * Confirma una cita
   */
  async confirmAppointment(data: AppointmentConfirm): Promise<{ success: boolean; message: string }> {
    try {
      const { id } = data;

      // Verificar que la cita existe
      const appointment = dbManager.queryFirst<{
        id: number;
        status: string;
      }>(
        'SELECT id, status FROM appointments WHERE id = ?',
        [id]
      );

      if (!appointment) {
        throw new OperationalError('Cita no encontrada', 404);
      }

      if (appointment.status === 'confirmed') {
        return { success: true, message: 'La cita ya estaba confirmada' };
      }

      if (appointment.status === 'cancelled') {
        throw new OperationalError('No se puede confirmar una cita cancelada', 400);
      }

      // Confirmar la cita
      dbManager.run(
        'UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['confirmed', id]
      );

      return { success: true, message: 'Cita confirmada exitosamente' };
    } catch (error) {
      if (error instanceof OperationalError) {
        throw error;
      }
      console.error('Error al confirmar cita:', error);
      throw new OperationalError('Error interno al confirmar la cita', 500);
    }
  }

  /**
   * Obtiene la disponibilidad para un rango de fechas
   */
  async getAvailability(
    fromISO: string,
    toISO: string,
    serviceId?: number
  ): Promise<AvailabilitySlot[]> {
    try {
      const fromDate = parseISO(fromISO);
      const toDate = parseISO(toISO);

      // Obtener servicios activos
      const services = serviceId 
        ? dbManager.query<{ id: number; duration_min: number }>(
            'SELECT id, duration_min FROM services WHERE id = ? AND active = 1',
            [serviceId]
          )
        : dbManager.query<{ id: number; duration_min: number }>(
            'SELECT id, duration_min FROM services WHERE active = 1'
          );

      if (services.length === 0) {
        return [];
      }

      // Generar slots de 30 minutos
      const slots: AvailabilitySlot[] = [];
      const slotDuration = 30; // 30 minutos
      let currentTime = new Date(fromDate);

      while (currentTime < toDate) {
        const slotEnd = addMinutes(currentTime, slotDuration);
        
        // Verificar disponibilidad para cada servicio
        let isAvailable = true;
        
        for (const service of services) {
          const hasConflict = await this.checkTimeConflict(
            currentTime,
            slotEnd,
            service.id
          );
          
          if (hasConflict) {
            isAvailable = false;
            break;
          }
        }

        slots.push({
          start: currentTime.toISOString(),
          end: slotEnd.toISOString(),
          available: isAvailable,
        });

        currentTime = slotEnd;
      }

      return slots;
    } catch (error) {
      console.error('Error al obtener disponibilidad:', error);
      throw new OperationalError('Error al obtener la disponibilidad', 500);
    }
  }

  /**
   * Obtiene una cita por ID con detalles completos
   */
  async getAppointmentById(id: number): Promise<AppointmentWithDetails | null> {
    try {
      const appointment = dbManager.queryFirst<AppointmentWithDetails>(
        `SELECT 
          a.id, a.customer_id, a.service_id, a.starts_at, a.ends_at, 
          a.status, a.notes, a.created_at, a.updated_at,
          c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
          s.name as service_name, s.duration_min as service_duration, s.price_cents as service_price
        FROM appointments a
        JOIN customers c ON a.customer_id = c.id
        JOIN services s ON a.service_id = s.id
        WHERE a.id = ?`,
        [id]
      );

      return appointment || null;
    } catch (error) {
      console.error('Error al obtener cita:', error);
      return null;
    }
  }

  /**
   * Obtiene todas las citas de un cliente
   */
  async getAppointmentsByCustomer(customerId: number): Promise<AppointmentWithDetails[]> {
    try {
      return dbManager.query<AppointmentWithDetails>(
        `SELECT 
          a.id, a.customer_id, a.service_id, a.starts_at, a.ends_at, 
          a.status, a.notes, a.created_at, a.updated_at,
          c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
          s.name as service_name, s.duration_min as service_duration, s.price_cents as service_price
        FROM appointments a
        JOIN customers c ON a.customer_id = c.id
        JOIN services s ON a.service_id = s.id
        WHERE a.customer_id = ?
        ORDER BY a.starts_at DESC`,
        [customerId]
      );
    } catch (error) {
      console.error('Error al obtener citas del cliente:', error);
      return [];
    }
  }

  /**
   * Verifica si hay conflicto de horarios
   */
  private async checkTimeConflict(
    startTime: Date,
    endTime: Date,
    serviceId: number,
    excludeAppointmentId?: number
  ): Promise<boolean> {
    try {
      let query = `
        SELECT COUNT(*) as count 
        FROM appointments 
        WHERE service_id = ? 
        AND status != 'cancelled'
        AND (
          (starts_at < ? AND ends_at > ?) OR
          (starts_at < ? AND ends_at > ?) OR
          (starts_at >= ? AND starts_at < ?)
        )
      `;
      
      const params = [
        serviceId,
        endTime.toISOString(),
        startTime.toISOString(),
        endTime.toISOString(),
        startTime.toISOString(),
        startTime.toISOString(),
        endTime.toISOString(),
      ];

      if (excludeAppointmentId) {
        query += ' AND id != ?';
        params.push(excludeAppointmentId);
      }

      const result = dbManager.queryFirst<{ count: number }>(query, params);
      return (result?.count || 0) > 0;
    } catch (error) {
      console.error('Error al verificar conflicto de horarios:', error);
      return true; // En caso de error, asumir que hay conflicto
    }
  }
}

// Exportar instancia singleton
export const appointmentsService = new AppointmentsService();
export default appointmentsService;
