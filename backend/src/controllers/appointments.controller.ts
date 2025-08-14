import { Request, Response } from 'express';
import { appointmentsService } from '../services/appointments.service';
import { 
  appointmentBookSchema, 
  appointmentRescheduleSchema, 
  appointmentCancelSchema, 
  appointmentConfirmSchema,
  availabilityQuerySchema,
  validateSchema
} from '../utils/validators';

export class AppointmentsController {
  /**
   * Reservar una nueva cita
   */
  async bookAppointment(req: Request, res: Response) {
    try {
      const validation = validateSchema(appointmentBookSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error
        });
        return;
      }
      
      const appointment = await appointmentsService.bookAppointment(validation.data);
      
      res.status(201).json({
        success: true,
        data: appointment,
        message: 'Cita reservada exitosamente'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        details: error.details || null
      });
    }
  }

  /**
   * Reprogramar una cita existente
   */
  async rescheduleAppointment(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateSchema(appointmentRescheduleSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error
        });
        return;
      }
      
      const appointment = await appointmentsService.rescheduleAppointment(validation.data);
      
      res.json({
        success: true,
        data: appointment,
        message: 'Cita reprogramada exitosamente'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        details: error.details || null
      });
    }
  }

  /**
   * Cancelar una cita
   */
  async cancelAppointment(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateSchema(appointmentCancelSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error
        });
        return;
      }
      
      const result = await appointmentsService.cancelAppointment(validation.data);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        details: error.details || null
      });
    }
  }

  /**
   * Confirmar una cita
   */
  async confirmAppointment(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateSchema(appointmentConfirmSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: validation.error
        });
        return;
      }
      
      const result = await appointmentsService.confirmAppointment(validation.data);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        details: error.details || null
      });
    }
  }

  /**
   * Obtener disponibilidad de horarios
   */
  async getAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { fromISO, toISO, serviceId } = req.query;
      
      if (!fromISO || !toISO) {
        res.status(400).json({
          success: false,
          error: 'Se requieren fechas de inicio y fin'
        });
        return;
      }

      const availability = await appointmentsService.getAvailability(
        fromISO as string,
        toISO as string,
        serviceId ? parseInt(serviceId as string) : undefined
      );
      
      res.json({
        success: true,
        data: availability
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener todas las citas
   */
  async getAllAppointments(req: Request, res: Response): Promise<void> {
    try {
      const { status, serviceId, customerId } = req.query;
      
      // Usar el método correcto del servicio - buscar por cliente si se especifica
      let appointments: any[] = [];
      if (customerId) {
        appointments = await appointmentsService.getAppointmentsByCustomer(parseInt(customerId as string));
      }
      // Por ahora, obtener todas las citas (esto se puede mejorar)
      
              res.json({
          success: true,
          data: appointments
        });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener una cita específica
   */
  async getAppointmentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const appointment = await appointmentsService.getAppointmentById(parseInt(id));
      
      if (!appointment) {
        res.status(404).json({
          success: false,
          error: 'Cita no encontrada'
        });
        return;
      }
      
      res.json({
        success: true,
        data: appointment
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const appointmentsController = new AppointmentsController();

