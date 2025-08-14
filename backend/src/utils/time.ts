/**
 * Utilidades para manejo de fechas y horarios
 */

/**
 * Convierte una fecha ISO a objeto Date
 * @param isoString String ISO de fecha
 * @returns Objeto Date
 */
export function parseISO(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Formatea una fecha para mostrar al usuario
 * @param date Fecha a formatear
 * @param locale Locale para formateo (default: 'es-ES')
 * @returns String formateado
 */
export function formatDate(date: Date, locale: string = 'es-ES'): string {
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formatea una hora para mostrar al usuario
 * @param date Fecha con hora
 * @param locale Locale para formateo (default: 'es-ES')
 * @returns String formateado
 */
export function formatTime(date: Date, locale: string = 'es-ES'): string {
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea fecha y hora para mostrar al usuario
 * @param date Fecha con hora
 * @param locale Locale para formateo (default: 'es-ES')
 * @returns String formateado
 */
export function formatDateTime(date: Date, locale: string = 'es-ES'): string {
  return `${formatDate(date, locale)} a las ${formatTime(date, locale)}`;
}

/**
 * Verifica si dos rangos de tiempo se solapan
 * @param start1 Inicio del primer rango
 * @param end1 Fin del primer rango
 * @param start2 Inicio del segundo rango
 * @param end2 Fin del segundo rango
 * @returns true si hay solapamiento
 */
export function hasTimeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Calcula la duración entre dos fechas en minutos
 * @param start Fecha de inicio
 * @param end Fecha de fin
 * @returns Duración en minutos
 */
export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Añade minutos a una fecha
 * @param date Fecha base
 * @param minutes Minutos a añadir
 * @returns Nueva fecha
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Obtiene la fecha actual en formato ISO
 * @returns String ISO de la fecha actual
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Verifica si una fecha está en el futuro
 * @param date Fecha a verificar
 * @returns true si está en el futuro
 */
export function isFutureDate(date: Date): boolean {
  return date > new Date();
}

/**
 * Obtiene el inicio del día (00:00:00)
 * @param date Fecha base
 * @returns Fecha con hora 00:00:00
 */
export function startOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

/**
 * Obtiene el fin del día (23:59:59)
 * @param date Fecha base
 * @returns Fecha con hora 23:59:59
 */
export function endOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}
