import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

// Importar configuración y middlewares
import config from './utils/env';
import dbManager from './db/db';
import { errorHandler, notFoundHandler, jsonErrorHandler } from './middlewares/error.middleware';
import { loggerMiddleware, slowRequestLogger } from './middlewares/logger.middleware';
import { getCorsMiddleware } from './middlewares/cors.middleware';

// Importar rutas
import chatRoutes from './routes/chat.routes';
import appointmentsRoutes from './routes/appointments.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import integrationsRoutes from './routes/integrations.routes';
import servicesRoutes from './routes/services.routes';

// __dirname y __filename están disponibles en CommonJS
// No necesitamos import.meta.url

/**
 * Clase principal del servidor
 */
class Server {
  private app: express.Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = config.port;
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Inicializa los middlewares
   */
  private initializeMiddlewares(): void {
    // Seguridad
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
    this.app.use(getCorsMiddleware());

    // Logging
    this.app.use(morgan('combined'));
    this.app.use(loggerMiddleware);
    this.app.use(slowRequestLogger(1000)); // Log peticiones lentas > 1s

    // Parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Manejo de errores de JSON
    this.app.use(jsonErrorHandler);

    // Servir archivos estáticos del frontend
    if (config.nodeEnv === 'production') {
      const frontendPath = path.join(__dirname, '../frontend/dist');
      this.app.use(express.static(frontendPath));
    }
  }

  /**
   * Inicializa las rutas de la API
   */
  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        database: dbManager.isConnected() ? 'connected' : 'disconnected',
      });
    });

    // API routes
    this.app.use('/api/chat', chatRoutes);
    this.app.use('/api/appointments', appointmentsRoutes);
    this.app.use('/api/knowledge', knowledgeRoutes);
    this.app.use('/api/services', servicesRoutes);
    this.app.use('/integrations', integrationsRoutes);

    // Ruta para el embed de WordPress
    this.app.get('/embed.html', (req, res) => {
      if (config.nodeEnv === 'production') {
        res.sendFile(path.join(__dirname, '../frontend/dist/embed.html'));
      } else {
        res.redirect('http://localhost:5173/embed.html');
      }
    });

    // Ruta principal para SPA
    if (config.nodeEnv === 'production') {
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
      });
    }
  }

  /**
   * Inicializa el manejo de errores
   */
  private initializeErrorHandling(): void {
    // Ruta no encontrada
    this.app.use(notFoundHandler);

    // Manejador de errores global
    this.app.use(errorHandler);
  }

  /**
   * Inicializa la base de datos
   */
  private async initializeDatabase(): Promise<void> {
    try {
      dbManager.initialize();
      console.log('✅ Base de datos inicializada correctamente');
    } catch (error) {
      console.error('❌ Error al inicializar la base de datos:', error);
      process.exit(1);
    }
  }

  /**
   * Inicia el servidor
   */
  async start(): Promise<void> {
    try {
      // Inicializar base de datos
      await this.initializeDatabase();

      // Iniciar servidor HTTP
      this.app.listen(this.port, () => {
        console.log('🚀 Servidor iniciado correctamente');
        console.log(`📍 Puerto: ${this.port}`);
        console.log(`🌍 Entorno: ${config.nodeEnv}`);
        console.log(`🔗 URL: http://localhost:${this.port}`);
        
        if (config.nodeEnv === 'development') {
          console.log(`🎨 Frontend: http://localhost:5173`);
        }
        
        console.log('✨ ChatBot listo para recibir mensajes');
      });

      // Manejo de señales de terminación
      process.on('SIGINT', this.gracefulShutdown.bind(this));
      process.on('SIGTERM', this.gracefulShutdown.bind(this));

    } catch (error) {
      console.error('❌ Error al iniciar el servidor:', error);
      process.exit(1);
    }
  }

  /**
   * Cierre graceful del servidor
   */
  private gracefulShutdown(): void {
    console.log('\n🔄 Cerrando servidor...');
    
    try {
      // Cerrar base de datos
      dbManager.close();
      console.log('✅ Base de datos cerrada');
      
      // Salir del proceso
      process.exit(0);
    } catch (error) {
      console.error('❌ Error durante el cierre:', error);
      process.exit(1);
    }
  }
}

// Crear y exportar instancia del servidor
const server = new Server();

// Iniciar servidor si se ejecuta directamente
if (require.main === module) {
  server.start().catch(error => {
    console.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  });
}

export default server;
