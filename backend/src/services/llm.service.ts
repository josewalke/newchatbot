import axios, { AxiosResponse } from 'axios';
import config from '../utils/env';
import { OperationalError } from '../middlewares/error.middleware';

/**
 * Interfaz para la respuesta de Ollama
 */
interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration: number;
  load_duration: number;
  prompt_eval_duration: number;
  eval_duration: number;
}

/**
 * Interfaz para la respuesta de embeddings de Ollama
 */
interface OllamaEmbeddingResponse {
  embeddings: number[];
}

/**
 * System prompt mejorado con few-shots
 */
const ENHANCED_SYSTEM_PROMPT = `Eres un asistente virtual especializado en atención al cliente para un centro de terapia y consultas psicológicas.

REGLAS PRINCIPALES:
- Responde en español claro y profesional; si el usuario usa otro idioma, respóndele en el mismo
- Si falta un dato crítico (fecha, servicio, sucursal), pide SOLO 1 dato a la vez
- Nunca inventes información: di "no tengo ese dato" y sugiere cómo obtenerlo
- Cuando crees/edites/canceles citas, confirma con un resumen y pregunta "¿Deseas confirmar?"
- Si la intención es FAQ/Sales, usa primero el contexto recuperado (RAG). Si es insuficiente, dilo
- Formato: usa listas cortas y pasos cuando sea útil. Sé breve (máximo 200 palabras)
- Usa emojis apropiados para hacer la conversación más amigable

FEW-SHOTS DE EJEMPLO:

Usuario: "quiero una cita"
Asistente: "¡Perfecto! Te ayudo a agendar tu cita. ¿Qué servicio necesitas? Tenemos:
• Consulta General (30 min, 50€)
• Sesión Terapéutica (60 min, 80€)
• Evaluación Inicial (90 min, 120€)"

Usuario: "me lo mueves para mañana"
Asistente: "Te ayudo a reprogramar tu cita. ¿A qué hora te viene mejor mañana? Tenemos disponibilidad en la mañana y tarde."

Usuario: "no puedo ir, me la cancelas"
Asistente: "Entiendo, te cancelo la cita. Para confirmar: ¿quieres cancelar tu cita del [FECHA]? Una vez confirmado, recibirás un email de cancelación."

Usuario: "¿cuáles son los horarios?"
Asistente: "Nuestros horarios de atención son:
• Lunes a Viernes: 9:00 - 18:00
• Sábados: 9:00 - 14:00
• Domingos: Cerrado

¿Te gustaría agendar una cita en alguno de estos horarios?"`;

/**
 * Servicio para interactuar con Ollama
 */
export class LLMService {
  private baseUrl: string;
  private model: string;
  private embedModel: string;
  private timeout: number;

  constructor() {
    this.baseUrl = config.ollamaUrl;
    this.model = config.ollamaModel;
    this.embedModel = config.embedModel;
    this.timeout = config.ollamaTimeout;
  }

  /**
   * Genera una respuesta usando el modelo de chat
   */
  async generateResponse(
    prompt: string,
    systemPrompt?: string,
    temperature: number = 0.4
  ): Promise<string> {
    try {
      const messages = [];
      
      // Usar el system prompt mejorado por defecto
      const finalSystemPrompt = systemPrompt || ENHANCED_SYSTEM_PROMPT;
      
      messages.push({
        role: 'system',
        content: finalSystemPrompt,
      });
      
      messages.push({
        role: 'user',
        content: prompt,
      });

      const response: AxiosResponse<OllamaResponse> = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: temperature,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            num_ctx: 8192,     // Contexto aumentado para mejor comprensión
            num_predict: 512,  // Respuestas más cortas y rápidas
            stop: ["</s>", "Human:", "Assistant:"], // Parar generación
            seed: 42,          // Consistencia en respuestas
          },
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.done && response.data.message) {
        return response.data.message.content;
      }

      throw new OperationalError('Respuesta incompleta de Ollama', 500);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new OperationalError('Timeout en la llamada a Ollama', 408);
        }
        if (error.response?.status === 404) {
          throw new OperationalError('Modelo de Ollama no encontrado', 404);
        }
        throw new OperationalError(
          `Error en la comunicación con Ollama: ${error.message}`,
          500
        );
      }
      throw error;
    }
  }

  /**
   * Genera embeddings para un texto usando el modelo de embeddings
   */
  async generateEmbeddings(text: string): Promise<number[]> {
    try {
      const response: AxiosResponse<OllamaEmbeddingResponse> = await axios.post(
        `${this.baseUrl}/api/embeddings`,
        {
          model: this.embedModel,
          prompt: text,
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.embeddings;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new OperationalError('Timeout en la generación de embeddings', 408);
        }
        if (error.response?.status === 404) {
          throw new OperationalError('Modelo de embeddings no encontrado', 404);
        }
        throw new OperationalError(
          `Error en la generación de embeddings: ${error.message}`,
          500
        );
      }
      throw error;
    }
  }

  /**
   * Clasifica la intención de un mensaje usando el modelo de chat
   */
  async classifyIntent(message: string): Promise<{
    type: string;
    slots: Record<string, any>;
  }> {
    const systemPrompt = `Eres un clasificador de intenciones para un chatbot de citas y atención al cliente.

CLASIFICA el mensaje en UNA de estas categorías:
- book: Reservar una cita
- reschedule: Mover una cita existente  
- cancel: Cancelar una cita
- confirm: Confirmar una cita
- faq: Pregunta frecuente o información general
- sales: Consulta sobre servicios y precios

EXTRACCION de slots:

Para "book":
- service: tipo de servicio mencionado
- date: fecha mencionada
- time: hora mencionada
- datetimeISO: fecha y hora en formato ISO si se puede inferir
- name: nombre del usuario
- email: email del usuario
- phone: teléfono del usuario

Para "reschedule":
- id: ID de la cita si se menciona
- newDatetimeISO: nueva fecha/hora en formato ISO
- date: nueva fecha
- time: nueva hora

Para "cancel":
- id: ID de la cita si se menciona

Para "confirm":
- id: ID de la cita si se menciona

Para "faq" y "sales":
- topic: tema principal de la consulta

REGLAS IMPORTANTES:
1. Responde SOLO con JSON válido
2. NO uses markdown
3. NO incluyas texto adicional
4. NO uses comillas dobles en los valores
5. Mantén el formato exacto

FORMATO REQUERIDO:
{"type":"tipo","slots":{"slot":"valor"}}

Ejemplo: {"type":"sales","slots":{"topic":"servicios"}}`;

    try {
      const response = await this.generateResponse(message, systemPrompt, 0.1);
      
      // Intentar parsear la respuesta como JSON
      try {
        // Limpiar la respuesta de Ollama (remover markdown si existe)
        let cleanResponse = response.trim();
        
        // Si la respuesta empieza con ```json, extraer solo el contenido JSON
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/\s*```$/, '');
        }
        
        const parsed = JSON.parse(cleanResponse);
        
        if (typeof parsed.type === 'string' && typeof parsed.slots === 'object') {
          return {
            type: parsed.type,
            slots: parsed.slots || {},
          };
        }
      } catch (parseError) {
        console.warn('Error al parsear JSON de clasificación:', parseError);
        console.log('Respuesta de Ollama que falló:', response);
      }

      // Si falla el parsing, hacer una clasificación simple basada en palabras clave
      return this.fallbackIntentClassification(message);
    } catch (error) {
      console.error('Error en clasificación de intención:', error);
      return this.fallbackIntentClassification(message);
    }
  }

  /**
   * Clasificación de intención basada en palabras clave (fallback)
   */
  private fallbackIntentClassification(message: string): {
    type: string;
    slots: Record<string, any>;
  } {
    const lowerMessage = message.toLowerCase();
    
    // Detectar intenciones de FAQ general PRIMERO (para evitar conflictos)
    if (lowerMessage.includes('dime') || lowerMessage.includes('puedes indicarme') || lowerMessage.includes('cuáles son') ||
        lowerMessage.includes('explícame') || lowerMessage.includes('cuéntame') || lowerMessage.includes('háblame') ||
        lowerMessage.includes('quiero saber') || lowerMessage.includes('necesito saber') || lowerMessage.includes('tengo dudas') ||
        lowerMessage.includes('tengo preguntas') || lowerMessage.includes('me interesa') || lowerMessage.includes('me gustaría saber') ||
        lowerMessage.includes('me gustaría conocer') || lowerMessage.includes('quiero conocer') || lowerMessage.includes('quiero entender') ||
        lowerMessage.includes('me puedes explicar') || lowerMessage.includes('puedes explicarme') || lowerMessage.includes('puedes contarme') ||
        lowerMessage.includes('puedes hablarme') || lowerMessage.includes('puedes decirme') || lowerMessage.includes('puedes informarme') ||
        lowerMessage.includes('déjame saber') || lowerMessage.includes('hazme saber') || lowerMessage.includes('avísame') ||
        lowerMessage.includes('coméntame') || lowerMessage.includes('cuéntame más') || lowerMessage.includes('dame más detalles') ||
        lowerMessage.includes('quiero más información') || lowerMessage.includes('necesito más información') || lowerMessage.includes('dame información') ||
        lowerMessage.includes('proporcióname información') || lowerMessage.includes('comparte información') || lowerMessage.includes('muéstrame') ||
        lowerMessage.includes('enséñame') || lowerMessage.includes('guíame') || lowerMessage.includes('orientame') ||
        lowerMessage.includes('aconsejame') || lowerMessage.includes('recomiéndame') || lowerMessage.includes('sugiéreme') ||
        lowerMessage.includes('opciones') || lowerMessage.includes('alternativas') || lowerMessage.includes('posibilidades') ||
        lowerMessage.includes('qué hay') || lowerMessage.includes('qué ofrecen') || lowerMessage.includes('qué tienen') ||
        lowerMessage.includes('qué servicios') || lowerMessage.includes('qué tratamientos') || lowerMessage.includes('qué opciones') ||
        lowerMessage.includes('todo') || lowerMessage.includes('información') || lowerMessage.includes('ayuda') ||
        lowerMessage.includes('qué') || lowerMessage.includes('cómo') || lowerMessage.includes('cuándo') ||
        lowerMessage.includes('dónde') || lowerMessage.includes('por qué') || lowerMessage.includes('horarios') || 
        lowerMessage.includes('fechas') || lowerMessage.includes('disponibilidad')) {
      return { type: 'faq', slots: { topic: 'general' } };
    }
    
    // Detectar intenciones de reserva (MÁS ESPECÍFICAS, sin palabras ambiguas)
    if ((lowerMessage.includes('reservar') || lowerMessage.includes('agendar') || lowerMessage.includes('pedir cita') ||
         lowerMessage.includes('hacer cita') || lowerMessage.includes('sacar cita') || lowerMessage.includes('conseguir cita') ||
         lowerMessage.includes('buscar cita') || lowerMessage.includes('encontrar cita') || lowerMessage.includes('apuntarme') ||
         lowerMessage.includes('inscribirme') || lowerMessage.includes('registrarme') || lowerMessage.includes('tomar cita') ||
         lowerMessage.includes('coger cita') || lowerMessage.includes('solicitar cita')) &&
        (lowerMessage.includes('cita') || lowerMessage.includes('hora') || lowerMessage.includes('fecha') ||
         lowerMessage.includes('turno') || lowerMessage.includes('cupo') || lowerMessage.includes('lugar'))) {
      return { type: 'book', slots: {} };
    }
    
    // Detectar intenciones de reserva por expresiones específicas
    if (lowerMessage.includes('quiero venir') || lowerMessage.includes('me gustaría venir') || lowerMessage.includes('necesito venir') ||
        lowerMessage.includes('puedo venir') || lowerMessage.includes('hay lugar') || lowerMessage.includes('tienen lugar') ||
        lowerMessage.includes('disponible') || lowerMessage.includes('libre') || lowerMessage.includes('vacante') ||
        lowerMessage.includes('hora libre') || lowerMessage.includes('fecha libre')) {
      return { type: 'book', slots: {} };
    }
    
    // Detectar intenciones de reprogramación (EXPANDIDO)
    if (lowerMessage.includes('mover') || lowerMessage.includes('cambiar') || lowerMessage.includes('reprogramar') ||
        lowerMessage.includes('modificar cita') || lowerMessage.includes('cambiar fecha') || lowerMessage.includes('cambiar hora') ||
        lowerMessage.includes('otra fecha') || lowerMessage.includes('otra hora') || lowerMessage.includes('diferente fecha') ||
        lowerMessage.includes('diferente hora') || lowerMessage.includes('no puedo ese día') || lowerMessage.includes('mejor otro día') ||
        lowerMessage.includes('prefiero') || lowerMessage.includes('mejor') || lowerMessage.includes('otro momento') ||
        lowerMessage.includes('reagendar') || lowerMessage.includes('reprogramar') || lowerMessage.includes('posponer') ||
        lowerMessage.includes('adelantar') || lowerMessage.includes('atrasar') || lowerMessage.includes('mover para') ||
        lowerMessage.includes('cambiar para') || lowerMessage.includes('mejor el') || lowerMessage.includes('mejor a las')) {
      return { type: 'reschedule', slots: {} };
    }
    
    // Detectar intenciones de cancelación (EXPANDIDO)
    if (lowerMessage.includes('cancelar') || lowerMessage.includes('anular') || lowerMessage.includes('borrar cita') ||
        lowerMessage.includes('no puedo venir') || lowerMessage.includes('no voy a poder') || lowerMessage.includes('me arrepentí') ||
        lowerMessage.includes('ya no quiero') || lowerMessage.includes('mejor no') || lowerMessage.includes('déjalo') ||
        lowerMessage.includes('olvídalo') || lowerMessage.includes('no me interesa') || lowerMessage.includes('mejor otro día') ||
        lowerMessage.includes('tengo un problema') || lowerMessage.includes('emergencia') || lowerMessage.includes('imprevisto') ||
        lowerMessage.includes('no puedo asistir') || lowerMessage.includes('no voy a asistir') || lowerMessage.includes('mejor cancelo') ||
        lowerMessage.includes('quiero cancelar') || lowerMessage.includes('necesito cancelar') || lowerMessage.includes('tengo que cancelar') ||
        lowerMessage.includes('mejor lo dejo') || lowerMessage.includes('mejor lo cancelo') || lowerMessage.includes('no va a ser posible')) {
      return { type: 'cancel', slots: {} };
    }
    
    // Detectar intenciones de confirmación (EXPANDIDO)
    if (lowerMessage.includes('confirmar') || lowerMessage.includes('confirmación') || lowerMessage.includes('verificar') ||
        lowerMessage.includes('está confirmada') || lowerMessage.includes('está confirmado') || lowerMessage.includes('ya está confirmada') ||
        lowerMessage.includes('ya está confirmado') || lowerMessage.includes('me confirmas') || lowerMessage.includes('puedes confirmar') ||
        lowerMessage.includes('quiero confirmar') || lowerMessage.includes('necesito confirmar') || lowerMessage.includes('tengo que confirmar') ||
        lowerMessage.includes('es correcto') || lowerMessage.includes('está bien') || lowerMessage.includes('está todo bien') ||
        lowerMessage.includes('está todo correcto') || lowerMessage.includes('me aseguro') || lowerMessage.includes('me aseguro que') ||
        lowerMessage.includes('quiero estar seguro') || lowerMessage.includes('quiero estar segura') || lowerMessage.includes('me quedo tranquilo') ||
        lowerMessage.includes('me quedo tranquila') || lowerMessage.includes('está todo listo') || lowerMessage.includes('está todo preparado')) {
      return { type: 'confirm', slots: {} };
    }
    
    // Detectar intenciones de ventas/servicios (EXPANDIDO)
    if (lowerMessage.includes('precio') || lowerMessage.includes('costo') || lowerMessage.includes('servicio') ||
        lowerMessage.includes('cuánto cuesta') || lowerMessage.includes('tarifa') || lowerMessage.includes('servicios') ||
        lowerMessage.includes('cuánto vale') || lowerMessage.includes('cuánto sale') || lowerMessage.includes('cuánto es') ||
        lowerMessage.includes('qué precio') || lowerMessage.includes('qué costo') || lowerMessage.includes('qué tarifa') ||
        lowerMessage.includes('información de precios') || lowerMessage.includes('lista de precios') || lowerMessage.includes('tabla de precios') ||
        lowerMessage.includes('oferta') || lowerMessage.includes('descuento') || lowerMessage.includes('promoción') ||
        lowerMessage.includes('paquete') || lowerMessage.includes('combo') || lowerMessage.includes('oferta especial') ||
        lowerMessage.includes('precio especial') || lowerMessage.includes('tarifa especial') || lowerMessage.includes('costo especial') ||
        lowerMessage.includes('qué incluye') || lowerMessage.includes('qué viene incluido') || lowerMessage.includes('qué está incluido') ||
        lowerMessage.includes('qué servicios') || lowerMessage.includes('qué tratamientos') || lowerMessage.includes('qué opciones')) {
      return { type: 'sales', slots: { topic: 'servicios' } };
    }
    
    // Esta sección ya no es necesaria, se movió arriba para evitar conflictos
    
    // Detectar intenciones de contacto y ubicación
    if (lowerMessage.includes('dónde están') || lowerMessage.includes('dónde se ubican') || lowerMessage.includes('dirección') ||
        lowerMessage.includes('ubicación') || lowerMessage.includes('localización') || lowerMessage.includes('zona') ||
        lowerMessage.includes('barrio') || lowerMessage.includes('ciudad') || lowerMessage.includes('cómo llegar') ||
        lowerMessage.includes('cómo ir') || lowerMessage.includes('ruta') || lowerMessage.includes('transporte') ||
        lowerMessage.includes('metro') || lowerMessage.includes('bus') || lowerMessage.includes('autobús') ||
        lowerMessage.includes('coche') || lowerMessage.includes('carro') || lowerMessage.includes('estacionamiento') ||
        lowerMessage.includes('parking') || lowerMessage.includes('parada') || lowerMessage.includes('estación')) {
      return { type: 'faq', slots: { topic: 'ubicacion' } };
    }
    
    // Detectar intenciones de contacto
    if (lowerMessage.includes('teléfono') || lowerMessage.includes('teléfono') || lowerMessage.includes('número') ||
        lowerMessage.includes('contacto') || lowerMessage.includes('email') || lowerMessage.includes('correo') ||
        lowerMessage.includes('whatsapp') || lowerMessage.includes('mensaje') || lowerMessage.includes('llamar') ||
        lowerMessage.includes('escribir') || lowerMessage.includes('escribirle') || lowerMessage.includes('contactarle') ||
        lowerMessage.includes('hablar con') || lowerMessage.includes('hablarle') || lowerMessage.includes('comunicarme') ||
        lowerMessage.includes('comunicación') || lowerMessage.includes('canal') || lowerMessage.includes('medio')) {
      return { type: 'faq', slots: { topic: 'contacto' } };
    }
    
    // Detectar intenciones de emergencia o urgencia
    if (lowerMessage.includes('emergencia') || lowerMessage.includes('urgente') || lowerMessage.includes('inmediato') ||
        lowerMessage.includes('ahora mismo') || lowerMessage.includes('ya') || lowerMessage.includes('pronto') ||
        lowerMessage.includes('rápido') || lowerMessage.includes('inmediatamente') || lowerMessage.includes('lo antes posible') ||
        lowerMessage.includes('cuanto antes') || lowerMessage.includes('urgentemente') || lowerMessage.includes('crítico') ||
        lowerMessage.includes('grave') || lowerMessage.includes('serio') || lowerMessage.includes('importante')) {
      return { type: 'faq', slots: { topic: 'emergencia' } };
    }
    
    // Por defecto, tratar como FAQ general
    return { type: 'faq', slots: { topic: 'general' } };
  }

  /**
   * Verifica si Ollama está disponible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Exportar instancia singleton
export const llmService = new LLMService();
export default llmService;
