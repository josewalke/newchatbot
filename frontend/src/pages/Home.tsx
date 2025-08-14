import React from 'react';
import { Link } from 'react-router-dom';
import { Settings, ExternalLink } from 'lucide-react';
import Chat from '../components/Chat';

interface HomeProps {
  isEmbed?: boolean;
}

const Home: React.FC<HomeProps> = ({ isEmbed = false }) => {
  return (
    <div className={`min-h-screen ${isEmbed ? 'embed-mode' : ''}`}>
      {/* Header */}
      {!isEmbed && (
        <header className="header bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">🤖</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">ChatBot Self-Hosted</h1>
                  <p className="text-sm text-gray-500">Asistente virtual inteligente</p>
                </div>
              </div>
              
              <nav className="flex items-center space-x-4">
                <Link
                  to="/playground"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Playground
                </Link>
                <a
                  href="https://github.com/tu-usuario/chatbot-self-hosted"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1"
                >
                  <span>GitHub</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button className="text-gray-600 hover:text-gray-900 p-2 rounded-md transition-colors">
                  <Settings className="w-5 h-5" />
                </button>
              </nav>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto h-screen">
          <Chat userId="web_user" channel="web" />
        </div>
      </main>

      {/* Footer */}
      {!isEmbed && (
        <footer className="footer bg-white border-t border-gray-200 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-sm text-gray-500">
                ChatBot Self-Hosted con Ollama • Desarrollado con ❤️ usando React + Node.js
              </p>
              <div className="mt-2 flex justify-center space-x-6 text-sm text-gray-400">
                <span>Powered by Ollama</span>
                <span>•</span>
                <span>SQLite Database</span>
                <span>•</span>
                <span>RAG Integration</span>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Home;
