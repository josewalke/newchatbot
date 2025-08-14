import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { validateBody, validateBody as validateBodyMiddleware } from '../middlewares/validate.middleware';
import { chatMessageSchema, ChatMessage } from '../utils/validators';
import llmService from '../services/llm.service';
import ragService from '../services/rag.service';
import appointmentsService from '../services/appointments.service';
import salesService from '../services/sales.service';
import conversationMemoryService from '../services/conversation-memory.service';
import dbManager from '../db/db';
import { OperationalError } from '../middlewares/error.middleware';
import { 
  normalizeUserText, 
  detectLanguage, 
  quickClassify, 
  askForMissingField,
  generateConfirmationMessage 
} from '../utils/text-processing';

/**
 * Controlador para el chat del chatbot
 */
export class ChatController {
  /**
   * Procesa un mensaje del chat con pipeline mejorado
   */
  processMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { message, meta } = req.body as ChatMessage;
    
    // Validar longitud del mensaje
    if (message.length > 2000) {
      throw new OperationalError('El mensaje es demasiado largo (máximo 2000 caracteres)', 400);
    }

    // Obtener ID del usuario (usar web_user como fallback)
    const userId = meta?.userId || 'web_user';
    
    // 1. NORMALIZAR texto del usuario
    const normalizedMessage = normalizeUserText(message);
    
    // 2. DETECTAR idioma
    const language = detectLanguage(normalizedMessage);
    
    // 3. CLASIFICACIÓN RÁPIDA con palabras clave
    const quickIntent = quickClassify(normalizedMessage);
    
    // 4. VERIFICAR si es una respuesta afirmativa que debe continuar un flujo
    if (conversationMemoryService.shouldContinueFlow(userId, normalizedMessage)) {
      const suggestedFlow = conversationMemoryService.getSuggestedFlow(userId);
      const reply = await this.handleContextualFlow(userId, suggestedFlow, normalizedMessage, meta);
      
      // Actualizar memoria de conversación
      conversationMemoryService.updateConversationState(userId, 'contextual_flow', reply, { flow: suggestedFlow });
      
      // Guardar mensaje y responder
      await this.saveMessage('in', message, meta);
      await this.saveMessage('out', reply, meta);
      
      res.json({
        reply,
        intent: { type: 'contextual_flow', slots: { flow: suggestedFlow } },
        context: 'continuation',
        language
      });
      return;
    }

    // 5. CLASIFICACIÓN PRINCIPAL con LLM (solo si la rápida no es confiable)
    let intent;
    if (quickIntent.confidence >= 0.6) {
      intent = {
        type: quickIntent.intent,
        slots: quickIntent.slots,
        confidence: quickIntent.confidence
      };
    } else {
      // Usar LLM para clasificación más precisa
      const llmIntent = await llmService.classifyIntent(normalizedMessage);
      intent = {
        ...llmIntent,
        confidence: 0.8 // Confianza por defecto para LLM
      };
    }
    
    // 6. RECUPERAR contexto RAG si es necesario
    let context = '';
    if (intent.type === 'faq' || intent.type === 'sales') {
      context = await ragService.generateContext(normalizedMessage);
    }
    
    // 7. GENERAR respuesta basada en la intención
    let reply = '';
    let responseData: any = {
      reply: '',
      intent: {
        type: intent.type,
        slots: intent.slots,
        confidence: intent.confidence,
      },
      language,
      context: context ? 'rag' : 'none'
    };

    try {
      // Para mensajes simples como saludos, usar el LLM directamente
      if (normalizedMessage.toLowerCase().includes('hola') || 
          normalizedMessage.toLowerCase().includes('buenos') ||
          normalizedMessage.toLowerCase().includes('buenas') ||
          normalizedMessage.toLowerCase().includes('ayuda') ||
          normalizedMessage.toLowerCase().includes('ayudar')) {
        
        const systemPrompt = `Eres un asistente virtual especializado en atención al cliente para un centro de terapia y consultas psicológicas.

REGLAS PRINCIPALES:
- Responde en español claro y profesional; si el usuario usa otro idioma, respóndele en el mismo
- Si falta un dato crítico (fecha, servicio, sucursal), pide SOLO 1 dato a la vez
- Nunca inventes información: di "no tengo ese dato" y sugiere cómo obtenerlo
- Cuando crees/edites/canceles citas, confirma con un resumen y pregunta "¿Deseas confirmar?"
- Si la intención es FAQ/Sales, usa primero el contexto recuperado (RAG). Si es insuficiente, dilo
- Formato: usa listas cortas y pasos cuando sea útil. Sé breve (máximo 200 palabras)
- Usa emojis apropiados para hacer la conversación más amigable

FEW-SHOTS DE EJEMPLO:

Usuario: "hola"
Asistente: "¡Hola! 🌟 Soy tu asistente virtual del centro de terapia y consultas psicológicas. ¿En qué puedo ayudarte hoy? Puedo ayudarte con:

• 📅 Reservas de citas
• 💰 Información sobre servicios y precios  
• ❓ Preguntas frecuentes
• 📋 Horarios y políticas

¿Qué te gustaría hacer?"

Usuario: "necesito ayuda"
Asistente: "¡Por supuesto! 🤗 Estoy aquí para ayudarte. Como asistente virtual del centro de terapia, puedo:

• 📅 Agendar o reprogramar citas
• 💰 Informarte sobre nuestros servicios y precios
• ❓ Responder tus preguntas sobre horarios, políticas, etc.
• 📋 Guiarte en todo el proceso

¿En qué área específica necesitas ayuda? ¿Es para una cita, información de servicios, o tienes alguna pregunta?"`;

        reply = await llmService.generateResponse(normalizedMessage, systemPrompt);
      } else {
        // Para otras intenciones, usar el sistema normal
        switch (intent.type) {
          case 'book':
            reply = await this.handleBookingIntent(normalizedMessage, intent.slots, meta, context);
            break;
          case 'reschedule':
            reply = await this.handleRescheduleIntent(normalizedMessage, intent.slots, meta, context);
            break;
          case 'cancel':
            reply = await this.handleCancelIntent(normalizedMessage, intent.slots, meta, context);
            break;
          case 'confirm':
            reply = await this.handleConfirmIntent(normalizedMessage, intent.slots, meta, context);
            break;
          case 'faq':
            reply = await this.handleFAQIntent(normalizedMessage, intent.slots, meta, context);
            break;
          case 'sales':
            reply = await this.handleSalesIntent(normalizedMessage, intent.slots, meta, context);
            break;
          default:
            reply = 'No entiendo tu solicitud. ¿Puedes reformularla?';
        }
      }

      // Actualizar memoria de conversación
      conversationMemoryService.updateConversationState(userId, intent.type, reply, intent.slots);

      // Guardar el mensaje en la base de datos
      await this.saveMessage('in', message, meta);
      await this.saveMessage('out', reply, meta);

      responseData.reply = reply;
      
      res.json(responseData);
    } catch (error) {
      console.error('Error al procesar mensaje:', error);
      
      const errorMessage = 'Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.';
      
      // Guardar mensaje de error
      await this.saveMessage('in', message, meta);
      await this.saveMessage('out', errorMessage, meta);
      
      res.status(500).json({
        reply: errorMessage,
        intent: { type: 'error', slots: {} },
        language,
        error: true
      });
    }
  });

  /**
   * Maneja la intención de reserva con confirmación obligatoria
   */
  private async handleBookingIntent(
    message: string, 
    slots: any, 
    meta: any, 
    context: string = ''
  ): Promise<string> {
    // Verificar si tenemos información suficiente
    const missingFields = this.getMissingFields(slots, ['service', 'date', 'time']);
    
    if (missingFields.length > 0) {
      // Preguntar solo por UN campo faltante
      const field = missingFields[0];
      const fieldMap: Record<string, 'fecha' | 'servicio' | 'sucursal' | 'hora'> = {
        'service': 'servicio',
        'date': 'fecha',
        'time': 'hora',
        'sucursal': 'sucursal'
      };
      return askForMissingField(fieldMap[field] || 'fecha');
    }
    
    // Si tenemos toda la información, generar confirmación
    const confirmationMessage = generateConfirmationMessage('book', slots);
    return confirmationMessage;
  }

  /**
   * Maneja la intención de reprogramar con confirmación
   */
  private async handleRescheduleIntent(
    message: string, 
    slots: any, 
    meta: any, 
    context: string = ''
  ): Promise<string> {
    const missingFields = this.getMissingFields(slots, ['newDate', 'newTime']);
    
    if (missingFields.length > 0) {
      const field = missingFields[0];
      const fieldMap: Record<string, 'fecha' | 'servicio' | 'sucursal' | 'hora'> = {
        'newDate': 'fecha',
        'newTime': 'hora'
      };
      return askForMissingField(fieldMap[field] || 'fecha');
    }
    
    const confirmationMessage = generateConfirmationMessage('reschedule', slots);
    return confirmationMessage;
  }

  /**
   * Maneja la intención de cancelar con confirmación
   */
  private async handleCancelIntent(
    message: string, 
    slots: any, 
    meta: any, 
    context: string = ''
  ): Promise<string> {
    if (!slots.date) {
      return '¿De qué fecha quieres cancelar la cita?';
    }
    
    const confirmationMessage = generateConfirmationMessage('cancel', slots);
    return confirmationMessage;
  }

  /**
   * Maneja la intención de confirmar
   */
  private async handleConfirmIntent(
    message: string, 
    slots: any, 
    meta: any, 
    context: string = ''
  ): Promise<string> {
    return generateConfirmationMessage('confirm', slots);
  }

  /**
   * Maneja preguntas frecuentes con RAG mejorado
   */
  private async handleFAQIntent(
    message: string, 
    slots: any, 
    meta: any, 
    context: string = ''
  ): Promise<string> {
    if (context && !context.includes('No tengo información específica')) {
      // Usar el contexto RAG recuperado
      return `Basándome en la información disponible:\n\n${context}\n\n¿Te gustaría agendar una cita o tienes alguna otra pregunta?`;
    } else {
      // No hay contexto suficiente, responder genéricamente
      return 'No tengo información específica sobre tu consulta. Te sugiero contactar directamente con nuestro equipo o agendar una cita para obtener información personalizada.';
    }
  }

  /**
   * Maneja consultas de ventas con RAG
   */
  private async handleSalesIntent(
    message: string, 
    slots: any, 
    meta: any, 
    context: string = ''
  ): Promise<string> {
    if (context && !context.includes('No tengo información específica')) {
      return `Aquí tienes información sobre nuestros servicios:\n\n${context}\n\n¿Te gustaría agendar una cita para conocer más detalles?`;
    } else {
      return 'Te puedo ayudar con información sobre nuestros servicios. Tenemos Consulta General (50€), Sesión Terapéutica (80€) y Evaluación Inicial (120€). ¿Te gustaría agendar una cita?';
    }
  }

  /**
   * Maneja flujos contextuales basados en la memoria de conversación
   */
  private async handleContextualFlow(
    userId: string,
    flow: string,
    message: string,
    meta?: any
  ): Promise<string> {
    const state = conversationMemoryService.getConversationState(userId);
    
    switch (flow) {
      case 'booking_flow':
        return this.handleBookingFlowContinuation(userId, state, message);
      
      case 'service_selection':
        return this.handleServiceSelectionContinuation(userId, state, message);
      
      default:
        return 'Perfecto, ¿en qué puedo ayudarte específicamente?';
    }
  }

  /**
   * Continúa el flujo de reserva cuando el usuario confirma interés
   */
  private async handleBookingFlowContinuation(
    userId: string,
    state: any,
    message: string
  ): Promise<string> {
    const lowerMessage = message.toLowerCase();
    
    // Si el usuario dijo "si" después de ver precios o servicios
    if (lowerMessage.includes('si') || lowerMessage.includes('sí') || lowerMessage.includes('perfecto')) {
      return `¡Excelente! 🎯 Vamos a reservar tu cita paso a paso.\n\n` +
             `**Paso 1: Selecciona el servicio**\n` +
             `¿Cuál de estos servicios te gustaría reservar?\n\n` +
             `🌟 **Consulta General** - 30 min, 50€\n` +
             `🌟 **Sesión Terapéutica** - 60 min, 80€\n` +
             `🌟 **Evaluación Inicial** - 90 min, 120€\n\n` +
             `**Responde con el nombre del servicio** que prefieras.`;
    }
    
    // Si el usuario dijo "si" después de ver horarios
    if (state.lastResponse.toLowerCase().includes('horarios')) {
      return `¡Perfecto! 🕐 Ahora que conoces nuestros horarios, vamos a reservar.\n\n` +
             `**¿Qué servicio te gustaría reservar?**\n\n` +
             `• Consulta General (30 min)\n` +
             `• Sesión Terapéutica (60 min)\n` +
             `• Evaluación Inicial (90 min)\n\n` +
             `**Escribe el nombre del servicio** que prefieras.`;
    }
    
    return 'Perfecto, ¿qué te gustaría hacer ahora?';
  }

  /**
   * Continúa la selección de servicio cuando el usuario confirma interés
   */
  private async handleServiceSelectionContinuation(
    userId: string,
    state: any,
    message: string
  ): Promise<string> {
    const lowerMessage = message.toLowerCase();
    
    // Si el usuario dijo "si" después de ver información de un servicio específico
    if (lowerMessage.includes('si') || lowerMessage.includes('sí') || lowerMessage.includes('me gustaría')) {
      return `¡Fantástico! 🎉 Ahora vamos a reservar tu cita.\n\n` +
             `**Paso 2: Selecciona fecha y hora**\n\n` +
             `**Próximas fechas disponibles**:\n` +
             `• Esta semana: Miércoles 14, Jueves 15, Viernes 16\n` +
             `• Próxima semana: Lunes 19, Martes 20, Miércoles 21\n\n` +
             `**Horarios más solicitados**:\n` +
             `• Mañana: 10:00 AM, 11:00 AM\n` +
             `• Tarde: 2:00 PM, 4:00 PM, 6:00 PM\n\n` +
             `**¿Qué fecha y hora prefieres?**\n` +
             `(Ejemplo: "Jueves 15 a las 2:00 PM")`;
    }
    
    return 'Perfecto, ¿en qué puedo ayudarte?';
  }

  /**
   * Guarda un mensaje en la base de datos
   */
  private async saveMessage(
    direction: 'in' | 'out',
    content: string,
    meta?: any
  ): Promise<void> {
    try {
      const userId = meta?.userId || 'anonymous';
      const channel = meta?.channel || 'web';
      
      dbManager.run(
        'INSERT INTO messages (channel, user_id, direction, content, meta_json) VALUES (?, ?, ?, ?, ?)',
        [channel, userId, direction, content, meta ? JSON.stringify(meta) : null]
      );
    } catch (error) {
      console.error('Error al guardar mensaje:', error);
      // No lanzar error para no interrumpir el flujo del chat
    }
  }

  /**
   * Obtiene el historial de mensajes de un usuario
   */
  getMessageHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId, channel = 'web', limit = 50 } = req.query;
    
    if (!userId) {
      throw new OperationalError('Se requiere userId', 400);
    }

    const messages = dbManager.query(
      'SELECT * FROM messages WHERE user_id = ? AND channel = ? ORDER BY created_at DESC LIMIT ?',
      [userId, channel, limit]
    );

    res.json({
      messages: messages.reverse(), // Ordenar cronológicamente
      total: messages.length,
    });
  });

  /**
   * Obtiene estadísticas del chat
   */
  getChatStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const totalMessages = dbManager.queryFirst<{ count: number }>(
      'SELECT COUNT(*) as count FROM messages'
    )?.count || 0;

    const messagesByChannel = dbManager.query(
      'SELECT channel, COUNT(*) as count FROM messages GROUP BY channel'
    );

    const messagesByDirection = dbManager.query(
      'SELECT direction, COUNT(*) as count FROM messages GROUP BY direction'
    );

    res.json({
      totalMessages,
      byChannel: messagesByChannel,
      byDirection: messagesByDirection,
    });
  });

  /**
   * Obtiene el estado de la conversación de un usuario
   */
  getConversationState = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.query;
    
    if (!userId) {
      throw new OperationalError('Se requiere userId', 400);
    }

    const state = conversationMemoryService.getConversationState(userId as string);
    
    res.json({
      success: true,
      data: {
        userId: state.userId,
        sessionId: state.sessionId,
        lastIntent: state.lastIntent,
        conversationFlow: state.conversationFlow,
        contextData: state.contextData,
        lastUpdate: state.lastUpdate,
        activeConversations: conversationMemoryService.getActiveConversationsCount()
      }
    });
  });

  /**
   * Resetea la conversación de un usuario
   */
  resetConversation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.query;
    
    if (!userId) {
      throw new OperationalError('Se requiere userId', 400);
    }

    conversationMemoryService.resetConversation(userId as string);
    
    res.json({
      success: true,
      message: 'Conversación reseteada correctamente'
    });
  });

  /**
   * Obtiene campos faltantes de los slots
   */
  private getMissingFields(slots: any, requiredFields: string[]): string[] {
    return requiredFields.filter(field => !slots[field]);
  }
}

// Exportar instancia singleton
export const chatController = new ChatController();
export default chatController;
