import dbManager from '../db/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interfaz para un mensaje en la conversación
 */
interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    entities?: Record<string, any>;
    confidence?: number;
    source?: string;
  };
}

/**
 * Interfaz para el estado de la conversación
 */
interface ConversationState {
  sessionId: string;
  userId?: string;
  currentTopic: string;
  currentIntent: string;
  entities: string; // JSON string en la base de datos
  context: string; // JSON string en la base de datos
  conversationHistory: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interfaz para el contexto de la conversación
 */
interface ConversationContext {
  lastService?: string;
  lastMedication?: string;
  lastQuestion?: string;
  appointmentContext?: {
    service?: string;
    date?: string;
    time?: string;
    name?: string;
    phone?: string;
  };
  medicationContext?: {
    name?: string;
    dosage?: string;
    requiresPrescription?: boolean;
    alternatives?: string[];
  };
  userPreferences?: {
    language?: string;
    urgency?: 'low' | 'medium' | 'high';
    preferredContact?: string;
  };
}

/**
 * Servicio de memoria conversacional para mantener contexto
 */
export class ConversationMemoryService {
  private readonly maxHistoryLength = 20; // Máximo mensajes en memoria
  private readonly maxContextTokens = 2000; // Máximo tokens para contexto

  /**
   * Normaliza el rol para evitar problemas de CHECK constraint
   */
  private normalizeRole(role: string): 'user' | 'assistant' | 'system' {
    // Si el LLM devuelve 'tool' | 'function', guárdalo como 'assistant'
    if (role === 'tool' || role === 'function') return 'assistant';
    if (role === 'user' || role === 'assistant' || role === 'system') return role;
    return 'assistant';
  }

  /**
   * Crea o recupera una sesión de conversación
   */
  async getOrCreateSession(userId?: string): Promise<string> {
    try {
      // Buscar sesión existente del usuario
      if (userId) {
        const existingSession = dbManager.queryFirst<{ sessionId: string }>(
          'SELECT sessionId FROM conversation_sessions WHERE userId = ? AND active = 1 ORDER BY updatedAt DESC LIMIT 1',
          [userId]
        );

        if (existingSession) {
          // Actualizar timestamp de la sesión existente
          dbManager.run(
            'UPDATE conversation_sessions SET updatedAt = ? WHERE sessionId = ?',
            [new Date().toISOString(), existingSession.sessionId]
          );
          return existingSession.sessionId;
        }
      }

      // Crear nueva sesión
      const sessionId = uuidv4();
      dbManager.run(
        'INSERT INTO conversation_sessions (sessionId, userId, currentTopic, currentIntent, entities, context, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          sessionId,
          userId || null,
          'general',
          'greeting',
          JSON.stringify({}),
          JSON.stringify({}),
          1,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );

      return sessionId;
    } catch (error) {
      console.error('Error al crear/recuperar sesión:', error);
      // Fallback: crear sesión temporal
      return uuidv4();
    }
  }

  /**
   * Guarda un mensaje en la conversación
   */
  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Normalizar el rol para evitar problemas de CHECK constraint
      const normalizedRole = this.normalizeRole(role);
      
      // Serializar metadata como JSON string
      const metaJson = metadata ? JSON.stringify(metadata) : null;
      
      // Usar timestamp ISO compatible con SQLite DATETIME
      const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      dbManager.run(
        'INSERT INTO conversation_messages (sessionId, role, content, metadata, timestamp) VALUES (?, ?, ?, ?, ?)',
        [
          sessionId,
          normalizedRole,
          content,
          metaJson,
          timestamp
        ]
      );

      // Actualizar timestamp de la sesión
      dbManager.run(
        'UPDATE conversation_sessions SET updatedAt = ? WHERE sessionId = ?',
        [new Date().toISOString(), sessionId]
      );

      // Limpiar mensajes antiguos si exceden el límite
      await this.cleanupOldMessages(sessionId);
    } catch (error) {
      console.error('Error al guardar mensaje:', error);
    }
  }

  /**
   * Obtiene el contexto de la conversación para el LLM
   */
  async getConversationContext(sessionId: string, maxMessages: number = 10): Promise<string> {
    try {
      // Obtener mensajes recientes
      const messages = dbManager.query<ConversationMessage>(
        'SELECT * FROM conversation_messages WHERE sessionId = ? ORDER BY timestamp DESC LIMIT ?',
        [sessionId, maxMessages]
      );

      if (messages.length === 0) {
        return '';
      }

      // Obtener estado actual de la conversación
      const session = dbManager.queryFirst<ConversationState>(
        'SELECT * FROM conversation_sessions WHERE sessionId = ?',
        [sessionId]
      );

      if (!session) {
        return '';
      }

      // Construir contexto estructurado
      const contextParts: string[] = [];

      // 1. Estado actual de la conversación
      if (session.currentTopic !== 'general') {
        contextParts.push(`📋 **Tema actual**: ${session.currentTopic}`);
      }
      
      if (session.currentIntent !== 'greeting') {
        contextParts.push(`🎯 **Intención actual**: ${session.currentIntent}`);
      }

      // 2. Contexto específico
      const context: ConversationContext = JSON.parse(session.context || '{}');
      if (context.appointmentContext) {
        const appt = context.appointmentContext;
        if (appt.service || appt.date || appt.name) {
          contextParts.push(`📅 **Contexto de cita**: ${appt.service || ''} ${appt.date || ''} ${appt.name || ''}`);
        }
      }

      if (context.medicationContext) {
        const med = context.medicationContext;
        if (med.name || med.dosage) {
          contextParts.push(`💊 **Medicamento**: ${med.name || ''} ${med.dosage || ''}`);
        }
      }

      // 3. Historial de mensajes (últimos 5)
      const recentMessages = messages.slice(0, 5).reverse();
      if (recentMessages.length > 0) {
        contextParts.push('\n💬 **Conversación reciente**:');
        recentMessages.forEach((msg, index) => {
          const role = msg.role === 'user' ? '👤 Usuario' : '🤖 Asistente';
          const content = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
          contextParts.push(`${index + 1}. ${role}: ${content}`);
        });
      }

      return contextParts.join('\n');
    } catch (error) {
      console.error('Error al obtener contexto:', error);
      return '';
    }
  }

  /**
   * Actualiza el estado de la conversación
   */
  async updateConversationState(
    sessionId: string,
    updates: Partial<{
      currentTopic: string;
      currentIntent: string;
      entities: Record<string, any>;
      context: any;
    }>
  ): Promise<void> {
    try {
      const session = dbManager.queryFirst<ConversationState>(
        'SELECT * FROM conversation_sessions WHERE sessionId = ?',
        [sessionId]
      );

      if (!session) {
        return;
      }

      // Fusionar con el estado existente
      const currentState = {
        currentTopic: session.currentTopic,
        currentIntent: session.currentIntent,
        entities: JSON.parse(session.entities || '{}'),
        context: JSON.parse(session.context || '{}') as ConversationContext
      };

      const newState = { ...currentState, ...updates };

      // Actualizar en la base de datos
      dbManager.run(
        'UPDATE conversation_sessions SET currentTopic = ?, currentIntent = ?, entities = ?, context = ?, updatedAt = ? WHERE sessionId = ?',
        [
          newState.currentTopic,
          newState.currentIntent,
          JSON.stringify(newState.entities),
          JSON.stringify(newState.context),
          new Date().toISOString(),
          sessionId
        ]
      );
    } catch (error) {
      console.error('Error al actualizar estado:', error);
    }
  }

  /**
   * Analiza la intención y entidades del mensaje
   */
  async analyzeMessage(sessionId: string, message: string): Promise<{
    intent: string;
    entities: Record<string, any>;
    confidence: number;
    shouldUpdateContext: boolean;
  }> {
    try {
      const lowerMessage = message.toLowerCase();
      let intent = 'general';
      let entities: Record<string, any> = {};
      let confidence = 0.5;
      let shouldUpdateContext = false;

      // Detectar intenciones específicas
      if (lowerMessage.includes('medicamento') || lowerMessage.includes('medicina') || lowerMessage.includes('fármaco')) {
        intent = 'medication_inquiry';
        confidence = 0.8;
        shouldUpdateContext = true;
        
        // Extraer entidades
        if (lowerMessage.includes('paracetamol') || lowerMessage.includes('ibuprofeno')) {
          entities.medication = lowerMessage.includes('paracetamol') ? 'paracetamol' : 'ibuprofeno';
          entities.requiresPrescription = false;
        }
        if (lowerMessage.includes('receta')) {
          entities.requiresPrescription = true;
        }
      }

      if (lowerMessage.includes('cita') || lowerMessage.includes('agendar') || lowerMessage.includes('reservar')) {
        intent = 'appointment_booking';
        confidence = 0.9;
        shouldUpdateContext = true;
        
        // Extraer entidades
        if (lowerMessage.includes('consulta')) {
          entities.service = 'consulta_farmaceutica';
        }
        if (lowerMessage.includes('presión') || lowerMessage.includes('glucosa')) {
          entities.service = lowerMessage.includes('presión') ? 'medicion_presion' : 'medicion_glucosa';
        }
      }

      if (lowerMessage.includes('horario') || lowerMessage.includes('abierto') || lowerMessage.includes('cerrado')) {
        intent = 'opening_hours';
        confidence = 0.7;
      }

      if (lowerMessage.includes('precio') || lowerMessage.includes('costo') || lowerMessage.includes('cuánto')) {
        intent = 'pricing_inquiry';
        confidence = 0.6;
      }

      if (lowerMessage.includes('suplemento') || lowerMessage.includes('vitamina')) {
        intent = 'supplement_inquiry';
        confidence = 0.8;
        shouldUpdateContext = true;
      }

      // Detectar seguimiento de conversación
      if (lowerMessage.includes('eso') || lowerMessage.includes('mismo') || lowerMessage.includes('también')) {
        intent = 'follow_up';
        confidence = 0.9;
        shouldUpdateContext = true;
      }

      return { intent, entities, confidence, shouldUpdateContext };
    } catch (error) {
      console.error('Error al analizar mensaje:', error);
      return {
        intent: 'general',
        entities: {},
        confidence: 0.5,
        shouldUpdateContext: false
      };
    }
  }

  /**
   * Genera sugerencias contextuales basadas en la conversación
   */
  async generateContextualSuggestions(sessionId: string): Promise<string[]> {
    try {
      const session = dbManager.queryFirst<ConversationState>(
        'SELECT * FROM conversation_sessions WHERE sessionId = ?',
        [sessionId]
      );

      if (!session) {
        return ['💊 ¿Qué medicamento necesitas?', '📅 ¿Quieres agendar una cita?', '🕐 ¿Necesitas saber nuestros horarios?'];
      }

      const context: ConversationContext = JSON.parse(session.context || '{}');
      const suggestions: string[] = [];

      // Sugerencias basadas en el contexto de medicamentos
      if (context.medicationContext?.name) {
        suggestions.push(`💊 ¿Necesitas más información sobre ${context.medicationContext.name}?`);
        suggestions.push(`📋 ¿Quieres saber si requiere receta?`);
        if (context.medicationContext.requiresPrescription) {
          suggestions.push(`📝 ¿Tienes la receta médica?`);
        }
      }

      // Sugerencias basadas en el contexto de citas
      if (context.appointmentContext?.service) {
        suggestions.push(`📅 ¿Quieres confirmar tu cita de ${context.appointmentContext.service}?`);
        suggestions.push(`⏰ ¿Necesitas cambiar la fecha o hora?`);
      }

      // Sugerencias basadas en el tema actual
      if (session.currentTopic === 'medication') {
        suggestions.push(`💊 ¿Otro medicamento?`, `📋 ¿Información sobre recetas?`, `⚠️ ¿Efectos secundarios?`);
      } else if (session.currentTopic === 'appointment') {
        suggestions.push(`📅 ¿Agendar otra cita?`, `🕐 ¿Ver horarios disponibles?`, `📞 ¿Contactar farmacéutico?`);
      }

      // Sugerencias generales si no hay contexto específico
      if (suggestions.length === 0) {
        suggestions.push('💊 ¿Qué medicamento necesitas?', '📅 ¿Quieres agendar una cita?', '🕐 ¿Necesitas saber nuestros horarios?');
      }

      return suggestions.slice(0, 3); // Máximo 3 sugerencias
    } catch (error) {
      console.error('Error al generar sugerencias:', error);
      return ['💊 ¿En qué puedo ayudarte?'];
    }
  }

  /**
   * Limpia mensajes antiguos para mantener el rendimiento
   */
  private async cleanupOldMessages(sessionId: string): Promise<void> {
    try {
      // Obtener el número total de mensajes
      const messageCount = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM conversation_messages WHERE sessionId = ?',
        [sessionId]
      )?.count || 0;

      if (messageCount > this.maxHistoryLength) {
        // Eliminar mensajes antiguos, manteniendo los más recientes
        const messagesToDelete = messageCount - this.maxHistoryLength;
        
        dbManager.run(
          'DELETE FROM conversation_messages WHERE sessionId = ? AND id IN (SELECT id FROM conversation_messages WHERE sessionId = ? ORDER BY timestamp ASC LIMIT ?)',
          [sessionId, sessionId, messagesToDelete]
        );
      }
    } catch (error) {
      console.error('Error al limpiar mensajes:', error);
    }
  }

  /**
   * Obtiene estadísticas de la conversación
   */
  async getConversationStats(sessionId: string): Promise<{
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    sessionDuration: number;
    topics: string[];
  }> {
    try {
      const session = dbManager.queryFirst<ConversationState>(
        'SELECT * FROM conversation_sessions WHERE sessionId = ?',
        [sessionId]
      );

      if (!session) {
        return {
          totalMessages: 0,
          userMessages: 0,
          assistantMessages: 0,
          sessionDuration: 0,
          topics: []
        };
      }

      const messages = dbManager.query<ConversationMessage>(
        'SELECT * FROM conversation_messages WHERE sessionId = ?',
        [sessionId]
      );

      const userMessages = messages.filter(m => m.role === 'user').length;
      const assistantMessages = messages.filter(m => m.role === 'assistant').length;
      
      const sessionDuration = new Date().getTime() - new Date(session.createdAt).getTime();
      const topics = [session.currentTopic];

      return {
        totalMessages: messages.length,
        userMessages,
        assistantMessages,
        sessionDuration: Math.floor(sessionDuration / 1000), // en segundos
        topics
      };
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return {
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        sessionDuration: 0,
        topics: []
      };
    }
  }
}

// Exportar instancia singleton
export const conversationMemoryService = new ConversationMemoryService();
export default conversationMemoryService;

