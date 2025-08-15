import { Request, Response } from 'express';
import { telegramService } from '../services/telegram.service';

export class IntegrationsController {
  /**
   * Webhook para recibir actualizaciones de Telegram
   */
  async telegramWebhook(req: Request, res: Response) {
    try {
      const update = req.body;
      
      // Verificar que sea una actualización válida de Telegram
      if (!update || !update.message) {
        return res.status(400).json({
          success: false,
          error: 'Actualización de Telegram inválida'
        });
      }

      // Procesar la actualización de forma asíncrona
      telegramService.processUpdate(update).catch(error => {
        console.error('Error procesando actualización de Telegram:', error);
      });

      // Responder inmediatamente a Telegram (requerido por la API)
      return res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('Error en webhook de Telegram:', error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener información del bot de Telegram
   */
  async getTelegramBotInfo(req: Request, res: Response) {
    try {
      const botInfo = await telegramService.getBotInfo();
      
      res.json({
        success: true,
        data: botInfo
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Configurar webhook de Telegram
   */
  async setTelegramWebhook(req: Request, res: Response) {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere la URL del webhook'
        });
      }

      const result = await telegramService.setWebhook(url);
      
      return res.json({
        success: true,
        data: result,
        message: 'Webhook configurado exitosamente'
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Eliminar webhook de Telegram
   */
  async deleteTelegramWebhook(req: Request, res: Response) {
    try {
      const result = await telegramService.deleteWebhook();
      
      res.json({
        success: true,
        data: result,
        message: 'Webhook eliminado exitosamente'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Enviar mensaje de prueba a Telegram
   */
  async sendTelegramTestMessage(req: Request, res: Response) {
    try {
      const { chatId, message } = req.body;
      
      if (!chatId || !message) {
        return res.status(400).json({
          success: false,
          error: 'Se requieren chatId y message'
        });
      }

      const result = await telegramService.sendMessage(chatId, message);
      
      return res.json({
        success: true,
        data: result,
        message: 'Mensaje enviado exitosamente'
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener información del webhook de Telegram
   */
  async getTelegramWebhookInfo(req: Request, res: Response) {
    try {
      // TODO: Implementar getWebhookInfo en TelegramService
      const webhookInfo = { status: 'not_implemented' };
      
      res.json({
        success: true,
        data: webhookInfo
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const integrationsController = new IntegrationsController();
export default integrationsController;

