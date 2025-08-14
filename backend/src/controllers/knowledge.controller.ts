import { Request, Response } from 'express';
import { ragService } from '../services/rag.service';

export class KnowledgeController {
  /**
   * Subir nuevo conocimiento al sistema RAG
   */
  async uploadKnowledge(req: Request, res: Response) {
    try {
      const { source, content } = req.body;
      
      if (!source || !content) {
        res.status(400).json({
          success: false,
          error: 'Se requieren source y content'
        });
        return;
      }
      
      const totalChunks = await ragService.addKnowledge(source, content);
      
      res.status(201).json({
        success: true,
        data: { totalChunks },
        message: `Conocimiento agregado exitosamente. ${totalChunks} chunks creados.`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        details: error.details || null
      });
    }
  }

  /**
   * Buscar en el conocimiento RAG
   */
  async searchKnowledge(req: Request, res: Response) {
    try {
      const { q, k = '5' } = req.query;
      
      if (!q) {
        res.status(400).json({
          success: false,
          error: 'Se requiere un término de búsqueda'
        });
        return;
      }

      const results = await ragService.search(q as string, parseInt(k as string));
      
      res.json({
        success: true,
        data: results
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener estadísticas del conocimiento
   */
  async getKnowledgeStats(req: Request, res: Response) {
    try {
      const stats = await ragService.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Eliminar conocimiento por fuente
   */
  async removeKnowledgeBySource(req: Request, res: Response) {
    try {
      const { source } = req.params;
      
      if (!source) {
        res.status(400).json({
          success: false,
          error: 'Se requiere el nombre de la fuente'
        });
        return;
      }

      const deletedCount = await ragService.removeKnowledgeBySource(source);
      
      res.json({
        success: true,
        data: { deletedCount },
        message: `Conocimiento de la fuente "${source}" eliminado exitosamente`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener todas las fuentes de conocimiento
   */
  async getAllKnowledgeSources(req: Request, res: Response) {
    try {
      // Por ahora, obtener fuentes desde la base de datos directamente
      // TODO: Implementar método getSources en RAGService si es necesario
      res.json({
        success: true,
        data: [],
        message: 'Funcionalidad en desarrollo'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener chunks de una fuente específica
   */
  async getKnowledgeChunksBySource(req: Request, res: Response) {
    try {
      const { source } = req.params;
      const { limit = '50', offset = '0' } = req.query;
      
      if (!source) {
        res.status(400).json({
          success: false,
          error: 'Se requiere el nombre de la fuente'
        });
        return;
      }

      // Por ahora, devolver mensaje de funcionalidad en desarrollo
      res.json({
        success: true,
        data: [],
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

export const knowledgeController = new KnowledgeController();
