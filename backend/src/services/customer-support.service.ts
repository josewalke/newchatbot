import dbManager from '../db/db';
import llmService from './llm.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interfaz para tickets de soporte
 */
export interface SupportTicket {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  category: 'consulta' | 'queja' | 'sugerencia' | 'problema_tecnico' | 'facturacion' | 'cita';
  priority: 'baja' | 'media' | 'alta' | 'urgente';
  subject: string;
  description: string;
  status: 'abierto' | 'en_proceso' | 'esperando_cliente' | 'resuelto' | 'cerrado';
  assignedTo?: string;
  resolution?: string;
  customerSatisfaction?: number; // 1-5
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

/**
 * Interfaz para crear un ticket
 */
export interface CreateTicketRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  category: SupportTicket['category'];
  subject: string;
  description: string;
  priority?: SupportTicket['priority'];
}

/**
 * Interfaz para respuesta de soporte
 */
export interface SupportResponse {
  success: boolean;
  message: string;
  ticket?: SupportTicket;
  suggestions?: string[];
  nextSteps?: string[];
  error?: string;
}

/**
 * Servicio de atención al cliente
 */
export class CustomerSupportService {
  
  /**
   * Crear un nuevo ticket de soporte
   */
  async createTicket(request: CreateTicketRequest): Promise<SupportResponse> {
    try {
      // Analizar la prioridad automáticamente si no se especifica
      const priority = request.priority || await this.analyzePriority(request.description);
      
      // Generar respuesta automática inteligente
      const autoResponse = await this.generateAutoResponse(request.category, request.description);
      
      // Crear el ticket
      const ticketId = uuidv4();
      const now = new Date().toISOString();
      
      const ticket: SupportTicket = {
        id: ticketId,
        customerId: uuidv4(), // ID temporal del cliente
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        customerPhone: request.customerPhone,
        category: request.category,
        priority,
        subject: request.subject,
        description: request.description,
        status: 'abierto',
        createdAt: now,
        updatedAt: now
      };
      
      // Guardar en base de datos
      dbManager.run(`
        INSERT INTO support_tickets (
          id, customer_id, customer_name, customer_email, customer_phone,
          category, priority, subject, description, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ticket.id,
        ticket.customerId,
        ticket.customerName,
        ticket.customerEmail,
        ticket.customerPhone,
        ticket.category,
        ticket.priority,
        ticket.subject,
        ticket.description,
        ticket.status,
        ticket.createdAt,
        ticket.updatedAt
      ]);
      
      return {
        success: true,
        message: autoResponse.message,
        ticket,
        suggestions: autoResponse.suggestions,
        nextSteps: autoResponse.nextSteps
      };
      
    } catch (error) {
      console.error('Error al crear ticket:', error);
      return {
        success: false,
        message: 'Error al procesar tu solicitud. Por favor, contacta con nosotros por teléfono.',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Analizar prioridad automáticamente usando IA
   */
  private async analyzePriority(description: string): Promise<SupportTicket['priority']> {
    try {
      const prompt = `Analiza la siguiente descripción de un ticket de soporte y determina la prioridad (baja, media, alta, urgente).
      
      Criterios:
      - URGENTE: Problemas de salud, medicamentos, citas médicas críticas
      - ALTA: Problemas técnicos que impiden el uso del servicio
      - MEDIA: Consultas generales, sugerencias
      - BAJA: Información general, preguntas básicas
      
      Descripción: "${description}"
      
      Responde solo con: urgente, alta, media o baja`;
      
      const response = await llmService.generateResponse(prompt, undefined, 0.3);
      const priority = response.toLowerCase().trim();
      
      if (['urgente', 'alta', 'media', 'baja'].includes(priority)) {
        return priority as SupportTicket['priority'];
      }
      
      return 'media'; // Por defecto
      
    } catch (error) {
      console.error('Error analizando prioridad:', error);
      return 'media';
    }
  }
  
  /**
   * Generar respuesta automática inteligente
   */
  private async generateAutoResponse(
    category: SupportTicket['category'], 
    description: string
  ): Promise<{
    message: string;
    suggestions: string[];
    nextSteps: string[];
  }> {
    try {
      const prompt = `Genera una respuesta automática profesional y empática para un ticket de soporte.
      
      Categoría: ${category}
      Descripción: "${description}"
      
      La respuesta debe:
      1. Ser empática y profesional
      2. Reconocer el problema del cliente
      3. Proporcionar soluciones inmediatas si es posible
      4. Incluir 2-3 sugerencias útiles
      3. Incluir 2-3 próximos pasos claros
      
      Responde en formato JSON:
      {
        "message": "respuesta principal",
        "suggestions": ["sugerencia1", "sugerencia2", "sugerencia3"],
        "nextSteps": ["paso1", "paso2", "paso3"]
      }`;
      
      const response = await llmService.generateResponse(prompt, undefined, 0.4);
      
      try {
        return JSON.parse(response);
      } catch {
        // Fallback si no se puede parsear
        return this.getFallbackResponse(category);
      }
      
    } catch (error) {
      console.error('Error generando respuesta automática:', error);
      return this.getFallbackResponse(category);
    }
  }
  
  /**
   * Respuesta de fallback por categoría
   */
  private getFallbackResponse(category: SupportTicket['category']): {
    message: string;
    suggestions: string[];
    nextSteps: string[];
  } {
    const responses = {
      consulta: {
        message: 'Gracias por tu consulta. Nuestro equipo especializado revisará tu solicitud y te responderá en las próximas 24 horas.',
        suggestions: [
          'Revisa nuestra sección de FAQ para respuestas rápidas',
          'Utiliza nuestro chat en vivo para consultas urgentes',
          'Consulta nuestro horario de atención'
        ],
        nextSteps: [
          'Recibirás una respuesta detallada por email',
          'Si es urgente, contacta por teléfono',
          'Mantén tu ticket actualizado con información adicional'
        ]
      },
      queja: {
        message: 'Lamentamos que hayas tenido una experiencia negativa. Tu feedback es importante para nosotros y lo revisaremos personalmente.',
        suggestions: [
          'Proporciona detalles específicos del incidente',
          'Incluye fechas y nombres de personas involucradas',
          'Menciona qué esperabas que sucediera'
        ],
        nextSteps: [
          'Un supervisor revisará tu caso personalmente',
          'Recibirás una respuesta en 24-48 horas',
          'Te contactaremos para resolver el problema'
        ]
      },
      sugerencia: {
        message: '¡Excelente! Agradecemos que compartas tus ideas para mejorar nuestro servicio. Cada sugerencia es valiosa para nosotros.',
        suggestions: [
          'Describe cómo tu sugerencia beneficiaría a otros clientes',
          'Proporciona ejemplos específicos si es posible',
          'Menciona si has visto algo similar en otros servicios'
        ],
        nextSteps: [
          'Tu sugerencia será evaluada por nuestro equipo',
          'Recibirás actualizaciones sobre su implementación',
          'Te notificaremos si se implementa'
        ]
      },
      problema_tecnico: {
        message: 'Entendemos que los problemas técnicos pueden ser frustrantes. Nuestro equipo de IT está trabajando para resolverlo rápidamente.',
        suggestions: [
          'Intenta refrescar la página o cerrar/abrir el navegador',
          'Verifica tu conexión a internet',
          'Limpia el caché del navegador'
        ],
        nextSteps: [
          'Nuestro equipo técnico investigará el problema',
          'Recibirás actualizaciones sobre el progreso',
          'Te notificaremos cuando esté resuelto'
        ]
      },
      facturacion: {
        message: 'Entendemos la importancia de resolver problemas de facturación rápidamente. Nuestro equipo financiero revisará tu caso.',
        suggestions: [
          'Revisa si tienes recibos o confirmaciones de pago',
          'Verifica que los datos de facturación sean correctos',
          'Consulta tu historial de transacciones'
        ],
        nextSteps: [
          'Nuestro equipo financiero revisará tu caso',
          'Recibirás una respuesta en 24-48 horas',
          'Te contactaremos para resolver cualquier discrepancia'
        ]
      },
      cita: {
        message: 'Entendemos que las citas son importantes. Te ayudaremos a resolver cualquier problema con tu programación.',
        suggestions: [
          'Verifica la fecha y hora de tu cita',
          'Revisa si recibiste confirmación por email',
          'Consulta nuestra política de cancelación'
        ],
        nextSteps: [
          'Nuestro equipo de citas revisará tu caso',
          'Recibirás una respuesta en 2-4 horas',
          'Te ayudaremos a reprogramar si es necesario'
        ]
      }
    };
    
    return responses[category] || responses.consulta;
  }
  
  /**
   * Obtener tickets de un cliente
   */
  async getCustomerTickets(customerEmail: string): Promise<SupportTicket[]> {
    try {
      const tickets = dbManager.query<SupportTicket>(
        `SELECT * FROM support_tickets WHERE customer_email = ? ORDER BY created_at DESC`,
        [customerEmail]
      );
      
      return tickets;
    } catch (error) {
      console.error('Error al obtener tickets del cliente:', error);
      return [];
    }
  }
  
  /**
   * Obtener un ticket específico
   */
  async getTicket(ticketId: string): Promise<SupportTicket | null> {
    try {
      const ticket = dbManager.queryFirst<SupportTicket>(
        'SELECT * FROM support_tickets WHERE id = ?',
        [ticketId]
      );
      
      return ticket || null;
    } catch (error) {
      console.error('Error al obtener ticket:', error);
      return null;
    }
  }
  
  /**
   * Actualizar estado de un ticket
   */
  async updateTicketStatus(
    ticketId: string, 
    status: SupportTicket['status'],
    resolution?: string
  ): Promise<SupportResponse> {
    try {
      const ticket = await this.getTicket(ticketId);
      if (!ticket) {
        return {
          success: false,
          message: 'Ticket no encontrado',
          error: 'TICKET_NOT_FOUND'
        };
      }
      
      const now = new Date().toISOString();
      const resolvedAt = status === 'resuelto' ? now : undefined;
      
      dbManager.run(`
        UPDATE support_tickets 
        SET status = ?, resolution = ?, resolved_at = ?, updated_at = ?
        WHERE id = ?
      `, [status, resolution || null, resolvedAt, now, ticketId]);
      
      const updatedTicket = await this.getTicket(ticketId);
      
      return {
        success: true,
        message: `Ticket ${status === 'resuelto' ? 'resuelto' : 'actualizado'} exitosamente`,
        ticket: updatedTicket!
      };
      
    } catch (error) {
      console.error('Error al actualizar ticket:', error);
      return {
        success: false,
        message: 'Error al actualizar el ticket',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Asignar ticket a un agente
   */
  async assignTicket(ticketId: string, agentId: string): Promise<SupportResponse> {
    try {
      const ticket = await this.getTicket(ticketId);
      if (!ticket) {
        return {
          success: false,
          message: 'Ticket no encontrado',
          error: 'TICKET_NOT_FOUND'
        };
      }
      
      dbManager.run(`
        UPDATE support_tickets 
        SET assigned_to = ?, updated_at = ?
        WHERE id = ?
      `, [agentId, new Date().toISOString(), ticketId]);
      
      return {
        success: true,
        message: 'Ticket asignado exitosamente'
      };
      
    } catch (error) {
      console.error('Error al asignar ticket:', error);
      return {
        success: false,
        message: 'Error al asignar el ticket',
        error: (error as Error).message
      };
      }
  }
  
  /**
   * Calificar satisfacción del cliente
   */
  async rateTicket(ticketId: string, rating: number): Promise<SupportResponse> {
    try {
      if (rating < 1 || rating > 5) {
        return {
          success: false,
          message: 'La calificación debe ser entre 1 y 5',
          error: 'INVALID_RATING'
        };
      }
      
      dbManager.run(`
        UPDATE support_tickets 
        SET customer_satisfaction = ?, updated_at = ?
        WHERE id = ?
      `, [rating, new Date().toISOString(), ticketId]);
      
      return {
        success: true,
        message: 'Gracias por tu calificación. Tu feedback nos ayuda a mejorar.'
      };
      
    } catch (error) {
      console.error('Error al calificar ticket:', error);
      return {
        success: false,
        message: 'Error al procesar tu calificación',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Obtener estadísticas de soporte
   */
  async getSupportStats(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    averageResolutionTime: number;
    averageSatisfaction: number;
    byCategory: { [key: string]: number };
    byPriority: { [key: string]: number };
  }> {
    try {
      const total = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM support_tickets'
      )?.count || 0;
      
      const open = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM support_tickets WHERE status = "abierto"'
      )?.count || 0;
      
      const inProgress = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM support_tickets WHERE status = "en_proceso"'
      )?.count || 0;
      
      const resolved = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM support_tickets WHERE status = "resuelto"'
      )?.count || 0;
      
      const averageSatisfaction = dbManager.queryFirst<{ avg: number }>(
        'SELECT AVG(customer_satisfaction) as avg FROM support_tickets WHERE customer_satisfaction IS NOT NULL'
      )?.avg || 0;
      
      // Estadísticas por categoría
      const byCategory = dbManager.query<{ category: string; count: number }>(
        'SELECT category, COUNT(*) as count FROM support_tickets GROUP BY category'
      );
      
      const categoryStats: { [key: string]: number } = {};
      byCategory.forEach(item => {
        categoryStats[item.category] = item.count;
      });
      
      // Estadísticas por prioridad
      const byPriority = dbManager.query<{ priority: string; count: number }>(
        'SELECT priority, COUNT(*) as count FROM support_tickets GROUP BY priority'
      );
      
      const priorityStats: { [key: string]: number } = {};
      byPriority.forEach(item => {
        priorityStats[item.priority] = item.count;
      });
      
      return {
        total,
        open,
        inProgress,
        resolved,
        averageResolutionTime: 0, // TODO: Implementar cálculo
        averageSatisfaction: Math.round(averageSatisfaction * 100) / 100,
        byCategory: categoryStats,
        byPriority: priorityStats
      };
      
    } catch (error) {
      console.error('Error al obtener estadísticas de soporte:', error);
      return {
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        averageResolutionTime: 0,
        averageSatisfaction: 0,
        byCategory: {},
        byPriority: {}
      };
    }
  }
  
  /**
   * Buscar tickets por texto
   */
  async searchTickets(query: string): Promise<SupportTicket[]> {
    try {
      const tickets = dbManager.query<SupportTicket>(
        `SELECT * FROM support_tickets 
         WHERE subject LIKE ? OR description LIKE ? OR customer_name LIKE ?
         ORDER BY created_at DESC`,
        [`%${query}%`, `%${query}%`, `%${query}%`]
      );
      
      return tickets;
    } catch (error) {
      console.error('Error al buscar tickets:', error);
      return [];
    }
  }
}

// Exportar instancia singleton
export const customerSupportService = new CustomerSupportService();
export default customerSupportService;
