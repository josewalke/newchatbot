import axios from 'axios';
import config from '../utils/env';
import { OperationalError } from '../middlewares/error.middleware';
import llmService from './llm.service';

/**
 * Interfaz para el mensaje de Telegram
 */
interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  date: number;
  text?: string;
}

/**
 * Interfaz para la actualización de Telegram
 */
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

/**
 * Interfaz para la respuesta de envío de mensaje
 */
interface SendMessageResponse {
  ok: boolean;
  result: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    date: number;
    text: string;
  };
}

/**
 * Servicio para integración con Telegram
 */
export class TelegramService {
  private botToken: string;
  private apiBaseUrl: string;

  constructor() {
    this.botToken = config.telegramBotToken;
    this.apiBaseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Verifica si el bot está configurado
   */
  isConfigured(): boolean {
    return !!this.botToken && this.botToken.length > 0;
  }

  /**
   * Procesa una actualización de Telegram
   */
  async processUpdate(update: TelegramUpdate): Promise<void> {
    try {
      if (!this.isConfigured()) {
        console.warn('Bot de Telegram no configurado');
        return;
      }

      const message = update.message || update.edited_message;
      if (!message || !message.text) {
        return;
      }

      // Generar ID único para el usuario
      const userId = `telegram_${message.chat.id}`;
      
      // Procesar el mensaje con el LLM
      const response = await this.processMessage(message.text, userId);
      
      // Enviar respuesta
      await this.sendMessage(message.chat.id, response);
      
    } catch (error) {
      console.error('Error al procesar actualización de Telegram:', error);
      
      // Enviar mensaje de error al usuario
      if (update.message?.chat.id) {
        try {
          await this.sendMessage(
            update.message.chat.id,
            'Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo más tarde.'
          );
        } catch (sendError) {
          console.error('Error al enviar mensaje de error:', sendError);
        }
      }
    }
  }

  /**
   * Procesa un mensaje del usuario
   */
  private async processMessage(messageText: string, userId: string): Promise<string> {
    try {
      // Clasificar la intención
      const intent = await llmService.classifyIntent(messageText);
      
      // Generar respuesta basada en la intención
      let response = '';
      
      switch (intent.type) {
        case 'book':
          response = await this.handleBookingIntent(messageText, intent.slots, userId);
          break;
        case 'reschedule':
          response = await this.handleRescheduleIntent(messageText, intent.slots, userId);
          break;
        case 'cancel':
          response = await this.handleCancelIntent(messageText, intent.slots, userId);
          break;
        case 'confirm':
          response = await this.handleConfirmIntent(messageText, intent.slots, userId);
          break;
        case 'faq':
          response = await this.handleFAQIntent(messageText, intent.slots, userId);
          break;
        case 'sales':
          response = await this.handleSalesIntent(messageText, intent.slots, userId);
          break;
        default:
          response = 'No entiendo tu solicitud. ¿Puedes reformularla?';
      }
      
      return response;
    } catch (error) {
      console.error('Error al procesar mensaje:', error);
      return 'Lo siento, ha ocurrido un error al procesar tu mensaje. ¿Puedes intentarlo de nuevo?';
    }
  }

  /**
   * Maneja la intención de reserva
   */
  private async handleBookingIntent(
    messageText: string,
    slots: Record<string, any>,
    userId: string
  ): Promise<string> {
    // Verificar si tenemos la información necesaria
    if (!slots.datetimeISO && !slots.date && !slots.time) {
      return 'Para ayudarte a reservar una cita, necesito saber cuándo te gustaría venir. ¿Podrías indicarme la fecha y hora preferida?';
    }
    
    if (!slots.service) {
      return '¿Qué tipo de servicio te gustaría reservar? Tenemos consultas generales, sesiones terapéuticas y evaluaciones iniciales.';
    }
    
    if (!slots.name) {
      return '¿Podrías decirme tu nombre para completar la reserva?';
    }
    
    // Aquí se integraría con el servicio de citas
    return 'Perfecto, tengo toda la información necesaria. Te ayudo a reservar tu cita. ¿Prefieres que lo haga ahora mismo o tienes alguna pregunta adicional?';
  }

  /**
   * Maneja la intención de reprogramar
   */
  private async handleRescheduleIntent(
    messageText: string,
    slots: Record<string, any>,
    userId: string
  ): Promise<string> {
    if (!slots.id) {
      return 'Para reprogramar tu cita, necesito el número de confirmación. ¿Podrías proporcionármelo?';
    }
    
    if (!slots.newDatetimeISO && !slots.date && !slots.time) {
      return '¿Cuándo te gustaría reprogramar la cita? Por favor, indícame la nueva fecha y hora.';
    }
    
    return 'Perfecto, puedo ayudarte a reprogramar tu cita. ¿Te parece bien si procedo con el cambio?';
  }

  /**
   * Maneja la intención de cancelar
   */
  private async handleCancelIntent(
    messageText: string,
    slots: Record<string, any>,
    userId: string
  ): Promise<string> {
    if (!slots.id) {
      return 'Para cancelar tu cita, necesito el número de confirmación. ¿Podrías proporcionármelo?';
    }
    
    return 'Entiendo que quieres cancelar tu cita. ¿Estás seguro? Solo se pueden cancelar citas con más de 24 horas de anticipación.';
  }

  /**
   * Maneja la intención de confirmar
   */
  private async handleConfirmIntent(
    messageText: string,
    slots: Record<string, any>,
    userId: string
  ): Promise<string> {
    if (!slots.id) {
      return 'Para confirmar tu cita, necesito el número de confirmación. ¿Podrías proporcionármelo?';
    }
    
    return 'Perfecto, puedo ayudarte a confirmar tu cita. ¿Te parece bien si procedo con la confirmación?';
  }

  /**
   * Maneja la intención de FAQ
   */
  private async handleFAQIntent(
    messageText: string,
    slots: Record<string, any>,
    userId: string
  ): Promise<string> {
    // Aquí se integraría con el servicio RAG
    return 'Tengo información sobre nuestros servicios, horarios, políticas de cancelación y más. ¿Qué te gustaría saber específicamente?';
  }

  /**
   * Maneja la intención de ventas
   */
  private async handleSalesIntent(
    messageText: string,
    slots: Record<string, any>,
    userId: string
  ): Promise<string> {
    // Aquí se integraría con el servicio de ventas
    return 'Te puedo ayudar con información sobre nuestros servicios y precios. Tenemos consultas desde 50€, sesiones terapéuticas desde 80€ y evaluaciones completas desde 120€. ¿Te gustaría que te ayude a reservar alguna?';
  }

  /**
   * Envía un mensaje a un chat específico
   */
  async sendMessage(chatId: number, text: string): Promise<SendMessageResponse> {
    try {
      if (!this.isConfigured()) {
        throw new OperationalError('Bot de Telegram no configurado', 500);
      }

      const response = await axios.post<SendMessageResponse>(
        `${this.apiBaseUrl}/sendMessage`,
        {
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown',
        },
        {
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error al enviar mensaje de Telegram:', error.response?.data);
        throw new OperationalError(
          `Error al enviar mensaje: ${error.response?.data?.description || error.message}`,
          500
        );
      }
      throw error;
    }
  }

  /**
   * Envía un mensaje con botones inline
   */
  async sendMessageWithButtons(
    chatId: number,
    text: string,
    buttons: Array<Array<{ text: string; callback_data: string }>>
  ): Promise<SendMessageResponse> {
    try {
      if (!this.isConfigured()) {
        throw new OperationalError('Bot de Telegram no configurado', 500);
      }

      const response = await axios.post<SendMessageResponse>(
        `${this.apiBaseUrl}/sendMessage`,
        {
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons,
          },
        },
        {
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error al enviar mensaje con botones:', error.response?.data);
        throw new OperationalError(
          `Error al enviar mensaje: ${error.response?.data?.description || error.message}`,
          500
        );
      }
      throw error;
    }
  }

  /**
   * Verifica el estado del bot
   */
  async getBotInfo(): Promise<any> {
    try {
      if (!this.isConfigured()) {
        throw new OperationalError('Bot de Telegram no configurado', 500);
      }

      const response = await axios.get(`${this.apiBaseUrl}/getMe`, {
        timeout: 5000,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error al obtener información del bot:', error.response?.data);
        throw new OperationalError(
          `Error al obtener información del bot: ${error.response?.data?.description || error.message}`,
          500
        );
      }
      throw error;
    }
  }

  /**
   * Configura el webhook del bot
   */
  async setWebhook(webhookUrl: string): Promise<any> {
    try {
      if (!this.isConfigured()) {
        throw new OperationalError('Bot de Telegram no configurado', 500);
      }

      const response = await axios.post(
        `${this.apiBaseUrl}/setWebhook`,
        {
          url: webhookUrl,
          allowed_updates: ['message', 'edited_message'],
        },
        {
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error al configurar webhook:', error.response?.data);
        throw new OperationalError(
          `Error al configurar webhook: ${error.response?.data?.description || error.message}`,
          500
        );
      }
      throw error;
    }
  }

  /**
   * Elimina el webhook del bot
   */
  async deleteWebhook(): Promise<any> {
    try {
      if (!this.isConfigured()) {
        throw new OperationalError('Bot de Telegram no configurado', 500);
      }

      const response = await axios.post(`${this.apiBaseUrl}/deleteWebhook`, {}, {
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error al eliminar webhook:', error.response?.data);
        throw new OperationalError(
          `Error al eliminar webhook: ${error.response?.data?.description || error.message}`,
          500
        );
      }
      throw error;
    }
  }
}

// Exportar instancia singleton
export const telegramService = new TelegramService();
export default telegramService;
