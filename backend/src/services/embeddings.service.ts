import axios from 'axios';
import config from '../utils/env';

/**
 * Servicio de embeddings con fallbacks robustos
 */
export class EmbeddingsService {
  private readonly ollamaUrl: string;
  private readonly provider: string;
  private readonly model: string;

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    this.provider = process.env.EMBEDDINGS_PROVIDER || 'ollama';
    this.model = process.env.EMBEDDINGS_MODEL || 'nomic-embed-text';
  }

  /**
   * Genera embeddings de forma segura con fallbacks
   */
  async generateEmbeddings(text: string): Promise<number[] | null> {
    try {
      console.log(`🧠 Generando embeddings para: "${text.substring(0, 50)}..."`);
      
      if (this.provider === 'ollama') {
        return await this.generateOllamaEmbeddings(text);
      } else if (this.provider === 'openai') {
        return await this.generateOpenAIEmbeddings(text);
      } else {
        console.warn(`⚠️ Proveedor de embeddings no soportado: ${this.provider}`);
        return null;
      }
    } catch (error) {
      console.warn('⚠️ Error al generar embeddings:', (error as Error).message);
      return null;
    }
  }

  /**
   * Genera embeddings de forma segura con fallback limpio
   */
  async safeEmbeddings(text: string): Promise<number[] | null> {
    try {
      const embedding = await this.generateEmbeddings(text);
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Embedding vacío o inválido");
      }
      return embedding;
    } catch (error) {
      console.warn(`⚠️ Embeddings OFF → usando fallback para: "${text.substring(0, 30)}..."`);
      return null;
    }
  }

  /**
   * Genera embeddings usando Ollama
   */
  private async generateOllamaEmbeddings(text: string): Promise<number[] | null> {
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/embeddings`, {
        model: this.model,
        prompt: text
      }, {
        timeout: 10000
      });

      if (response.data && response.data.embedding) {
        const embedding = response.data.embedding;
        console.log(`✅ Embeddings Ollama generados: dim=${embedding.length}, model=${this.model}`);
        return embedding;
      } else {
        console.warn('⚠️ Respuesta de Ollama sin embeddings válidos');
        return null;
      }
    } catch (error) {
      console.warn('⚠️ Error en Ollama embeddings:', (error as Error).message);
      return null;
    }
  }

  /**
   * Genera embeddings usando OpenAI
   */
  private async generateOpenAIEmbeddings(text: string): Promise<number[] | null> {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ OPENAI_API_KEY no configurada');
        return null;
      }

      const response = await axios.post('https://api.openai.com/v1/embeddings', {
        input: text,
        model: this.model
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (response.data && response.data.data && response.data.data[0]?.embedding) {
        const embedding = response.data.data[0].embedding;
        console.log(`✅ Embeddings OpenAI generados: dim=${embedding.length}, model=${this.model}`);
        return embedding;
      } else {
        console.warn('⚠️ Respuesta de OpenAI sin embeddings válidos');
        return null;
      }
    } catch (error) {
      console.warn('⚠️ Error en OpenAI embeddings:', (error as Error).message);
      return null;
    }
  }

  /**
   * Verifica que el sistema de embeddings esté funcionando
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    provider: string;
    model: string;
    dimension?: number;
    error?: string;
  }> {
    try {
      const testEmbedding = await this.generateEmbeddings('test');
      
      if (testEmbedding && testEmbedding.length > 0) {
        return {
          status: 'healthy',
          provider: this.provider,
          model: this.model,
          dimension: testEmbedding.length
        };
      } else {
        return {
          status: 'degraded',
          provider: this.provider,
          model: this.model,
          error: 'No se pudieron generar embeddings'
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.provider,
        model: this.model,
        error: (error as Error).message
      };
    }
  }

  /**
   * Obtiene la dimensión esperada de embeddings
   */
  getExpectedDimension(): number {
    if (this.provider === 'ollama' && this.model === 'nomic-embed-text') {
      return 768;
    } else if (this.provider === 'openai' && this.model === 'text-embedding-3-small') {
      return 1536;
    } else if (this.provider === 'openai' && this.model === 'text-embedding-ada-002') {
      return 1536;
    }
    return 768; // Default
  }
}

// Exportar instancia singleton
export const embeddingsService = new EmbeddingsService();
export default embeddingsService;
