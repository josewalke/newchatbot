const { dbManager } = require('./dist/db/db');

/**
 * Script de migración para ejecutar el esquema SQL actualizado
 */
async function migrateSchema() {
  try {
    console.log('🔄 Iniciando migración del esquema...');

    // Inicializar la base de datos
    console.log('🔌 Inicializando base de datos...');
    dbManager.initialize();

    // Definir las consultas en el orden correcto (sin dependencias circulares)
    const queries = [
      // 1. Crear tablas base sin dependencias
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        category TEXT NOT NULL CHECK (category IN ('consulta', 'queja', 'sugerencia', 'problema_tecnico', 'facturacion', 'cita')),
        priority TEXT NOT NULL CHECK (priority IN ('baja', 'media', 'alta', 'urgente')),
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'en_proceso', 'esperando_cliente', 'resuelto', 'cerrado')),
        assigned_to TEXT,
        resolution TEXT,
        customer_satisfaction INTEGER CHECK (customer_satisfaction >= 1 AND customer_satisfaction <= 5),
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        resolved_at DATETIME
      )`,

      `CREATE TABLE IF NOT EXISTS shopping_carts (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        items_json TEXT NOT NULL,
        subtotal REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'completed')),
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS pharmaceutical_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL CHECK (category IN ('medicamento', 'cosmetico', 'suplemento', 'equipamiento')),
        requires_prescription BOOLEAN DEFAULT FALSE,
        price_cents INTEGER NOT NULL,
        stock_quantity INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS pharmacy_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        duration_min INTEGER NOT NULL,
        price_cents INTEGER NOT NULL,
        requires_appointment BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS customers_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS pharmacy_hours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        open_time TIME NOT NULL,
        close_time TIME NOT NULL,
        is_24h BOOLEAN DEFAULT FALSE,
        is_closed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // 2. Crear tablas con dependencias
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        cart_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        items_json TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL,
        total REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
        payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'transfer', 'cash', 'pharmacy_pickup')),
        payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
        shipping_address TEXT,
        notes TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (cart_id) REFERENCES shopping_carts (id)
      )`,

      `CREATE TABLE IF NOT EXISTS appointments_new (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        service_id INTEGER NOT NULL,
        service_name TEXT NOT NULL,
        appointment_date TEXT NOT NULL,
        appointment_time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled')),
        notes TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (service_id) REFERENCES pharmacy_services (id)
      )`,

      `CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        doctor_name TEXT NOT NULL,
        doctor_license TEXT,
        prescription_date DATE NOT NULL,
        expiration_date DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'completed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers_new (id)
      )`,

      `CREATE TABLE IF NOT EXISTS prescription_medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prescription_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        dosage TEXT NOT NULL,
        frequency TEXT NOT NULL,
        duration_days INTEGER,
        instructions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prescription_id) REFERENCES prescriptions (id),
        FOREIGN KEY (product_id) REFERENCES pharmaceutical_products (id)
      )`,

      // 3. Insertar datos iniciales
      `INSERT OR IGNORE INTO pharmacy_hours (day_of_week, open_time, close_time, is_24h, is_closed) VALUES
        (0, '09:00', '14:00', 0, 0),
        (1, '08:00', '20:00', 0, 0),
        (2, '08:00', '20:00', 0, 0),
        (3, '08:00', '20:00', 0, 0),
        (4, '08:00', '20:00', 0, 0),
        (5, '08:00', '20:00', 0, 0),
        (6, '09:00', '18:00', 0, 0)`,

      `INSERT OR IGNORE INTO pharmacy_services (name, description, duration_min, price_cents, requires_appointment, active) VALUES
        ('Consulta General', 'Consulta farmacéutica general sobre medicamentos y salud', 15, 0, 0, 1),
        ('Análisis de Sangre', 'Análisis básico de sangre con resultados en 24h', 30, 2500, 1, 1),
        ('Control de Tensión', 'Medición y control de tensión arterial', 10, 500, 0, 1),
        ('Asesoramiento Nutricional', 'Consulta sobre nutrición y suplementos', 20, 1500, 1, 1),
        ('Vacunación', 'Administración de vacunas', 15, 1000, 1, 1)`,

      `INSERT OR IGNORE INTO pharmaceutical_products (name, description, category, requires_prescription, price_cents, stock_quantity, active) VALUES
        ('Paracetamol 500mg', 'Analgésico y antipirético', 'medicamento', 0, 250, 100, 1),
        ('Ibuprofeno 400mg', 'Antiinflamatorio y analgésico', 'medicamento', 0, 300, 80, 1),
        ('Vitamina C 1000mg', 'Suplemento vitamínico', 'suplemento', 0, 450, 120, 1),
        ('Omeprazol 20mg', 'Protector gástrico', 'medicamento', 1, 800, 50, 1),
        ('Aspirina 100mg', 'Anticoagulante y analgésico', 'medicamento', 0, 200, 90, 1),
        ('Calcio + Vitamina D', 'Suplemento para huesos', 'suplemento', 0, 600, 75, 1),
        ('Jarabe para la Tos', 'Antitusivo natural', 'medicamento', 0, 350, 60, 1),
        ('Crema Hidratante', 'Hidratante corporal', 'cosmetico', 0, 400, 45, 1)`,

      // 4. Crear índices
      `CREATE INDEX IF NOT EXISTS idx_pharmaceutical_products_category ON pharmaceutical_products(category)`,
      `CREATE INDEX IF NOT EXISTS idx_pharmaceutical_products_active ON pharmaceutical_products(active)`,
      `CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)`,
      `CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority)`,
      `CREATE INDEX IF NOT EXISTS idx_shopping_carts_customer_email ON shopping_carts(customer_email)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`
    ];
    
    console.log(`📝 Ejecutando ${queries.length} consultas SQL...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      try {
        console.log(`   [${i + 1}/${queries.length}] Ejecutando consulta...`);
        dbManager.run(query);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Error en consulta ${i + 1}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n✅ Migración completada!');
    console.log(`   ✅ Consultas exitosas: ${successCount}`);
    console.log(`   ❌ Consultas con error: ${errorCount}`);
    
    // Verificar las tablas creadas
    console.log('\n🔍 Verificando tablas creadas...');
    const tables = dbManager.query("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('📊 Tablas disponibles:');
    tables.forEach(table => {
      console.log(`   - ${table.name}`);
    });

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    // Cerrar la base de datos
    dbManager.close();
  }
}

// Ejecutar la migración si se llama directamente
if (require.main === module) {
  migrateSchema();
}

module.exports = { migrateSchema };
