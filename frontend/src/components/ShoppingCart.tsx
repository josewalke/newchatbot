import React, { useState, useEffect } from 'react';
import { ShoppingCart as CartIcon, Plus, Minus, Trash2, CreditCard, Truck, DollarSign, Package } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  stock_quantity: number;
  active: boolean;
}

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  requiresPrescription: boolean;
  prescriptionId?: number;
}

interface ShoppingCartData {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

const ShoppingCart: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<ShoppingCartData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutData, setCheckoutData] = useState({
    paymentMethod: 'card' as 'card' | 'transfer' | 'cash' | 'pharmacy_pickup',
    shippingAddress: '',
    notes: ''
  });

  // Cargar productos al montar el componente
  useEffect(() => {
    loadProducts();
    createOrLoadCart();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/sales-management/products');
      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const createOrLoadCart = async () => {
    try {
      // Intentar crear un nuevo carrito
      const response = await fetch('/api/sales-management/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: 'Cliente Demo',
          customerEmail: 'demo@farmacia.com',
          customerPhone: '+34 600 000 000'
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCart(data.data);
      }
    } catch (error) {
      console.error('Error al crear carrito:', error);
    }
  };

  const addToCart = async (product: Product, quantity: number = 1) => {
    if (!cart) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/sales-management/carts/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartId: cart.id,
          productId: product.id,
          quantity
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCart(data.data);
      }
    } catch (error) {
      console.error('Error al agregar al carrito:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromCart = async (productId: number) => {
    if (!cart) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/sales-management/carts/${cart.id}/items/${productId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setCart(data.data);
      }
    } catch (error) {
      console.error('Error al remover del carrito:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (productId: number, quantity: number) => {
    if (!cart) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/sales-management/carts/${cart.id}/items/${productId}/quantity`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity }),
      });

      const data = await response.json();
      if (data.success) {
        setCart(data.data);
      }
    } catch (error) {
      console.error('Error al actualizar cantidad:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!cart) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/sales-management/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartId: cart.id,
          ...checkoutData
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('¡Orden creada exitosamente!');
        setShowCheckout(false);
        // Recargar carrito
        createOrLoadCart();
      } else {
        alert('Error al procesar el checkout: ' + data.message);
      }
    } catch (error) {
      console.error('Error en checkout:', error);
      alert('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (priceCents: number): string => {
    return `${(priceCents / 100).toFixed(2)}€`;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'medicamento': return 'text-blue-600 bg-blue-100';
      case 'cosmetico': return 'text-pink-600 bg-pink-100';
      case 'suplemento': return 'text-green-600 bg-green-100';
      case 'equipamiento': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!cart) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando carrito...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          🛒 Carrito de Compras
        </h2>
        <p className="text-gray-600">
          Explora nuestros productos farmacéuticos y agrega lo que necesites
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de productos */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Productos Disponibles
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map((product) => (
                <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{product.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(product.category)}`}>
                      {product.category}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {product.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-blue-600">
                      {formatPrice(product.price_cents)}
                    </span>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        Stock: {product.stock_quantity}
                      </span>
                      
                      <button
                        onClick={() => addToCart(product)}
                        disabled={isLoading || product.stock_quantity === 0}
                        className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Carrito */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-6">
            <div className="flex items-center space-x-2 mb-4">
              <CartIcon className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">Tu Carrito</h3>
            </div>

            {cart.items.length === 0 ? (
              <div className="text-center py-8">
                <CartIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Tu carrito está vacío</p>
                <p className="text-sm text-gray-400">Agrega productos para comenzar</p>
              </div>
            ) : (
              <>
                {/* Items del carrito */}
                <div className="space-y-3 mb-4">
                  {cart.items.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm">{item.productName}</h4>
                        <p className="text-sm text-gray-600">{formatPrice(item.unitPrice)} x {item.quantity}</p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          disabled={isLoading}
                          className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        
                        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                        
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          disabled={isLoading}
                          className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          disabled={isLoading}
                          className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumen */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatPrice(cart.subtotal * 100)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>IVA (21%):</span>
                    <span>{formatPrice(cart.tax * 100)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span className="text-blue-600">{formatPrice(cart.total * 100)}</span>
                  </div>
                </div>

                {/* Botón de checkout */}
                <button
                  onClick={() => setShowCheckout(true)}
                  disabled={isLoading}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-md font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-4"
                >
                  Proceder al Pago
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de checkout */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Finalizar Compra
            </h3>
            
            <div className="space-y-4">
              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <select
                  value={checkoutData.paymentMethod}
                  onChange={(e) => setCheckoutData(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="card">💳 Tarjeta de Crédito/Débito</option>
                  <option value="transfer">🏦 Transferencia Bancaria</option>
                  <option value="cash">💵 Efectivo</option>
                  <option value="pharmacy_pickup">🏥 Recogida en Farmacia</option>
                </select>
              </div>

              {/* Dirección de envío */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección de Envío
                </label>
                <textarea
                  value={checkoutData.shippingAddress}
                  onChange={(e) => setCheckoutData(prev => ({ ...prev, shippingAddress: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Deja vacío si es recogida en farmacia"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas Adicionales
                </label>
                <textarea
                  value={checkoutData.notes}
                  onChange={(e) => setCheckoutData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Instrucciones especiales..."
                />
              </div>
            </div>

            {/* Botones */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCheckout}
                disabled={isLoading}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Procesando...' : 'Confirmar Compra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingCart;
