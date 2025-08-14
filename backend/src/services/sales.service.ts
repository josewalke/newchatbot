import dbManager from '../db/db';
import { OperationalError } from '../middlewares/error.middleware';
import { formatDateTime } from '../utils/time';

/**
 * Interfaz para un servicio
 */
interface Service {
  id: number;
  name: string;
  duration_min: number;
  price_cents: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Interfaz para información de ventas
 */
interface SalesInfo {
  service: Service;
  formattedPrice: string;
  paymentInstructions: string;
  ctaText: string;
}

/**
 * Servicio para gestión de ventas y servicios
 */
export class SalesService {
  /**
   * Obtiene todos los servicios activos
   */
  async getActiveServices(): Promise<Service[]> {
    try {
      return dbManager.query<Service>(
        'SELECT * FROM services WHERE active = 1 ORDER BY price_cents ASC'
      );
    } catch (error) {
      console.error('Error al obtener servicios:', error);
      return [];
    }
  }

  /**
   * Obtiene un servicio por ID
   */
  async getServiceById(id: number): Promise<Service | null> {
    try {
      const result = dbManager.queryFirst<Service>(
        'SELECT * FROM services WHERE id = ? AND active = 1',
        [id]
      );
      return result || null;
    } catch (error) {
      console.error('Error al obtener servicio:', error);
      return null;
    }
  }

  /**
   * Crea un nuevo servicio
   */
  async createService(data: {
    name: string;
    duration_min: number;
    price_cents: number;
  }): Promise<Service> {
    try {
      const result = dbManager.run(
        'INSERT INTO services (name, duration_min, price_cents, active) VALUES (?, ?, ?, 1)',
        [data.name, data.duration_min, data.price_cents]
      );

      const serviceId = Number(result.lastInsertRowid);
      const service = await this.getServiceById(serviceId);
      
      if (!service) {
        throw new OperationalError('Error al crear el servicio', 500);
      }

      return service;
    } catch (error) {
      if (error instanceof OperationalError) {
        throw error;
      }
      console.error('Error al crear servicio:', error);
      throw new OperationalError('Error interno al crear el servicio', 500);
    }
  }

  /**
   * Actualiza un servicio existente
   */
  async updateService(
    id: number,
    data: Partial<{
      name: string;
      duration_min: number;
      price_cents: number;
      active: boolean;
    }>
  ): Promise<Service> {
    try {
      // Verificar que el servicio existe
      const existingService = await this.getServiceById(id);
      if (!existingService) {
        throw new OperationalError('Servicio no encontrado', 404);
      }

      // Construir query de actualización dinámicamente
      const updates: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }

      if (data.duration_min !== undefined) {
        updates.push('duration_min = ?');
        values.push(data.duration_min);
      }

      if (data.price_cents !== undefined) {
        updates.push('price_cents = ?');
        values.push(data.price_cents);
      }

      if (data.active !== undefined) {
        updates.push('active = ?');
        values.push(data.active ? 1 : 0);
      }

      if (updates.length === 0) {
        return existingService;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const query = `UPDATE services SET ${updates.join(', ')} WHERE id = ?`;
      dbManager.run(query, values);

      // Obtener el servicio actualizado
      const updatedService = await this.getServiceById(id);
      if (!updatedService) {
        throw new OperationalError('Error al actualizar el servicio', 500);
      }

      return updatedService;
    } catch (error) {
      if (error instanceof OperationalError) {
        throw error;
      }
      console.error('Error al actualizar servicio:', error);
      throw new OperationalError('Error interno al actualizar el servicio', 500);
    }
  }

  /**
   * Elimina un servicio (lo marca como inactivo)
   */
  async deleteService(id: number): Promise<{ success: boolean; message: string }> {
    try {
      // Verificar que el servicio existe
      const existingService = await this.getServiceById(id);
      if (!existingService) {
        throw new OperationalError('Servicio no encontrado', 404);
      }

      // Marcar como inactivo en lugar de eliminar
      dbManager.run(
        'UPDATE services SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      return { success: true, message: 'Servicio eliminado exitosamente' };
    } catch (error) {
      if (error instanceof OperationalError) {
        throw error;
      }
      console.error('Error al eliminar servicio:', error);
      throw new OperationalError('Error interno al eliminar el servicio', 500);
    }
  }

  /**
   * Obtiene información de ventas para un servicio específico
   */
  async getSalesInfo(serviceId: number): Promise<SalesInfo> {
    try {
      const service = await this.getServiceById(serviceId);
      if (!service) {
        throw new OperationalError('Servicio no encontrado', 404);
      }

      const formattedPrice = this.formatPrice(service.price_cents);
      const paymentInstructions = this.getPaymentInstructions();
      const ctaText = this.getCTAText(service);

      return {
        service,
        formattedPrice,
        paymentInstructions,
        ctaText,
      };
    } catch (error) {
      if (error instanceof OperationalError) {
        throw error;
      }
      console.error('Error al obtener información de ventas:', error);
      throw new OperationalError('Error interno al obtener información de ventas', 500);
    }
  }

  /**
   * Obtiene información de ventas para un tema específico
   */
  async getSalesInfoByTopic(topic: string): Promise<SalesInfo[]> {
    try {
      // Buscar servicios que coincidan con el tema
      const services = dbManager.query<Service>(
        'SELECT * FROM services WHERE active = 1 AND (name LIKE ? OR name LIKE ?) ORDER BY price_cents ASC',
        [`%${topic}%`, `%${topic.toLowerCase()}%`]
      );

      if (services.length === 0) {
        // Si no hay coincidencias específicas, devolver todos los servicios activos
        return this.getAllServicesSalesInfo();
      }

      return services.map(service => ({
        service,
        formattedPrice: this.formatPrice(service.price_cents),
        paymentInstructions: this.getPaymentInstructions(),
        ctaText: this.getCTAText(service),
      }));
    } catch (error) {
      console.error('Error al obtener información de ventas por tema:', error);
      return this.getAllServicesSalesInfo();
    }
  }

  /**
   * Obtiene información de ventas para todos los servicios
   */
  async getAllServicesSalesInfo(): Promise<SalesInfo[]> {
    try {
      const services = await this.getActiveServices();
      
      return services.map(service => ({
        service,
        formattedPrice: this.formatPrice(service.price_cents),
        paymentInstructions: this.getPaymentInstructions(),
        ctaText: this.getCTAText(service),
      }));
    } catch (error) {
      console.error('Error al obtener información de ventas de todos los servicios:', error);
      return [];
    }
  }

  /**
   * Genera una propuesta de venta personalizada
   */
  async generateSalesProposal(
    serviceId?: number,
    topic?: string,
    customerName?: string
  ): Promise<string> {
    try {
      let salesInfo: SalesInfo[];

      if (serviceId) {
        const info = await this.getSalesInfo(serviceId);
        salesInfo = [info];
      } else if (topic) {
        salesInfo = await this.getSalesInfoByTopic(topic);
      } else {
        salesInfo = await this.getAllServicesSalesInfo();
      }

      if (salesInfo.length === 0) {
        return 'Lo siento, no tengo servicios disponibles en este momento.';
      }

      // Generar propuesta personalizada
      const greeting = customerName ? `¡Hola ${customerName}!` : '¡Hola!';
      
      let proposal = `${greeting} Te presento nuestros servicios:\n\n`;

      for (const info of salesInfo) {
        const duration = info.service.duration_min >= 60 
          ? `${Math.floor(info.service.duration_min / 60)}h ${info.service.duration_min % 60}min`
          : `${info.service.duration_min} minutos`;

        proposal += `🌟 **${info.service.name}**\n`;
        proposal += `⏱️ Duración: ${duration}\n`;
        proposal += `💰 Precio: ${info.formattedPrice}\n`;
        proposal += `💳 ${info.paymentInstructions}\n\n`;
      }

      proposal += `🎯 ${salesInfo[0].ctaText}\n\n`;
      proposal += '¿Te gustaría que te ayude a reservar una cita?';

      return proposal;
    } catch (error) {
      console.error('Error al generar propuesta de ventas:', error);
      return 'Lo siento, no puedo generar la propuesta en este momento. ¿Puedes contactar con nuestro equipo?';
    }
  }

  /**
   * Formatea el precio en formato legible
   */
  private formatPrice(priceCents: number): string {
    if (priceCents === 0) {
      return 'Gratis';
    }

    const euros = priceCents / 100;
    return `${euros.toFixed(2)}€`;
  }

  /**
   * Obtiene las instrucciones de pago
   */
  private getPaymentInstructions(): string {
    // En una implementación real, esto vendría de configuración
    const hasStripe = process.env.STRIPE_PUBLIC_KEY;
    
    if (hasStripe) {
      return 'Pago seguro online con tarjeta';
    } else {
      return 'Pago por transferencia bancaria';
    }
  }

  /**
   * Genera el texto de call-to-action
   */
  private getCTAText(service: Service): string {
    const duration = service.duration_min >= 60 
      ? `${Math.floor(service.duration_min / 60)} hora${Math.floor(service.duration_min / 60) > 1 ? 's' : ''}`
      : `${service.duration_min} minutos`;

    return `Reserva tu ${service.name} de ${duration} ahora mismo`;
  }

  /**
   * Obtiene estadísticas de servicios
   */
  async getServiceStats(): Promise<{
    totalServices: number;
    activeServices: number;
    averagePrice: number;
    totalRevenue: number;
  }> {
    try {
      const totalServices = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM services'
      )?.count || 0;

      const activeServices = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM services WHERE active = 1'
      )?.count || 0;

      const priceStats = dbManager.queryFirst<{ 
        avg_price: number; 
        total_revenue: number 
      }>(
        'SELECT AVG(price_cents) as avg_price, SUM(price_cents) as total_revenue FROM services WHERE active = 1'
      );

      return {
        totalServices,
        activeServices,
        averagePrice: priceStats?.avg_price || 0,
        totalRevenue: priceStats?.total_revenue || 0,
      };
    } catch (error) {
      console.error('Error al obtener estadísticas de servicios:', error);
      return {
        totalServices: 0,
        activeServices: 0,
        averagePrice: 0,
        totalRevenue: 0,
      };
    }
  }
}

// Exportar instancia singleton
export const salesService = new SalesService();
export default salesService;
