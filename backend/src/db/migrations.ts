import dbManager from './db';

/**
 * Script de migraciones para la base de datos
 * Se ejecuta automáticamente al inicializar la aplicación
 */

async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Ejecutando migraciones de la base de datos...');
    
    // Inicializar la base de datos (esto ejecuta automáticamente las migraciones)
    dbManager.initialize();
    
    console.log('✅ Migraciones completadas exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante las migraciones:', error);
    process.exit(1);
  }
}

// Si se ejecuta directamente este archivo
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🎉 Migraciones ejecutadas correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal durante las migraciones:', error);
      process.exit(1);
    });
}

export { runMigrations };
