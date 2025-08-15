import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import ragService from '../services/rag.service';

const router = Router();

/**
 * Endpoint de depuración para diagnosticar el sistema RAG
 * GET /api/rag/debug?q=medicamentos
 */
router.get('/debug', asyncHandler(async (req: Request, res: Response) => {
  const query = String(req.query.q || '');
  
  if (!query.trim()) {
    return res.status(400).json({
      error: 'Se requiere parámetro "q" (query)',
      ejemplo: '/api/rag/debug?q=medicamentos'
    });
  }

  console.log(`🔍 DEBUG RAG - Query: "${query}"`);

  try {
    // 1. Búsqueda vectorial simple
    const vectorResults = await ragService.search(query, 8, 0.20);
    
    // 2. Búsqueda híbrida (vector + texto)
    const hybridResults = await ragService.hybridSearch(query, 8, 0.22);
    
    // 3. Expansión de consulta
    const expandedQuery = ragService.expandQuery(query);
    
    // 4. Información de la base de datos
    const dbInfo = await ragService.getDatabaseInfo();

    const debugInfo: any = {
      query: {
        original: query,
        expanded: expandedQuery
      },
      database: dbInfo,
      vectorSearch: {
        query: query,
        results: vectorResults.chunks.map((chunk, index) => ({
          rank: index + 1,
          score: chunk.score?.toFixed(3) || 'N/A',
          source: chunk.source,
          snippet: chunk.chunk_text.substring(0, 150) + '...',
          hasRelevantContext: vectorResults.hasRelevantContext
        })),
        totalScore: vectorResults.totalScore,
        sources: vectorResults.sources
      },
      hybridSearch: {
        query: expandedQuery,
        results: hybridResults.chunks.map((chunk, index) => ({
          rank: index + 1,
          score: chunk.score?.toFixed(3) || 'N/A',
          source: chunk.source,
          snippet: chunk.chunk_text.substring(0, 150) + '...',
          hasRelevantContext: hybridResults.hasRelevantContext
        })),
        totalScore: hybridResults.totalScore,
        sources: hybridResults.sources
      },
      recommendations: {
        vectorWorking: vectorResults.hasRelevantContext,
        hybridWorking: hybridResults.hasRelevantContext,
        suggestedActions: [] as string[]
      }
    };

    // Generar recomendaciones
    if (!vectorResults.hasRelevantContext && !hybridResults.hasRelevantContext) {
      debugInfo.recommendations.suggestedActions.push(
        '❌ Ninguna búsqueda encontró contexto relevante',
        '🔧 Verificar que los embeddings estén generados correctamente',
        '🔧 Reducir el umbral de similitud (minScore)',
        '🔧 Aumentar el número de chunks (topK)',
        '🔧 Verificar que la consulta no sea demasiado genérica'
      );
    } else if (vectorResults.hasRelevantContext && !hybridResults.hasRelevantContext) {
      debugInfo.recommendations.suggestedActions.push(
        '✅ Búsqueda vectorial funciona',
        '⚠️  Búsqueda híbrida no mejora los resultados',
        '🔧 Verificar configuración de BM25/texto'
      );
    } else {
      debugInfo.recommendations.suggestedActions.push(
        '🎉 Sistema RAG funcionando correctamente',
        '✅ Búsqueda vectorial y híbrida funcionan',
        '💡 Considerar ajustar umbrales para optimizar'
      );
    }

    return res.json(debugInfo);

  } catch (error) {
    console.error('Error en debug RAG:', error);
    res.status(500).json({
      error: 'Error al depurar RAG',
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    });
    return;
  }
}));

export default router;
