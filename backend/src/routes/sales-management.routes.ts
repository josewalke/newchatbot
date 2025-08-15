import { Router } from 'express';
import salesManagementController from '../controllers/sales-management.controller';

const router = Router();

/**
 * Rutas para gestión de ventas
 */

// Carritos de compras
router.post('/carts', salesManagementController.createCart);
router.get('/carts/:cartId', salesManagementController.getCart);
router.get('/carts/customer/:customerEmail', salesManagementController.getCustomerCarts);

// Gestión de productos en el carrito
router.post('/carts/items', salesManagementController.addToCart);
router.delete('/carts/:cartId/items/:productId', salesManagementController.removeFromCart);
router.put('/carts/:cartId/items/:productId/quantity', salesManagementController.updateCartItemQuantity);

// Checkout y órdenes
router.post('/checkout', salesManagementController.checkout);
router.get('/orders/:orderId', salesManagementController.getOrder);
router.get('/orders/customer/:customerEmail', salesManagementController.getCustomerOrders);
router.put('/orders/:orderId/status', salesManagementController.updateOrderStatus);

// Productos
router.get('/products', salesManagementController.getAvailableProducts);
router.get('/products/:productId', salesManagementController.getProduct);
router.get('/products/recommended/:customerEmail', salesManagementController.getRecommendedProducts);

// Estadísticas
router.get('/stats', salesManagementController.getSalesStats);

export default router;
