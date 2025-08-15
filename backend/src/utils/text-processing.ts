/**
 * Utilidades para procesamiento de texto y mejora de la comprensión del chatbot
 */

/**
 * Normaliza el texto del usuario para mejorar la comprensión
 */
export function normalizeUserText(text: string): string {
  return text
    // Normalizar abreviaciones comunes
    .replace(/\bq\b/gi, 'que')
    .replace(/\bxq\b/gi, 'porque')
    .replace(/\bpa\b/gi, 'para')
    .replace(/\bta\b/gi, 'está')
    .replace(/\bke\b/gi, 'que')
    .replace(/\baki\b/gi, 'aquí')
    .replace(/\bq tal\b/gi, 'qué tal')
    .replace(/\bq hora\b/gi, 'qué hora')
    .replace(/\bq dia\b/gi, 'qué día')
    
    // Limpiar muletillas y sonidos
    .replace(/\s+(eee+|mmm+|ajá+|eh+|um+)\s+/gi, ' ')
    .replace(/\s+(bueno+|pues+|entonces+)\s+/gi, ' ')
    
    // Normalizar puntuación
    .replace(/\s*\.{2,}/g, '.')
    .replace(/\s*!{2,}/g, '!')
    .replace(/\s*\?{2,}/g, '?')
    
    // Limpiar espacios múltiples
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Detecta el idioma del texto (implementación básica)
 */
export function detectLanguage(text: string): 'es' | 'en' | 'other' {
  const spanishWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'una', 'como', 'más', 'pero', 'sus', 'me', 'hasta', 'hay', 'donde', 'han', 'quien', 'están', 'estado', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros'];
  const englishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'];
  
  const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = normalizedText.split(/\s+/);
  
  let spanishCount = 0;
  let englishCount = 0;
  
  words.forEach(word => {
    if (spanishWords.includes(word)) spanishCount++;
    if (englishWords.includes(word)) englishCount++;
  });
  
  if (spanishCount > englishCount && spanishCount > 2) return 'es';
  if (englishCount > spanishCount && englishCount > 2) return 'en';
  return 'other';
}

/**
 * Clasificación rápida basada en palabras clave
 */
export function quickClassify(text: string): { intent: string; confidence: number; slots: Record<string, any> } {
  const normalizedText = normalizeUserText(text).toLowerCase();
  
  // Patrones para clasificación rápida
  const patterns = {
    book: {
      keywords: ['cita', 'agendar', 'reservar', 'appointment', 'book', 'schedule', 'reserva', 'hora', 'consulta', 'sesión'],
      confidence: 0.8
    },
    reschedule: {
      keywords: ['mover', 'cambiar', 'reprogramar', 'mueve', 'cambia', 'reschedule', 'move', 'change', 'otro día', 'otra hora'],
      confidence: 0.75
    },
    cancel: {
      keywords: ['cancelar', 'cancel', 'no puedo', 'no puedo ir', 'me la cancelas', 'me lo cancelas', 'anular'],
      confidence: 0.8
    },
    confirm: {
      keywords: ['confirmar', 'confirm', 'sí', 'yes', 'ok', 'vale', 'perfecto', 'perfect'],
      confidence: 0.7
    },
    faq: {
      keywords: ['qué', 'cómo', 'cuándo', 'dónde', 'por qué', 'what', 'how', 'when', 'where', 'why', 'horarios', 'precios', 'servicios'],
      confidence: 0.6
    },
    sales: {
      keywords: ['precio', 'costo', 'cost', 'price', 'cuánto', 'how much', 'servicios', 'services', 'oferta', 'offer'],
      confidence: 0.6
    }
  };
  
  let bestMatch = { intent: 'unknown', confidence: 0, slots: {} as Record<string, any> };
  
  for (const [intent, pattern] of Object.entries(patterns)) {
    const matches = pattern.keywords.filter(keyword => 
      normalizedText.includes(keyword)
    ).length;
    
    if (matches > 0) {
      const confidence = Math.min(pattern.confidence + (matches * 0.1), 0.95);
      if (confidence > bestMatch.confidence) {
        bestMatch = { intent, confidence, slots: {} as Record<string, any> };
      }
    }
  }
  
  // Extraer slots básicos
  if (bestMatch.intent === 'book' || bestMatch.intent === 'reschedule') {
    const timeSlots = extractTimeSlots(normalizedText);
    if (timeSlots.length > 0) {
      bestMatch.slots.time = timeSlots[0];
    }
  }
  
  return bestMatch;
}

/**
 * Extrae información temporal del texto
 */
function extractTimeSlots(text: string): string[] {
  const timePatterns = [
    /(mañana|morning)/gi,
    /(tarde|afternoon)/gi,
    /(noche|evening|night)/gi,
    /(lunes|monday)/gi,
    /(martes|tuesday)/gi,
    /(miércoles|wednesday)/gi,
    /(jueves|thursday)/gi,
    /(viernes|friday)/gi,
    /(sábado|saturday)/gi,
    /(domingo|sunday)/gi,
    /(\d{1,2}:\d{2})/g,
    /(\d{1,2}\s*(am|pm))/gi
  ];
  
  const slots: string[] = [];
  
  timePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      slots.push(...matches);
    }
  });
  
  return slots;
}

/**
 * Genera pregunta de desambiguación para campos faltantes
 */
export function askForMissingField(field: 'fecha' | 'servicio' | 'sucursal' | 'hora'): string {
  const questions = {
    fecha: '¿Qué día te viene mejor?',
          servicio: '¿Qué servicio necesitas? Tenemos Consulta Farmacéutica, Medición de Presión y Consejo Nutricional.',
    sucursal: '¿En qué sucursal prefieres la cita?',
    hora: '¿A qué hora te viene mejor? Tenemos disponibilidad en la mañana y tarde.'
  };
  
  return questions[field];
}

/**
 * Genera mensaje de confirmación para operaciones
 */
export function generateConfirmationMessage(operation: string, details: Record<string, any>): string {
  const confirmations: Record<string, string> = {
    book: `Voy a agendar tu cita para ${details.service || 'el servicio'} el ${details.date || 'la fecha indicada'}. ¿Deseas confirmar?`,
    reschedule: `Voy a reprogramar tu cita para ${details.newDate || 'la nueva fecha'}. ¿Deseas confirmar?`,
    cancel: `Voy a cancelar tu cita del ${details.date || 'la fecha indicada'}. ¿Deseas confirmar?`,
    confirm: `Perfecto, tu cita ha sido confirmada. Recibirás un email de confirmación.`
  };
  
  return confirmations[operation] || '¿Deseas confirmar esta operación?';
}

/**
 * Limpia el texto de respuestas del chatbot para evitar duplicaciones y mejorar la legibilidad
 */
export function cleanChatbotResponse(text: string): string {
  return text
    // Eliminar confirmaciones duplicadas
    .replace(/(\s*¿Deseas confirmar\?\s*){2,}/gi, " ¿Deseas confirmar?")
    .replace(/(\s*¿Te gustaría confirmar\?\s*){2,}/gi, " ¿Te gustaría confirmar?")
    .replace(/(\s*¿Quieres confirmar\?\s*){2,}/gi, " ¿Quieres confirmar?")
    
    // Eliminar espacios múltiples
    .replace(/\s{2,}/g, " ")
    
    // Limpiar saltos de línea múltiples
    .replace(/\n{3,}/g, "\n\n")
    
    // Limpiar puntos múltiples
    .replace(/\.{3,}/g, "...")
    
    // Limpiar signos de exclamación múltiples
    .replace(/!{2,}/g, "!")
    
    // Limpiar signos de interrogación múltiples
    .replace(/\?{2,}/g, "?")
    
    // Limpiar espacios al inicio y final
    .trim();
}

/**
 * Genera respuesta específica para síntomas de garganta con disclaimer de seguridad
 */
export function generateThroatSymptomResponse(otcItems: string[]): string {
  if (otcItems.length === 0) {
    return `Para el dolor de garganta, te recomiendo consultar con nuestro farmacéutico para obtener recomendaciones personalizadas. Recuerda que si tienes fiebre alta, dificultad para respirar o los síntomas persisten más de 3 días, debes acudir a un profesional médico.`;
  }
  
  const itemsList = otcItems.map(item => `• ${item}`).join('\n');
  
  return `Para el dolor de garganta (información general, no es un diagnóstico):

${itemsList}

**⚠️ Importante:** Esta información es solo orientativa. Si experimentas:
• Fiebre alta (>38°C)
• Dificultad para respirar
• Dolor intenso que no mejora
• Síntomas que persisten más de 3 días

**Debes acudir a un profesional médico o urgencias.**

¿Prefieres que te recomiende opciones de **venta libre** o ver **servicios** de consulta farmacéutica?`;
}

/**
 * Genera respuesta para medicamentos específicos con información de reserva
 */
export function generateMedicationResponse(medicationName: string, price: string, requiresPrescription: boolean = false): string {
  if (requiresPrescription) {
    return `**${medicationName}** - ${price}
Este medicamento requiere **receta médica**. 

Para obtenerlo necesitas:
1. 📝 Receta médica válida
2. 📋 Documento de identidad
3. 💰 Pago del medicamento

¿Tienes la receta médica o prefieres consultar sobre alternativas de venta libre?`;
  }
  
  return `**${medicationName}** - ${price} [Venta libre]

Este medicamento está disponible **sin receta** (OTC).

¿Quieres **reservarlo para recoger** hoy? Para hacerlo necesito:
• 📦 **Cantidad** (ej. 1 caja, 2 unidades)
• 👤 **Tu nombre** para la reserva

*No es una compra online, solo reserva para recoger en farmacia.*`;
}

/**
 * Genera respuesta para servicios con información de citas
 */
export function generateServiceResponse(serviceName: string, description: string, price: string): string {
  return `**${serviceName}** - ${price}

${description}

**📅 ¿Quieres agendar una cita?**
Para reservar necesito:
• 📅 **Fecha preferida** (hoy, mañana, otro día)
• 🕐 **Hora aproximada** (mañana, tarde, noche)
• 👤 **Tu nombre**
• 📱 **Teléfono de contacto**

¿Te gustaría agendar este servicio?`;
}
