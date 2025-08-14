import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Mail, Phone, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { bookAppointment, getServices, Service } from '../lib/api';

const BookingForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    serviceId: '',
    datetimeISO: '',
    durationMin: '',
  });
  
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    appointment?: any;
  } | null>(null);

  // Cargar servicios al montar el componente
  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const servicesData = await getServices();
      setServices(servicesData);
    } catch (error) {
      console.error('Error al cargar servicios:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      const appointment = await bookAppointment({
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        serviceId: parseInt(formData.serviceId),
        datetimeISO: formData.datetimeISO,
        durationMin: formData.durationMin ? parseInt(formData.durationMin) : undefined,
      });

      setResult({
        success: true,
        message: '¡Cita reservada exitosamente!',
        appointment,
      });

      // Limpiar formulario
      setFormData({
        name: '',
        email: '',
        phone: '',
        serviceId: '',
        datetimeISO: '',
        durationMin: '',
      });
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error al reservar la cita',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (priceCents: number): string => {
    if (priceCents === 0) return 'Gratis';
    return `${(priceCents / 100).toFixed(2)}€`;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes > 0 ? remainingMinutes + 'min' : ''}`.trim();
    }
    return `${minutes} min`;
  };

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nombre */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-2" />
              Nombre completo *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="input-field"
              placeholder="Tu nombre completo"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              <Mail className="w-4 h-4 inline mr-2" />
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="input-field"
              placeholder="tu@email.com"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              <Phone className="w-4 h-4 inline mr-2" />
              Teléfono
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="input-field"
              placeholder="+34 600 000 000"
            />
          </div>

          {/* Servicio */}
          <div>
            <label htmlFor="serviceId" className="block text-sm font-medium text-gray-700 mb-1">
              <Package className="w-4 h-4 inline mr-2" />
              Servicio *
            </label>
            <select
              id="serviceId"
              name="serviceId"
              value={formData.serviceId}
              onChange={handleInputChange}
              required
              className="input-field"
            >
              <option value="">Selecciona un servicio</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} - {formatDuration(service.duration_min)} - {formatPrice(service.price_cents)}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha y hora */}
          <div>
            <label htmlFor="datetimeISO" className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-2" />
              Fecha y hora *
            </label>
            <input
              type="datetime-local"
              id="datetimeISO"
              name="datetimeISO"
              value={formData.datetimeISO}
              onChange={handleInputChange}
              required
              className="input-field"
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          {/* Duración personalizada */}
          <div>
            <label htmlFor="durationMin" className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="w-4 h-4 inline mr-2" />
              Duración personalizada (min)
            </label>
            <input
              type="number"
              id="durationMin"
              name="durationMin"
              value={formData.durationMin}
              onChange={handleInputChange}
              className="input-field"
              placeholder="Dejar vacío para usar duración del servicio"
              min="15"
              step="15"
            />
          </div>
        </div>

        {/* Botón de envío */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading || !formData.name || !formData.serviceId || !formData.datetimeISO}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Reservando cita...</span>
              </div>
            ) : (
              'Reservar Cita'
            )}
          </button>
        </div>
      </form>

      {/* Resultado */}
      {result && (
        <div className={`p-4 rounded-lg border ${
          result.success 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start space-x-3">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div>
              <h3 className={`font-medium ${
                result.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {result.success ? '¡Éxito!' : 'Error'}
              </h3>
              <p className="mt-1 text-sm">{result.message}</p>
              
              {result.success && result.appointment && (
                <div className="mt-3 p-3 bg-green-100 rounded border border-green-200">
                  <h4 className="font-medium text-green-800 mb-2">Detalles de la cita:</h4>
                  <div className="text-sm text-green-700 space-y-1">
                    <p><strong>ID:</strong> #{result.appointment.id}</p>
                    <p><strong>Estado:</strong> {result.appointment.status}</p>
                    <p><strong>Inicio:</strong> {new Date(result.appointment.startsAt).toLocaleString('es-ES')}</p>
                    <p><strong>Fin:</strong> {new Date(result.appointment.endsAt).toLocaleString('es-ES')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">💡 Consejos para reservar:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Las citas se pueden cancelar hasta 24 horas antes</li>
          <li>• Llega 10 minutos antes de tu cita</li>
          <li>• Si necesitas reprogramar, contacta con nosotros</li>
          <li>• Los campos marcados con * son obligatorios</li>
        </ul>
      </div>
    </div>
  );
};

export default BookingForm;
