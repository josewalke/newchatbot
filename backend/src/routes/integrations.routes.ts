import { Router } from 'express';
import { telegramController } from '../controllers/telegram.controller';

const router = Router();

// Rutas de Telegram
router.post('/telegram/webhook', telegramController.handleWebhook);
router.get('/telegram/bot-info', telegramController.getBotInfo);
router.post('/telegram/set-webhook', telegramController.setWebhook);
router.delete('/telegram/delete-webhook', telegramController.deleteWebhook);
router.post('/telegram/send-test', telegramController.sendTestMessage);
router.get('/telegram/webhook-info', telegramController.getWebhookInfo);

export default router;

