import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { chatMessageSchema, ChatMessage } from '../utils/validators';
import llmService from '../services/llm.service';
import ragEnhancedService from '../services/rag-enhanced.service';
import supplementsController from './supplements.controller';
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
 * Controlador de chat mejorado con memoria conversacional
 */
export class ChatEnhancedController {
  /**
   * Procesa un mensaje del chat con memoria conversacional
   */
  processMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { message, meta } = req.body as ChatMessage;
    
    // Validar longitud del mensaje
    if (message.length > 2000) {
      throw new OperationalError('El mensaje es demasiado largo (máximo 2000 caracteres)', 400);
    }

    // Obtener ID del usuario (usar web_user como fallback)
    const userId = meta?.userId || 'web_user';
    
    try {
      // 1. CREAR O RECUPERAR SESIÓN DE CONVERSACIÓN
      const sessionId = await conversationMemoryService.getOrCreateSession(userId);
      
      // 2. GUARDAR MENSAJE DEL USUARIO
      await conversationMemoryService.saveMessage(sessionId, 'user', message, {
        timestamp: new Date().toISOString(),
        userId,
        ...meta
      });

      // 3. NORMALIZAR Y ANALIZAR MENSAJE
      const normalizedMessage = normalizeUserText(message);
      const language = detectLanguage(normalizedMessage);
      
      // 4. ANÁLISIS DE INTENCIÓN CON MEMORIA
      const messageAnalysis = await conversationMemoryService.analyzeMessage(sessionId, normalizedMessage);
      
      // 5. OBTENER CONTEXTO DE CONVERSACIÓN PREVIA
      const conversationContext = await conversationMemoryService.getConversationContext(sessionId, 8);
      
      // 6. GENERAR RESPUESTA CON CONTEXTO
      const response = await this.generateContextualResponse(
        sessionId,
        normalizedMessage,
        messageAnalysis,
        conversationContext,
        language
      );

      // 7. GUARDAR RESPUESTA DEL ASISTENTE
      await conversationMemoryService.saveMessage(sessionId, 'assistant', response.reply, {
        intent: response.intent,
        context: response.context,
        timestamp: new Date().toISOString()
      });

      // 8. ACTUALIZAR ESTADO DE LA CONVERSACIÓN
      if (messageAnalysis.shouldUpdateContext) {
        await conversationMemoryService.updateConversationState(sessionId, {
          currentTopic: this.mapIntentToTopic(messageAnalysis.intent),
          currentIntent: messageAnalysis.intent,
          entities: messageAnalysis.entities,
          context: this.buildContextUpdate(messageAnalysis, response)
        });
      }

      // 9. GENERAR SUGERENCIAS CONTEXTUALES
      const suggestions = await conversationMemoryService.generateContextualSuggestions(sessionId);

      // 10. RESPONDER CON CONTEXTO COMPLETO
      res.json({
        reply: response.reply,
        intent: response.intent,
        context: response.context,
        language,
        sessionId,
        suggestions,
        conversationStats: await conversationMemoryService.getConversationStats(sessionId)
      });

    } catch (error) {
      console.error('Error en procesamiento de mensaje:', error);
      
      // Respuesta de fallback
      const fallbackResponse = {
        reply: 'Lo siento, he tenido un problema técnico. ¿Puedes reformular tu pregunta?',
        intent: { type: 'error', confidence: 0 },
        context: 'fallback',
        language: 'es',
        sessionId: 'error',
        suggestions: ['💊 ¿Qué medicamento necesitas?', '📅 ¿Quieres agendar una cita?', '🕐 ¿Necesitas saber nuestros horarios?']
      };

      res.json(fallbackResponse);
    }
  });

  /**
   * Genera respuesta contextual basada en la memoria y análisis
   */
  private async generateContextualResponse(
    sessionId: string,
    message: string,
    analysis: any,
    conversationContext: string,
    language: string
  ): Promise<{
    reply: string;
    intent: any;
    context: any;
  }> {
    try {
      // Construir prompt con contexto de conversación
      const contextPrompt = this.buildContextPrompt(message, analysis, conversationContext);
      
      // Obtener información RAG si es necesario
      let ragContext = '';
      if (analysis.intent === 'medication_inquiry' || analysis.intent === 'supplement_inquiry' || analysis.intent === 'general') {
        // Para suplementos, intentar usar el controlador estructurado primero
        if (analysis.intent === 'supplement_inquiry') {
          try {
            const supplements = await this.getSupplementsData();
            if (supplements && supplements.length > 0) {
              ragContext = supplementsController.renderSupplementsResponse(supplements);
            } else {
              // Fallback a RAG si no hay datos estructurados
              ragContext = await ragEnhancedService.generateContext(message);
            }
          } catch (error) {
            console.log('Fallback a RAG para suplementos:', error);
            ragContext = await ragEnhancedService.generateContext(message);
          }
        } else {
          ragContext = await ragEnhancedService.generateContext(message);
        }
      }

      // Generar respuesta con LLM
      const systemPrompt = this.buildSystemPrompt(analysis.intent, conversationContext, ragContext);
      const userPrompt = this.buildUserPrompt(message, analysis, ragContext);
      
      const llmResponse = await llmService.generateResponse(userPrompt, systemPrompt, 0.4);

      // Procesar respuesta del LLM
      const processedResponse = this.processLLMResponse(llmResponse, analysis, ragContext);

      return {
        reply: processedResponse,
        intent: {
          type: analysis.intent,
          confidence: analysis.confidence,
          entities: analysis.entities
        },
        context: {
          hasRAG: !!ragContext,
          hasConversationHistory: !!conversationContext,
          topic: this.mapIntentToTopic(analysis.intent)
        }
      };

    } catch (error) {
      console.error('Error al generar respuesta contextual:', error);
      
      // Respuesta de fallback basada en análisis
      return {
        reply: this.generateFallbackResponse(analysis.intent),
        intent: {
          type: analysis.intent,
          confidence: analysis.confidence,
          entities: analysis.entities
        },
        context: {
          hasRAG: false,
          hasConversationHistory: !!conversationContext,
          topic: this.mapIntentToTopic(analysis.intent)
        }
      };
    }
  }

  /**
   * Construye el prompt del sistema con contexto
   */
  private buildSystemPrompt(intent: string, conversationContext: string, ragContext: string): string {
    let basePrompt = `Eres un asistente virtual especializado en atención al cliente para una FARMACIA 24/7.

REGLAS CRÍTICAS:
- SIEMPRE usa PRIMERO la información del contexto proporcionado (CONTEXT)
- Si hay contexto relevante, responde EXCLUSIVAMENTE con esa información
- NUNCA digas "La información disponible es limitada" si hay contexto útil
- Si el contexto no contiene la respuesta específica, di "No encuentro esa información en la base de conocimiento"
- NO inventes ni des información general si no está en CONTEXT

REGLAS DE COMUNICACIÓN:
- Responde en español claro y profesional
- Si falta un dato crítico, pide SOLO 1 dato a la vez
- Cuando crees/edites/canceles citas, confirma con resumen y pregunta "¿Deseas confirmar?"
- Formato: usa listas cortas y pasos cuando sea útil. Sé breve (máximo 200 palabras)
- Usa emojis apropiados para hacer la conversación más amigable
- IMPORTANTE: Para medicamentos con receta, SIEMPRE pide la prescripción médica`;

    // Agregar contexto de conversación si existe
    if (conversationContext) {
      basePrompt += `\n\nCONTEXTO DE CONVERSACIÓN PREVIA:\n${conversationContext}\n\nIMPORTANTE: Usa este contexto para entender de qué estábamos hablando y dar respuestas coherentes.`;
    }

    // Agregar contexto RAG si existe
    if (ragContext) {
      basePrompt += `\n\nINFORMACIÓN DISPONIBLE:\n${ragContext}\n\nResponde basándote en esta información específica.`;
    }

    return basePrompt;
  }

  /**
   * Construye el prompt del usuario
   */
  private buildUserPrompt(message: string, analysis: any, ragContext: string): string {
    let prompt = `Consulta del usuario: "${message}"\n\n`;

    if (analysis.intent === 'follow_up') {
      prompt += `NOTA: El usuario está haciendo seguimiento de la conversación anterior. Responde de manera coherente con el contexto previo.\n\n`;
    }

    if (ragContext) {
      prompt += `Responde usando SOLO la información proporcionada. Si no encuentras la respuesta específica, indícalo claramente.`;
    } else {
      prompt += `Responde de manera general y sugiere que el usuario sea más específico si es necesario.`;
    }

    return prompt;
  }

  /**
   * Procesa la respuesta del LLM
   */
  private processLLMResponse(llmResponse: string, analysis: any, ragContext: string): string {
    let response = llmResponse.trim();

    // Agregar contexto si es un seguimiento
    if (analysis.intent === 'follow_up') {
      response = `Continuando con tu consulta anterior:\n\n${response}`;
    }

    // Agregar sugerencias si no hay contexto RAG
    if (!ragContext && analysis.intent === 'general') {
      response += `\n\n💡 **Sugerencias**: ¿Podrías ser más específico? Por ejemplo:\n• "¿Qué medicamentos tienes para el dolor?"\n• "¿Cuánto cuesta la consulta farmacéutica?"\n• "¿A qué hora abren?"`;
    }

    return response;
  }

  /**
   * Genera respuesta de fallback
   */
  private generateFallbackResponse(intent: string): string {
    const fallbacks = {
      'medication_inquiry': '💊 ¿Qué medicamento específico necesitas? Puedo ayudarte con información sobre medicamentos, precios y requisitos de receta.',
      'appointment_booking': '📅 ¿Qué servicio te gustaría agendar? Tenemos consultas farmacéuticas, mediciones de presión y glucosa.',
      'opening_hours': '🕐 Estamos abiertos 24/7. ¿En qué horario específico necesitas atención?',
      'pricing_inquiry': '💰 ¿Sobre qué servicio o producto quieres saber el precio?',
      'supplement_inquiry': '🥗 ¿Qué tipo de suplemento o vitamina te interesa?',
      'follow_up': '¿Podrías reformular tu pregunta? Quiero asegurarme de entenderte correctamente.',
      'general': '¿En qué puedo ayudarte específicamente? Puedo ayudarte con medicamentos, citas, horarios o precios.'
    };

    return fallbacks[intent as keyof typeof fallbacks] || fallbacks['general'];
  }

  /**
   * Mapea intención a tema de conversación
   */
  private mapIntentToTopic(intent: string): string {
    const topicMap: Record<string, string> = {
      'medication_inquiry': 'medication',
      'supplement_inquiry': 'supplement',
      'appointment_booking': 'appointment',
      'opening_hours': 'hours',
      'pricing_inquiry': 'pricing',
      'follow_up': 'follow_up',
      'general': 'general'
    };

    return topicMap[intent] || 'general';
  }

  /**
   * Construye actualización de contexto
   */
  private buildContextUpdate(analysis: any, response: any): any {
    const context: any = {};

    if (analysis.intent === 'medication_inquiry' && analysis.entities.medication) {
      context.medicationContext = {
        name: analysis.entities.medication,
        requiresPrescription: analysis.entities.requiresPrescription || false,
        lastInquiry: new Date().toISOString()
      };
    }

    if (analysis.intent === 'appointment_booking' && analysis.entities.service) {
      context.appointmentContext = {
        service: analysis.entities.service,
        lastInquiry: new Date().toISOString()
      };
    }

    return context;
  }

  /**
   * Construye prompt de contexto
   */
  private buildContextPrompt(message: string, analysis: any, conversationContext: string): string {
    let prompt = `Mensaje del usuario: "${message}"\n\n`;

    if (conversationContext) {
      prompt += `Contexto de conversación previa:\n${conversationContext}\n\n`;
    }

    prompt += `Análisis del mensaje:\n- Intención: ${analysis.intent}\n- Confianza: ${analysis.confidence}\n- Entidades: ${JSON.stringify(analysis.entities)}\n\n`;

    return prompt;
  }

  /**
   * Obtiene estadísticas de conversación
   */
  getConversationStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      throw new OperationalError('Se requiere sessionId', 400);
    }

    const stats = await conversationMemoryService.getConversationStats(sessionId);
    res.json(stats);
  });

  /**
   * Obtiene contexto de conversación
   */
  getConversationContext = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const { maxMessages } = req.query;
    
    if (!sessionId) {
      throw new OperationalError('Se requiere sessionId', 400);
    }

    const context = await conversationMemoryService.getConversationContext(
      sessionId, 
      maxMessages ? parseInt(maxMessages as string) : 10
    );
    
    res.json({ sessionId, context, maxMessages: maxMessages || 10 });
  });

  /**
   * Obtiene sugerencias contextuales
   */
  getContextualSuggestions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      throw new OperationalError('Se requiere sessionId', 400);
    }

    const suggestions = await conversationMemoryService.generateContextualSuggestions(sessionId);
    res.json({ sessionId, suggestions });
  });

  /**
   * Obtiene datos de suplementos para respuestas estructuradas
   */
  private async getSupplementsData(): Promise<any[]> {
    try {
      // Intentar obtener suplementos de la base de datos
      const supplements = dbManager.query<any>(
        `SELECT 
          id,
          name,
          category,
          format,
          dosage,
          price,
          requires_prescription as requiresPrescription,
          description
        FROM pharmaceutical_products 
        WHERE category IN ('suplementos', 'vitaminas', 'complementos')
        ORDER BY category, name
        LIMIT 20`
      );
      
      return supplements;
    } catch (error) {
      console.error('Error al obtener datos de suplementos:', error);
      return [];
    }
  }
}

// Exportar instancia singleton
export const chatEnhancedController = new ChatEnhancedController();
export default chatEnhancedController;
