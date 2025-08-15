import { Router } from 'express';
import customerSupportController from '../controllers/customer-support.controller';

const router = Router();

/**
 * Rutas para soporte al cliente
 */

// Crear un nuevo ticket de soporte
router.post('/tickets', customerSupportController.createTicket);

// Obtener tickets de un cliente
router.get('/tickets/customer/:customerEmail', customerSupportController.getCustomerTickets);

// Obtener un ticket específico
router.get('/tickets/:ticketId', customerSupportController.getTicket);

// Actualizar estado de un ticket
router.put('/tickets/:ticketId/status', customerSupportController.updateTicketStatus);

// Asignar ticket a un agente
router.put('/tickets/:ticketId/assign', customerSupportController.assignTicket);

// Calificar satisfacción del cliente
router.put('/tickets/:ticketId/rate', customerSupportController.rateTicket);

// Obtener estadísticas de soporte
router.get('/stats', customerSupportController.getSupportStats);

// Buscar tickets por texto
router.get('/tickets/search', customerSupportController.searchTickets);

// Obtener tickets por estado
router.get('/tickets/status/:status', customerSupportController.getTicketsByStatus);

// Obtener tickets por prioridad
router.get('/tickets/priority/:priority', customerSupportController.getTicketsByPriority);

// Obtener tickets por categoría
router.get('/tickets/category/:category', customerSupportController.getTicketsByCategory);

export default router;
