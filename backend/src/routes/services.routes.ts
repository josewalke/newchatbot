import { Router } from 'express';
import { servicesController } from '../controllers/services.controller';

const router = Router();

// Obtener todos los servicios
router.get('/', servicesController.getAllServices);

// Obtener un servicio específico
router.get('/:id', servicesController.getServiceById);

export default router;
