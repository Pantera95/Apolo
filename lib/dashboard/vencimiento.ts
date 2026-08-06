/**
 * ¿Toca enviar este informe programado?
 *
 * Pura y probada aparte porque es donde vive el error caro: un fallo aquí manda
 * el mismo resumen doce veces a un grupo de dirección, o no lo manda ninguna.
 */

export interface Programado {
  activa: boolean;
  hora: number;
  minuto: number;
  /** 0 = domingo. Vacío = todos los días. */
  dias: number[];
  ultimoEnvio?: string;
}

/** Tolerancia: si la app se abre poco después de la hora, el envío sale igual. */
export const VENTANA_MIN = 30;

export function toca(p: Programado, ahoraMs: number): { debe: boolean; motivo: string } {
  if (!p.activa) return { debe: false, motivo: "desactivada" };

  const ahora = new Date(ahoraMs);

  if (p.dias.length > 0 && !p.dias.includes(ahora.getDay())) {
    return { debe: false, motivo: "hoy no es un día programado" };
  }

  const objetivo = new Date(ahora);
  objetivo.setHours(p.hora, p.minuto, 0, 0);
  const minutosDesde = (ahoraMs - objetivo.getTime()) / 60_000;

  if (minutosDesde < 0) return { debe: false, motivo: "todavía no es la hora" };
  if (minutosDesde > VENTANA_MIN) {
    // Pasada la ventana NO se envía: un resumen de las 7:00 recibido a las 18:00
    // desinforma más de lo que informa.
    return { debe: false, motivo: "la ventana de envío ya pasó" };
  }

  if (p.ultimoEnvio) {
    const ultimo = new Date(Date.parse(p.ultimoEnvio));
    if (!Number.isNaN(ultimo.getTime()) && mismoDia(ultimo, ahora)) {
      // Sin este freno, cada recarga de la página reenviaría el mismo resumen.
      return { debe: false, motivo: "ya se envió hoy" };
    }
  }

  return { debe: true, motivo: "dentro de la ventana" };
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Próxima ejecución, para mostrarla en la pantalla. */
export function proximaEjecucion(p: Programado, ahoraMs: number): Date {
  const d = new Date(ahoraMs);
  d.setSeconds(0, 0);
  for (let i = 0; i < 8; i++) {
    const cand = new Date(d);
    cand.setDate(d.getDate() + i);
    cand.setHours(p.hora, p.minuto, 0, 0);
    if (cand.getTime() <= ahoraMs) continue;
    if (p.dias.length === 0 || p.dias.includes(cand.getDay())) return cand;
  }
  return d;
}
