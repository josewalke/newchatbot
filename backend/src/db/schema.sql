-- Esquema de la base de datos para el chatbot

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de servicios
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de citas
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
);

-- Tabla de mensajes del chat
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  user_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  content TEXT NOT NULL,
  meta_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de conocimiento (RAG)
CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de embeddings para RAG
CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  knowledge_id INTEGER NOT NULL,
  vector_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (knowledge_id) REFERENCES knowledge (id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at ON appointments (starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments (service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages (user_id, channel);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge (source);
CREATE INDEX IF NOT EXISTS idx_embeddings_knowledge_id ON embeddings (knowledge_id);

-- Datos de ejemplo para servicios
INSERT OR IGNORE INTO services (id, name, duration_min, price_cents, active) VALUES
  (1, 'Consulta General', 30, 5000, 1),
  (2, 'Sesión Terapéutica', 60, 8000, 1),
  (3, 'Evaluación Inicial', 90, 12000, 1);

-- Datos de ejemplo para clientes
INSERT OR IGNORE INTO customers (id, name, email, phone) VALUES
  (1, 'Cliente Ejemplo', 'cliente@ejemplo.com', '+34600000000');

-- Datos de ejemplo para conocimiento
INSERT OR IGNORE INTO knowledge (id, source, chunk_text) VALUES
  (1, 'faq.md', '¿Cuáles son los horarios de atención?\n\nNuestros horarios de atención son de lunes a viernes de 9:00 a 18:00, y sábados de 9:00 a 14:00.'),
  (2, 'faq.md', '¿Cómo puedo cancelar una cita?\n\nPuedes cancelar tu cita hasta 24 horas antes de la hora programada. Contacta con nosotros por teléfono o email.'),
  (3, 'servicios.md', 'Consulta General\n\nNuestra consulta general incluye una evaluación completa de tu situación actual, identificación de necesidades y plan de acción personalizado. Duración: 30 minutos.'),
  (4, 'servicios.md', 'Sesión Terapéutica\n\nSesión individualizada para trabajar en profundidad en áreas específicas de tu desarrollo personal o profesional. Duración: 60 minutos.'),
  (5, 'servicios.md', 'Evaluación Inicial\n\nEvaluación completa que incluye entrevista, análisis de necesidades y recomendaciones personalizadas. Duración: 90 minutos.');
