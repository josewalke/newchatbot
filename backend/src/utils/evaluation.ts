/**
 * Sistema de evaluación para medir la calidad del chatbot
 */

interface TestCase {
  id: string;
  input: string;
  expectedIntent: string;
  expectedSlots?: Record<string, any>;
  expectedResponse?: string;
  category: 'booking' | 'reschedule' | 'cancel' | 'faq' | 'sales';
  difficulty: 'easy' | 'medium' | 'hard';
}

interface TestResult {
  testCase: TestCase;
  actualIntent: string;
  actualSlots: Record<string, any>;
  actualResponse: string;
  intentCorrect: boolean;
  slotsCorrect: boolean;
  responseQuality: number; // 0-1
  passed: boolean;
  notes: string;
}

/**
 * Casos de prueba para evaluar el chatbot
 */
export const TEST_CASES: TestCase[] = [
  // Casos de reserva
  {
    id: 'book-1',
    input: 'quiero una cita',
    expectedIntent: 'book',
    category: 'booking',
    difficulty: 'easy'
  },
  {
    id: 'book-2',
    input: 'me gustaría agendar una consulta para mañana',
    expectedIntent: 'book',
    expectedSlots: { date: 'mañana' },
    category: 'booking',
    difficulty: 'medium'
  },
  {
    id: 'book-3',
    input: 'necesito una sesión terapéutica el viernes por la tarde',
    expectedIntent: 'book',
    expectedSlots: { service: 'sesión terapéutica', date: 'viernes', time: 'tarde' },
    category: 'booking',
    difficulty: 'hard'
  },
  
  // Casos de reprogramar
  {
    id: 'reschedule-1',
    input: 'me lo mueves para mañana',
    expectedIntent: 'reschedule',
    expectedSlots: { newDate: 'mañana' },
    category: 'reschedule',
    difficulty: 'medium'
  },
  {
    id: 'reschedule-2',
    input: 'cambia mi cita del lunes para el miércoles',
    expectedIntent: 'reschedule',
    expectedSlots: { date: 'lunes', newDate: 'miércoles' },
    category: 'reschedule',
    difficulty: 'hard'
  },
  
  // Casos de cancelar
  {
    id: 'cancel-1',
    input: 'no puedo ir, me la cancelas',
    expectedIntent: 'cancel',
    category: 'cancel',
    difficulty: 'medium'
  },
  {
    id: 'cancel-2',
    input: 'cancelar cita del viernes',
    expectedIntent: 'cancel',
    expectedSlots: { date: 'viernes' },
    category: 'cancel',
    difficulty: 'medium'
  },
  
  // Casos de FAQ
  {
    id: 'faq-1',
    input: '¿cuáles son los horarios?',
    expectedIntent: 'faq',
    category: 'faq',
    difficulty: 'easy'
  },
  {
    id: 'faq-2',
    input: '¿cómo puedo cancelar una cita?',
    expectedIntent: 'faq',
    category: 'faq',
    difficulty: 'medium'
  },
  
  // Casos de ventas
  {
    id: 'sales-1',
    input: '¿cuánto cuesta la consulta?',
    expectedIntent: 'sales',
    category: 'sales',
    difficulty: 'easy'
  },
  {
    id: 'sales-2',
    input: 'me interesa saber los precios de todos los servicios',
    expectedIntent: 'sales',
    category: 'sales',
    difficulty: 'medium'
  },
  
  // Casos coloquiales/ambiguos
  {
    id: 'coloquial-1',
    input: 'eeeh, q tal, me gustaría una cita',
    expectedIntent: 'book',
    category: 'booking',
    difficulty: 'hard'
  },
  {
    id: 'coloquial-2',
    input: 'mmm, no puedo mañana por la tarde',
    expectedIntent: 'cancel',
    expectedSlots: { date: 'mañana', time: 'tarde' },
    category: 'cancel',
    difficulty: 'hard'
  }
];

/**
 * Evalúa la calidad de una respuesta del chatbot
 */
export function evaluateResponse(
  testCase: TestCase,
  actualIntent: string,
  actualSlots: Record<string, any>,
  actualResponse: string
): TestResult {
  // Evaluar intención
  const intentCorrect = actualIntent === testCase.expectedIntent;
  
  // Evaluar slots
  let slotsCorrect = true;
  if (testCase.expectedSlots) {
    for (const [key, value] of Object.entries(testCase.expectedSlots)) {
      if (!actualSlots[key] || !actualSlots[key].includes(value)) {
        slotsCorrect = false;
        break;
      }
    }
  }
  
  // Evaluar calidad de respuesta
  const responseQuality = evaluateResponseQuality(actualResponse, testCase);
  
  // Determinar si pasó la prueba
  const passed = intentCorrect && slotsCorrect && responseQuality >= 0.7;
  
  // Generar notas
  const notes = generateNotes(testCase, actualIntent, actualSlots, actualResponse, intentCorrect, slotsCorrect, responseQuality);
  
  return {
    testCase,
    actualIntent,
    actualSlots,
    actualResponse,
    intentCorrect,
    slotsCorrect,
    responseQuality,
    passed,
    notes
  };
}

/**
 * Evalúa la calidad de una respuesta
 */
function evaluateResponseQuality(response: string, testCase: TestCase): number {
  let score = 0;
  
  // Longitud apropiada
  if (response.length >= 20 && response.length <= 300) score += 0.2;
  else if (response.length > 0) score += 0.1;
  
  // Claridad y estructura
  if (response.includes('•') || response.includes('-')) score += 0.2; // Listas
  if (response.includes('¿') && response.includes('?')) score += 0.2; // Preguntas
  
  // Relevancia al contexto
  if (testCase.category === 'booking' && response.includes('cita')) score += 0.2;
  if (testCase.category === 'faq' && response.includes('información')) score += 0.2;
  if (testCase.category === 'sales' && response.includes('precio')) score += 0.2;
  
  // Confirmación para operaciones críticas
  if ((testCase.category === 'booking' || testCase.category === 'cancel') && 
      response.includes('confirmar') || response.includes('¿Deseas')) {
    score += 0.2;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Genera notas de evaluación
 */
function generateNotes(
  testCase: TestCase,
  actualIntent: string,
  actualSlots: Record<string, any>,
  actualResponse: string,
  intentCorrect: boolean,
  slotsCorrect: boolean,
  responseQuality: number
): string {
  const notes: string[] = [];
  
  if (!intentCorrect) {
    notes.push(`Intención incorrecta: esperado "${testCase.expectedIntent}", obtenido "${actualIntent}"`);
  }
  
  if (!slotsCorrect) {
    notes.push(`Slots incorrectos: esperado ${JSON.stringify(testCase.expectedSlots)}, obtenido ${JSON.stringify(actualSlots)}`);
  }
  
  if (responseQuality < 0.7) {
    notes.push(`Calidad de respuesta baja: ${(responseQuality * 100).toFixed(1)}%`);
  }
  
  if (notes.length === 0) {
    notes.push('Prueba superada correctamente');
  }
  
  return notes.join('; ');
}

/**
 * Ejecuta todas las pruebas de evaluación
 */
export async function runEvaluation(
  sendMessage: (message: string) => Promise<any>
): Promise<{
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    accuracy: number;
    averageQuality: number;
  };
}> {
  const results: TestResult[] = [];
  
  console.log('🚀 Iniciando evaluación del chatbot...');
  console.log(`📋 Total de pruebas: ${TEST_CASES.length}`);
  console.log('');
  
  for (const testCase of TEST_CASES) {
    console.log(`🧪 Ejecutando: ${testCase.id} (${testCase.category})`);
    
    try {
      const response = await sendMessage(testCase.input);
      
      const result = evaluateResponse(
        testCase,
        response.intent?.type || 'unknown',
        response.intent?.slots || {},
        response.reply || ''
      );
      
      results.push(result);
      
      const status = result.passed ? '✅ PASÓ' : '❌ FALLÓ';
      console.log(`   ${status} - ${result.notes}`);
      
      // Pausa entre pruebas para no sobrecargar
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ❌ ERROR: ${error}`);
      results.push({
        testCase,
        actualIntent: 'error',
        actualSlots: {},
        actualResponse: '',
        intentCorrect: false,
        slotsCorrect: false,
        responseQuality: 0,
        passed: false,
        notes: `Error de ejecución: ${error}`
      });
    }
  }
  
  // Calcular resumen
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const accuracy = (passed / total) * 100;
  const averageQuality = results.reduce((sum, r) => sum + r.responseQuality, 0) / total;
  
  const summary = {
    total,
    passed,
    failed: total - passed,
    accuracy,
    averageQuality
  };
  
  console.log('');
  console.log('📊 RESUMEN DE EVALUACIÓN');
  console.log('========================');
  console.log(`Total de pruebas: ${summary.total}`);
  console.log(`Pruebas superadas: ${summary.passed}`);
  console.log(`Pruebas fallidas: ${summary.failed}`);
  console.log(`Precisión: ${summary.accuracy.toFixed(1)}%`);
  console.log(`Calidad promedio: ${(summary.averageQuality * 100).toFixed(1)}%`);
  
  return { results, summary };
}
