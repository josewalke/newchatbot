import { Router } from 'express';
import supplementsController from '../controllers/supplements.controller';

const router = Router();

/**
 * @route GET /api/supplements
 * @desc Lista todos los suplementos disponibles
 * @access Public
 */
router.get('/', supplementsController.listSupplements);

/**
 * @route GET /api/supplements/search
 * @desc Busca suplementos por término, categoría o precio
 * @access Public
 */
router.get('/search', supplementsController.searchSupplements);

/**
 * @route GET /api/supplements/categories
 * @desc Obtiene todas las categorías de suplementos
 * @access Public
 */
router.get('/categories', supplementsController.getSupplementCategories);

/**
 * @route GET /api/supplements/popular
 * @desc Obtiene suplementos populares
 * @access Public
 */
router.get('/popular', supplementsController.getPopularSupplements);

/**
 * @route GET /api/supplements/benefit
 * @desc Obtiene suplementos por beneficio específico
 * @access Public
 */
router.get('/benefit', supplementsController.getSupplementsByBenefit);

/**
 * @route GET /api/supplements/:id
 * @desc Obtiene detalles completos de un suplemento
 * @access Public
 */
router.get('/:id', supplementsController.getSupplementDetails);

export default router;
