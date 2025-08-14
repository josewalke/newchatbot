import { Request, Response } from 'express';
import dbManager from '../db/db';

export class ServicesController {
  /**
   * Obtiene todos los servicios activos
   */
  async getAllServices(req: Request, res: Response) {
    try {
      const services = dbManager.query<{
        id: number;
        name: string;
        duration_min: number;
        price_cents: number;
        active: boolean;
        created_at: string;
        updated_at: string;
      }>(
        'SELECT * FROM services WHERE active = 1 ORDER BY name'
      );

      res.json({
        success: true,
        data: services
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtiene un servicio por ID
   */
  async getServiceById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const service = dbManager.queryFirst<{
        id: number;
        name: string;
        duration_min: number;
        price_cents: number;
        active: boolean;
        created_at: string;
        updated_at: string;
      }>(
        'SELECT * FROM services WHERE id = ? AND active = 1',
        [parseInt(id)]
      );

      if (!service) {
        res.status(404).json({
          success: false,
          error: 'Servicio no encontrado'
        });
        return;
      }

      res.json({
        success: true,
        data: service
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const servicesController = new ServicesController();
