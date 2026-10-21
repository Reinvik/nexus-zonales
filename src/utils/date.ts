/**
 * Utilidades de fecha y hora bajo zona horaria oficial Santiago de Chile (America/Santiago).
 */

export const getTodayChile = (): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // Formato YYYY-MM-DD
};

export const formatChileanDate = (dateVal?: string | Date | null): string => {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD -> DD/MM/YYYY
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return str;
};

export const getChileTimeString = (dateObj: Date = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(dateObj);
};

export const getISOWeekNumber = (dateStr: string): string => {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    if (isNaN(d.getTime())) return 'Sem --';
    const dayNum = d.getUTCDay() || 7;
    const target = new Date(d);
    target.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `Sem ${weekNo}`;
  } catch {
    return 'Sem --';
  }
};

/**
 * Genera el LOTE oficial CIAL: Almacén + Día + Mes (DDMM)
 * Ejemplo: Viña del Mar (VMSJ) el 20 de Octubre -> VMSJ2010
 */
export const getZonalLote = (almacen: string, dateStr?: string): string => {
  const cleanAlm = (almacen || 'VMSJ').toUpperCase().trim();
  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const day = parts[2].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      return `${cleanAlm}${day}${month}`;
    }
  }
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${cleanAlm}${day}${month}`;
};
