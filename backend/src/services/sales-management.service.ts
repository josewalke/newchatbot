import dbManager from '../db/db';
import llmService from './llm.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interfaz para productos del carrito
 */
export interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  requiresPrescription: boolean;
  prescriptionId?: number;
}

/**
 * Interfaz para el carrito de compras
 */
export interface ShoppingCart {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'active' | 'abandoned' | 'completed';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

/**
 * Interfaz para crear un carrito
 */
export interface CreateCartRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

/**
 * Interfaz para agregar producto al carrito
 */
export interface AddToCartRequest {
  cartId: string;
  productId: number;
  quantity: number;
  prescriptionId?: number;
}

/**
 * Interfaz para orden de compra
 */
export interface Order {
  id: string;
  cartId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: 'card' | 'transfer' | 'cash' | 'pharmacy_pickup';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  shippingAddress?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interfaz para respuesta de venta
 */
export interface SalesResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Servicio de gestión de ventas
 */
export class SalesManagementService {
  
  /**
   * Crear un nuevo carrito de compras
   */
  async createCart(request: CreateCartRequest): Promise<SalesResponse> {
    try {
      const cartId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas
      
      const cart: ShoppingCart = {
        id: cartId,
        customerId: uuidv4(),
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        customerPhone: request.customerPhone,
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      };
      
      // Guardar en base de datos
      dbManager.run(`
        INSERT INTO shopping_carts (
          id, customer_id, customer_name, customer_email, customer_phone,
          items_json, subtotal, tax, total, status, created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cart.id,
        cart.customerId,
        cart.customerName,
        cart.customerEmail,
        cart.customerPhone,
        JSON.stringify(cart.items),
        cart.subtotal,
        cart.tax,
        cart.total,
        cart.status,
        cart.createdAt,
        cart.updatedAt,
        cart.expiresAt
      ]);
      
      return {
        success: true,
        message: 'Carrito creado exitosamente',
        data: cart
      };
      
    } catch (error) {
      console.error('Error al crear carrito:', error);
      return {
        success: false,
        message: 'Error al crear el carrito',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Agregar producto al carrito
   */
  async addToCart(request: AddToCartRequest): Promise<SalesResponse> {
    try {
      // Obtener el carrito
      const cart = await this.getCart(request.cartId);
      if (!cart) {
        return {
          success: false,
          message: 'Carrito no encontrado',
          error: 'CART_NOT_FOUND'
        };
      }
      
      // Verificar que el carrito esté activo
      if (cart.status !== 'active') {
        return {
          success: false,
          message: 'El carrito no está activo',
          error: 'CART_NOT_ACTIVE'
        };
      }
      
      // Obtener información del producto
      const product = dbManager.queryFirst<{
        id: number;
        name: string;
        price_cents: number;
        requires_prescription: number;
        stock_quantity: number;
        active: number;
      }>('SELECT * FROM pharmaceutical_products WHERE id = ? AND active = 1', [request.productId]);
      
      if (!product) {
        return {
          success: false,
          message: 'Producto no encontrado o no disponible',
          error: 'PRODUCT_NOT_FOUND'
        };
      }
      
      // Verificar stock
      if (product.stock_quantity < request.quantity) {
        return {
          success: false,
          message: `Stock insuficiente. Solo quedan ${product.stock_quantity} unidades`,
          error: 'INSUFFICIENT_STOCK'
        };
      }
      
      // Verificar prescripción si es necesaria
      if (product.requires_prescription && !request.prescriptionId) {
        return {
          success: false,
          message: 'Este producto requiere prescripción médica',
          error: 'PRESCRIPTION_REQUIRED'
        };
      }
      
      // Verificar si el producto ya está en el carrito
      const existingItemIndex = cart.items.findIndex(item => item.productId === request.productId);
      
      if (existingItemIndex >= 0) {
        // Actualizar cantidad
        cart.items[existingItemIndex].quantity += request.quantity;
        cart.items[existingItemIndex].totalPrice = cart.items[existingItemIndex].quantity * cart.items[existingItemIndex].unitPrice;
      } else {
        // Agregar nuevo item
        const unitPrice = product.price_cents / 100;
        cart.items.push({
          productId: product.id,
          productName: product.name,
          quantity: request.quantity,
          unitPrice,
          totalPrice: unitPrice * request.quantity,
          requiresPrescription: product.requires_prescription === 1,
          prescriptionId: request.prescriptionId
        });
      }
      
      // Recalcular totales
      this.recalculateCartTotals(cart);
      
      // Actualizar base de datos
      dbManager.run(`
        UPDATE shopping_carts 
        SET items_json = ?, subtotal = ?, tax = ?, total = ?, updated_at = ?
        WHERE id = ?
      `, [
        JSON.stringify(cart.items),
        cart.subtotal,
        cart.tax,
        cart.total,
        new Date().toISOString(),
        cart.id
      ]);
      
      return {
        success: true,
        message: 'Producto agregado al carrito exitosamente',
        data: cart
      };
      
    } catch (error) {
      console.error('Error al agregar al carrito:', error);
      return {
        success: false,
        message: 'Error al agregar el producto al carrito',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Remover producto del carrito
   */
  async removeFromCart(cartId: string, productId: number): Promise<SalesResponse> {
    try {
      const cart = await this.getCart(cartId);
      if (!cart) {
        return {
          success: false,
          message: 'Carrito no encontrado',
          error: 'CART_NOT_FOUND'
        };
      }
      
      // Remover el producto
      cart.items = cart.items.filter(item => item.productId !== productId);
      
      // Recalcular totales
      this.recalculateCartTotals(cart);
      
      // Actualizar base de datos
      dbManager.run(`
        UPDATE shopping_carts 
        SET items_json = ?, subtotal = ?, tax = ?, total = ?, updated_at = ?
        WHERE id = ?
      `, [
        JSON.stringify(cart.items),
        cart.subtotal,
        cart.tax,
        cart.total,
        new Date().toISOString(),
        cart.id
      ]);
      
      return {
        success: true,
        message: 'Producto removido del carrito exitosamente',
        data: cart
      };
      
    } catch (error) {
      console.error('Error al remover del carrito:', error);
      return {
        success: false,
        message: 'Error al remover el producto del carrito',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Actualizar cantidad de un producto en el carrito
   */
  async updateCartItemQuantity(
    cartId: string, 
    productId: number, 
    quantity: number
  ): Promise<SalesResponse> {
    try {
      if (quantity <= 0) {
        return await this.removeFromCart(cartId, productId);
      }
      
      const cart = await this.getCart(cartId);
      if (!cart) {
        return {
          success: false,
          message: 'Carrito no encontrado',
          error: 'CART_NOT_FOUND'
        };
      }
      
      // Verificar stock
      const product = dbManager.queryFirst<{ stock_quantity: number }>(
        'SELECT stock_quantity FROM pharmaceutical_products WHERE id = ?',
        [productId]
      );
      
      if (!product || product.stock_quantity < quantity) {
        return {
          success: false,
          message: `Stock insuficiente. Solo quedan ${product?.stock_quantity || 0} unidades`,
          error: 'INSUFFICIENT_STOCK'
        };
      }
      
      // Actualizar cantidad
      const item = cart.items.find(item => item.productId === productId);
      if (item) {
        item.quantity = quantity;
        item.totalPrice = item.unitPrice * quantity;
      }
      
      // Recalcular totales
      this.recalculateCartTotals(cart);
      
      // Actualizar base de datos
      dbManager.run(`
        UPDATE shopping_carts 
        SET items_json = ?, subtotal = ?, tax = ?, total = ?, updated_at = ?
        WHERE id = ?
      `, [
        JSON.stringify(cart.items),
        cart.subtotal,
        cart.tax,
        cart.total,
        new Date().toISOString(),
        cart.id
      ]);
      
      return {
        success: true,
        message: 'Cantidad actualizada exitosamente',
        data: cart
      };
      
    } catch (error) {
      console.error('Error al actualizar cantidad:', error);
      return {
        success: false,
        message: 'Error al actualizar la cantidad',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Obtener carrito por ID
   */
  async getCart(cartId: string): Promise<ShoppingCart | null> {
    try {
      const cartData = dbManager.queryFirst<{
        id: string;
        customer_id: string;
        customer_name: string;
        customer_email: string;
        customer_phone: string;
        items_json: string;
        subtotal: number;
        tax: number;
        total: number;
        status: string;
        created_at: string;
        updated_at: string;
        expires_at: string;
      }>('SELECT * FROM shopping_carts WHERE id = ?', [cartId]);
      
      if (!cartData) return null;
      
      return {
        id: cartData.id,
        customerId: cartData.customer_id,
        customerName: cartData.customer_name,
        customerEmail: cartData.customer_email,
        customerPhone: cartData.customer_phone,
        items: JSON.parse(cartData.items_json || '[]'),
        subtotal: cartData.subtotal,
        tax: cartData.tax,
        total: cartData.total,
        status: cartData.status as ShoppingCart['status'],
        createdAt: cartData.created_at,
        updatedAt: cartData.updated_at,
        expiresAt: cartData.expires_at
      };
      
    } catch (error) {
      console.error('Error al obtener carrito:', error);
      return null;
    }
  }
  
  /**
   * Obtener carritos de un cliente
   */
  async getCustomerCarts(customerEmail: string): Promise<ShoppingCart[]> {
    try {
      const cartsData = dbManager.query<{
        id: string;
        customer_id: string;
        customer_name: string;
        customer_email: string;
        customer_phone: string;
        items_json: string;
        subtotal: number;
        tax: number;
        total: number;
        status: string;
        created_at: string;
        updated_at: string;
        expires_at: string;
      }>('SELECT * FROM shopping_carts WHERE customer_email = ? ORDER BY created_at DESC', [customerEmail]);
      
      return cartsData.map(cartData => ({
        id: cartData.id,
        customerId: cartData.customer_id,
        customerName: cartData.customer_name,
        customerEmail: cartData.customer_email,
        customerPhone: cartData.customer_phone,
        items: JSON.parse(cartData.items_json || '[]'),
        subtotal: cartData.subtotal,
        tax: cartData.tax,
        total: cartData.total,
        status: cartData.status as ShoppingCart['status'],
        createdAt: cartData.created_at,
        updatedAt: cartData.updated_at,
        expiresAt: cartData.expires_at
      }));
      
    } catch (error) {
      console.error('Error al obtener carritos del cliente:', error);
      return [];
    }
  }
  
  /**
   * Procesar checkout y crear orden
   */
  async checkout(
    cartId: string,
    paymentMethod: Order['paymentMethod'],
    shippingAddress?: string,
    notes?: string
  ): Promise<SalesResponse> {
    try {
      const cart = await this.getCart(cartId);
      if (!cart) {
        return {
          success: false,
          message: 'Carrito no encontrado',
          error: 'CART_NOT_FOUND'
        };
      }
      
      if (cart.status !== 'active') {
        return {
          success: false,
          message: 'El carrito no está activo',
          error: 'CART_NOT_ACTIVE'
        };
      }
      
      if (cart.items.length === 0) {
        return {
          success: false,
          message: 'El carrito está vacío',
          error: 'EMPTY_CART'
        };
      }
      
      // Verificar stock de todos los productos
      for (const item of cart.items) {
        const product = dbManager.queryFirst<{ stock_quantity: number }>(
          'SELECT stock_quantity FROM pharmaceutical_products WHERE id = ?',
          [item.productId]
        );
        
        if (!product || product.stock_quantity < item.quantity) {
          return {
            success: false,
            message: `Stock insuficiente para ${item.productName}`,
            error: 'INSUFFICIENT_STOCK'
          };
        }
      }
      
      // Crear la orden
      const orderId = uuidv4();
      const now = new Date().toISOString();
      
      const order: Order = {
        id: orderId,
        cartId: cart.id,
        customerId: cart.customerId,
        customerName: cart.customerName,
        customerEmail: cart.customerEmail,
        customerPhone: cart.customerPhone,
        items: cart.items,
        subtotal: cart.subtotal,
        tax: cart.tax,
        total: cart.total,
        status: 'pending',
        paymentMethod,
        paymentStatus: 'pending',
        shippingAddress,
        notes,
        createdAt: now,
        updatedAt: now
      };
      
      // Guardar la orden
      dbManager.run(`
        INSERT INTO orders (
          id, cart_id, customer_id, customer_name, customer_email, customer_phone,
          items_json, subtotal, tax, total, status, payment_method, payment_status,
          shipping_address, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        order.id,
        order.cartId,
        order.customerId,
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        JSON.stringify(order.items),
        order.subtotal,
        order.tax,
        order.total,
        order.status,
        order.paymentMethod,
        order.paymentStatus,
        order.shippingAddress || null,
        order.notes || null,
        order.createdAt,
        order.updatedAt
      ]);
      
      // Actualizar stock de productos
      for (const item of order.items) {
        dbManager.run(`
          UPDATE pharmaceutical_products 
          SET stock_quantity = stock_quantity - ?, updated_at = ?
          WHERE id = ?
        `, [item.quantity, now, item.productId]);
      }
      
      // Marcar carrito como completado
      dbManager.run(`
        UPDATE shopping_carts 
        SET status = 'completed', updated_at = ?
        WHERE id = ?
      `, [now, cartId]);
      
      return {
        success: true,
        message: 'Orden creada exitosamente',
        data: order
      };
      
    } catch (error) {
      console.error('Error en checkout:', error);
      return {
        success: false,
        message: 'Error al procesar el checkout',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Obtener orden por ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const orderData = dbManager.queryFirst<{
        id: string;
        cart_id: string;
        customer_id: string;
        customer_name: string;
        customer_email: string;
        customer_phone: string;
        items_json: string;
        subtotal: number;
        tax: number;
        total: number;
        status: string;
        payment_method: string;
        payment_status: string;
        shipping_address?: string;
        notes?: string;
        created_at: string;
        updated_at: string;
      }>('SELECT * FROM orders WHERE id = ?', [orderId]);
      
      if (!orderData) return null;
      
      return {
        id: orderData.id,
        cartId: orderData.cart_id,
        customerId: orderData.customer_id,
        customerName: orderData.customer_name,
        customerEmail: orderData.customer_email,
        customerPhone: orderData.customer_phone,
        items: JSON.parse(orderData.items_json || '[]'),
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        total: orderData.total,
        status: orderData.status as Order['status'],
        paymentMethod: orderData.payment_method as Order['paymentMethod'],
        paymentStatus: orderData.payment_status as Order['paymentStatus'],
        shippingAddress: orderData.shipping_address,
        notes: orderData.notes,
        createdAt: orderData.created_at,
        updatedAt: orderData.updated_at
      };
      
    } catch (error) {
      console.error('Error al obtener orden:', error);
      return null;
    }
  }
  
  /**
   * Obtener órdenes de un cliente
   */
  async getCustomerOrders(customerEmail: string): Promise<Order[]> {
    try {
      const ordersData = dbManager.query<{
        id: string;
        cart_id: string;
        customer_id: string;
        customer_name: string;
        customer_email: string;
        customer_phone: string;
        items_json: string;
        subtotal: number;
        tax: number;
        total: number;
        status: string;
        payment_method: string;
        payment_status: string;
        shipping_address?: string;
        notes?: string;
        created_at: string;
        updated_at: string;
      }>('SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC', [customerEmail]);
      
      return ordersData.map(orderData => ({
        id: orderData.id,
        cartId: orderData.cart_id,
        customerId: orderData.customer_id,
        customerName: orderData.customer_name,
        customerEmail: orderData.customer_email,
        customerPhone: orderData.customer_phone,
        items: JSON.parse(orderData.items_json || '[]'),
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        total: orderData.total,
        status: orderData.status as Order['status'],
        paymentMethod: orderData.payment_method as Order['paymentMethod'],
        paymentStatus: orderData.payment_status as Order['paymentStatus'],
        shippingAddress: orderData.shipping_address,
        notes: orderData.notes,
        createdAt: orderData.created_at,
        updatedAt: orderData.updated_at
      }));
      
    } catch (error) {
      console.error('Error al obtener órdenes del cliente:', error);
      return [];
    }
  }
  
  /**
   * Actualizar estado de una orden
   */
  async updateOrderStatus(
    orderId: string, 
    status: Order['status'],
    paymentStatus?: Order['paymentStatus']
  ): Promise<SalesResponse> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) {
        return {
          success: false,
          message: 'Orden no encontrada',
          error: 'ORDER_NOT_FOUND'
        };
      }
      
      const updates: string[] = [];
      const values: any[] = [];
      
      if (status) {
        updates.push('status = ?');
        values.push(status);
      }
      
      if (paymentStatus) {
        updates.push('payment_status = ?');
        values.push(paymentStatus);
      }
      
      if (updates.length === 0) {
        return {
          success: false,
          message: 'No hay campos para actualizar',
          error: 'NO_UPDATES'
        };
      }
      
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(orderId);
      
      const updateQuery = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
      dbManager.run(updateQuery, values);
      
      return {
        success: true,
        message: 'Orden actualizada exitosamente'
      };
      
    } catch (error) {
      console.error('Error al actualizar orden:', error);
      return {
        success: false,
        message: 'Error al actualizar la orden',
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Obtener productos recomendados para un cliente
   */
  async getRecommendedProducts(customerEmail: string, limit: number = 5): Promise<any[]> {
    try {
      // Obtener historial de compras del cliente
      const orders = await this.getCustomerOrders(customerEmail);
      
      if (orders.length === 0) {
        // Si no hay historial, devolver productos populares
        return dbManager.query<{
          id: number;
          name: string;
          description: string;
          price_cents: number;
          category: string;
        }>(`
          SELECT id, name, description, price_cents, category 
          FROM pharmaceutical_products 
          WHERE active = 1 
          ORDER BY stock_quantity DESC 
          LIMIT ?
        `, [limit]);
      }
      
      // Analizar preferencias del cliente
      const preferences = this.analyzeCustomerPreferences(orders);
      
      // Obtener productos recomendados basados en preferencias
      const recommendedProducts = dbManager.query<{
        id: number;
        name: string;
        description: string;
        price_cents: number;
        category: string;
      }>(`
        SELECT id, name, description, price_cents, category 
        FROM pharmaceutical_products 
        WHERE active = 1 AND category IN (${preferences.categories.map(() => '?').join(',')})
        ORDER BY price_cents ASC 
        LIMIT ?
      `, [...preferences.categories, limit]);
      
      return recommendedProducts;
      
    } catch (error) {
      console.error('Error al obtener productos recomendados:', error);
      return [];
    }
  }
  
  /**
   * Analizar preferencias del cliente basado en historial
   */
  private analyzeCustomerPreferences(orders: Order[]): {
    categories: string[];
    priceRange: { min: number; max: number };
    totalSpent: number;
  } {
    const categories = new Set<string>();
    let totalSpent = 0;
    let minPrice = Infinity;
    let maxPrice = 0;
    
    orders.forEach(order => {
      order.items.forEach(item => {
        // Obtener categoría del producto
        const product = dbManager.queryFirst<{ category: string }>(
          'SELECT category FROM pharmaceutical_products WHERE id = ?',
          [item.productId]
        );
        
        if (product) {
          categories.add(product.category);
        }
        
        totalSpent += item.totalPrice;
        minPrice = Math.min(minPrice, item.unitPrice);
        maxPrice = Math.max(maxPrice, item.unitPrice);
      });
    });
    
    return {
      categories: Array.from(categories),
      priceRange: { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice },
      totalSpent
    };
  }
  
  /**
   * Recalcular totales del carrito
   */
  private recalculateCartTotals(cart: ShoppingCart): void {
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    cart.tax = cart.subtotal * 0.21; // 21% IVA en España
    cart.total = cart.subtotal + cart.tax;
  }
  
  /**
   * Obtener estadísticas de ventas
   */
  async getSalesStats(): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    topProducts: Array<{ productId: number; name: string; quantity: number; revenue: number }>;
    ordersByStatus: { [key: string]: number };
  }> {
    try {
      const totalOrders = dbManager.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM orders'
      )?.count || 0;
      
      const totalRevenue = dbManager.queryFirst<{ total: number }>(
        'SELECT SUM(total) as total FROM orders WHERE payment_status = "paid"'
      )?.total || 0;
      
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      // Productos más vendidos
      const topProducts = dbManager.query<{
        product_id: number;
        name: string;
        quantity: number;
        revenue: number;
      }>(`
        SELECT 
          p.id as product_id,
          p.name,
          SUM(CAST(json_extract(item.value, '$.quantity') AS INTEGER)) as quantity,
          SUM(CAST(json_extract(item.value, '$.totalPrice') AS REAL)) as revenue
        FROM orders o
        CROSS JOIN json_each(o.items_json) as item
        JOIN pharmaceutical_products p ON p.id = CAST(json_extract(item.value, '$.productId') AS INTEGER)
        WHERE o.payment_status = 'paid'
        GROUP BY p.id, p.name
        ORDER BY quantity DESC
        LIMIT 10
      `);
      
      // Órdenes por estado
      const ordersByStatus = dbManager.query<{ status: string; count: number }>(
        'SELECT status, COUNT(*) as count FROM orders GROUP BY status'
      );
      
      const statusStats: { [key: string]: number } = {};
      ordersByStatus.forEach(item => {
        statusStats[item.status] = item.count;
      });
      
      return {
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        topProducts: topProducts.map(item => ({
          productId: item.product_id,
          name: item.name,
          quantity: item.quantity,
          revenue: Math.round(item.revenue * 100) / 100
        })),
        ordersByStatus: statusStats
      };
      
    } catch (error) {
      console.error('Error al obtener estadísticas de ventas:', error);
      return {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        topProducts: [],
        ordersByStatus: {}
      };
    }
  }

  /**
   * Obtener productos disponibles
   */
  async getAvailableProducts(category?: string, search?: string, limit?: number): Promise<{
    products: any[];
    count: number;
    filters: { category: string | null; search: string | null; limit: number | null };
  }> {
    try {
      let query = 'SELECT * FROM pharmaceutical_products WHERE active = 1';
      const params: any[] = [];

      // Filtrar por categoría
      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }

      // Búsqueda por nombre
      if (search) {
        query += ' AND LOWER(name) LIKE ?';
        params.push(`%${search.toLowerCase()}%`);
      }

      // Ordenar y limitar
      query += ' ORDER BY name ASC';
      
      if (limit && !isNaN(limit)) {
        query += ' LIMIT ?';
        params.push(limit);
      }

      // Ejecutar consulta
      const products = dbManager.query(query, params);

      return {
        products,
        count: products.length,
        filters: {
          category: category || null,
          search: search || null,
          limit: limit || null
        }
      };

    } catch (error) {
      console.error('Error al obtener productos disponibles:', error);
      return {
        products: [],
        count: 0,
        filters: {
          category: category || null,
          search: search || null,
          limit: limit || null
        }
      };
    }
  }

  /**
   * Obtener un producto específico
   */
  async getProduct(productId: number): Promise<any | null> {
    try {
      const product = dbManager.queryFirst(
        'SELECT * FROM pharmaceutical_products WHERE id = ? AND active = 1',
        [productId]
      );

      return product;

    } catch (error) {
      console.error('Error al obtener producto:', error);
      return null;
    }
  }
}

// Exportar instancia singleton
export const salesManagementService = new SalesManagementService();
export default salesManagementService;
