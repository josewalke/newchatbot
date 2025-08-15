import { Request, Response } from 'express';
import customerSupportService from '../services/customer-support.service';
import { cleanChatbotResponse } from '../utils/text-processing';

/**
 * Controlador para soporte al cliente
 */
export class CustomerSupportController {

  /**
   * Crear un nuevo ticket de soporte
   */
  async createTicket(req: Request, res: Response): Promise<void> {
    try {
      const { customerName, customerEmail, customerPhone, category, subject, description, priority } = req.body;

      // Validaciones básicas
      if (!customerName || !customerEmail || !category || !subject || !description) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos requeridos: customerName, customerEmail, category, subject, description'
        });
        return;
      }

      // Validar categoría
      const validCategories = ['consulta', 'queja', 'sugerencia', 'problema_tecnico', 'facturacion', 'cita'];
      if (!validCategories.includes(category)) {
        res.status(400).json({
          success: false,
          message: 'Categoría inválida. Categorías válidas: ' + validCategories.join(', ')
        });
        return;
      }

      // Validar prioridad si se proporciona
      if (priority) {
        const validPriorities = ['baja', 'media', 'alta', 'urgente'];
        if (!validPriorities.includes(priority)) {
          res.status(400).json({
            success: false,
            message: 'Prioridad inválida. Prioridades válidas: ' + validPriorities.join(', ')
          });
          return;
        }
      }

      const result = await customerSupportService.createTicket({
        customerName,
        customerEmail,
        customerPhone: customerPhone || '',
        category,
        subject,
        description,
        priority
      });

      if (result.success) {
        res.status(201).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          ticket: result.ticket,
          suggestions: result.suggestions,
          nextSteps: result.nextSteps
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en createTicket:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener tickets de un cliente
   */
  async getCustomerTickets(req: Request, res: Response): Promise<void> {
    try {
      const { customerEmail } = req.params;

      if (!customerEmail) {
        res.status(400).json({
          success: false,
          message: 'Email del cliente es requerido'
        });
        return;
      }

      const tickets = await customerSupportService.getCustomerTickets(customerEmail);

      res.status(200).json({
        success: true,
        data: tickets,
        count: tickets.length
      });

    } catch (error) {
      console.error('Error en getCustomerTickets:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener un ticket específico
   */
  async getTicket(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;

      if (!ticketId) {
        res.status(400).json({
          success: false,
          message: 'ID del ticket es requerido'
        });
        return;
      }

      const ticket = await customerSupportService.getTicket(ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          message: 'Ticket no encontrado'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: ticket
      });

    } catch (error) {
      console.error('Error en getTicket:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Actualizar estado de un ticket
   */
  async updateTicketStatus(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;
      const { status, resolution } = req.body;

      if (!ticketId) {
        res.status(400).json({
          success: false,
          message: 'ID del ticket es requerido'
        });
        return;
      }

      if (!status) {
        res.status(400).json({
          success: false,
          message: 'Estado es requerido'
        });
        return;
      }

      // Validar estado
      const validStatuses = ['abierto', 'en_proceso', 'esperando_cliente', 'resuelto', 'cerrado'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Estado inválido. Estados válidos: ' + validStatuses.join(', ')
        });
        return;
      }

      const result = await customerSupportService.updateTicketStatus(ticketId, status, resolution);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          ticket: result.ticket
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en updateTicketStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Asignar ticket a un agente
   */
  async assignTicket(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;
      const { agentId } = req.body;

      if (!ticketId) {
        res.status(400).json({
          success: false,
          message: 'ID del ticket es requerido'
        });
        return;
      }

      if (!agentId) {
        res.status(400).json({
          success: false,
          message: 'ID del agente es requerido'
        });
        return;
      }

      const result = await customerSupportService.assignTicket(ticketId, agentId);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message)
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en assignTicket:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Calificar satisfacción del cliente
   */
  async rateTicket(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;
      const { rating } = req.body;

      if (!ticketId) {
        res.status(400).json({
          success: false,
          message: 'ID del ticket es requerido'
        });
        return;
      }

      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          message: 'Calificación debe ser un número entre 1 y 5'
        });
        return;
      }

      const result = await customerSupportService.rateTicket(ticketId, rating);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message)
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en rateTicket:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener estadísticas de soporte
   */
  async getSupportStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await customerSupportService.getSupportStats();

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error en getSupportStats:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Buscar tickets por texto
   */
  async searchTickets(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Query de búsqueda es requerido'
        });
        return;
      }

      const tickets = await customerSupportService.searchTickets(query);

      res.status(200).json({
        success: true,
        data: tickets,
        count: tickets.length,
        query
      });

    } catch (error) {
      console.error('Error en searchTickets:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener tickets por estado
   */
  async getTicketsByStatus(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.params;

      if (!status) {
        res.status(400).json({
          success: false,
          message: 'Estado es requerido'
        });
        return;
      }

      // Validar estado
      const validStatuses = ['abierto', 'en_proceso', 'esperando_cliente', 'resuelto', 'cerrado'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Estado inválido. Estados válidos: ' + validStatuses.join(', ')
        });
        return;
      }

      // Obtener tickets por estado usando búsqueda
      const tickets = await customerSupportService.searchTickets(`status:${status}`);

      res.status(200).json({
        success: true,
        data: tickets,
        count: tickets.length,
        status
      });

    } catch (error) {
      console.error('Error en getTicketsByStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener tickets por prioridad
   */
  async getTicketsByPriority(req: Request, res: Response): Promise<void> {
    try {
      const { priority } = req.params;

      if (!priority) {
        res.status(400).json({
          success: false,
          message: 'Prioridad es requerida'
        });
        return;
      }

      // Validar prioridad
      const validPriorities = ['baja', 'media', 'alta', 'urgente'];
      if (!validPriorities.includes(priority)) {
        res.status(400).json({
          success: false,
          message: 'Prioridad inválida. Prioridades válidas: ' + validPriorities.join(', ')
        });
        return;
      }

      // Obtener tickets por prioridad usando búsqueda
      const tickets = await customerSupportService.searchTickets(`priority:${priority}`);

      res.status(200).json({
        success: true,
        data: tickets,
        count: tickets.length,
        priority
      });

    } catch (error) {
      console.error('Error en getTicketsByPriority:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener tickets por categoría
   */
  async getTicketsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params;

      if (!category) {
        res.status(400).json({
          success: false,
          message: 'Categoría es requerida'
        });
        return;
      }

      // Validar categoría
      const validCategories = ['consulta', 'queja', 'sugerencia', 'problema_tecnico', 'facturacion', 'cita'];
      if (!validCategories.includes(category)) {
        res.status(400).json({
          success: false,
          message: 'Categoría inválida. Categorías válidas: ' + validCategories.join(', ')
        });
        return;
      }

      // Obtener tickets por categoría usando búsqueda
      const tickets = await customerSupportService.searchTickets(`category:${category}`);

      res.status(200).json({
        success: true,
        data: tickets,
        count: tickets.length,
        category
      });

    } catch (error) {
      console.error('Error en getTicketsByCategory:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }
}

// Exportar instancia singleton
export const customerSupportController = new CustomerSupportController();
export default customerSupportController;
