import dbManager from '../db/db';
import llmService from './llm.service';
import { findTopKSimilar, normalizeVector } from '../utils/vector';
import { OperationalError } from '../middlewares/error.middleware';

/**
 * Interfaz para un chunk de conocimiento
 */
interface KnowledgeChunk {
  id: number;
  source: string;
  chunk_text: string;
  score?: number;
}

/**
 * Interfaz para el resultado de búsqueda RAG
 */
interface RAGResult {
  chunks: KnowledgeChunk[];
  totalScore: number;
  sources: string[];
  hasRelevantContext: boolean;
}

/**
 * Servicio de RAG (Retrieval Augmented Generation) mejorado con búsqueda híbrida
 */
export class RAGService {
  /**
   * Expande consultas genéricas para mejorar la búsqueda
   */
  expandQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Expansión para consultas farmacéuticas
    if (lowerQuery.includes('medicamento') || lowerQuery.includes('medicina')) {
      return query + ' fármacos dispensación receta OTC posología principio activo efectos secundarios';
    }
    
    if (lowerQuery.includes('servicio') || lowerQuery.includes('servicios')) {
      return query + ' consulta farmacéutica medición presión glucosa vacunación consejo nutricional';
    }
    
    if (lowerQuery.includes('horario') || lowerQuery.includes('horarios')) {
      return query + ' farmacia 24/7 atención nocturna emergencia disponible';
    }
    
    if (lowerQuery.includes('precio') || lowerQuery.includes('costo')) {
      return query + ' euros coste tarifa consulta gratuita medición';
    }
    
    return query;
  }

  /**
   * Búsqueda vectorial mejorada con umbrales optimizados
   */
  async search(
    query: string,
    k: number = 8, // Aumentado para mejor cobertura
    minScore: number = 0.25 // Reducido para capturar más resultados
  ): Promise<RAGResult> {
    try {
      console.log(`🔍 RAG Search: "${query}" - k=${k}, minScore=${minScore}`);
      
      // Generar embeddings para la consulta
      const queryEmbedding = await llmService.generateEmbeddings(query);
      
      if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
        console.warn('No se pudieron generar embeddings para la consulta:', query);
        return {
          chunks: [],
          totalScore: 0,
          sources: [],
          hasRelevantContext: false,
        };
      }
      
      const normalizedQueryEmbedding = normalizeVector(queryEmbedding);
      console.log(`✅ Embedding generado: ${normalizedQueryEmbedding.length} dimensiones`);

      // Obtener todos los embeddings de la base de datos
      const embeddings = dbManager.query<{
        id: number;
        knowledge_id: number;
        vector_json: string;
      }>(
        'SELECT id, knowledge_id, vector_json FROM embeddings'
      );

      if (embeddings.length === 0) {
        console.warn('No hay embeddings en la base de datos');
        return {
          chunks: [],
          totalScore: 0,
          sources: [],
          hasRelevantContext: false,
        };
      }

      console.log(`📊 Comparando con ${embeddings.length} embeddings`);

      // Convertir embeddings de JSON a arrays
      const embeddingVectors = embeddings.map(emb => ({
        id: emb.id,
        knowledgeId: emb.knowledge_id,
        vector: JSON.parse(emb.vector_json) as number[],
      }));

      // Buscar similitud con más candidatos
      const initialK = Math.min(k * 2, embeddingVectors.length);
      const similarities = findTopKSimilar(
        normalizedQueryEmbedding,
        embeddingVectors.map(emb => emb.vector),
        initialK
      );

      console.log(`🔍 Similitudes encontradas: ${similarities.length}`);

      // Filtrar por umbral y ordenar
      const filteredSimilarities = similarities
        .filter(sim => sim.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

      console.log(`✅ Chunks filtrados: ${filteredSimilarities.length} (umbral ${minScore})`);

      if (filteredSimilarities.length === 0) {
        // Fallback con umbral más bajo
        const fallbackSimilarities = similarities
          .filter(sim => sim.score >= 0.20) // Umbral de fallback más bajo
          .sort((a, b) => b.score - a.score)
          .slice(0, k);
        
        console.log(`🔄 Fallback con umbral 0.20: ${fallbackSimilarities.length} chunks`);
        
        if (fallbackSimilarities.length === 0) {
          return {
            chunks: [],
            totalScore: 0,
            sources: [],
            hasRelevantContext: false,
          };
        }
        
        // Usar resultados de fallback
        const fallbackChunkIds = fallbackSimilarities.map(sim => 
          embeddingVectors[sim.index].knowledgeId
        );
        
        const fallbackChunks = dbManager.query<KnowledgeChunk>(
          'SELECT id, source, chunk_text FROM knowledge WHERE id IN (' +
          fallbackChunkIds.map(() => '?').join(',') + ')',
          fallbackChunkIds
        );
        
        const fallbackChunksWithScores = fallbackChunks.map(chunk => {
          const similarity = fallbackSimilarities.find(sim => 
            embeddingVectors[sim.index].knowledgeId === chunk.id
          );
          return {
            ...chunk,
            score: similarity?.score || 0,
          };
        });
        
        const totalScore = fallbackChunksWithScores.reduce((sum, chunk) => sum + (chunk.score || 0), 0);
        const sources = [...new Set(fallbackChunksWithScores.map(chunk => chunk.source))];
        
        return {
          chunks: fallbackChunksWithScores,
          totalScore,
          sources,
          hasRelevantContext: true,
        };
      }

      // Obtener los chunks de conocimiento correspondientes
      const chunkIds = filteredSimilarities.map(sim => 
        embeddingVectors[sim.index].knowledgeId
      );

      const chunks = dbManager.query<KnowledgeChunk>(
        'SELECT id, source, chunk_text FROM knowledge WHERE id IN (' +
        chunkIds.map(() => '?').join(',') + ')',
        chunkIds
      );

      // Asignar scores a los chunks
      const chunksWithScores = chunks.map(chunk => {
        const similarity = filteredSimilarities.find(sim => 
          embeddingVectors[sim.index].knowledgeId === chunk.id
        );
        return {
          ...chunk,
          score: similarity?.score || 0,
        };
      });

      // Ordenar por score descendente
      chunksWithScores.sort((a, b) => (b.score || 0) - (a.score || 0));

      const totalScore = chunksWithScores.reduce((sum, chunk) => sum + (chunk.score || 0), 0);
      const sources = [...new Set(chunksWithScores.map(chunk => chunk.source))];

      console.log(`🎯 Resultados finales: ${chunksWithScores.length} chunks, score total: ${totalScore.toFixed(3)}`);

      return {
        chunks: chunksWithScores,
        totalScore,
        sources,
        hasRelevantContext: chunksWithScores.length > 0,
      };
    } catch (error) {
      console.error('Error en búsqueda RAG:', error);
      throw new OperationalError('Error al buscar información relevante', 500);
    }
  }

  /**
   * Búsqueda híbrida: vector + texto (BM25 simplificado)
   */
  async hybridSearch(
    query: string,
    k: number = 8,
    minScore: number = 0.22
  ): Promise<RAGResult> {
    try {
      console.log(`🔍 Hybrid Search: "${query}" - k=${k}, minScore=${minScore}`);
      
      // 1. Búsqueda vectorial
      const vectorResults = await this.search(query, k, minScore);
      
      // 2. Búsqueda por texto (simulación de BM25)
      const textResults = await this.textSearch(query, k);
      
      // 3. Fusionar resultados
      const mergedResults = this.mergeResults(vectorResults, textResults, k);
      
      console.log(`🔄 Hybrid: Vector=${vectorResults.chunks.length}, Text=${textResults.chunks.length}, Merged=${mergedResults.chunks.length}`);
      
      return mergedResults;
    } catch (error) {
      console.error('Error en búsqueda híbrida:', error);
      // Fallback a búsqueda vectorial simple
      return this.search(query, k, minScore);
    }
  }

  /**
   * Búsqueda por texto (simulación de BM25)
   */
  private async textSearch(query: string, k: number): Promise<RAGResult> {
    try {
      const lowerQuery = query.toLowerCase();
      const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 2);
      
      if (queryWords.length === 0) {
        return {
          chunks: [],
          totalScore: 0,
          sources: [],
          hasRelevantContext: false,
        };
      }

      // Obtener todos los chunks
      const allChunks = dbManager.query<KnowledgeChunk>(
        'SELECT id, source, chunk_text FROM knowledge'
      );

      // Calcular score de texto para cada chunk
      const scoredChunks = allChunks.map(chunk => {
        const lowerText = chunk.chunk_text.toLowerCase();
        let score = 0;
        
        // Score por palabras coincidentes
        queryWords.forEach(word => {
          const wordCount = (lowerText.match(new RegExp(word, 'g')) || []).length;
          score += wordCount * 0.1;
        });
        
        // Score por coincidencia exacta de frase
        if (lowerText.includes(lowerQuery)) {
          score += 0.5;
        }
        
        // Score por fuente relevante
        if (chunk.source.includes('productos') && query.includes('medicamento')) {
          score += 0.3;
        }
        if (chunk.source.includes('servicios') && query.includes('servicio')) {
          score += 0.3;
        }
        if (chunk.source.includes('horarios') && query.includes('horario')) {
          score += 0.3;
        }
        
        return { ...chunk, score };
      });

      // Filtrar y ordenar por score
      const relevantChunks = scoredChunks
        .filter(chunk => chunk.score > 0)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, k);

      const totalScore = relevantChunks.reduce((sum, chunk) => sum + (chunk.score || 0), 0);
      const sources = [...new Set(relevantChunks.map(chunk => chunk.source))];

      return {
        chunks: relevantChunks,
        totalScore,
        sources,
        hasRelevantContext: relevantChunks.length > 0,
      };
    } catch (error) {
      console.error('Error en búsqueda de texto:', error);
      return {
        chunks: [],
        totalScore: 0,
        sources: [],
        hasRelevantContext: false,
      };
    }
  }

  /**
   * Fusiona resultados de búsqueda vectorial y textual
   */
  private mergeResults(vectorResults: RAGResult, textResults: RAGResult, k: number): RAGResult {
    const merged = new Map<number, KnowledgeChunk>();
    
    // Agregar resultados vectoriales (peso 0.7)
    vectorResults.chunks.forEach(chunk => {
      merged.set(chunk.id, {
        ...chunk,
        score: (chunk.score || 0) * 0.7
      });
    });
    
    // Agregar resultados textuales (peso 0.3)
    textResults.chunks.forEach(chunk => {
      if (merged.has(chunk.id)) {
        // Combinar scores
        const existing = merged.get(chunk.id)!;
        merged.set(chunk.id, {
          ...existing,
          score: (existing.score || 0) + (chunk.score || 0) * 0.3
        });
      } else {
        merged.set(chunk.id, {
          ...chunk,
          score: (chunk.score || 0) * 0.3
        });
      }
    });
    
    // Ordenar por score combinado
    const mergedChunks = Array.from(merged.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, k);
    
    const totalScore = mergedChunks.reduce((sum, chunk) => sum + (chunk.score || 0), 0);
    const sources = [...new Set(mergedChunks.map(chunk => chunk.source))];
    
    return {
      chunks: mergedChunks,
      totalScore,
      sources,
      hasRelevantContext: mergedChunks.length > 0,
    };
  }

  /**
   * Genera contexto para el LLM basado en los chunks encontrados
   */
  async generateContext(query: string, maxChunks: number = 4): Promise<string> {
    // Usar búsqueda híbrida para mejor cobertura
    const result = await this.hybridSearch(query, maxChunks, 0.20);
    
    if (!result.hasRelevantContext) {
      return "No tengo información específica sobre tu consulta. Te sugiero contactar directamente con nuestro equipo para obtener la información más actualizada.";
    }

    // Crear contexto estructurado
    const contextParts = result.chunks.map(chunk => {
      const source = chunk.source.replace(/\.(md|txt|pdf)$/, '');
      const score = chunk.score ? ` (relevancia: ${chunk.score.toFixed(3)})` : '';
      return `• ${source}${score}:\n${chunk.chunk_text}`;
    });

    return `Información relevante encontrada:\n\n${contextParts.join('\n\n')}`;
  }

  /**
   * Verifica si hay contexto suficiente para responder
   */
  async hasSufficientContext(query: string): Promise<boolean> {
    const result = await this.search(query, 2, 0.75);
    return result.hasRelevantContext && result.chunks.length >= 1;
  }

  /**
   * Genera una respuesta basada en el conocimiento encontrado
   */
  async generateResponse(
    query: string,
    context: KnowledgeChunk[],
    maxLength: number = 500
  ): Promise<string> {
    if (context.length === 0) {
      return 'Lo siento, no tengo información específica sobre eso. ¿Puedes reformular tu pregunta o contactar con nuestro equipo?';
    }

    try {
      // Construir el contexto para el LLM
      const contextText = context
        .map(chunk => `Fuente: ${chunk.source}\nContenido: ${chunk.chunk_text}`)
        .join('\n\n');

      const systemPrompt = `Eres un asistente de atención al cliente experto. 
      
IMPORTANTE: Usa SOLO la información proporcionada en el contexto para responder. 
Si la información no está en el contexto, di que no tienes esa información específica.

Responde de manera clara, concisa y útil. Cita las fuentes cuando sea relevante.
Mantén la respuesta por debajo de ${maxLength} caracteres.`;

      const userPrompt = `Consulta del usuario: "${query}"

Contexto disponible:
${contextText}

Responde basándote únicamente en esta información:`;

      const response = await llmService.generateResponse(userPrompt, systemPrompt, 0.3);
      
      return response;
    } catch (error) {
      console.error('Error al generar respuesta RAG:', error);
      
      // Fallback: respuesta simple basada en el contexto
      const sources = [...new Set(context.map(chunk => chunk.source))];
      return `Basándome en la información disponible, puedo ayudarte con lo siguiente:\n\n${
        context[0].chunk_text
      }\n\nFuentes: ${sources.join(', ')}`;
    }
  }

  /**
   * Añade nuevo conocimiento a la base de datos
   */
  async addKnowledge(
    source: string,
    content: string,
    chunkSize: number = 1000
  ): Promise<number> {
    try {
      // Dividir el contenido en chunks
      const chunks = this.splitIntoChunks(content, chunkSize);
      let totalChunks = 0;

      // Procesar cada chunk en una transacción
      dbManager.transaction(() => {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          
          // Insertar chunk de conocimiento
          const result = dbManager.run(
            'INSERT INTO knowledge (source, chunk_text, chunk_index) VALUES (?, ?, ?)',
            [source, chunk, i]
          );
          
          const knowledgeId = Number(result.lastInsertRowid);
          
          // Generar embeddings para el chunk
          this.generateAndStoreEmbeddings(knowledgeId, chunk);
          
          totalChunks++;
        }
      });

      return totalChunks;
    } catch (error) {
      console.error('Error al añadir conocimiento:', error);
      throw new OperationalError('Error al procesar el conocimiento', 500);
    }
  }

  /**
   * Divide el contenido en chunks de tamaño apropiado
   */
  private splitIntoChunks(content: string, chunkSize: number): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedSentence;
      } else {
        currentChunk += (currentChunk.length > 0 ? ' ' : '') + trimmedSentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Genera y almacena embeddings para un chunk de conocimiento
   */
  private async generateAndStoreEmbeddings(knowledgeId: number, text: string): Promise<void> {
    try {
      const embedding = await llmService.generateEmbeddings(text);
      
      dbManager.run(
        'INSERT INTO embeddings (knowledge_id, vector_json) VALUES (?, ?)',
        [knowledgeId, JSON.stringify(embedding)]
      );
    } catch (error) {
      console.error('Error al generar embeddings:', error);
      // No lanzar error para no romper la transacción
    }
  }

  /**
   * Elimina conocimiento por fuente
   */
  async removeKnowledgeBySource(source: string): Promise<number> {
    try {
      // Obtener IDs de conocimiento a eliminar
      const knowledgeIds = dbManager.query<{ id: number }>(
        'SELECT id FROM knowledge WHERE source = ?',
        [source]
      );

      if (knowledgeIds.length === 0) {
        return 0;
      }

      const ids = knowledgeIds.map(k => k.id);

      // Eliminar en transacción
      dbManager.transaction(() => {
        // Eliminar embeddings primero (por foreign key)
        dbManager.run(
          'DELETE FROM embeddings WHERE knowledge_id IN (' + ids.map(() => '?').join(',') + ')',
          ids
        );

        // Eliminar chunks de conocimiento
        dbManager.run(
          'DELETE FROM knowledge WHERE id IN (' + ids.map(() => '?').join(',') + ')',
          ids
        );
      });

      return knowledgeIds.length;
    } catch (error) {
      console.error('Error al eliminar conocimiento:', error);
      throw new OperationalError('Error al eliminar el conocimiento', 500);
    }
  }

  /**
   * Obtiene estadísticas del conocimiento almacenado
   */
  async getStats(): Promise<{
    totalChunks: number;
    totalSources: number;
    totalEmbeddings: number;
  }> {
    try {
      const totalChunks = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM knowledge'
      )?.count || 0;

      const totalSources = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(DISTINCT source) as count FROM knowledge'
      )?.count || 0;

      const totalEmbeddings = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM embeddings'
      )?.count || 0;

      return {
        totalChunks,
        totalSources,
        totalEmbeddings,
      };
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return {
        totalChunks: 0,
        totalSources: 0,
        totalEmbeddings: 0,
      };
    }
  }

  /**
   * Obtiene información de la base de datos para depuración
   */
  async getDatabaseInfo(): Promise<any> {
    try {
      const knowledgeCount = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM knowledge'
      )?.count || 0;
      
      const embeddingsCount = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM embeddings'
      )?.count || 0;
      
      const servicesCount = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM services'
      )?.count || 0;
      
      const knowledgeBySource = dbManager.query(
        'SELECT source, COUNT(*) as count FROM knowledge GROUP BY source'
      );
      
      return {
        knowledge: {
          total: knowledgeCount,
          bySource: knowledgeBySource
        },
        embeddings: embeddingsCount,
        services: servicesCount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error al obtener información de BD:', error);
      return { 
        error: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Exportar instancia singleton
export const ragService = new RAGService();
export default ragService;
