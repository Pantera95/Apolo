import { progresoViaje, siguienteParada, usoCapacidad, type Eta } from "@/lib/logistica/nucleo";
import type {
  CapacidadVehiculo,
  EventoTracking,
  PlanRuta,
  Severidad,
} from "@/lib/logistica/tipos";

/**
 * Plantillas de informe logístico para Telegram.
 *
 * FUNCIONES PURAS Y FUERA DEL COMPONENTE, y ese es el cambio de fondo: antes
 * vivían dentro del panel y no se podían ejercitar. Un mensaje que sale a un
 * grupo de veinte personas con una cifra rota no se puede recoger, así que
 * tiene que poder probarse cada plantilla contra cada viaje antes de enviarla.
 *
 * CADA PLANTILLA DECLARA SI PUEDE COMPONERSE CON VERDAD. El riesgo de este
 * panel nunca fue que fallara el envío —Telegram acepta cualquier texto—, sino
 * que enviara algo FALSO: "Entrega completada · 0 de 1 paradas" o una "Alerta"
 * cuyo motivo detectado es "Sin eventos abiertos". Eso se lee en voz alta en
 * una demostración y no hay forma de arreglarlo después.
 */

export type IdPlantilla = "salida" | "en_ruta" | "alerta" | "entrega" | "resumen";

export interface DefPlantilla {
  id: IdPlantilla;
  nombre: string;
  severidad: Severidad;
}

export const PLANTILLAS: DefPlantilla[] = [
  { id: "salida", nombre: "Salida del almacén", severidad: "informativa" },
  { id: "en_ruta", nombre: "En ruta con ETA", severidad: "informativa" },
  { id: "alerta", nombre: "Alerta de retraso o desvío", severidad: "alta" },
  { id: "entrega", nombre: "Entrega completada", severidad: "informativa" },
  { id: "resumen", nombre: "Resumen de la jornada", severidad: "informativa" },
];

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Umbral a partir del cual un desvío deja de ser ruido y merece aviso. */
export const UMBRAL_RETRASO_MIN = 10;

export interface CtxLogistica {
  ruta: PlanRuta;
  rutas: PlanRuta[];
  vehiculo: string;
  capacidad: CapacidadVehiculo | null;
  chofer: string;
  /** Nombre del lugar de la siguiente parada. */
  destino: string;
  /** ETA de la siguiente parada. `null` si el vehículo no reporta posición. */
  eta: Eta | null;
  eventos: EventoTracking[];
  velocidadKmh: number | null;
  /** Formatea un ISO a hora local. Se inyecta para no atar esto al idioma. */
  hora: (iso: string) => string;
  nombreLugar: (lugarId: string) => string;
  urlRuta: string | null;
  urlSiguiente: string | null;
  nombreSiguiente: string | null;
  paradasEnEnlace: number;
  omitidas: string[];
}

// ---------------------------------------------------------------------------
// Aptitud
// ---------------------------------------------------------------------------

export interface Aptitud {
  apto: boolean;
  /** Por qué no aplica. Se enseña en pantalla ANTES de poder enviar. */
  motivo: string | null;
}

/**
 * ¿Puede esta plantilla decir la verdad sobre este viaje?
 *
 * Es una puerta, no un adorno. Sin ella el operador puede mandar a un grupo de
 * obra un "Entrega completada" de un viaje que no ha entregado nada, y el
 * mensaje sale perfectamente formado — que es justo lo que lo hace peligroso.
 */
export function aptitud(id: IdPlantilla, c: CtxLogistica): Aptitud {
  const completadas = c.ruta.paradas.filter((p) => p.estado === "completada").length;

  switch (id) {
    case "salida":
      return c.ruta.paradas.length > 0
        ? { apto: true, motivo: null }
        : { apto: false, motivo: "El viaje no tiene paradas planificadas." };

    case "en_ruta":
      // Sin posición no hay ETA, y un "ETA: —" no informa de nada.
      return c.eta !== null
        ? { apto: true, motivo: null }
        : {
            apto: false,
            motivo: "El vehículo no reporta posición: no hay ETA que informar.",
          };

    case "alerta": {
      const retraso = c.eta ? Math.round(c.eta.desviacionMin) : 0;
      if (c.eventos.length > 0 || retraso > UMBRAL_RETRASO_MIN) {
        return { apto: true, motivo: null };
      }
      return {
        apto: false,
        motivo:
          "Este viaje no tiene incidencias abiertas ni retraso relevante. Una alerta sin motivo enseña al canal a ignorarlas.",
      };
    }

    case "entrega":
      return completadas > 0
        ? { apto: true, motivo: null }
        : {
            apto: false,
            motivo: "Ninguna parada de este viaje está completada todavía.",
          };

    case "resumen":
      return c.rutas.length > 0
        ? { apto: true, motivo: null }
        : { apto: false, motivo: "No hay viajes en la jornada." };
  }
}

// ---------------------------------------------------------------------------
// Composición
// ---------------------------------------------------------------------------

function bloqueNavegacion(c: CtxLogistica): string {
  const partes: string[] = [];
  if (c.urlSiguiente && c.nombreSiguiente) {
    partes.push(`🧭 <a href="${c.urlSiguiente}">Ir a ${esc(c.nombreSiguiente)}</a>`);
  }
  if (c.urlRuta) {
    partes.push(`🗺 <a href="${c.urlRuta}">Ruta completa (${c.paradasEnEnlace} paradas)</a>`);
  }
  // Google descarta por encima de nueve waypoints EN SILENCIO, y un chofer
  // navegando una ruta recortada sin saberlo es peor que no darle enlace.
  if (c.omitidas.length > 0) {
    partes.push(
      `⚠️ No caben en el enlace: ${esc(c.omitidas.join(", "))}. Google admite 9 paradas.`,
    );
  }
  return partes.length > 0 ? "\n\n" + partes.join("\n") : "";
}

const identidad = (c: CtxLogistica): string[] => [
  `Ruta: <b>${esc(c.ruta.codigo)}</b>`,
  `Vehículo: ${esc(c.vehiculo)}`,
  `Conductor: ${esc(c.chofer)}`,
];

/** Carga del viaje, con el porcentaje de ocupación cuando se conoce. */
function carga(c: CtxLogistica): string {
  const pesoKg = c.ruta.paradas.reduce((s, p) => s + p.pesoKg, 0);
  const m3 = c.ruta.paradas.reduce((s, p) => s + p.volumenM3, 0);
  if (!c.capacidad) return `Carga: ${pesoKg.toLocaleString("es-VE")} kg · ${m3} m³`;
  const u = usoCapacidad(c.ruta.paradas, c.capacidad);
  return `Carga: ${pesoKg.toLocaleString("es-VE")} kg · ${m3} m³ (${Math.round(Math.max(u.pctPeso, u.pctVolumen))}% del camión)`;
}

export function componer(id: IdPlantilla, c: CtxLogistica): string {
  const completadas = c.ruta.paradas.filter((p) => p.estado === "completada").length;
  const total = c.ruta.paradas.length;
  const retraso = c.eta ? Math.round(c.eta.desviacionMin) : 0;

  switch (id) {
    case "salida": {
      const primera = c.ruta.paradas[0];
      return (
        [
          "<b>🚚 Salida del almacén</b>",
          ...identidad(c),
          "",
          carga(c),
          `Paradas planificadas: ${total}`,
          `Recorrido: ${c.ruta.distanciaPlanKm.toFixed(1)} km · ${Math.round(c.ruta.duracionPlanMin)} min`,
          "",
          `Primera parada: ${esc(c.nombreLugar(primera?.lugarId ?? ""))}`,
          primera ? `Despacho ${esc(primera.despachoId)} · llegada prevista ${c.hora(primera.llegadaPlanificada)}` : "",
        ]
          .filter(Boolean)
          .join("\n") + bloqueNavegacion(c)
      );
    }

    case "en_ruta": {
      // La aptitud garantiza que hay ETA; el `?? ` es defensa, no lógica.
      const eta = c.eta;
      const estado =
        retraso > UMBRAL_RETRASO_MIN
          ? `⚠️ Retraso de ${retraso} min`
          : retraso < -UMBRAL_RETRASO_MIN
            ? `Adelantado ${Math.abs(retraso)} min`
            : "✅ En tiempo";
      return (
        [
          "<b>📍 En ruta</b>",
          ...identidad(c),
          "",
          `Siguiente parada: ${esc(c.destino)}`,
          eta ? `ETA: <b>${c.hora(eta.llegadaEstimada)}</b> (${Math.round(eta.minutosRestantes)} min · ${eta.distanciaRestanteKm.toFixed(1)} km)` : "",
          `Estado: ${estado}`,
          c.velocidadKmh !== null ? `Velocidad: ${Math.round(c.velocidadKmh)} km/h` : "",
          `Progreso: ${completadas} de ${total} paradas · ${Math.round(progresoViaje(c.ruta.paradas) * 100)}%`,
        ]
          .filter(Boolean)
          .join("\n") + bloqueNavegacion(c)
      );
    }

    case "alerta": {
      const motivos = c.eventos.length > 0
        ? c.eventos.map((e) => `• ${esc(e.detalle)}`)
        : [`• Retraso de ${retraso} min sobre lo planificado`];
      // A QUÉ OBRA AFECTA: sin esto el aviso obliga a abrir el sistema para
      // saber a quién hay que llamar, y en ese rato la obra ya está parada.
      const afectadas = c.ruta.paradas
        .filter((p) => p.estado !== "completada")
        .map((p) => `${esc(c.nombreLugar(p.lugarId))} (${esc(p.despachoId)})`);
      return (
        [
          "<b>⚠️ Alerta en el viaje</b>",
          ...identidad(c),
          "",
          "<b>Motivo</b>",
          ...motivos,
          retraso > 0 ? `\nRetraso acumulado: <b>${retraso} min</b>` : "",
          afectadas.length > 0 ? `\n<b>Entregas afectadas</b>\n${afectadas.map((a) => `• ${a}`).join("\n")}` : "",
          "",
          "<b>Acción recomendada</b>",
          "Contactar al conductor y avisar a la obra del nuevo estimado.",
        ]
          .filter(Boolean)
          .join("\n") + bloqueNavegacion(c)
      );
    }

    case "entrega": {
      const ultima = [...c.ruta.paradas]
        .filter((p) => p.estado === "completada")
        .sort((a, b) => b.orden - a.orden)[0];
      const restantes = c.ruta.paradas.filter((p) => p.estado !== "completada");
      const kg = ultima?.pesoKg ?? 0;
      return (
        [
          "<b>✅ Entrega completada</b>",
          ...identidad(c),
          "",
          ultima ? `Obra: <b>${esc(c.nombreLugar(ultima.lugarId))}</b>` : "",
          ultima ? `Despacho ${esc(ultima.despachoId)} · ${kg.toLocaleString("es-VE")} kg · ${ultima.volumenM3} m³` : "",
          ultima?.llegadaReal ? `Hora de entrega: ${c.hora(ultima.llegadaReal)}` : "",
          "",
          `Avance del viaje: ${completadas} de ${total} paradas`,
          restantes.length > 0
            ? `Pendientes: ${restantes.map((p) => esc(c.nombreLugar(p.lugarId))).join(", ")}`
            : "Viaje completo. El vehículo queda disponible.",
        ]
          .filter(Boolean)
          .join("\n") + (restantes.length > 0 ? bloqueNavegacion(c) : "")
      );
    }

    case "resumen": {
      const hechas = c.rutas.reduce(
        (s, r) => s + r.paradas.filter((p) => p.estado === "completada").length,
        0,
      );
      const totales = c.rutas.reduce((s, r) => s + r.paradas.length, 0);
      const kg = c.rutas.reduce(
        (s, r) => s + r.paradas.reduce((x, p) => x + p.pesoKg, 0),
        0,
      );
      const km = c.rutas.reduce((s, r) => s + r.distanciaPlanKm, 0);
      const filas = c.rutas.map((r) => {
        const c2 = r.paradas.filter((p) => p.estado === "completada").length;
        const sig = siguienteParada(r.paradas);
        return `• <b>${esc(r.codigo)}</b> — ${c2}/${r.paradas.length} · ${esc(r.estado.replace(/_/g, " "))}${
          sig ? ` · siguiente ${esc(c.nombreLugar(sig.lugarId))}` : ""
        }`;
      });
      return [
        "<b>📋 Resumen de la jornada</b>",
        "",
        `Viajes: <b>${c.rutas.length}</b>`,
        `Paradas: ${hechas} de ${totales} completadas`,
        `Carga movida: ${kg.toLocaleString("es-VE")} kg`,
        `Recorrido planificado: ${km.toFixed(1)} km`,
        "",
        ...filas,
      ].join("\n");
    }
  }
}

/** Quita el HTML para la vista previa y el portapapeles. */
export function textoPlano(html: string): string {
  return html
    .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
