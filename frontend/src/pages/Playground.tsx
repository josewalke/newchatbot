import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Calendar, Upload, Search, Settings } from 'lucide-react';
import Chat from '../components/Chat';
import BookingForm from '../components/BookingForm';
import KnowledgeUpload from '../components/KnowledgeUpload';

type TabType = 'chat' | 'appointments' | 'knowledge';

const Playground: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  const tabs = [
    {
      id: 'chat' as TabType,
      name: 'Chat',
      icon: MessageSquare,
      description: 'Prueba el chatbot',
    },
    {
      id: 'appointments' as TabType,
      name: 'Citas',
      icon: Calendar,
      description: 'Gestiona citas y servicios',
    },
    {
      id: 'knowledge' as TabType,
      name: 'Conocimiento',
      icon: Upload,
      description: 'Sube y gestiona conocimiento RAG',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="text-gray-600 hover:text-gray-900 p-2 rounded-md transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Playground</h1>
                <p className="text-sm text-gray-500">Prueba todas las funcionalidades</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-900 p-2 rounded-md transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Description */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-gray-600">
            {(() => {
              const activeTabData = tabs.find(tab => tab.id === activeTab);
              const Icon = activeTabData?.icon || MessageSquare;
              return (
                <>
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{activeTabData?.name}</span>
                  <span>•</span>
                  <span>{activeTabData?.description}</span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Tab Panels */}
        <div className="space-y-6">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="card">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Chat de Pruebas
                </h2>
                <p className="text-gray-600">
                  Prueba el chatbot con diferentes tipos de mensajes. Intenta preguntar sobre
                  servicios, reservar citas, o hacer consultas generales.
                </p>
              </div>
              
              <div className="h-96">
                <Chat userId="playground_user" channel="web" />
              </div>
            </div>
          )}

          {/* Appointments Tab */}
          {activeTab === 'appointments' && (
            <div className="card">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Gestión de Citas
                </h2>
                <p className="text-gray-600">
                  Prueba la funcionalidad de reserva de citas, gestión de servicios y
                  disponibilidad.
                </p>
              </div>
              
              <BookingForm />
            </div>
          )}

          {/* Knowledge Tab */}
          {activeTab === 'knowledge' && (
            <div className="card">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Gestión de Conocimiento
                </h2>
                <p className="text-gray-600">
                  Sube documentos y texto para entrenar el sistema RAG. El chatbot podrá
                  responder preguntas basándose en este conocimiento.
                </p>
              </div>
              
              <KnowledgeUpload />
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Probar Chat</h3>
                <p className="text-sm text-gray-500">Interactúa con el chatbot</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Gestionar Citas</h3>
                <p className="text-sm text-gray-500">Reserva y administra citas</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Upload className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Subir Conocimiento</h3>
                <p className="text-sm text-gray-500">Entrena el sistema RAG</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Playground;
