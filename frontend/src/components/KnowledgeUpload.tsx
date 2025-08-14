import React, { useState, useEffect } from 'react';
import { Upload, FileText, Search, Database, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { uploadKnowledge, searchKnowledge, getKnowledgeStats } from '../lib/api';

const KnowledgeUpload: React.FC = () => {
  const [uploadData, setUploadData] = useState({
    source: '',
    content: '',
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    countChunks?: number;
  } | null>(null);

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const statsData = await getKnowledgeStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setUploadData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setUploadResult(null);

    try {
      const result = await uploadKnowledge(uploadData.source, uploadData.content);
      
      setUploadResult({
        success: true,
        message: `Conocimiento subido exitosamente. Se crearon ${result.countChunks} chunks.`,
        countChunks: result.countChunks,
      });

      // Limpiar formulario
      setUploadData({
        source: '',
        content: '',
      });

      // Recargar estadísticas
      await loadStats();
    } catch (error) {
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error al subir el conocimiento',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const result = await searchKnowledge(searchQuery, 5);
      setSearchResults(result.chunks);
    } catch (error) {
      console.error('Error en la búsqueda:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const formatScore = (score: number): string => {
    return (score * 100).toFixed(1) + '%';
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Database className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-900">{stats.totalChunks}</p>
                <p className="text-sm text-blue-700">Chunks de conocimiento</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-900">{stats.totalSources}</p>
                <p className="text-sm text-green-700">Fuentes de información</p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Search className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-900">{stats.totalEmbeddings}</p>
                <p className="text-sm text-purple-700">Embeddings generados</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de subida */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          <Upload className="w-5 h-5 inline mr-2" />
          Subir Nuevo Conocimiento
        </h3>
        
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
              Fuente del conocimiento *
            </label>
            <input
              type="text"
              id="source"
              name="source"
              value={uploadData.source}
              onChange={handleUploadChange}
              required
              className="input-field"
              placeholder="Ej: manual_usuario.md, faq_servicios.txt, politica_empresa.pdf"
            />
          </div>
          
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Contenido del conocimiento *
            </label>
            <textarea
              id="content"
              name="content"
              value={uploadData.content}
              onChange={handleUploadChange}
              required
              rows={8}
              className="input-field resize-none"
              placeholder="Pega aquí el contenido del documento, texto, o información que quieres que el chatbot conozca..."
            />
            <p className="text-xs text-gray-500 mt-1">
              El sistema dividirá automáticamente el contenido en chunks y generará embeddings para búsquedas RAG.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isUploading || !uploadData.source.trim() || !uploadData.content.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Subiendo conocimiento...</span>
              </div>
            ) : (
              'Subir Conocimiento'
            )}
          </button>
        </form>

        {/* Resultado de la subida */}
        {uploadResult && (
          <div className={`mt-4 p-4 rounded-lg border ${
            uploadResult.success 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-start space-x-3">
              {uploadResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div>
                <h4 className={`font-medium ${
                  uploadResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {uploadResult.success ? '¡Conocimiento subido!' : 'Error en la subida'}
                </h4>
                <p className="mt-1 text-sm">{uploadResult.message}</p>
                
                {uploadResult.success && uploadResult.countChunks && (
                  <p className="mt-2 text-sm text-green-700">
                    <strong>Chunks creados:</strong> {uploadResult.countChunks}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Búsqueda en el conocimiento */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          <Search className="w-5 h-5 inline mr-2" />
          Buscar en el Conocimiento
        </h3>
        
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700 mb-1">
              Consulta de búsqueda
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                id="searchQuery"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field flex-1"
                placeholder="Escribe tu pregunta o consulta..."
              />
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Buscar'
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Resultados de búsqueda */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            <h4 className="font-medium text-gray-900">Resultados encontrados:</h4>
            
            {searchResults.map((chunk, index) => (
              <div key={chunk.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-600">
                      Fuente: {chunk.source}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Score: {formatScore(chunk.score)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      // Aquí se podría implementar la funcionalidad de eliminar
                      console.log('Eliminar chunk:', chunk.id);
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Eliminar chunk"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {chunk.chunk_text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Información adicional */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-800 mb-2">📚 Información sobre RAG:</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• <strong>Chunks:</strong> Fragmentos de texto en los que se divide el contenido</li>
          <li>• <strong>Embeddings:</strong> Representaciones vectoriales para búsquedas semánticas</li>
          <li>• <strong>Fuente:</strong> Identificador del documento o información</li>
          <li>• <strong>Score:</strong> Relevancia de la respuesta (0-100%)</li>
          <li>• El sistema automáticamente encuentra la información más relevante para cada consulta</li>
        </ul>
      </div>
    </div>
  );
};

export default KnowledgeUpload;
