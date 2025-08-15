import { Router } from 'express';
import chatEnhancedController from '../controllers/chat.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { chatMessageSchema } from '../utils/validators';

const router = Router();

/**
 * @route POST /api/chat
 * @desc Procesar mensaje de chat
 * @access Public
 */
router.post('/', validateBody(chatMessageSchema), chatEnhancedController.processMessage);

/**
 * @route GET /api/chat/stats/:sessionId
 * @desc Obtener estadísticas de la conversación
 * @access Public
 */
router.get('/stats/:sessionId', chatEnhancedController.getConversationStats);

/**
 * @route GET /api/chat/context/:sessionId
 * @desc Obtener contexto de la conversación
 * @access Public
 */
router.get('/context/:sessionId', chatEnhancedController.getConversationContext);

/**
 * @route GET /api/chat/suggestions/:sessionId
 * @desc Obtener sugerencias contextuales
 * @access Public
 */
router.get('/suggestions/:sessionId', chatEnhancedController.getContextualSuggestions);

export default router;

