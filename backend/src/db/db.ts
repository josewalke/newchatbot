import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import config from '../utils/env';

/**
 * Clase para manejar la conexión a la base de datos SQLite
 */
class DatabaseManager {
  private db: Database.Database | null = null;
  private static instance: DatabaseManager;

  private constructor() {}

  /**
   * Obtiene la instancia singleton de DatabaseManager
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Inicializa la conexión a la base de datos
   */
  public initialize(): void {
    try {
      // Crear conexión a la base de datos
      this.db = new Database(config.dbPath);
      
      // Configurar opciones de rendimiento
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('temp_store = MEMORY');
      
      console.log('✅ Base de datos SQLite inicializada correctamente');
      
      // Ejecutar migraciones
      this.runMigrations();
      
    } catch (error) {
      console.error('❌ Error al inicializar la base de datos:', error);
      throw error;
    }
  }

  /**
   * Ejecuta las migraciones del esquema
   */
  private runMigrations(): void {
    try {
      // Crear tablas si no existen
      this.createTables();
      
      // Insertar datos de ejemplo si las tablas están vacías
      this.insertSampleData();
      
      console.log('✅ Migraciones ejecutadas correctamente');
    } catch (error) {
      console.error('❌ Error al ejecutar migraciones:', error);
      throw error;
    }
  }

  /**
   * Crea las tablas de la base de datos
   */
  private createTables(): void {
    // Tabla de clientes
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de servicios
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        duration_min INTEGER NOT NULL,
        price_cents INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de citas
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        starts_at DATETIME NOT NULL,
        ends_at DATETIME NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id),
        FOREIGN KEY (service_id) REFERENCES services (id)
      )
    `);

    // Tabla de mensajes del chat
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL,
        user_id TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
        content TEXT NOT NULL,
        meta_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de conocimiento (RAG)
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        chunk_text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de embeddings para RAG
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        knowledge_id INTEGER NOT NULL,
        vector_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (knowledge_id) REFERENCES knowledge (id)
      )
    `);

    // Crear índices
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_appointments_starts_at ON appointments (starts_at)');
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments (service_id)');
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status)');
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages (user_id, channel)');
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at)');
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge (source)');
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_embeddings_knowledge_id ON embeddings (knowledge_id)');
  }

  /**
   * Inserta datos de ejemplo en las tablas
   */
  private insertSampleData(): void {
    // Insertar servicios de ejemplo
    this.db!.exec(`
      INSERT OR IGNORE INTO services (id, name, duration_min, price_cents, active) VALUES
        (1, 'Consulta General', 30, 5000, 1),
        (2, 'Sesión Terapéutica', 60, 8000, 1),
        (3, 'Evaluación Inicial', 90, 12000, 1)
    `);

    // Insertar cliente de ejemplo
    this.db!.exec(`
      INSERT OR IGNORE INTO customers (id, name, email, phone) VALUES
        (1, 'Cliente Ejemplo', 'cliente@ejemplo.com', '+34600000000')
    `);

    // Insertar conocimiento de ejemplo
    this.db!.exec(`
      INSERT OR IGNORE INTO knowledge (id, source, chunk_text) VALUES
        (1, 'faq.md', '¿Cuáles son los horarios de atención?\n\nNuestros horarios de atención son de lunes a viernes de 9:00 a 18:00, y sábados de 9:00 a 14:00.'),
        (2, 'faq.md', '¿Cómo puedo cancelar una cita?\n\nPuedes cancelar tu cita hasta 24 horas antes de la hora programada. Contacta con nosotros por teléfono o email.'),
        (3, 'servicios.md', 'Consulta General\n\nNuestra consulta general incluye una evaluación completa de tu situación actual, identificación de necesidades y plan de acción personalizado. Duración: 30 minutos.'),
        (4, 'servicios.md', 'Sesión Terapéutica\n\nSesión individualizada para trabajar en profundidad en áreas específicas de tu desarrollo personal o profesional. Duración: 60 minutos.'),
        (5, 'servicios.md', 'Evaluación Inicial\n\nEvaluación completa que incluye entrevista, análisis de necesidades y recomendaciones personalizadas. Duración: 90 minutos.')
    `);
  }

  /**
   * Obtiene la instancia de la base de datos
   */
  public getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('La base de datos no ha sido inicializada');
    }
    return this.db;
  }

  /**
   * Cierra la conexión a la base de datos
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔒 Conexión a la base de datos cerrada');
    }
  }

  /**
   * Ejecuta una consulta y retorna el resultado
   */
  public query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.getDatabase().prepare(sql);
    return stmt.all(params) as T[];
  }

  /**
   * Ejecuta una consulta y retorna el primer resultado
   */
  public queryFirst<T = any>(sql: string, params: any[] = []): T | undefined {
    const stmt = this.getDatabase().prepare(sql);
    return stmt.get(params) as T | undefined;
  }

  /**
   * Ejecuta una consulta de inserción/actualización/eliminación
   */
  public run(sql: string, params: any[] = []): Database.RunResult {
    const stmt = this.getDatabase().prepare(sql);
    return stmt.run(params);
  }

  /**
   * Ejecuta múltiples consultas en una transacción
   */
  public transaction<T>(callback: () => T): T {
    const db = this.getDatabase();
    return db.transaction(callback)();
  }

  /**
   * Verifica si la base de datos está conectada
   */
  public isConnected(): boolean {
    return this.db !== null;
  }
}

// Exportar instancia singleton
export const dbManager = DatabaseManager.getInstance();
export default dbManager;
