import dbManager from '../db/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interfaz para una cita
 */
export interface Appointment {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: number;
  serviceName: string;
  appointmentDate: string; // ISO string
  appointmentTime: string; // HH:MM
  duration: number; // minutos
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interfaz para crear una cita
 */
export interface CreateAppointmentRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: number;
  appointmentDate: string;
  appointmentTime: string;
  notes?: string;
}

/**
 * Interfaz para actualizar una cita
 */
export interface UpdateAppointmentRequest {
  appointmentDate?: string;
  appointmentTime?: string;
  status?: Appointment['status'];
  notes?: string;
}

/**
 * Interfaz para el resultado de una operación
 */
export interface AppointmentResult {
  success: boolean;
  message: string;
  appointment?: Appointment;
  error?: string;
}

/**
 * Servicio completo de gestión de citas
 */
export class AppointmentManagementService {
  
  /**
   * Crear una nueva cita
   */
  async createAppointment(request: CreateAppointmentRequest): Promise<AppointmentResult> {
    try {
      // Validar que el servicio existe
      const service = dbManager.queryFirst<{ id: number; name: string; duration: number; price: number }>(
        'SELECT id, name, duration, price FROM services WHERE id = ?',
        [request.serviceId]
      );

      if (!service) {
        return {
          success: false,
          message: 'El servicio solicitado no existe',
          error: 'SERVICE_NOT_FOUND'
        };
      }

      // Verificar disponibilidad del horario
      const isAvailable = await this.checkAvailability(
        request.serviceId,
        request.appointmentDate,
        request.appointmentTime,
        service.duration
      );

      if (!isAvailable) {
        return {
          success: false,
          message: 'El horario solicitado no está disponible',
          error: 'TIME_SLOT_UNAVAILABLE'
        };
      }

      // Crear la cita
      const appointmentId = uuidv4();
      const now = new Date().toISOString();
      
      dbManager.run(
        `INSERT INTO appointments (
          id, customer_name, customer_email, customer_phone, 
          service_id, service_name, appointment_date, appointment_time,
          duration, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          appointmentId,
          request.customerName,
          request.customerEmail,
          request.customerPhone,
          request.serviceId,
          service.name,
          request.appointmentDate,
          request.appointmentTime,
          service.duration,
          'scheduled',
          request.notes || null,
          now,
          now
        ]
      );

      const appointment: Appointment = {
        id: appointmentId,
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        customerPhone: request.customerPhone,
        serviceId: request.serviceId,
        serviceName: service.name,
        appointmentDate: request.appointmentDate,
        appointmentTime: request.appointmentTime,
        duration: service.duration,
        status: 'scheduled',
        notes: request.notes,
        createdAt: now,
        updatedAt: now
      };

      return {
        success: true,
        message: `Cita creada exitosamente para ${service.name} el ${request.appointmentDate} a las ${request.appointmentTime}`,
        appointment
      };

    } catch (error) {
      console.error('Error al crear cita:', error);
      return {
        success: false,
        message: 'Error interno al crear la cita',
        error: (error as Error).message
      };
    }
  }

  /**
   * Obtener todas las citas de un cliente
   */
  async getCustomerAppointments(customerEmail: string): Promise<Appointment[]> {
    try {
      const appointments = dbManager.query<Appointment>(
        `SELECT * FROM appointments WHERE customer_email = ? ORDER BY appointment_date DESC, appointment_time DESC`,
        [customerEmail]
      );

      return appointments;
    } catch (error) {
      console.error('Error al obtener citas del cliente:', error);
      return [];
    }
  }

  /**
   * Obtener una cita específica
   */
  async getAppointment(appointmentId: string): Promise<Appointment | null> {
    try {
      const appointment = dbManager.queryFirst<Appointment>(
        'SELECT * FROM appointments WHERE id = ?',
        [appointmentId]
      );

      return appointment || null;
    } catch (error) {
      console.error('Error al obtener cita:', error);
      return null;
    }
  }

  /**
   * Actualizar una cita
   */
  async updateAppointment(appointmentId: string, updates: UpdateAppointmentRequest): Promise<AppointmentResult> {
    try {
      const appointment = await this.getAppointment(appointmentId);
      if (!appointment) {
        return {
          success: false,
          message: 'Cita no encontrada',
          error: 'APPOINTMENT_NOT_FOUND'
        };
      }

      // Si se está cambiando la fecha/hora, verificar disponibilidad
      if (updates.appointmentDate || updates.appointmentTime) {
        const newDate = updates.appointmentDate || appointment.appointmentDate;
        const newTime = updates.appointmentTime || appointment.appointmentTime;
        
        const isAvailable = await this.checkAvailability(
          appointment.serviceId,
          newDate,
          newTime,
          appointment.duration,
          appointmentId // excluir esta cita de la verificación
        );

        if (!isAvailable) {
          return {
            success: false,
            message: 'El nuevo horario no está disponible',
            error: 'NEW_TIME_SLOT_UNAVAILABLE'
          };
        }
      }

      // Construir query de actualización
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updates.appointmentDate) {
        updateFields.push('appointment_date = ?');
        updateValues.push(updates.appointmentDate);
      }

      if (updates.appointmentTime) {
        updateFields.push('appointment_time = ?');
        updateValues.push(updates.appointmentTime);
      }

      if (updates.status) {
        updateFields.push('status = ?');
        updateValues.push(updates.status);
      }

      if (updates.notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(updates.notes);
      }

      if (updateFields.length === 0) {
        return {
          success: false,
          message: 'No hay campos para actualizar',
          error: 'NO_UPDATES'
        };
      }

      updateFields.push('updated_at = ?');
      updateValues.push(new Date().toISOString());
      updateValues.push(appointmentId);

      const updateQuery = `UPDATE appointments SET ${updateFields.join(', ')} WHERE id = ?`;
      dbManager.run(updateQuery, updateValues);

      // Obtener la cita actualizada
      const updatedAppointment = await this.getAppointment(appointmentId);
      
      return {
        success: true,
        message: 'Cita actualizada exitosamente',
        appointment: updatedAppointment!
      };

    } catch (error) {
      console.error('Error al actualizar cita:', error);
      return {
        success: false,
        message: 'Error interno al actualizar la cita',
        error: (error as Error).message
      };
    }
  }

  /**
   * Cancelar una cita
   */
  async cancelAppointment(appointmentId: string): Promise<AppointmentResult> {
    try {
      const appointment = await this.getAppointment(appointmentId);
      if (!appointment) {
        return {
          success: false,
          message: 'Cita no encontrada',
          error: 'APPOINTMENT_NOT_FOUND'
        };
      }

      if (appointment.status === 'cancelled') {
        return {
          success: false,
          message: 'La cita ya está cancelada',
          error: 'ALREADY_CANCELLED'
        };
      }

      if (appointment.status === 'completed') {
        return {
          success: false,
          message: 'No se puede cancelar una cita ya completada',
          error: 'ALREADY_COMPLETED'
        };
      }

      // Verificar si es muy tarde para cancelar (24 horas antes)
      const appointmentDateTime = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`);
      const now = new Date();
      const hoursDifference = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursDifference < 24) {
        return {
          success: false,
          message: 'Solo se pueden cancelar citas con al menos 24 horas de anticipación',
          error: 'TOO_LATE_TO_CANCEL'
        };
      }

      const result = await this.updateAppointment(appointmentId, { status: 'cancelled' });
      
      if (result.success) {
        result.message = 'Cita cancelada exitosamente';
      }

      return result;

    } catch (error) {
      console.error('Error al cancelar cita:', error);
      return {
        success: false,
        message: 'Error interno al cancelar la cita',
        error: (error as Error).message
      };
    }
  }

  /**
   * Confirmar una cita
   */
  async confirmAppointment(appointmentId: string): Promise<AppointmentResult> {
    try {
      const appointment = await this.getAppointment(appointmentId);
      if (!appointment) {
        return {
          success: false,
          message: 'Cita no encontrada',
          error: 'APPOINTMENT_NOT_FOUND'
        };
      }

      if (appointment.status === 'confirmed') {
        return {
          success: false,
          message: 'La cita ya está confirmada',
          error: 'ALREADY_CONFIRMED'
        };
      }

      if (appointment.status === 'cancelled') {
        return {
          success: false,
          message: 'No se puede confirmar una cita cancelada',
          error: 'CANNOT_CONFIRM_CANCELLED'
        };
      }

      const result = await this.updateAppointment(appointmentId, { status: 'confirmed' });
      
      if (result.success) {
        result.message = 'Cita confirmada exitosamente';
      }

      return result;

    } catch (error) {
      console.error('Error al confirmar cita:', error);
      return {
        success: false,
        message: 'Error interno al confirmar la cita',
        error: (error as Error).message
      };
    }
  }

  /**
   * Mover/Reprogramar una cita
   */
  async rescheduleAppointment(
    appointmentId: string, 
    newDate: string, 
    newTime: string
  ): Promise<AppointmentResult> {
    try {
      const appointment = await this.getAppointment(appointmentId);
      if (!appointment) {
        return {
          success: false,
          message: 'Cita no encontrada',
          error: 'APPOINTMENT_NOT_FOUND'
        };
      }

      if (appointment.status === 'completed') {
        return {
          success: false,
          message: 'No se puede reprogramar una cita ya completada',
          error: 'CANNOT_RESCHEDULE_COMPLETED'
        };
      }

      if (appointment.status === 'cancelled') {
        return {
          success: false,
          message: 'No se puede reprogramar una cita cancelada',
          error: 'CANNOT_RESCHEDULE_CANCELLED'
        };
      }

      // Verificar disponibilidad del nuevo horario
      const isAvailable = await this.checkAvailability(
        appointment.serviceId,
        newDate,
        newTime,
        appointment.duration,
        appointmentId
      );

      if (!isAvailable) {
        return {
          success: false,
          message: 'El nuevo horario no está disponible',
          error: 'NEW_TIME_SLOT_UNAVAILABLE'
        };
      }

      const result = await this.updateAppointment(appointmentId, {
        appointmentDate: newDate,
        appointmentTime: newTime,
        status: 'scheduled' // Resetear a programada
      });

      if (result.success) {
        result.message = 'Cita reprogramada exitosamente';
      }

      return result;

    } catch (error) {
      console.error('Error al reprogramar cita:', error);
      return {
        success: false,
        message: 'Error interno al reprogramar la cita',
        error: (error as Error).message
      };
    }
  }

  /**
   * Verificar disponibilidad de un horario
   */
  private async checkAvailability(
    serviceId: number,
    date: string,
    time: string,
    duration: number,
    excludeAppointmentId?: string
  ): Promise<boolean> {
    try {
      // Obtener el servicio para verificar horarios de la farmacia
      const service = dbManager.queryFirst<{ duration: number }>(
        'SELECT duration FROM services WHERE id = ?',
        [serviceId]
      );

      if (!service) return false;

      // Verificar que la farmacia esté abierta (24/7 en este caso)
      const appointmentDateTime = new Date(`${date}T${time}`);
      const dayOfWeek = appointmentDateTime.getDay();
      const hour = appointmentDateTime.getHours();

      // Farmacia 24/7, pero horarios de atención de servicios pueden variar
      if (hour < 6 || hour > 23) {
        // Solo servicios de emergencia en horarios nocturnos
        return false;
      }

      // Verificar conflictos con otras citas
      let conflictQuery = `
        SELECT COUNT(*) as count FROM appointments 
        WHERE service_id = ? 
        AND appointment_date = ? 
        AND status NOT IN ('cancelled', 'completed')
        AND (
          (appointment_time <= ? AND appointment_time + duration > ?) OR
          (appointment_time < ? + ? AND appointment_time >= ?)
        )
      `;

      let conflictParams = [serviceId, date, time, time, time, duration, time];

      if (excludeAppointmentId) {
        conflictQuery += ' AND id != ?';
        conflictParams.push(excludeAppointmentId);
      }

      const conflictCount = dbManager.queryFirst<{ count: number }>(
        conflictQuery,
        conflictParams
      )?.count || 0;

      return conflictCount === 0;

    } catch (error) {
      console.error('Error al verificar disponibilidad:', error);
      return false;
    }
  }

  /**
   * Obtener horarios disponibles para un servicio en una fecha
   */
  async getAvailableSlots(serviceId: number, date: string): Promise<string[]> {
    try {
      const service = dbManager.queryFirst<{ duration: number }>(
        'SELECT duration FROM services WHERE id = ?',
        [serviceId]
      );

      if (!service) return [];

      const availableSlots: string[] = [];
      const startHour = 8; // 8:00 AM
      const endHour = 20;  // 8:00 PM
      const slotDuration = 30; // 30 minutos

      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          const isAvailable = await this.checkAvailability(serviceId, date, time, service.duration);
          if (isAvailable) {
            availableSlots.push(time);
          }
        }
      }

      return availableSlots;

    } catch (error) {
      console.error('Error al obtener horarios disponibles:', error);
      return [];
    }
  }

  /**
   * Obtener estadísticas de citas
   */
  async getAppointmentStats(): Promise<{
    total: number;
    scheduled: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    today: number;
    thisWeek: number;
  }> {
    try {
      const total = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM appointments'
      )?.count || 0;

      const scheduled = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM appointments WHERE status = "scheduled"'
      )?.count || 0;

      const confirmed = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM appointments WHERE status = "confirmed"'
      )?.count || 0;

      const completed = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM appointments WHERE status = "completed"'
      )?.count || 0;

      const cancelled = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM appointments WHERE status = "cancelled"'
      )?.count || 0;

      const today = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM appointments WHERE appointment_date = DATE("now")'
      )?.count || 0;

      const thisWeek = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM appointments WHERE appointment_date BETWEEN DATE("now", "weekday 0", "-6 days") AND DATE("now")'
      )?.count || 0;

      return {
        total,
        scheduled,
        confirmed,
        completed,
        cancelled,
        today,
        thisWeek
      };

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return {
        total: 0,
        scheduled: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        today: 0,
        thisWeek: 0
      };
    }
  }
}

// Exportar instancia singleton
export const appointmentManagementService = new AppointmentManagementService();
export default appointmentManagementService;
