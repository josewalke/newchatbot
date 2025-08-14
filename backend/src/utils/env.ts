import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Ollama
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'chatbot-optimized',
  embedModel: process.env.EMBED_MODEL || 'nomic-embed-text',
  
  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  
  // Database
  dbPath: process.env.DB_PATH || './chatbot.db',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // Limits
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '2000'),
  ollamaTimeout: parseInt(process.env.OLLAMA_TIMEOUT || '15000'),
} as const;

export default config;
