import dbManager from '../db/db';
import llmService from './llm.service';
import appointmentsService from './appointments.service';
import { OperationalError } from '../middlewares/error.middleware';

/**
 * Interfaz para el proceso de venta
 */
interface SalesProcess {
  stage: 'awareness' | 'interest' | 'desire' | 'action' | 'closing';
  customerId?: number;
  serviceId?: number;
  objections: string[];
  benefits: string[];
  urgency: number; // 1-10
  budget: number;
  timeline: string;
}

/**
 * Interfaz para propuestas de venta
 */
interface SalesProposal {
  serviceId: number;
  serviceName: string;
  price: number;
  duration: number;
  benefits: string[];
  urgency: string;
  specialOffer?: string;
  nextStep: string;
}

/**
 * Servicio de ventas automáticas para el chatbot
 */
export class SalesService {
  
  /**
   * Inicia el proceso de venta
   */
  async startSalesProcess(userMessage: string, userId: string): Promise<{
    stage: string;
    message: string;
    nextAction: string;
    proposals?: SalesProposal[];
  }> {
    try {
      // Analizar la intención del usuario
      const intent = await this.analyzeSalesIntent(userMessage);
      
      // Determinar la etapa del proceso de venta
      const stage = this.determineSalesStage(userMessage, intent);
      
      // Generar respuesta apropiada para la etapa
      const response = await this.generateStageResponse(stage, intent, userId);
      
      // Generar propuestas de venta si es apropiado
      const proposals = stage === 'desire' || stage === 'action' 
        ? await this.generateSalesProposals(intent, userId)
        : undefined;
      
      return {
        stage,
        message: response,
        nextAction: this.getNextAction(stage),
        proposals
      };
      
    } catch (error) {
      console.error('Error en proceso de venta:', error);
      throw new OperationalError('Error en el proceso de venta', 500);
    }
  }

  /**
   * Analiza la intención de venta del usuario
   */
  private async analyzeSalesIntent(message: string): Promise<{
    service: string;
    urgency: number;
    budget: number;
    timeline: string;
    objections: string[];
  }> {
    const prompt = `Analiza la siguiente intención de compra y extrae:
    - Servicio deseado
    - Urgencia (1-10)
    - Presupuesto aproximado
    - Timeline
    - Posibles objeciones
    
    Mensaje: "${message}"
    
    Responde en formato JSON:
    {
      "service": "nombre del servicio",
      "urgency": número,
      "budget": número,
      "timeline": "texto",
      "objections": ["objeción1", "objeción2"]
    }`;
    
    const response = await llmService.generateResponse(prompt, undefined, 0.3);
    
    try {
      return JSON.parse(response);
    } catch {
      // Fallback si no se puede parsear
      return {
        service: 'consulta farmacéutica',
        urgency: 5,
        budget: 100,
        timeline: 'próximas semanas',
        objections: []
      };
    }
  }

  /**
   * Determina la etapa del proceso de venta
   */
  private determineSalesStage(message: string, intent: any): string {
    const lowerMessage = message.toLowerCase();
    
    // Palabras clave para cada etapa
    if (lowerMessage.includes('qué') || lowerMessage.includes('cuáles') || lowerMessage.includes('información')) {
      return 'awareness';
    }
    
    if (lowerMessage.includes('me gustaría') || lowerMessage.includes('interesado') || lowerMessage.includes('precio')) {
      return 'interest';
    }
    
    if (lowerMessage.includes('necesito') || lowerMessage.includes('urgente') || lowerMessage.includes('problema')) {
      return 'desire';
    }
    
    if (lowerMessage.includes('reservar') || lowerMessage.includes('cita') || lowerMessage.includes('agendar')) {
      return 'action';
    }
    
    if (lowerMessage.includes('confirmar') || lowerMessage.includes('pagar') || lowerMessage.includes('finalizar')) {
      return 'closing';
    }
    
    return 'interest'; // Por defecto
  }
  
  /**
   * Genera respuesta apropiada para cada etapa
   */
  private async generateStageResponse(stage: string, intent: any, userId: string): Promise<string> {
    switch (stage) {
      case 'awareness':
        return this.generateAwarenessResponse(intent);
      
      case 'interest':
        return this.generateInterestResponse(intent);
      
      case 'desire':
        return this.generateDesireResponse(intent);
      
      case 'action':
        return this.generateActionResponse(intent, userId);
      
      case 'closing':
        return this.generateClosingResponse(intent, userId);
      
      default:
        return this.generateInterestResponse(intent);
    }
  }

  /**
   * Genera respuesta para etapa de conciencia
   */
  private generateAwarenessResponse(intent: any): string {
    return `¡Perfecto! 🌟 Te explico nuestros servicios especializados:\n\n` +
           `**🌟 Consulta Farmacéutica (GRATIS - 15 min)**\n` +
           `• Evaluación completa de tu situación\n` +
           `• Identificación de necesidades específicas\n` +
           `• Plan de acción personalizado\n\n` +
           `**🌟 Sesión Terapéutica (80€ - 60 min)**\n` +
           `• Trabajo en profundidad en áreas específicas\n` +
           `• Técnicas personalizadas para tu caso\n` +
           `• Seguimiento continuo de progreso\n\n` +
           `**🌟 Evaluación Inicial (120€ - 90 min)**\n` +
           `• Evaluación completa y detallada\n` +
           `• Recomendaciones personalizadas\n` +
           `• Plan de tratamiento a largo plazo\n\n` +
           `¿Cuál de estos servicios te interesa más? 🤔`;
  }
  
  /**
   * Genera respuesta para etapa de interés
   */
  private generateInterestResponse(intent: any): string {
            const service = intent.service || 'consulta farmacéutica';
    
    return `¡Excelente elección! 🎯 El servicio de **${service}** es perfecto para tu caso.\n\n` +
           `**¿Por qué es ideal para ti?**\n` +
           `• ✅ Resultados comprobados en casos similares\n` +
           `• ✅ Enfoque personalizado y adaptado\n` +
           `• ✅ Flexibilidad de horarios\n` +
           `• ✅ Seguimiento continuo\n\n` +
           `**¿Te gustaría conocer más detalles específicos** sobre este servicio o prefieres que te ayude a **agendar una cita** directamente? 📅`;
  }
  
  /**
   * Genera respuesta para etapa de deseo
   */
  private generateDesireResponse(intent: any): string {
    const urgency = intent.urgency || 5;
    
    if (urgency >= 8) {
      return `¡Entiendo la urgencia! 🚨 Es importante actuar rápido para mejores resultados.\n\n` +
             `**Oferta especial por urgencia:**\n` +
             `• 📅 Cita en las próximas 24-48 horas\n` +
             `• 💰 15% de descuento en la primera sesión\n` +
             `• ⚡ Prioridad en el calendario\n\n` +
             `**¿Quieres que reserve tu cita AHORA MISMO** para aprovechar esta oferta especial? 🎯`;
    }
    
    return `¡Perfecto! 🎉 Veo que estás listo para tomar acción.\n\n` +
           `**Próximos pasos para ti:**\n` +
           `• 📅 Seleccionar fecha y hora preferida\n` +
           `• 💳 Confirmar reserva (sin compromiso)\n` +
           `• 📱 Recibir confirmación inmediata\n\n` +
           `**¿Empezamos con la reserva?** Te guío paso a paso para que sea súper fácil! 🚀`;
  }
  
  /**
   * Genera respuesta para etapa de acción
   */
  private async generateActionResponse(intent: any, userId: string): Promise<string> {
    // Generar propuestas de venta
    const proposals = await this.generateSalesProposals(intent, userId);
    
    let response = `¡Fantástico! 🎯 Vamos a cerrar tu reserva paso a paso.\n\n`;
    
    if (proposals && proposals.length > 0) {
      response += `**Opciones disponibles para ti:**\n\n`;
      
      proposals.forEach((proposal, index) => {
        response += `**${index + 1}. ${proposal.serviceName}**\n`;
        response += `   💰 Precio: ${proposal.price}€\n`;
        response += `   ⏱️ Duración: ${proposal.duration} min\n`;
        response += `   ${proposal.specialOffer ? `🎁 ${proposal.specialOffer}\n` : ''}`;
        response += `   📋 ${proposal.nextStep}\n\n`;
      });
      
      response += `**¿Cuál opción prefieres?** Responde con el número o el nombre del servicio. 🎯`;
    } else {
      response += `**Vamos a agendar tu cita ahora mismo!** 📅\n\n` +
                  `¿Qué día te viene mejor? Tenemos disponibilidad esta semana y la próxima.`;
    }
    
    return response;
  }
  
  /**
   * Genera respuesta para etapa de cierre
   */
  private async generateClosingResponse(intent: any, userId: string): Promise<string> {
    return `¡Excelente decisión! 🎉 Estás a un paso de transformar tu vida.\n\n` +
           `**Resumen de tu reserva:**\n` +
           `• ✅ Servicio seleccionado\n` +
           `• ✅ Fecha y hora confirmadas\n` +
           `• ✅ Precio acordado\n\n` +
           `**Último paso:** Confirmar tu reserva\n\n` +
           `**¿Confirmas que quieres proceder con la reserva?** Una vez confirmado, recibirás:\n` +
           `• 📧 Email de confirmación\n` +
           `• 📱 SMS de recordatorio\n` +
           `• 🗓️ Evento en tu calendario\n\n` +
           `**Responde "SÍ" para confirmar** o "NO" si quieres hacer algún cambio. 🎯`;
  }
  
  /**
   * Genera propuestas de venta personalizadas
   */
  private async generateSalesProposals(intent: any, userId: string): Promise<SalesProposal[]> {
    try {
      // Obtener servicios disponibles
      const services = dbManager.query<{
        id: number;
        name: string;
        duration_min: number;
        price_cents: number;
        active: number;
      }>('SELECT * FROM services WHERE active = 1 ORDER BY price_cents ASC');
      
      const proposals: SalesProposal[] = [];
      
      services.forEach(service => {
        const price = service.price_cents / 100;
        const urgency = intent.urgency || 5;
        
        // Crear propuesta personalizada
        const proposal: SalesProposal = {
          serviceId: service.id,
          serviceName: service.name,
          price,
          duration: service.duration_min,
          benefits: this.generateBenefits(service.name, intent),
          urgency: this.generateUrgency(urgency),
          nextStep: this.generateNextStep(service.name)
        };
        
        // Agregar ofertas especiales
        if (urgency >= 8) {
          proposal.specialOffer = `15% descuento por urgencia - Solo ${(price * 0.85).toFixed(2)}€`;
        } else if (price >= 80) {
          proposal.specialOffer = `10% descuento en primera sesión - Solo ${(price * 0.9).toFixed(2)}€`;
        }
        
        proposals.push(proposal);
      });
      
      return proposals;
      
    } catch (error) {
      console.error('Error generando propuestas de venta:', error);
      return [];
    }
  }

  /**
   * Genera beneficios personalizados para cada servicio
   */
  private generateBenefits(serviceName: string, intent: any): string[] {
    const benefits: { [key: string]: string[] } = {
              'Consulta Farmacéutica': [
        'Evaluación completa en 30 minutos',
        'Plan de acción inmediato',
        'Recomendaciones personalizadas',
        'Seguimiento por email'
      ],
      'Sesión Terapéutica': [
        'Trabajo en profundidad',
        'Técnicas especializadas',
        'Seguimiento continuo',
        'Resultados medibles'
      ],
      'Evaluación Inicial': [
        'Análisis completo y detallado',
        'Diagnóstico profesional',
        'Plan de tratamiento largo plazo',
        'Sesiones de seguimiento incluidas'
      ]
    };
    
            return benefits[serviceName] || benefits['Consulta Farmacéutica'];
  }
  
  /**
   * Genera urgencia personalizada
   */
  private generateUrgency(urgency: number): string {
    if (urgency >= 9) return '🚨 URGENTE - Actuar inmediatamente';
    if (urgency >= 7) return '⚡ ALTA - Recomendado esta semana';
    if (urgency >= 5) return '📅 MEDIA - Próximas 2 semanas';
    return '📋 BAJA - Cuando sea conveniente';
  }
  
  /**
   * Genera siguiente paso personalizado
   */
  private generateNextStep(serviceName: string): string {
    return `Reservar ${serviceName} - Proceso rápido y seguro`;
  }
  
  /**
   * Obtiene la siguiente acción recomendada
   */
  private getNextAction(stage: string): string {
    const actions: { [key: string]: string } = {
      'awareness': 'Proporcionar información detallada',
      'interest': 'Generar interés y beneficios',
      'desire': 'Crear urgencia y ofertas',
      'action': 'Facilitar reserva',
      'closing': 'Confirmar y cerrar venta'
    };
    
    return actions[stage] || 'Generar interés';
  }
  
  /**
   * Cierra una venta exitosa
   */
  async closeSale(serviceId: number, userId: string, customerData: any): Promise<{
    success: boolean;
    appointmentId?: number;
    message: string;
  }> {
    try {
      // Crear cliente si no existe
      let customerId = customerData.id;
      if (!customerId) {
        const result = dbManager.run(`
          INSERT INTO customers (name, email, phone)
          VALUES (?, ?, ?)
        `, [
          customerData.name,
          customerData.email,
          customerData.phone
        ]);
        
        customerId = result.lastInsertRowid;
      }
      
      // Crear cita
      const appointment = await appointmentsService.bookAppointment({
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        serviceId,
        datetimeISO: customerData.preferredDate
      });

      return {
        success: true,
        appointmentId: appointment.id,
        message: `¡Venta cerrada exitosamente! 🎉\n\n` +
                 `**Resumen de tu reserva:**\n` +
                 `• 📅 Fecha: ${customerData.preferredDate}\n` +
                 `• 🎯 Servicio: ${appointment.service_name}\n` +
                 `• 💰 Precio: ${(appointment.service_price / 100).toFixed(2)}€\n\n` +
                 `Recibirás confirmación por email y SMS. ¡Nos vemos pronto! 🌟`
      };
      
    } catch (error) {
      console.error('Error cerrando venta:', error);
      return {
        success: false,
        message: 'Hubo un error al procesar tu reserva. Por favor, contacta con nuestro equipo.'
      };
    }
  }
}

export const salesService = new SalesService();
export default salesService;
