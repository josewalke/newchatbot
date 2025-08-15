import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import dbManager from '../db/db';
import { OperationalError } from '../middlewares/error.middleware';

/**
 * Interfaz para un suplemento de la base de datos
 */
interface Supplement {
  id: number;
  name: string;
  category: string;
  format: string;
  dosage: string;
  price: number;
  requires_prescription: boolean;
  description: string;
  benefits: string;
  active_ingredients: string;
  side_effects?: string;
  interactions?: string;
  contraindications?: string;
}

/**
 * Interfaz para un suplemento formateado para la respuesta
 */
interface FormattedSupplement {
  id: number;
  name: string;
  category: string;
  format: string;
  dosage: string;
  price: number;
  requires_prescription: boolean;
  description: string;
  benefits: string[];
  activeIngredients: string[];
  sideEffects?: string[];
  interactions?: string[];
  contraindications?: string[];
}

/**
 * Controlador para suplementos y vitaminas
 */
export class SupplementsController {
  /**
   * Lista todos los suplementos disponibles
   */
  listSupplements = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // Obtener suplementos de la base de datos
      const supplements = dbManager.query<Supplement>(
        `SELECT 
          id,
          name,
          category,
          format,
          dosage,
          price,
          requires_prescription,
          description,
          benefits,
          active_ingredients
        FROM pharmaceutical_products 
        WHERE category IN ('suplementos', 'vitaminas', 'complementos')
        ORDER BY category, name`
      );

      // Formatear respuesta
      const formattedSupplements: FormattedSupplement[] = supplements.map(supplement => ({
        id: supplement.id,
        name: supplement.name,
        category: supplement.category,
        format: supplement.format,
        dosage: supplement.dosage,
        price: supplement.price,
        requires_prescription: supplement.requires_prescription,
        description: supplement.description,
        benefits: supplement.benefits ? JSON.parse(supplement.benefits) : [],
        activeIngredients: supplement.active_ingredients ? JSON.parse(supplement.active_ingredients) : []
      }));

      res.json({
        success: true,
        count: formattedSupplements.length,
        supplements: formattedSupplements,
        categories: [...new Set(formattedSupplements.map(s => s.category))],
        message: `Se encontraron ${formattedSupplements.length} suplementos disponibles`
      });

    } catch (error) {
      console.error('Error al listar suplementos:', error);
      throw new OperationalError('Error al obtener la lista de suplementos', 500);
    }
  });

  /**
   * Busca suplementos por término
   */
  searchSupplements = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query, category, maxPrice } = req.query;
    
    try {
      let sql = `SELECT 
        id,
        name,
        category,
        format,
        dosage,
        price,
        requires_prescription,
        description
      FROM pharmaceutical_products 
      WHERE category IN ('suplementos', 'vitaminas', 'complementos')`;
      
      const params: any[] = [];
      
      // Filtro por término de búsqueda
      if (query) {
        sql += ` AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)`;
        params.push(`%${query.toString().toLowerCase()}%`, `%${query.toString().toLowerCase()}%`);
      }
      
      // Filtro por categoría
      if (category) {
        sql += ` AND category = ?`;
        params.push(category.toString());
      }
      
      // Filtro por precio máximo
      if (maxPrice) {
        sql += ` AND price <= ?`;
        params.push(parseFloat(maxPrice.toString()));
      }
      
      sql += ` ORDER BY price ASC, name ASC`;
      
      const supplements = dbManager.query<Supplement>(sql, params);
      
      res.json({
        success: true,
        count: supplements.length,
        supplements,
        filters: { query, category, maxPrice },
        message: `Se encontraron ${supplements.length} suplementos que coinciden con tu búsqueda`
      });

    } catch (error) {
      console.error('Error al buscar suplementos:', error);
      throw new OperationalError('Error al buscar suplementos', 500);
    }
  });

  /**
   * Obtiene información detallada de un suplemento
   */
  getSupplementDetails = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    if (!id) {
      throw new OperationalError('Se requiere ID del suplemento', 400);
    }
    
    try {
      const supplement = dbManager.queryFirst<Supplement>(
        `SELECT 
          id,
          name,
          category,
          format,
          dosage,
          price,
          requires_prescription,
          description,
          benefits,
          active_ingredients,
          side_effects,
          interactions,
          contraindications
        FROM pharmaceutical_products 
        WHERE id = ? AND category IN ('suplementos', 'vitaminas', 'complementos')`,
        [parseInt(id)]
      );
      
      if (!supplement) {
        throw new OperationalError('Suplemento no encontrado', 404);
      }
      
      // Formatear arrays JSON
      const formattedSupplement: FormattedSupplement = {
        id: supplement.id,
        name: supplement.name,
        category: supplement.category,
        format: supplement.format,
        dosage: supplement.dosage,
        price: supplement.price,
        requires_prescription: supplement.requires_prescription,
        description: supplement.description,
        benefits: supplement.benefits ? JSON.parse(supplement.benefits) : [],
        activeIngredients: supplement.active_ingredients ? JSON.parse(supplement.active_ingredients) : [],
        sideEffects: supplement.side_effects ? JSON.parse(supplement.side_effects) : [],
        interactions: supplement.interactions ? JSON.parse(supplement.interactions) : [],
        contraindications: supplement.contraindications ? JSON.parse(supplement.contraindications) : []
      };
      
      res.json({
        success: true,
        supplement: formattedSupplement
      });

    } catch (error) {
      console.error('Error al obtener detalles del suplemento:', error);
      if (error instanceof OperationalError) throw error;
      throw new OperationalError('Error al obtener detalles del suplemento', 500);
    }
  });

  /**
   * Obtiene categorías de suplementos
   */
  getSupplementCategories = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const categories = dbManager.query<{ category: string; count: number }>(
        `SELECT 
          category,
          COUNT(*) as count
        FROM pharmaceutical_products 
        WHERE category IN ('suplementos', 'vitaminas', 'complementos')
        GROUP BY category
        ORDER BY count DESC`
      );
      
      res.json({
        success: true,
        categories,
        totalCategories: categories.length
      });

    } catch (error) {
      console.error('Error al obtener categorías:', error);
      throw new OperationalError('Error al obtener categorías de suplementos', 500);
    }
  });

  /**
   * Obtiene suplementos populares (por ventas o consultas)
   */
  getPopularSupplements = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { limit = 10 } = req.query;
    
    try {
      // Por ahora, devolver suplementos aleatorios como "populares"
      // En el futuro, esto se puede basar en datos de ventas reales
      const popularSupplements = dbManager.query<Supplement>(
        `SELECT 
          id,
          name,
          category,
          format,
          dosage,
          price,
          requires_prescription,
          description
        FROM pharmaceutical_products 
        WHERE category IN ('suplementos', 'vitaminas', 'complementos')
        ORDER BY RANDOM()
        LIMIT ?`,
        [parseInt(limit.toString())]
      );
      
      res.json({
        success: true,
        count: popularSupplements.length,
        supplements: popularSupplements,
        message: 'Suplementos populares'
      });

    } catch (error) {
      console.error('Error al obtener suplementos populares:', error);
      throw new OperationalError('Error al obtener suplementos populares', 500);
    }
  });

  /**
   * Obtiene suplementos por beneficio específico
   */
  getSupplementsByBenefit = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { benefit } = req.query;
    
    if (!benefit) {
      throw new OperationalError('Se requiere especificar el beneficio', 400);
    }
    
    try {
      const supplements = dbManager.query<Supplement>(
        `SELECT 
          id,
          name,
          category,
          format,
          dosage,
          price,
          requires_prescription,
          description
        FROM pharmaceutical_products 
        WHERE category IN ('suplementos', 'vitaminas', 'complementos')
        AND LOWER(benefits) LIKE ?
        ORDER BY price ASC, name ASC`,
        [`%${benefit.toString().toLowerCase()}%`]
      );
      
      res.json({
        success: true,
        count: supplements.length,
        benefit: benefit.toString(),
        supplements,
        message: `Suplementos para ${benefit}`
      });

    } catch (error) {
      console.error('Error al buscar suplementos por beneficio:', error);
      throw new OperationalError('Error al buscar suplementos por beneficio', 500);
    }
  });

  /**
   * Renderiza suplementos en formato legible para el usuario
   */
  renderSupplementsResponse(supplements: Supplement[]): string {
    if (supplements.length === 0) {
      return 'No se encontraron suplementos que coincidan con tu búsqueda.';
    }
    
    const lines = supplements.slice(0, 8).map(supplement => {
      let line = `• ${supplement.name}`;
      
      if (supplement.format) {
        line += ` (${supplement.format})`;
      }
      
      if (supplement.dosage) {
        line += ` - ${supplement.dosage}`;
      }
      
      if (supplement.price) {
        line += ` - ${supplement.price.toFixed(2)}€`;
      }
      
      if (supplement.requires_prescription) {
        line += ` - Requiere receta`;
      }
      
      return line;
    });
    
    const tail = supplements.length > 8 ? `\n… y ${supplements.length - 8} más.` : '';
    
    return `Suplementos y vitaminas disponibles:\n${lines.join('\n')}${tail}\n\n¿Buscas algo concreto (ej. vitamina D, omega 3, colágeno)?`;
  }
}

// Exportar instancia singleton
export const supplementsController = new SupplementsController();
export default supplementsController;
