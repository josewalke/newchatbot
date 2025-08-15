import dbManager from '../db/db';
import llmService from './llm.service';
import { OperationalError } from '../middlewares/error.middleware';

/**
 * Interfaz para el aprendizaje automático
 */
interface LearningData {
  question: string;
  answer: string;
  success: boolean;
  userFeedback?: number; // 1-5 estrellas
  context: string;
  timestamp: Date;
}

/**
 * Interfaz para respuestas aprendidas
 */
interface LearnedResponse {
  id: number;
  question: string;
  answer: string;
  confidence: number;
  usage_count: number;
  success_rate: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Servicio de aprendizaje automático para el chatbot
 */
export class LearningService {
  
  /**
   * Aprende de una nueva interacción
   */
  async learnFromInteraction(data: LearningData): Promise<void> {
    try {
      // Guardar la interacción
      await this.saveInteraction(data);
      
      // Si fue exitosa, agregar a respuestas aprendidas
      if (data.success) {
        await this.addLearnedResponse(data.question, data.answer, data.context);
      }
      
      // Actualizar estadísticas de respuestas existentes
      await this.updateResponseStats(data.question, data.answer, data.success);
      
      // Reentrenar el modelo si hay suficientes datos nuevos
      await this.checkAndRetrain();
      
    } catch (error) {
      console.error('Error en aprendizaje automático:', error);
    }
  }
  
  /**
   * Guarda una interacción para análisis
   */
  private async saveInteraction(data: LearningData): Promise<void> {
    dbManager.run(`
      INSERT INTO learning_interactions 
      (question, answer, success, user_feedback, context, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      data.question,
      data.answer,
      data.success ? 1 : 0,
      data.userFeedback || null,
      data.context,
      data.timestamp.toISOString()
    ]);
  }
  
  /**
   * Agrega una nueva respuesta aprendida
   */
  private async addLearnedResponse(question: string, answer: string, context: string): Promise<void> {
    // Verificar si ya existe una respuesta similar
    const existing = dbManager.query<LearnedResponse>(
      'SELECT * FROM learned_responses WHERE question LIKE ? LIMIT 1',
      [`%${question.substring(0, 20)}%`]
    );
    
    if (existing.length === 0) {
      dbManager.run(`
        INSERT INTO learned_responses 
        (question, answer, confidence, usage_count, success_rate, context)
        VALUES (?, ?, ?, 1, 1.0, ?)
      `, [question, answer, 0.8, context]);
    }
  }
  
  /**
   * Actualiza estadísticas de respuestas existentes
   */
  private async updateResponseStats(question: string, answer: string, success: boolean): Promise<void> {
    dbManager.run(`
      UPDATE learned_responses 
      SET usage_count = usage_count + 1,
          success_rate = (success_rate * usage_count + ?) / (usage_count + 1),
          updated_at = CURRENT_TIMESTAMP
      WHERE question LIKE ? AND answer LIKE ?
    `, [success ? 1 : 0, `%${question.substring(0, 20)}%`, `%${answer.substring(0, 20)}%`]);
  }
  
  /**
   * Busca respuestas aprendidas para una pregunta
   */
  async findLearnedResponse(question: string): Promise<LearnedResponse | null> {
    try {
      // Buscar respuestas similares
      const responses = dbManager.query<LearnedResponse>(
        'SELECT * FROM learned_responses WHERE question LIKE ? ORDER BY confidence DESC, success_rate DESC LIMIT 1',
        [`%${question.substring(0, 30)}%`]
      );
      
      if (responses.length > 0 && responses[0].confidence > 0.7) {
        return responses[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error buscando respuesta aprendida:', error);
      return null;
    }
  }
  
  /**
   * Verifica si debe reentrenar el modelo
   */
  private async checkAndRetrain(): Promise<void> {
    try {
      // Contar interacciones nuevas
      const newInteractions = dbManager.query<{count: number}>(
        'SELECT COUNT(*) as count FROM learning_interactions WHERE timestamp > datetime("now", "-1 hour")'
      );
      
      // Si hay muchas interacciones nuevas, reentrenar
      if (newInteractions[0]?.count > 10) {
        await this.retrainModel();
      }
    } catch (error) {
      console.error('Error verificando reentrenamiento:', error);
    }
  }
  
  /**
   * Reentrena el modelo con nuevos datos
   */
  private async retrainModel(): Promise<void> {
    try {
      console.log('🔄 Reentrenando modelo con nuevos datos...');
      
      // Obtener todas las respuestas exitosas
      const successfulResponses = dbManager.query<LearnedResponse>(
        'SELECT * FROM learned_responses WHERE success_rate > 0.8 ORDER BY usage_count DESC LIMIT 100'
      );
      
      if (successfulResponses.length > 0) {
        // Crear un nuevo system prompt con ejemplos aprendidos
        const learnedExamples = successfulResponses
          .slice(0, 10)
          .map(r => `Usuario: "${r.question}"\nAsistente: "${r.answer}"`)
          .join('\n\n');
        
        // Actualizar el modelo con nuevos ejemplos
        await this.updateModelWithExamples(learnedExamples);
        
        console.log('✅ Modelo reentrenado exitosamente');
      }
    } catch (error) {
      console.error('Error reentrenando modelo:', error);
    }
  }
  
  /**
   * Actualiza el modelo con nuevos ejemplos
   */
  private async updateModelWithExamples(examples: string): Promise<void> {
    // Aquí podrías implementar fine-tuning del modelo
    // Por ahora, actualizamos el contexto de aprendizaje
    dbManager.run(`
      INSERT INTO model_updates (examples, timestamp)
      VALUES (?, CURRENT_TIMESTAMP)
    `, [examples]);
  }
  
  /**
   * Obtiene estadísticas de aprendizaje
   */
  async getLearningStats(): Promise<{
    totalInteractions: number;
    successRate: number;
    learnedResponses: number;
    lastTraining: Date;
  }> {
    try {
      const stats = dbManager.query<{
        total: number;
        success: number;
        learned: number;
        last_update: string;
      }>(`
        SELECT 
          (SELECT COUNT(*) FROM learning_interactions) as total,
          (SELECT COUNT(*) FROM learning_interactions WHERE success = 1) as success,
          (SELECT COUNT(*) FROM learned_responses) as learned,
          (SELECT MAX(updated_at) FROM learned_responses) as last_update
      `);
      
      return {
        totalInteractions: stats[0]?.total || 0,
        successRate: stats[0]?.total ? (stats[0].success / stats[0].total) * 100 : 0,
        learnedResponses: stats[0]?.learned || 0,
        lastTraining: stats[0]?.last_update ? new Date(stats[0].last_update) : new Date()
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return {
        totalInteractions: 0,
        successRate: 0,
        learnedResponses: 0,
        lastTraining: new Date()
      };
    }
  }
}

export const learningService = new LearningService();
export default learningService;
