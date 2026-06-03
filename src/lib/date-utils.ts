/**
 * Utilidades para el manejo de fechas y horas forzadas a la zona horaria de Ecuador.
 * Esto evita el desfase de UTC en servidores como Vercel y locales.
 */

export const ECUADOR_TIMEZONE = 'America/Guayaquil';
if (typeof process !== 'undefined') {
  process.env.TZ = ECUADOR_TIMEZONE;
}

/**
 * Obtiene un objeto Date que representa el "ahora" en la zona horaria de Ecuador.
 * ⚠️ ADVERTENCIA: No usar para guardar en la base de datos (Prisma/MySQL).
 * Para almacenamiento usar siempre `new Date()` (UTC puro).
 * Usar esta función SOLO para comparaciones en el cliente o lógica de visualización inmediata.
 */
export function getLocalNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: ECUADOR_TIMEZONE }));
}

/**
 * Formatea una fecha para visualización en formato local de Ecuador.
 */
export function formatToEcuador(date: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  return d.toLocaleString('es-EC', {
    timeZone: ECUADOR_TIMEZONE,
    hour12: true,
    ...options
  });
}

/**
 * Helper para mostrar solo la hora (HH:mm AM/PM) en Ecuador
 * Versión manual para evitar problemas con hour12 en Android WebView
 */
export function formatTimeEcuador(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  // Forzar interpretación en zona Ecuador
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: ECUADOR_TIMEZONE
  };
  
  // Algunos Android WebView no respetan hour12, así que formateamos manualmente
  const formatted = d.toLocaleString('en-US', options);
  
  // Si parece que hour12 no funcionó (muestra 00 en vez de 12), ajustar manualmente
  if (formatted.includes(':00 ') && !formatted.includes('12:')) {
    const match = formatted.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      let hours = parseInt(match[1]);
      const mins = match[2];
      const period = match[3].toUpperCase();
      
      // Si hour12 falló y muestra 00, convertir a 12 para AM o mantener para PM
      if (hours === 0) hours = 12;
      
      return `${hours.toString().padStart(2, '0')}:${mins}${period}`;
    }
  }
  
  return formatted;
}

/**
 * Helper para mostrar solo la fecha (DD/MM/YYYY) en Ecuador
 */
export function formatDateEcuador(date: Date | string | number | null | undefined): string {
  return formatToEcuador(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const formatDate = formatDateEcuador;

/**
 * Helper para mostrar fecha larga (D de mes de YYYY) en Ecuador
 */
export function formatDateLongEcuador(date: Date | string | number | null | undefined): string {
  return formatToEcuador(date, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Fuerza que un string de fecha (de input) sea interpretado en la zona de Ecuador (-05:00)
 */
export function forceEcuadorTZ(dtStr: string | null | undefined): string {
  if (!dtStr) return '';
  // If it already has a timezone indicator, don't double-apply
  if (dtStr.endsWith('Z')) return dtStr;
  // Check for offset only in the TIME part (after T), not in the date part where '-' is a separator
  const tIndex = dtStr.indexOf('T');
  if (tIndex !== -1) {
    const timePart = dtStr.substring(tIndex);
    // Look for +HH:MM or -HH:MM offset pattern in the time portion
    if (/[+-]\d{2}:\d{2}$/.test(timePart)) return dtStr;
    // dtStr format is YYYY-MM-DDTHH:mm, append seconds and Ecuador offset
    return dtStr + ':00-05:00';
  } else {
    // Si no tiene la "T", suele venir de un <input type="date"> => "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(dtStr)) {
      return dtStr + 'T00:00:00-05:00';
    }
    return dtStr; // Retorna normal si no tiene un formato esperado
  }
}

/**
 * Formatea una fecha para <input type="datetime-local"> en la zona de Ecuador.
 */
export function formatForDateTimeInput(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ECUADOR_TIMEZONE
  };
  
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(d);
  const find = (type: string) => parts.find(p => p.type === type)?.value;
  
  return `${find('year')}-${find('month')}-${find('day')}T${find('hour')}:${find('minute')}`;
}

/**
 * Retorna fecha ISO en zona de Ecuador (YYYY-MM-DD)
 */
export function toEcuadorISODate(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ECUADOR_TIMEZONE };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(d);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}
