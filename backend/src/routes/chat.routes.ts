import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';

const router = Router();

/**
 * @route POST /api/chat
 * @desc Procesar mensaje de chat
 * @access Public
 */
router.post('/', chatController.processMessage);

/**
 * @route GET /api/chat/history
 * @desc Obtener historial de mensajes
 * @access Public
 */
router.get('/history', chatController.getMessageHistory);

/**
 * @route GET /api/chat/stats
 * @desc Obtener estadísticas del chat
 * @access Public
 */
router.get('/stats', chatController.getChatStats);

/**
 * @route GET /api/chat/conversation-state
 * @desc Obtener estado de la conversación
 * @access Public
 */
router.get('/conversation-state', chatController.getConversationState);

/**
 * @route DELETE /api/chat/reset-conversation
 * @desc Resetear conversación de un usuario
 * @access Public
 */
router.delete('/reset-conversation', chatController.resetConversation);

export default router;

