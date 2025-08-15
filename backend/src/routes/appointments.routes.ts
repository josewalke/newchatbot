import { Router } from 'express';
import { appointmentsController } from '../controllers/appointments.controller';

const router = Router();

/**
 * Rutas para gestión de citas
 */

// Obtener horarios disponibles
router.get('/available-slots', appointmentsController.getAvailableSlots);

// Obtener estadísticas de citas
router.get('/stats', appointmentsController.getAppointmentStats);

// Obtener citas de un cliente
router.get('/customer/:customerEmail', appointmentsController.getCustomerAppointments);

// Crear una nueva cita
router.post('/', appointmentsController.createAppointment);

// Obtener una cita específica
router.get('/:appointmentId', appointmentsController.getAppointment);

// Actualizar una cita
router.put('/:appointmentId', appointmentsController.updateAppointment);

// Cancelar una cita
router.delete('/:appointmentId', appointmentsController.cancelAppointment);

// Confirmar una cita
router.post('/:appointmentId/confirm', appointmentsController.confirmAppointment);

// Reprogramar una cita
router.post('/:appointmentId/reschedule', appointmentsController.rescheduleAppointment);

export default router;

