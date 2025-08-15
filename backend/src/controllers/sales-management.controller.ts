import { Request, Response } from 'express';
import salesManagementService from '../services/sales-management.service';
import { cleanChatbotResponse } from '../utils/text-processing';

/**
 * Controlador para gestión de ventas
 */
export class SalesManagementController {

  /**
   * Crear un nuevo carrito de compras
   */
  async createCart(req: Request, res: Response): Promise<void> {
    try {
      const { customerName, customerEmail, customerPhone } = req.body;

      // Validaciones básicas
      if (!customerName || !customerEmail) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos requeridos: customerName, customerEmail'
        });
        return;
      }

      const result = await salesManagementService.createCart({
        customerName,
        customerEmail,
        customerPhone: customerPhone || ''
      });

      if (result.success) {
        res.status(201).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en createCart:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Agregar producto al carrito
   */
  async addToCart(req: Request, res: Response): Promise<void> {
    try {
      const { cartId, productId, quantity, prescriptionId } = req.body;

      // Validaciones básicas
      if (!cartId || !productId || !quantity) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos requeridos: cartId, productId, quantity'
        });
        return;
      }

      if (quantity <= 0) {
        res.status(400).json({
          success: false,
          message: 'La cantidad debe ser mayor a 0'
        });
        return;
      }

      const result = await salesManagementService.addToCart({
        cartId,
        productId,
        quantity,
        prescriptionId
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en addToCart:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Remover producto del carrito
   */
  async removeFromCart(req: Request, res: Response): Promise<void> {
    try {
      const { cartId, productId } = req.params;

      if (!cartId || !productId) {
        res.status(400).json({
          success: false,
          message: 'cartId y productId son requeridos'
        });
        return;
      }

      const result = await salesManagementService.removeFromCart(cartId, parseInt(productId));

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en removeFromCart:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Actualizar cantidad de un producto en el carrito
   */
  async updateCartItemQuantity(req: Request, res: Response): Promise<void> {
    try {
      const { cartId, productId } = req.params;
      const { quantity } = req.body;

      if (!cartId || !productId) {
        res.status(400).json({
          success: false,
          message: 'cartId y productId son requeridos'
        });
        return;
      }

      if (!quantity || quantity < 0) {
        res.status(400).json({
          success: false,
          message: 'La cantidad debe ser mayor o igual a 0'
        });
        return;
      }

      const result = await salesManagementService.updateCartItemQuantity(
        cartId, 
        parseInt(productId), 
        quantity
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en updateCartItemQuantity:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener carrito por ID
   */
  async getCart(req: Request, res: Response): Promise<void> {
    try {
      const { cartId } = req.params;

      if (!cartId) {
        res.status(400).json({
          success: false,
          message: 'cartId es requerido'
        });
        return;
      }

      const cart = await salesManagementService.getCart(cartId);

      if (!cart) {
        res.status(404).json({
          success: false,
          message: 'Carrito no encontrado'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: cart
      });

    } catch (error) {
      console.error('Error en getCart:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener carritos de un cliente
   */
  async getCustomerCarts(req: Request, res: Response): Promise<void> {
    try {
      const { customerEmail } = req.params;

      if (!customerEmail) {
        res.status(400).json({
          success: false,
          message: 'Email del cliente es requerido'
        });
        return;
      }

      const carts = await salesManagementService.getCustomerCarts(customerEmail);

      res.status(200).json({
        success: true,
        data: carts,
        count: carts.length
      });

    } catch (error) {
      console.error('Error en getCustomerCarts:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Procesar checkout y crear orden
   */
  async checkout(req: Request, res: Response): Promise<void> {
    try {
      const { cartId, paymentMethod, shippingAddress, notes } = req.body;

      // Validaciones básicas
      if (!cartId || !paymentMethod) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos requeridos: cartId, paymentMethod'
        });
        return;
      }

      // Validar método de pago
      const validPaymentMethods = ['card', 'transfer', 'cash', 'pharmacy_pickup'];
      if (!validPaymentMethods.includes(paymentMethod)) {
        res.status(400).json({
          success: false,
          message: 'Método de pago inválido. Métodos válidos: ' + validPaymentMethods.join(', ')
        });
        return;
      }

      const result = await salesManagementService.checkout(
        cartId,
        paymentMethod,
        shippingAddress,
        notes
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message),
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en checkout:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener orden por ID
   */
  async getOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'orderId es requerido'
        });
        return;
      }

      const order = await salesManagementService.getOrder(orderId);

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Orden no encontrada'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: order
      });

    } catch (error) {
      console.error('Error en getOrder:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener órdenes de un cliente
   */
  async getCustomerOrders(req: Request, res: Response): Promise<void> {
    try {
      const { customerEmail } = req.params;

      if (!customerEmail) {
        res.status(400).json({
          success: false,
          message: 'Email del cliente es requerido'
        });
        return;
      }

      const orders = await salesManagementService.getCustomerOrders(customerEmail);

      res.status(200).json({
        success: true,
        data: orders,
        count: orders.length
      });

    } catch (error) {
      console.error('Error en getCustomerOrders:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Actualizar estado de una orden
   */
  async updateOrderStatus(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { status, paymentStatus } = req.body;

      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'orderId es requerido'
        });
        return;
      }

      if (!status && !paymentStatus) {
        res.status(400).json({
          success: false,
          message: 'Al menos uno de los campos status o paymentStatus es requerido'
        });
        return;
      }

      // Validar estado si se proporciona
      if (status) {
        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
          res.status(400).json({
            success: false,
            message: 'Estado inválido. Estados válidos: ' + validStatuses.join(', ')
          });
          return;
        }
      }

      // Validar estado de pago si se proporciona
      if (paymentStatus) {
        const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
        if (!validPaymentStatuses.includes(paymentStatus)) {
          res.status(400).json({
            success: false,
            message: 'Estado de pago inválido. Estados válidos: ' + validPaymentStatuses.join(', ')
          });
          return;
        }
      }

      const result = await salesManagementService.updateOrderStatus(orderId, status, paymentStatus);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: cleanChatbotResponse(result.message)
        });
      } else {
        res.status(400).json({
          success: false,
          message: cleanChatbotResponse(result.message),
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error en updateOrderStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener productos recomendados para un cliente
   */
  async getRecommendedProducts(req: Request, res: Response): Promise<void> {
    try {
      const { customerEmail } = req.params;
      const { limit } = req.query;

      if (!customerEmail) {
        res.status(400).json({
          success: false,
          message: 'Email del cliente es requerido'
        });
        return;
      }

      const limitNumber = limit ? parseInt(String(limit)) : 5;
      
      if (isNaN(limitNumber) || limitNumber <= 0) {
        res.status(400).json({
          success: false,
          message: 'El límite debe ser un número positivo'
        });
        return;
      }

      const products = await salesManagementService.getRecommendedProducts(customerEmail, limitNumber);

      res.status(200).json({
        success: true,
        data: products,
        count: products.length,
        customerEmail,
        limit: limitNumber
      });

    } catch (error) {
      console.error('Error en getRecommendedProducts:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener estadísticas de ventas
   */
  async getSalesStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await salesManagementService.getSalesStats();

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error en getSalesStats:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener productos disponibles
   */
  async getAvailableProducts(req: Request, res: Response): Promise<void> {
    try {
      const { category, search, limit } = req.query;

      const result = await salesManagementService.getAvailableProducts(
        category as string,
        search as string,
        limit ? parseInt(String(limit)) : undefined
      );

      res.status(200).json({
        success: true,
        data: result.products,
        count: result.count,
        filters: result.filters
      });

    } catch (error) {
      console.error('Error en getAvailableProducts:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }

  /**
   * Obtener un producto específico
   */
  async getProduct(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      if (!productId) {
        res.status(400).json({
          success: false,
          message: 'productId es requerido'
        });
        return;
      }

      const product = await salesManagementService.getProduct(parseInt(productId));

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: product
      });

    } catch (error) {
      console.error('Error en getProduct:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: (error as Error).message
      });
    }
  }
}

// Exportar instancia singleton
export const salesManagementController = new SalesManagementController();
export default salesManagementController;
