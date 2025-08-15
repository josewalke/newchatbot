import { Request, Response } from 'express';
import appointmentManagementService from '../services/appointment-management.service';
import { cleanChatbotResponse } from '../utils/text-processing';

/**
 * Controlador para gestión de citas
 */
export class AppointmentsController {

  /**
   * Crear una nueva cita
   */
  async createAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { customerName, customerEmail, customerPhone, serviceId, appointmentDate, appointmentTime, notes } = req.body;

      // Validaciones básicas
      if (!customerName || !customerEmail || !customerPhone || !serviceId || !appointmentDate || !appointmentTime) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos requeridos: customerName, customerEmail, customerPhone, serviceId, appointmentDate, appointmentTime'
        });
        return;
      }

      const result = await appointmentManagementService.createAppointment({
        customerName,
        customerEmail,
        customerPhone,
        serviceId,
        appointmentDate,
        appointmentTime,
        notes
      });

      if (result.success) {
        res.status(201).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          appointment: result.appointment
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en createAppointment:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener citas de un cliente
   */
  async getCustomerAppointments(req: Request, res: Response): Promise<void> {
    try {
      const { customerEmail } = req.params;

      if (!customerEmail) {
        res.status(400).json({
          success: false,
          message: 'Email del cliente es requerido'
        });
        return;
      }

      const appointments = await appointmentManagementService.getCustomerAppointments(customerEmail);

      res.status(200).json({
        success: true,
        data: appointments,
        count: appointments.length
      });

    } catch (error) {
      console.error('Error en getCustomerAppointments:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener una cita específica
   */
  async getAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;

      if (!appointmentId) {
        res.status(400).json({
          success: false,
          message: 'ID de la cita es requerido'
        });
        return;
      }

      const appointment = await appointmentManagementService.getAppointment(appointmentId);

      if (!appointment) {
        res.status(404).json({
          success: false,
          message: 'Cita no encontrada'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: appointment
      });

    } catch (error) {
      console.error('Error en getAppointment:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Actualizar una cita
   */
  async updateAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;
      const updates = req.body;

      if (!appointmentId) {
        res.status(400).json({
          success: false,
          message: 'ID de la cita es requerido'
        });
        return;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          message: 'No hay campos para actualizar'
        });
        return;
      }

      const result = await appointmentManagementService.updateAppointment(appointmentId, updates);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          appointment: result.appointment
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en updateAppointment:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Cancelar una cita
   */
  async cancelAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;

      if (!appointmentId) {
        res.status(400).json({
          success: false,
          message: 'ID de la cita es requerido'
        });
        return;
      }

      const result = await appointmentManagementService.cancelAppointment(appointmentId);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          appointment: result.appointment
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en cancelAppointment:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Confirmar una cita
   */
  async confirmAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;

      if (!appointmentId) {
        res.status(400).json({
          success: false,
          message: 'ID de la cita es requerido'
        });
        return;
      }

      const result = await appointmentManagementService.confirmAppointment(appointmentId);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          appointment: result.appointment
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en confirmAppointment:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Reprogramar una cita
   */
  async rescheduleAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;
      const { newDate, newTime } = req.body;

      if (!appointmentId) {
        res.status(400).json({
          success: false,
          message: 'ID de la cita es requerido'
        });
        return;
      }

      if (!newDate || !newTime) {
        res.status(400).json({
          success: false,
          message: 'Nueva fecha y hora son requeridas'
        });
        return;
      }

      const result = await appointmentManagementService.rescheduleAppointment(appointmentId, newDate, newTime);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          appointment: result.appointment
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en rescheduleAppointment:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener horarios disponibles
   */
  async getAvailableSlots(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId, date } = req.query;

      if (!serviceId || !date) {
        res.status(400).json({
          success: false,
          message: 'serviceId y date son requeridos'
        });
        return;
      }

      const slots = await appointmentManagementService.getAvailableSlots(Number(serviceId), String(date));

      res.status(200).json({
        success: true,
        data: {
          serviceId: Number(serviceId),
          date: String(date),
          availableSlots: slots
        }
      });

    } catch (error) {
      console.error('Error en getAvailableSlots:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener estadísticas de citas
   */
  async getAppointmentStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await appointmentManagementService.getAppointmentStats();

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error en getAppointmentStats:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }
}

// Exportar instancia singleton
export const appointmentsController = new AppointmentsController();
export default appointmentsController;

