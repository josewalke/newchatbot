import { Router } from 'express';
import { knowledgeController } from '../controllers/knowledge.controller';

const router = Router();

/**
 * @route POST /api/knowledge/upload
 * @desc Subir nuevo conocimiento al sistema RAG
 * @access Public
 */
router.post('/upload', knowledgeController.uploadKnowledge);

/**
 * @route GET /api/knowledge/search
 * @desc Buscar en el conocimiento RAG
 * @access Public
 */
router.get('/search', knowledgeController.searchKnowledge);

/**
 * @route GET /api/knowledge/stats
 * @desc Obtener estadísticas del conocimiento
 * @access Public
 */
router.get('/stats', knowledgeController.getKnowledgeStats);

/**
 * @route GET /api/knowledge/sources
 * @desc Obtener todas las fuentes de conocimiento
 * @access Public
 */
router.get('/sources', knowledgeController.getAllKnowledgeSources);

/**
 * @route GET /api/knowledge/sources/:source/chunks
 * @desc Obtener chunks de una fuente específica
 * @access Public
 */
router.get('/sources/:source/chunks', knowledgeController.getKnowledgeChunksBySource);

/**
 * @route DELETE /api/knowledge/sources/:source
 * @desc Eliminar conocimiento por fuente
 * @access Public
 */
router.delete('/sources/:source', knowledgeController.removeKnowledgeBySource);

export default router;

