import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import dbManager from '../db/db';
import embeddingsService from '../services/embeddings.service';

const router = Router();

/**
 * Endpoint de salud del sistema
 */
router.get('/', asyncHandler(async (req: any, res: any) => {
  try {
    // Verificar base de datos
    const db = dbManager.getDatabase();
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
          const tableNames = tables.map((t: any) => t.name);
    
    // Verificar tablas críticas
    const criticalTables = ['customers', 'services', 'knowledge', 'embeddings', 'conversation_sessions', 'conversation_messages'];
    const missingTables = criticalTables.filter(t => !tableNames.includes(t));
    
    // Verificar embeddings
    const embeddingsHealth = await embeddingsService.healthCheck();
    
    // Verificar conocimiento y embeddings
    const knowledgeCount = (db.prepare('SELECT COUNT(*) as count FROM knowledge').get() as any)?.count || 0;
    const embeddingsCount = (db.prepare('SELECT COUNT(*) as count FROM embeddings').get() as any)?.count || 0;
    
    // Verificar memoria conversacional
    const sessionsCount = (db.prepare('SELECT COUNT(*) as count FROM conversation_sessions').get() as any)?.count || 0;
    const messagesCount = (db.prepare('SELECT COUNT(*) as count FROM conversation_messages').get() as any)?.count || 0;
    
    const healthStatus = {
      timestamp: new Date().toISOString(),
      status: missingTables.length === 0 && embeddingsHealth.status === 'healthy' ? 'healthy' : 'degraded',
      database: {
        path: db.name,
        tables: tableNames,
        missingTables,
        knowledgeCount,
        embeddingsCount,
        sessionsCount,
        messagesCount
      },
      embeddings: embeddingsHealth,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
    
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    res.status(500).json({
      timestamp: new Date().toISOString(),
      status: 'unhealthy',
      error: (error as Error).message
    });
  }
}));

export default router;
