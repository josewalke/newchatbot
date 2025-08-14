import { Request, Response } from 'express';
import { telegramService } from '../services/telegram.service';

export class TelegramController {
  /**
   * Webhook para recibir actualizaciones de Telegram
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const update = req.body;
      
      // Verificar que sea una actualización válida de Telegram
      if (!update || !update.message) {
        res.status(400).json({
          success: false,
          error: 'Actualización de Telegram inválida'
        });
        return;
      }

      // Procesar la actualización de forma asíncrona
      telegramService.processUpdate(update).catch(error => {
        console.error('Error procesando actualización de Telegram:', error);
      });

      // Responder inmediatamente a Telegram (requerido por la API)
      res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('Error en webhook de Telegram:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener información del bot
   */
  async getBotInfo(req: Request, res: Response) {
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
   * Configurar webhook
   */
  async setWebhook(req: Request, res: Response) {
    try {
      const { url } = req.body;
      
      if (!url) {
        res.status(400).json({
          success: false,
          error: 'Se requiere la URL del webhook'
        });
        return;
      }

      const result = await telegramService.setWebhook(url);
      
      res.json({
        success: true,
        data: result,
        message: 'Webhook configurado exitosamente'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Eliminar webhook
   */
  async deleteWebhook(req: Request, res: Response) {
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
   * Enviar mensaje de prueba
   */
  async sendTestMessage(req: Request, res: Response) {
    try {
      const { chatId, message } = req.body;
      
      if (!chatId || !message) {
        res.status(400).json({
          success: false,
          error: 'Se requieren chatId y message'
        });
        return;
      }

      const result = await telegramService.sendMessage(chatId, message);
      
      res.json({
        success: true,
        data: result,
        message: 'Mensaje enviado exitosamente'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener estado del webhook
   */
  async getWebhookInfo(req: Request, res: Response) {
    try {
      // TODO: Implementar getWebhookInfo en TelegramService
      // const webhookInfo = await telegramService.getWebhookInfo();
      
      res.json({
        success: true,
        data: { status: 'not_implemented' },
        message: 'Funcionalidad en desarrollo'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const telegramController = new TelegramController();

