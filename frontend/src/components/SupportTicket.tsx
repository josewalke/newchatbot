import React, { useState } from 'react';
import { MessageCircle, AlertCircle, CheckCircle, Clock, Star } from 'lucide-react';

interface SupportTicketForm {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  category: 'consulta' | 'queja' | 'sugerencia' | 'problema_tecnico' | 'facturacion' | 'cita';
  subject: string;
  description: string;
  priority?: 'baja' | 'media' | 'alta' | 'urgente';
}

const SupportTicket: React.FC = () => {
  const [formData, setFormData] = useState<SupportTicketForm>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    category: 'consulta',
    subject: '',
    description: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    suggestions?: string[];
    nextSteps?: string[];
  } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/customer-support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message,
          suggestions: data.suggestions,
          nextSteps: data.nextSteps
        });

        // Limpiar formulario
        setFormData({
          customerName: '',
          customerEmail: '',
          customerPhone: '',
          category: 'consulta',
          subject: '',
          description: ''
        });
      } else {
        setResult({
          success: false,
          message: data.message || 'Error al crear el ticket'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Error de conexión. Por favor, intenta de nuevo.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'consulta': return <MessageCircle className="w-4 h-4" />;
      case 'queja': return <AlertCircle className="w-4 h-4" />;
      case 'sugerencia': return <CheckCircle className="w-4 h-4" />;
      case 'problema_tecnico': return <Clock className="w-4 h-4" />;
      case 'facturacion': return <Star className="w-4 h-4" />;
      case 'cita': return <Clock className="w-4 h-4" />;
      default: return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'consulta': return 'text-blue-600 bg-blue-100';
      case 'queja': return 'text-red-600 bg-red-100';
      case 'sugerencia': return 'text-green-600 bg-green-100';
      case 'problema_tecnico': return 'text-orange-600 bg-orange-100';
      case 'facturacion': return 'text-purple-600 bg-purple-100';
      case 'cita': return 'text-indigo-600 bg-indigo-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Soporte al Cliente
        </h2>
        <p className="text-gray-600">
          Estamos aquí para ayudarte. Crea un ticket y te responderemos lo antes posible.
        </p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nombre */}
          <div>
            <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre completo *
            </label>
            <input
              type="text"
              id="customerName"
              name="customerName"
              value={formData.customerName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Tu nombre completo"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              id="customerEmail"
              name="customerEmail"
              value={formData.customerEmail}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="tu@email.com"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-2">
              Teléfono
            </label>
            <input
              type="tel"
              id="customerPhone"
              name="customerPhone"
              value={formData.customerPhone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+34 600 000 000"
            />
          </div>

          {/* Categoría */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Categoría *
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="consulta">Consulta General</option>
              <option value="queja">Queja o Reclamo</option>
              <option value="sugerencia">Sugerencia</option>
              <option value="problema_tecnico">Problema Técnico</option>
              <option value="facturacion">Facturación</option>
              <option value="cita">Problema con Cita</option>
            </select>
          </div>
        </div>

        {/* Asunto */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
            Asunto *
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Resumen breve de tu consulta"
          />
        </div>

        {/* Descripción */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Descripción detallada *
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Describe tu consulta, problema o sugerencia en detalle..."
          />
        </div>

        {/* Botón de envío */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading || !formData.customerName || !formData.customerEmail || !formData.subject || !formData.description}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Creando ticket...</span>
              </div>
            ) : (
              'Crear Ticket de Soporte'
            )}
          </button>
        </div>
      </form>

      {/* Resultado */}
      {result && (
        <div className={`p-6 rounded-lg border ${
          result.success 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start space-x-3">
            {result.success ? (
              <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className={`text-lg font-medium ${
                result.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {result.success ? '¡Ticket creado exitosamente!' : 'Error'}
              </h3>
              <p className="mt-2">{result.message}</p>
              
              {result.success && result.suggestions && (
                <div className="mt-4">
                  <h4 className="font-medium text-green-800 mb-2">Sugerencias útiles:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                    {result.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.success && result.nextSteps && (
                <div className="mt-4">
                  <h4 className="font-medium text-green-800 mb-2">Próximos pasos:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                    {result.nextSteps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-medium text-blue-800 mb-3">💡 Información importante:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <h4 className="font-medium mb-2">Tiempos de respuesta:</h4>
            <ul className="space-y-1">
              <li>• <span className="font-medium">Urgente:</span> 2-4 horas</li>
              <li>• <span className="font-medium">Alta:</span> 4-8 horas</li>
              <li>• <span className="font-medium">Media:</span> 24 horas</li>
              <li>• <span className="font-medium">Baja:</span> 48 horas</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Canales de contacto:</h4>
            <ul className="space-y-1">
              <li>• 📧 Email: soporte@farmacia.com</li>
              <li>• 📱 WhatsApp: +34 600 000 000</li>
              <li>• ☎️ Teléfono: +34 900 000 000</li>
              <li>• 💬 Chat en vivo: Disponible 24/7</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportTicket;
