import { Router } from 'express';
import { appointmentsController } from '../controllers/appointments.controller';

const router = Router();

/**
 * @route POST /api/appointments/book
 * @desc Reservar una nueva cita
 * @access Public
 */
router.post('/book', appointmentsController.bookAppointment);

/**
 * @route POST /api/appointments/reschedule
 * @desc Reprogramar una cita existente
 * @access Public
 */
router.post('/reschedule', appointmentsController.rescheduleAppointment);

/**
 * @route POST /api/appointments/cancel
 * @desc Cancelar una cita
 * @access Public
 */
router.post('/cancel', appointmentsController.cancelAppointment);

/**
 * @route POST /api/appointments/confirm
 * @desc Confirmar una cita
 * @access Public
 */
router.post('/confirm', appointmentsController.confirmAppointment);

/**
 * @route GET /api/appointments/availability
 * @desc Obtener disponibilidad de horarios
 * @access Public
 */
router.get('/availability', appointmentsController.getAvailability);

/**
 * @route GET /api/appointments
 * @desc Obtener todas las citas (con filtros opcionales)
 * @access Public
 */
router.get('/', appointmentsController.getAllAppointments);

/**
 * @route GET /api/appointments/:id
 * @desc Obtener una cita específica
 * @access Public
 */
router.get('/:id', appointmentsController.getAppointmentById);

export default router;

