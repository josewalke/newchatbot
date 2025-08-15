import React from 'react';
import { Bot, User, Clock, Info } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  intent?: {
    type: string;
    slots?: Record<string, any>;
  };
}

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getIntentIcon = (intentType: string) => {
    switch (intentType) {
      case 'book':
        return '📅';
      case 'reschedule':
        return '🔄';
      case 'cancel':
        return '❌';
      case 'confirm':
        return '✅';
      case 'faq':
        return '❓';
      case 'sales':
        return '💰';
      default:
        return '💬';
    }
  };

  const getIntentLabel = (intentType: string) => {
    switch (intentType) {
      case 'book':
        return 'Reserva';
      case 'reschedule':
        return 'Reprogramar';
      case 'cancel':
        return 'Cancelar';
      case 'confirm':
        return 'Confirmar';
      case 'faq':
        return 'Pregunta';
      case 'sales':
        return 'Ventas';
      default:
        return 'Chat';
    }
  };

  if (message.isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start space-x-2 max-w-xs lg:max-w-md">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg rounded-br-none">
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{formatTime(message.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="flex items-start space-x-2 max-w-xs lg:max-w-md">
        <div className="flex flex-col items-center space-y-1">
          <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{formatTime(message.timestamp)}</span>
          </div>
        </div>
        <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg rounded-bl-none shadow-sm">
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
            {message.content}
          </p>
          
          {/* Mostrar información de intención si está disponible */}
          {message.intent && message.intent.type && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <Info className="w-3 h-3" />
                <span className="flex items-center space-x-1">
                  <span>{getIntentIcon(message.intent.type)}</span>
                  <span>{getIntentLabel(message.intent.type)}</span>
                </span>
              </div>
              
              {/* Mostrar slots si hay información relevante */}
              {Object.keys(message.intent.slots || {}).length > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  {Object.entries(message.intent.slots || {}).map(([key, value]) => (
                    value && (
                      <div key={key} className="flex space-x-1">
                        <span className="font-medium">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
