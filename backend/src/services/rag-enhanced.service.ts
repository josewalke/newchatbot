import dbManager from '../db/db';
import llmService from './llm.service';
import embeddingsService from './embeddings.service';
import { findTopKSimilar, normalizeVector } from '../utils/vector';
import { OperationalError } from '../middlewares/error.middleware';

/**
 * Interfaz para un chunk de conocimiento con metadatos
 */
interface KnowledgeChunk {
  id: number;
  source: string;
  chunk_text: string;
  score?: number;
  metadata?: {
    category?: string;
    type?: string;
    tags?: string[];
  };
}

/**
 * Interfaz para el resultado de búsqueda RAG
 */
interface RAGResult {
  chunks: KnowledgeChunk[];
  totalScore: number;
  sources: string[];
  hasRelevantContext: boolean;
  searchType: 'vector' | 'hybrid' | 'category' | 'fallback';
  topScore: number;
}

/**
 * Tipos de intención para filtrado inteligente
 */
type Intent = 'symptom_throat' | 'medication_query' | 'supplements' | 'medication' | 'product_list' | 'service_info' | 'appointment' | 'hours' | 'pricing' | 'general';

/**
 * Servicio RAG mejorado con gating inteligente, filtros por categoría y búsqueda híbrida
 */
export class RAGEnhancedService {
  // Parámetros optimizados según recomendaciones de ChatGPT
  private readonly TOPK_VECTOR = 12;
  private readonly TOPK_BM25 = 12;
  private readonly MIN_SCORE_VECTOR = 0.22;
  private readonly MIN_SCORE_HYBRID = 0.20;
  private readonly MIN_SCORE_CATEGORY = 0.20;
  private readonly GATING_THRESHOLD = 0.18;

  /**
   * Búsqueda principal con gating inteligente y routing por intención
   */
  async search(query: string, k: number = 8): Promise<RAGResult> {
    try {
      console.log(`🔍 RAG Enhanced Search: "${query}" - k=${k}`);
      
      // 1. Detectar intención específica para aplicar filtros
      const intent = this.detectIntent(query);
      console.log(`🎯 Intención detectada: ${intent}`);
      
      // 2. Expansión de consulta específica por dominio
      const expandedQuery = this.expandQuery(query, intent);
      console.log(`🔤 Query expandida: "${expandedQuery}"`);
      
      // 3. Búsqueda vectorial inicial con score más alto
      const vectorResults = await this.searchByVector(expandedQuery, this.TOPK_VECTOR, this.MIN_SCORE_VECTOR);
      const topScore = vectorResults[0]?.score ?? 0;
      
      console.log(`📊 Score top vectorial: ${topScore}`);
      
      // 4. GATING INTELIGENTE: Si el score top es muy bajo, activar estrategias alternativas
      if (topScore < this.GATING_THRESHOLD) {
        console.log(`⚠️ Score top muy bajo (${topScore}), activando estrategias alternativas`);
        
        // Estrategia 1: Búsqueda híbrida con expansión
        const hybridResults = await this.hybridSearch(expandedQuery, this.TOPK_BM25, this.MIN_SCORE_HYBRID);
        
        if (hybridResults.length > 0) {
          console.log(`✅ Búsqueda híbrida exitosa: ${hybridResults.length} resultados`);
          return this.formatResult(hybridResults, 'hybrid', topScore);
        }
        
                 // Estrategia 2: Filtro por categoría si la intención es clara
         if (intent === 'supplements' || intent === 'medication' || intent === 'symptom_throat' || intent === 'medication_query' || intent === 'product_list') {
           const categoryResults = await this.searchByCategory(query, intent, k, this.MIN_SCORE_CATEGORY);
           if (categoryResults.length > 0) {
             console.log(`✅ Búsqueda por categoría exitosa: ${categoryResults.length} resultados`);
             return this.formatResult(categoryResults, 'category', topScore);
           }
         }
        
        // Estrategia 3: Búsqueda vectorial con score muy bajo como último recurso
        console.log(`🔄 Aplicando búsqueda vectorial con score mínimo 0.15`);
        const fallbackResults = await this.searchByVector(expandedQuery, k, 0.15);
        return this.formatResult(fallbackResults, 'fallback', topScore);
      }
      
      // 5. Si el score es aceptable, usar resultados vectoriales
      console.log(`✅ Usando resultados vectoriales con score aceptable`);
      return this.formatResult(vectorResults.slice(0, k), 'vector', topScore);
      
    } catch (error) {
      console.error('Error en búsqueda RAG mejorada:', error);
      return {
        chunks: [],
        totalScore: 0,
        sources: [],
        hasRelevantContext: false,
        searchType: 'fallback',
        topScore: 0
      };
    }
  }

  /**
   * Detección inteligente de intención para aplicar filtros específicos
   */
  private detectIntent(query: string): Intent {
    const lowerQuery = query.toLowerCase();
    
    // Detección de síntomas específicos
    if (/\bgarganta|faringitis|odinofagia|dolor de garganta|irritación faríngea\b/.test(lowerQuery)) {
      return 'symptom_throat';
    }
    
    // Detección de medicamentos específicos (marcas/principios activos)
    if (/\b(paracetamol|ibuprofeno|omeprazol|metformina|dalsy|gelocatil|nurofen|aspirina)\b/.test(lowerQuery)) {
      return 'medication_query';
    }
    
    // Detección de suplementos y vitaminas
    if (/\bsuplement|complement|vitamin|vitamina/.test(lowerQuery)) {
      return 'supplements';
    }
    
    // Detección de medicamentos generales
    if (/\bmedicament|medicina|fármaco|receta|posología/.test(lowerQuery)) {
      return 'medication';
    }
    
    // Detección de productos/catálogo
    if (/\bproductos|catálogo|catalogo|qué tienen|qué hay\b/.test(lowerQuery)) {
      return 'product_list';
    }
    
    // Detección de servicios
    if (/\bservicio|medición|consulta|presión|glucosa\b/.test(lowerQuery)) {
      return 'service_info';
    }
    
    // Detección de citas (solo para servicios, no productos)
    if (/\bcita|reserv|agend|consulta|agendar\b/.test(lowerQuery)) {
      return 'appointment';
    }
    
    // Detección de horarios
    if (/\bhorario|abren|hora|24\/7|disponible|cuándo abren\b/.test(lowerQuery)) {
      return 'hours';
    }
    
    // Detección de precios
    if (/\bprecio|costo|cuánto|tarifa|vale\b/.test(lowerQuery)) {
      return 'pricing';
    }
    
    return 'general';
  }

  /**
   * Expansión de consulta específica por dominio e intención
   */
  private expandQuery(query: string, intent: Intent): string {
    const lowerQuery = query.toLowerCase();
    
    // Expansión específica para síntomas de garganta
    if (intent === 'symptom_throat' || /\bgarganta|faringitis|odinofagia\b/.test(lowerQuery)) {
      return query + ' dolor de garganta faringitis irritación faríngea pastillas para la garganta antiinflamatorio analgésico OTC venta libre';
    }
    
    // Expansión para medicamentos específicos
    if (intent === 'medication_query' || /\b(paracetamol|ibuprofeno|omeprazol|metformina)\b/.test(lowerQuery)) {
      return query + ' medicamento OTC venta libre posología dosis efectos secundarios interacciones';
    }
    
    // Expansión específica para suplementos
    if (intent === 'supplements' || /\bsuplement|complement|vitamin/.test(lowerQuery)) {
      return query + ' vitaminas complementos alimenticios minerales multivitamínico omega colágeno magnesio hierro B12 D3 zinc probióticos antioxidantes';
    }
    
    // Expansión para medicamentos generales
    if (intent === 'medication' || /\bmedicament|medicina/.test(lowerQuery)) {
      return query + ' fármacos dispensación receta OTC posología principio activo efectos secundarios interacciones contraindicaciones';
    }
    
    // Expansión para productos/catálogo
    if (intent === 'product_list' || /\bproductos|catálogo|catalogo\b/.test(lowerQuery)) {
      return query + ' medicamentos suplementos productos farmacéuticos catálogo disponible stock';
    }
    
    // Expansión para servicios
    if (intent === 'service_info' || /\bservicio|medición|consulta\b/.test(lowerQuery)) {
      return query + ' consulta farmacéutica medición presión glucosa vacunación consejo nutricional asesoramiento';
    }
    
    // Expansión para citas (solo servicios)
    if (intent === 'appointment' || /\bcita|reserv|agend|consulta\b/.test(lowerQuery)) {
      return query + ' consulta farmacéutica medición presión glucosa vacunación consejo nutricional asesoramiento cita reserva';
    }
    
    // Expansión para horarios
    if (intent === 'hours' || /\bhorario|abren|hora|24\/7\b/.test(lowerQuery)) {
      return query + ' farmacia 24/7 atención nocturna emergencia disponible guardia horarios de apertura';
    }
    
    // Expansión para precios
    if (intent === 'pricing' || /\bprecio|costo|cuánto\b/.test(lowerQuery)) {
      return query + ' euros coste tarifa consulta gratuita medición precio valor';
    }
    
    return query;
  }

  /**
   * Búsqueda vectorial optimizada
   */
  private async searchByVector(query: string, k: number, minScore: number): Promise<KnowledgeChunk[]> {
    try {
      const queryEmbedding = await embeddingsService.safeEmbeddings(query);
      
      if (!queryEmbedding) {
        console.log('🔄 Embeddings no disponibles, usando búsqueda por texto como fallback');
        return await this.textSearch(query, k, minScore);
      }
      
      const normalizedQueryEmbedding = normalizeVector(queryEmbedding);
      
      // Obtener embeddings de la base de datos
      const embeddings = dbManager.query<{
        id: number;
        knowledge_id: number;
        vector_json: string;
      }>('SELECT id, knowledge_id, vector_json FROM embeddings');

      if (embeddings.length === 0) {
        return [];
      }

      // Convertir embeddings de JSON a arrays
      const embeddingVectors = embeddings.map(emb => ({
        id: emb.id,
        knowledgeId: emb.knowledge_id,
        vector: JSON.parse(emb.vector_json) as number[],
      }));

      // Buscar similitud
      const similarities = findTopKSimilar(
        normalizedQueryEmbedding,
        embeddingVectors.map(emb => emb.vector),
        k
      );

      // Filtrar por score y obtener chunks
      const filteredSimilarities = similarities.filter(sim => sim.score >= minScore);
      
      if (filteredSimilarities.length === 0) {
        return [];
      }

      const chunkIds = filteredSimilarities.map(sim => 
        embeddingVectors[sim.index].knowledgeId
      );

      const chunks = dbManager.query<KnowledgeChunk>(
        'SELECT id, source, chunk_text FROM knowledge WHERE id IN (' +
        chunkIds.map(() => '?').join(',') + ')',
        chunkIds
      );

      // Asignar scores y ordenar
      const chunksWithScores = chunks.map(chunk => {
        const similarity = filteredSimilarities.find(sim => 
          embeddingVectors[sim.index].knowledgeId === chunk.id
        );
        return {
          ...chunk,
          score: similarity?.score || 0,
        };
      }).sort((a, b) => (b.score || 0) - (a.score || 0));

      return chunksWithScores;
      
    } catch (error) {
      console.error('Error en búsqueda vectorial:', error);
      return [];
    }
  }

  /**
   * Búsqueda híbrida (vector + BM25 simulation)
   */
  private async hybridSearch(query: string, k: number, minScore: number): Promise<KnowledgeChunk[]> {
    try {
      // Búsqueda vectorial
      const vectorResults = await this.searchByVector(query, k, minScore);
      
      // Búsqueda por texto (simulación BM25)
      const textResults = await this.textSearch(query, k, minScore);
      
      // Combinar y ordenar resultados
      const combinedResults = this.mergeResults(vectorResults, textResults, k);
      
      return combinedResults.filter(result => (result.score ?? 0) >= minScore);
      
    } catch (error) {
      console.error('Error en búsqueda híbrida:', error);
      return [];
    }
  }

  /**
   * Búsqueda por texto (simulación BM25)
   */
  private async textSearch(query: string, k: number, minScore: number): Promise<KnowledgeChunk[]> {
    try {
      const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      
      if (terms.length === 0) {
        return [];
      }

      // Búsqueda simple por términos en el texto
      const chunks = dbManager.query<KnowledgeChunk>(
        'SELECT id, source, chunk_text FROM knowledge WHERE ' +
        terms.map(() => 'LOWER(chunk_text) LIKE ?').join(' OR '),
        terms.map(term => `%${term}%`)
      );

      // Calcular score simple basado en coincidencias
      const chunksWithScores = chunks.map(chunk => {
        const lowerText = chunk.chunk_text.toLowerCase();
        let score = 0;
        
        terms.forEach(term => {
          const matches = (lowerText.match(new RegExp(term, 'g')) || []).length;
          score += matches * 0.1; // Score por coincidencia
        });
        
        return {
          ...chunk,
          score: Math.min(score, 1.0), // Normalizar a 0-1
        };
      }).filter(chunk => (chunk.score ?? 0) >= minScore)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      return chunksWithScores.slice(0, k);
      
    } catch (error) {
      console.error('Error en búsqueda por texto:', error);
      return [];
    }
  }

  /**
   * Búsqueda por categoría específica
   */
  private async searchByCategory(query: string, intent: Intent, k: number, minScore: number): Promise<KnowledgeChunk[]> {
    try {
      let categoryFilter = '';
      let searchTerms = query;
      
      // Definir filtros por categoría
      if (intent === 'supplements') {
        categoryFilter = 'AND (LOWER(chunk_text) LIKE "%vitamina%" OR LOWER(chunk_text) LIKE "%suplemento%" OR LOWER(chunk_text) LIKE "%complemento%" OR LOWER(chunk_text) LIKE "%mineral%")';
        searchTerms = query + ' vitaminas suplementos complementos';
      } else if (intent === 'medication' || intent === 'medication_query') {
        categoryFilter = 'AND (LOWER(chunk_text) LIKE "%medicamento%" OR LOWER(chunk_text) LIKE "%fármaco%" OR LOWER(chunk_text) LIKE "%receta%" OR LOWER(chunk_text) LIKE "%OTC%" OR LOWER(chunk_text) LIKE "%venta libre%")';
        searchTerms = query + ' medicamentos fármacos OTC venta libre';
      } else if (intent === 'symptom_throat') {
        categoryFilter = 'AND (LOWER(chunk_text) LIKE "%analgésico%" OR LOWER(chunk_text) LIKE "%antiinflamatorio%" OR LOWER(chunk_text) LIKE "%OTC%" OR LOWER(chunk_text) LIKE "%venta libre%" OR LOWER(chunk_text) LIKE "%paracetamol%" OR LOWER(chunk_text) LIKE "%ibuprofeno%")';
        searchTerms = query + ' analgésicos antiinflamatorios OTC venta libre';
      } else if (intent === 'product_list') {
        categoryFilter = 'AND (LOWER(chunk_text) LIKE "%producto%" OR LOWER(chunk_text) LIKE "%medicamento%" OR LOWER(chunk_text) LIKE "%suplemento%" OR LOWER(chunk_text) LIKE "%vitamina%" OR LOWER(chunk_text) LIKE "%catálogo%")';
        searchTerms = query + ' productos medicamentos suplementos catálogo';
      } else if (intent === 'service_info') {
        categoryFilter = 'AND (LOWER(chunk_text) LIKE "%servicio%" OR LOWER(chunk_text) LIKE "%consulta%" OR LOWER(chunk_text) LIKE "%medición%" OR LOWER(chunk_text) LIKE "%presión%" OR LOWER(chunk_text) LIKE "%glucosa%")';
        searchTerms = query + ' servicios consultas mediciones';
      } else if (intent === 'appointment') {
        categoryFilter = 'AND (LOWER(chunk_text) LIKE "%cita%" OR LOWER(chunk_text) LIKE "%consulta%" OR LOWER(chunk_text) LIKE "%servicio%" OR LOWER(chunk_text) LIKE "%agendar%" OR LOWER(chunk_text) LIKE "%reservar%")';
        searchTerms = query + ' citas consultas servicios agendar';
      } else if (intent === 'hours') {
        categoryFilter = 'AND (LOWER(chunk_text) LIKE "%horario%" OR LOWER(chunk_text) LIKE "%24/7%" OR LOWER(chunk_text) LIKE "%abierto%" OR LOWER(chunk_text) LIKE "%disponible%" OR LOWER(chunk_text) LIKE "%guardia%")';
        searchTerms = query + ' horarios 24/7 abierto disponible';
      } else if (intent === 'pricing') {
        categoryFilter = 'AND (LOWER(chunk_text) LIKE "%precio%" OR LOWER(chunk_text) LIKE "%costo%" OR LOWER(chunk_text) LIKE "%tarifa%" OR LOWER(chunk_text) LIKE "%euros%" OR LOWER(chunk_text) LIKE "%gratuito%")';
        searchTerms = query + ' precios costos tarifas euros';
      }
      
      // Búsqueda con filtro de categoría
      const chunks = dbManager.query<KnowledgeChunk>(
        `SELECT id, source, chunk_text FROM knowledge WHERE LOWER(chunk_text) LIKE ? ${categoryFilter}`,
        [`%${searchTerms.toLowerCase()}%`]
      );
      
      // Asignar score base por categoría
      const chunksWithScores = chunks.map(chunk => ({
        ...chunk,
        score: 0.25, // Score base para categoría
      })).slice(0, k);
      
      return chunksWithScores;
      
    } catch (error) {
      console.error('Error en búsqueda por categoría:', error);
      return [];
    }
  }

  /**
   * Combinar resultados de diferentes estrategias de búsqueda
   */
  private mergeResults(vectorResults: KnowledgeChunk[], textResults: KnowledgeChunk[], k: number): KnowledgeChunk[] {
    const allResults = [...vectorResults, ...textResults];
    
    // Agrupar por ID y combinar scores
    const mergedMap = new Map<number, KnowledgeChunk>();
    
    allResults.forEach(result => {
      if (mergedMap.has(result.id)) {
        // Combinar scores (promedio ponderado)
        const existing = mergedMap.get(result.id)!;
        const combinedScore = (existing.score ?? 0) * 0.7 + (result.score ?? 0) * 0.3;
        mergedMap.set(result.id, { ...existing, score: combinedScore });
      } else {
        mergedMap.set(result.id, result);
      }
    });
    
    // Ordenar por score y limitar
    return Array.from(mergedMap.values())
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, k);
  }

  /**
   * Formatear resultado final
   */
  private formatResult(chunks: KnowledgeChunk[], searchType: string, topScore: number): RAGResult {
    const totalScore = chunks.reduce((sum, chunk) => sum + (chunk.score ?? 0), 0);
    const sources = [...new Set(chunks.map(chunk => chunk.source))];
    
    return {
      chunks,
      totalScore,
      sources,
      hasRelevantContext: chunks.length > 0,
      searchType: searchType as any,
      topScore
    };
  }

  /**
   * Generar contexto para el LLM con información filtrada y relevante
   */
  async generateContext(query: string): Promise<string> {
    try {
      const result = await this.search(query);
      
      if (!result.hasRelevantContext) {
        return '';
      }
      
      // Filtrar chunks por relevancia y construir contexto
      const relevantChunks = result.chunks
        .filter(chunk => (chunk.score ?? 0) >= 0.20) // Solo chunks relevantes
        .map(chunk => {
          const score = chunk.score ?? 0;
          const source = chunk.source;
          const text = chunk.chunk_text;
          
          return `• ${source} (relevancia: ${score.toFixed(3)}): ${text}`;
        });
      
      if (relevantChunks.length === 0) {
        return '';
      }
      
      const context = `Información relevante encontrada:\n${relevantChunks.join('\n')}`;
      
      console.log(`📝 Contexto generado: ${relevantChunks.length} chunks relevantes`);
      return context;
      
    } catch (error) {
      console.error('Error al generar contexto:', error);
      return '';
    }
  }

  /**
   * Generar respuesta estructurada basada en la intención detectada
   */
  async generateStructuredResponse(query: string): Promise<{
    intent: Intent;
    response: string;
    needsUserInput: boolean;
    suggestedActions: string[];
  }> {
    try {
      const intent = this.detectIntent(query);
      const result = await this.search(query);
      
      if (!result.hasRelevantContext) {
        return {
          intent,
          response: 'No encontré información específica sobre tu consulta. ¿Podrías ser más específico o consultar con nuestro farmacéutico?',
          needsUserInput: true,
          suggestedActions: ['💊 Consultar sobre medicamentos', '📅 Agendar cita', '🕐 Ver horarios', '💰 Consultar precios']
        };
      }
      
      // Generar respuesta basada en la intención y el contexto
      let response = '';
      let needsUserInput = false;
      let suggestedActions: string[] = [];
      
      switch (intent) {
        case 'symptom_throat':
          const otcItems = result.chunks
            .filter(chunk => (chunk.score ?? 0) >= 0.25)
            .map(chunk => chunk.chunk_text)
            .slice(0, 3);
          
          response = this.generateThroatSymptomResponse(otcItems);
          needsUserInput = true;
          suggestedActions = ['💊 Ver opciones OTC', '📅 Consulta farmacéutica', '🆘 Urgencias si es grave'];
          break;
          
        case 'medication_query':
          const medicationChunks = result.chunks
            .filter(chunk => (chunk.score ?? 0) >= 0.25)
            .slice(0, 2);
          
          if (medicationChunks.length > 0) {
            const chunk = medicationChunks[0];
            response = this.generateMedicationResponse(
              this.extractMedicationName(chunk.chunk_text),
              this.extractPrice(chunk.chunk_text),
              this.extractRequiresPrescription(chunk.chunk_text)
            );
            needsUserInput = true;
            suggestedActions = ['📦 Reservar para recoger', '📋 Ver más información', '💊 Alternativas'];
          }
          break;
          
        case 'appointment':
          const serviceChunks = result.chunks
            .filter(chunk => (chunk.score ?? 0) >= 0.25)
            .slice(0, 2);
          
          if (serviceChunks.length > 0) {
            const chunk = serviceChunks[0];
            response = this.generateServiceResponse(
              this.extractServiceName(chunk.chunk_text),
              chunk.chunk_text,
              this.extractPrice(chunk.chunk_text)
            );
            needsUserInput = true;
            suggestedActions = ['📅 Agendar cita', '🕐 Ver horarios disponibles', '💰 Consultar precios'];
          }
          break;
          
        default:
          // Respuesta genérica con contexto
          response = `Según la información disponible:\n\n${result.chunks
            .filter(chunk => (chunk.score ?? 0) >= 0.25)
            .map(chunk => `• ${chunk.chunk_text}`)
            .slice(0, 3)
            .join('\n')}\n\n¿Te gustaría más detalles sobre algún aspecto específico?`;
          needsUserInput = true;
          suggestedActions = ['💊 Más información', '📅 Agendar cita', '🕐 Ver horarios'];
      }
      
      return {
        intent,
        response,
        needsUserInput,
        suggestedActions
      };
      
    } catch (error) {
      console.error('Error al generar respuesta estructurada:', error);
      return {
        intent: 'general',
        response: 'Hubo un error al procesar tu consulta. ¿Podrías intentar de nuevo?',
        needsUserInput: true,
        suggestedActions: ['🔄 Intentar de nuevo', '📞 Contactar farmacéutico']
      };
    }
  }

  /**
   * Genera respuesta para síntomas de garganta
   */
  private generateThroatSymptomResponse(otcItems: string[]): string {
    if (otcItems.length === 0) {
      return `Para el dolor de garganta, te recomiendo consultar con nuestro farmacéutico para obtener recomendaciones personalizadas. Recuerda que si tienes fiebre alta, dificultad para respirar o los síntomas persisten más de 3 días, debes acudir a un profesional médico.`;
    }
    
    const itemsList = otcItems.map(item => `• ${item}`).join('\n');
    
    return `Para el dolor de garganta (información general, no es un diagnóstico):

${itemsList}

**⚠️ Importante:** Esta información es solo orientativa. Si experimentas:
• Fiebre alta (>38°C)
• Dificultad para respirar
• Dolor intenso que no mejora
• Síntomas que persisten más de 3 días

**Debes acudir a un profesional médico o urgencias.**

¿Prefieres que te recomiende opciones de **venta libre** o ver **servicios** de consulta farmacéutica?`;
  }

  /**
   * Genera respuesta para medicamentos específicos
   */
  private generateMedicationResponse(medicationName: string, price: string, requiresPrescription: boolean = false): string {
    if (requiresPrescription) {
      return `**${medicationName}** - ${price}
Este medicamento requiere **receta médica**. 

Para obtenerlo necesitas:
1. 📝 Receta médica válida
2. 📋 Documento de identidad
3. 💰 Pago del medicamento

¿Tienes la receta médica o prefieres consultar sobre alternativas de venta libre?`;
    }
    
    return `**${medicationName}** - ${price} [Venta libre]

Este medicamento está disponible **sin receta** (OTC).

¿Quieres **reservarlo para recoger** hoy? Para hacerlo necesito:
• 📦 **Cantidad** (ej. 1 caja, 2 unidades)
• 👤 **Tu nombre** para la reserva

*No es una compra online, solo reserva para recoger en farmacia.*`;
  }

  /**
   * Genera respuesta para servicios
   */
  private generateServiceResponse(serviceName: string, description: string, price: string): string {
    return `**${serviceName}** - ${price}

${description}

**📅 ¿Quieres agendar una cita?**
Para reservar necesito:
• 📅 **Fecha preferida** (hoy, mañana, otro día)
• 🕐 **Hora aproximada** (mañana, tarde, noche)
• 👤 **Tu nombre**
• 📱 **Teléfono de contacto**

¿Te gustaría agendar este servicio?`;
  }

  /**
   * Extrae el nombre del medicamento del texto
   */
  private extractMedicationName(text: string): string {
    const medicationMatch = text.match(/(paracetamol|ibuprofeno|omeprazol|metformina|aspirina)/i);
    return medicationMatch ? medicationMatch[1] : 'Medicamento';
  }

  /**
   * Extrae el precio del texto
   */
  private extractPrice(text: string): string {
    const priceMatch = text.match(/(\d+[.,]\d+)\s*€/);
    return priceMatch ? `${priceMatch[1]}€` : 'Precio a consultar';
  }

  /**
   * Extrae si requiere receta del texto
   */
  private extractRequiresPrescription(text: string): boolean {
    return /\b(receta|prescripción|médico)\b/i.test(text);
  }

  /**
   * Extrae el nombre del servicio del texto
   */
  private extractServiceName(text: string): string {
    const serviceMatch = text.match(/(consulta|medición|servicio|farmacéutica|presión|glucosa)/i);
    return serviceMatch ? serviceMatch[1] : 'Servicio';
  }

  /**
   * Obtener información de la base de datos para debugging
   */
  async getDatabaseInfo(): Promise<{
    totalKnowledge: number;
    totalEmbeddings: number;
    categories: string[];
    sources: string[];
  }> {
    try {
      const knowledgeCount = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM knowledge'
      )?.count || 0;
      
      const embeddingsCount = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM embeddings'
      )?.count || 0;
      
      const sources = dbManager.query<{ source: string }>(
        'SELECT DISTINCT source FROM knowledge'
      ).map(row => row.source);
      
      // Extraer categorías del texto (simulación)
      const allText = dbManager.query<{ chunk_text: string }>(
        'SELECT chunk_text FROM knowledge LIMIT 100'
      ).map(row => row.chunk_text).join(' ').toLowerCase();
      
      const categories = [];
      if (allText.includes('vitamina') || allText.includes('suplemento')) categories.push('suplementos');
      if (allText.includes('medicamento') || allText.includes('fármaco')) categories.push('medicamentos');
      if (allText.includes('consulta') || allText.includes('servicio')) categories.push('servicios');
      if (allText.includes('horario') || allText.includes('24/7')) categories.push('horarios');
      
      return {
        totalKnowledge: knowledgeCount,
        totalEmbeddings: embeddingsCount,
        categories,
        sources
      };
      
    } catch (error) {
      console.error('Error al obtener información de la base de datos:', error);
      return {
        totalKnowledge: 0,
        totalEmbeddings: 0,
        categories: [],
        sources: []
      };
    }
  }
}

// Exportar instancia singleton
export const ragEnhancedService = new RAGEnhancedService();
export default ragEnhancedService;
