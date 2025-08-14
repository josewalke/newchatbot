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
 * Servicio de RAG (Retrieval Augmented Generation) mejorado
 */
export class RAGService {
  /**
   * Busca chunks de conocimiento relevantes para una consulta
   */
  async search(
    query: string,
    k: number = 4, // Reducido de 5 a 4 para mayor precisión
    minScore: number = 0.78 // Aumentado de 0.3 a 0.78 para evitar ruido
  ): Promise<RAGResult> {
    try {
      // Generar embeddings para la consulta
      const queryEmbedding = await llmService.generateEmbeddings(query);
      
      // Validar que se generaron embeddings
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

      // Obtener todos los embeddings de la base de datos
      const embeddings = dbManager.query<{
        id: number;
        knowledge_id: number;
        vector_json: string;
      }>(
        'SELECT id, knowledge_id, vector_json FROM embeddings'
      );

      if (embeddings.length === 0) {
        return {
          chunks: [],
          totalScore: 0,
          sources: [],
          hasRelevantContext: false,
        };
      }

      // Convertir embeddings de JSON a arrays
      const embeddingVectors = embeddings.map(emb => ({
        id: emb.id,
        knowledgeId: emb.knowledge_id,
        vector: JSON.parse(emb.vector_json) as number[],
      }));

      // Buscar más candidatos inicialmente para luego filtrar
      const initialK = Math.min(k * 2, embeddingVectors.length);
      
      // Encontrar los más similares
      const similarities = findTopKSimilar(
        normalizedQueryEmbedding,
        embeddingVectors.map(emb => emb.vector),
        initialK
      );

      // Filtrar por umbral de similitud más estricto
      const filteredSimilarities = similarities
        .filter(sim => sim.score >= minScore)
        .slice(0, k);

      if (filteredSimilarities.length === 0) {
        return {
          chunks: [],
          totalScore: 0,
          sources: [],
          hasRelevantContext: false,
        };
      }

      // Obtener los chunks de conocimiento correspondientes
      const chunkIds = filteredSimilarities.map(sim => 
        embeddingVectors[sim.index].knowledgeId
      );

      // Obtener los chunks de conocimiento
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
   * Genera contexto para el LLM basado en los chunks encontrados
   */
  async generateContext(query: string, maxChunks: number = 4): Promise<string> {
    const result = await this.search(query, maxChunks);
    
    if (!result.hasRelevantContext) {
      return "No tengo información específica sobre tu consulta. Te sugiero contactar directamente con nuestro equipo para obtener la información más actualizada.";
    }

    // Crear contexto estructurado
    const contextParts = result.chunks.map(chunk => {
      const source = chunk.source.replace(/\.(md|txt|pdf)$/, '');
      return `• ${source}:\n${chunk.chunk_text}`;
    });

    return `Información relevante:\n\n${contextParts.join('\n\n')}`;
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
}

// Exportar instancia singleton
export const ragService = new RAGService();
export default ragService;
