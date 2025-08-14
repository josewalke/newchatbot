import { v4 as uuidv4 } from 'uuid';

/**
 * Interfaz para el estado de la conversación
 */
interface ConversationState {
  userId: string;
  sessionId: string;
  lastIntent: string;
  lastResponse: string;
  selectedService?: string;
  selectedDateTime?: string;
  conversationFlow: string[];
  contextData: Record<string, any>;
  lastUpdate: Date;
}

/**
 * Servicio para manejar la memoria de conversación
 */
export class ConversationMemoryService {
  private conversations: Map<string, ConversationState> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos

  /**
   * Obtiene o crea el estado de conversación de un usuario
   */
  getConversationState(userId: string): ConversationState {
    const existing = this.conversations.get(userId);
    
    if (existing && this.isSessionValid(existing.lastUpdate)) {
      return existing;
    }

    // Crear nuevo estado de conversación
    const newState: ConversationState = {
      userId,
      sessionId: uuidv4(),
      lastIntent: 'greeting',
      lastResponse: '',
      conversationFlow: [],
      contextData: {},
      lastUpdate: new Date()
    };

    this.conversations.set(userId, newState);
    return newState;
  }

  /**
   * Actualiza el estado de la conversación
   */
  updateConversationState(
    userId: string, 
    intent: string, 
    response: string, 
    contextData?: Record<string, any>
  ): void {
    const state = this.getConversationState(userId);
    
    state.lastIntent = intent;
    state.lastResponse = response;
    state.lastUpdate = new Date();
    
    if (contextData) {
      state.contextData = { ...state.contextData, ...contextData };
    }
    
    // Agregar a la secuencia de conversación
    state.conversationFlow.push(intent);
    
    // Mantener solo los últimos 10 intents
    if (state.conversationFlow.length > 10) {
      state.conversationFlow = state.conversationFlow.slice(-10);
    }
  }

  /**
   * Verifica si una respuesta afirmativa debe continuar un flujo
   */
  shouldContinueFlow(userId: string, message: string): boolean {
    const state = this.getConversationState(userId);
    const lowerMessage = message.toLowerCase();
    
    // Respuestas afirmativas comunes
    const affirmativeResponses = [
      'si', 'sí', 'yes', 'ok', 'okay', 'vale', 'perfecto', 'perfecta',
      'me gustaría', 'quiero', 'necesito', 'me interesa', 'claro',
      'por supuesto', 'excelente', 'genial', 'bueno', 'bien'
    ];

    if (!affirmativeResponses.some(response => lowerMessage.includes(response))) {
      return false;
    }

    // Verificar si el último contexto sugiere continuar un flujo
    const lastIntent = state.lastIntent;
    const lastResponse = state.lastResponse.toLowerCase();
    
    // Contextos que sugieren continuar con reserva
    const reservationContexts = [
      'precio', 'servicios', 'horarios', 'fechas disponibles',
      'consulta general', 'sesión terapéutica', 'evaluación inicial'
    ];

    return reservationContexts.some(context => lastResponse.includes(context));
  }

  /**
   * Obtiene el flujo sugerido basado en el contexto
   */
  getSuggestedFlow(userId: string): string {
    const state = this.getConversationState(userId);
    const lastResponse = state.lastResponse.toLowerCase();
    
    if (lastResponse.includes('precio') || lastResponse.includes('servicios')) {
      return 'booking_flow';
    }
    
    if (lastResponse.includes('horarios') || lastResponse.includes('fechas')) {
      return 'booking_flow';
    }
    
    if (lastResponse.includes('consulta general') || lastResponse.includes('sesión terapéutica')) {
      return 'service_selection';
    }
    
    return 'general_inquiry';
  }

  /**
   * Limpia conversaciones expiradas
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [userId, state] of this.conversations.entries()) {
      if (!this.isSessionValid(state.lastUpdate)) {
        this.conversations.delete(userId);
      }
    }
  }

  /**
   * Verifica si una sesión es válida
   */
  private isSessionValid(lastUpdate: Date): boolean {
    return (Date.now() - lastUpdate.getTime()) < this.SESSION_TIMEOUT;
  }

  /**
   * Obtiene estadísticas de conversaciones activas
   */
  getActiveConversationsCount(): number {
    return this.conversations.size;
  }

  /**
   * Resetea el estado de conversación de un usuario
   */
  resetConversation(userId: string): void {
    this.conversations.delete(userId);
  }
}

// Exportar instancia singleton
export const conversationMemoryService = new ConversationMemoryService();
export default conversationMemoryService;

