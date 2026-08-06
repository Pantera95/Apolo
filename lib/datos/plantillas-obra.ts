import type {
  AvanceObra,
  Cierre,
  DeudaEscalada,
  ResumenEscalado,
} from "@/lib/datos/obra-premium";
import { estadoPresupuesto } from "@/lib/datos/obra-premium";
import type { Obra } from "@/lib/dominio/tipos";

/**
 * Plantillas de Telegram para eventos de obra.
 *
 * Formato HTML y no Markdown: un guion bajo en un código de obra rompe el
 * Markdown de Telegram y el mensaje llega sin formato o directamente con error.
 *
 * Todas reciben el estado YA CALCULADO. Ninguna vuelve a calcular nada: si
 * recalcularan por su cuenta, el mensaje podría decir cifras distintas de las
 * que el gerente acaba de ver en pantalla.
 */

export type EventoObra = "inicio" | "cierre" | "deuda_vencida" | "presupuesto";

export interface PlantillaObra {
  id: EventoObra;
  nombre: string;
  descripcion: string;
  /** Cuándo tiene sentido enviarla. Evita mandar la de cierre a media obra. */
  cuando: string;
}

export const PLANTILLAS_OBRA: PlantillaObra[] = [
  {
    id: "inicio",
    nombre: "Inicio de obra",
    descripcion: "Apertura del frente, con el presupuesto de material asignado.",
    cuando: "Al abrir la obra",
  },
  {
    id: "cierre",
    nombre: "Cierre de obra",
    descripcion: "Liquidación con la lista de verificación y lo que quedó pendiente.",
    cuando: "Al cerrar, o para pedir que resuelvan lo que bloquea",
  },
  {
    id: "deuda_vencida",
    nombre: "Alerta de deuda vencida",
    descripcion: "Herramienta con más de 60 días fuera, con responsable y valor en riesgo.",
    cuando: "Cuando hay deuda vencida",
  },
  {
    id: "presupuesto",
    nombre: "Alerta de presupuesto",
    descripcion: "Consumo por encima del umbral, con los renglones excedidos.",
    cuando: "Cuando el consumo supera el 85%",
  },
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const usd = (n: number) =>
  new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export interface ContextoObra {
  obra: Obra;
  avance: AvanceObra;
  cierre: Cierre;
  deudas: DeudaEscalada[];
  escalado: ResumenEscalado;
  enlace: string;
  /** Cierto cuando las cifras son de demostración. Se avisa DENTRO del mensaje. */
  demo: boolean;
}

export function componerObra(id: EventoObra, c: ContextoObra): string {
  const cabecera = `<b>${esc(c.obra.codigo)}</b> · ${esc(c.obra.nombre)}`;

  // El aviso de datos ficticios va dentro del mensaje, no solo en la pantalla:
  // el mensaje se reenvía y llega a gente que nunca vio el panel.
  const pie = c.demo
    ? "\n\n⚠️ <i>Cifras de demostración. No son datos reales del cliente.</i>"
    : "";
  const link = `\n\n<a href="${esc(c.enlace)}">Abrir la obra en Apolo</a>`;

  switch (id) {
    case "inicio":
      return (
        [
          "<b>🏗 Obra iniciada</b>",
          cabecera,
          `Ubicación: ${esc(c.obra.ubicacionGeografica)}`,
          "",
          c.avance.presupuestadoUsd > 0
            ? `<b>Presupuesto de material:</b> ${usd(c.avance.presupuestadoUsd)}\n${c.avance.renglones.filter((r) => r.presupuestadoUsd > 0).length} renglones presupuestados`
            : "Sin presupuesto de material cargado todavía.",
        ].join("\n") +
        link +
        pie
      );

    case "cierre": {
      const listo = c.cierre.puedeCerrar;
      const lineas = [
        listo ? "<b>✅ Obra lista para cerrar</b>" : "<b>🔒 Cierre bloqueado</b>",
        cabecera,
        "",
        `Material consumido: ${usd(c.avance.consumidoUsd)}`,
      ];

      if (c.avance.presupuestadoUsd > 0) {
        const pct = Math.round((c.avance.consumo ?? 0) * 100);
        lineas.push(
          `Presupuestado: ${usd(c.avance.presupuestadoUsd)} · consumido ${pct}%`,
          c.avance.desviacionUsd > 0
            ? `⚠️ Desviación: ${usd(c.avance.desviacionUsd)} por encima`
            : `Dentro del presupuesto (${usd(Math.abs(c.avance.desviacionUsd))} de margen)`,
        );
      }

      if (!listo) {
        lineas.push("", "<u>Bloquea el cierre</u>");
        for (const b of c.cierre.bloqueos) {
          lineas.push(`🔴 ${esc(b.titulo)} — ${esc(b.detalle)}`);
        }
      }

      if (c.cierre.advertencias.length > 0) {
        lineas.push("", "<u>Conviene revisar</u>");
        for (const a of c.cierre.advertencias) {
          lineas.push(`🟡 ${esc(a.titulo)} — ${esc(a.detalle)}`);
        }
      }

      return lineas.join("\n") + link + pie;
    }

    case "deuda_vencida": {
      if (c.escalado.vencidas.length === 0) {
        return (
          ["<b>✅ Sin deuda vencida</b>", cabecera, "", "Ninguna herramienta lleva más de 60 días fuera."].join(
            "\n",
          ) + pie
        );
      }
      const filas = c.escalado.vencidas
        .slice(0, 10)
        .map(
          (d) =>
            `${d.tramo === "90" ? "🔴" : "🟠"} <b>${esc(d.articuloCodigo)}</b> ${esc(d.descripcion)}\n   ${Math.round(d.unidades)} und · ${d.diasMax} días · ${usd(d.valorUsd)} · registró: ${esc(d.responsable)}`,
        )
        .join("\n");

      return (
        [
          `<b>⏰ Deuda de herramienta vencida</b>`,
          cabecera,
          "",
          `<b>Valor en riesgo:</b> ${usd(c.escalado.enRiesgoUsd)}`,
          `${c.escalado.vencidas.length} renglones con más de 60 días fuera`,
          "",
          filas,
          "",
          "<i>El responsable es quien registró la salida en el sistema, no necesariamente quien custodia la herramienta.</i>",
        ].join("\n") +
        link +
        pie
      );
    }

    case "presupuesto": {
      const estado = estadoPresupuesto(c.avance.consumo);
      if (estado === "sin-presupuesto") {
        return (
          ["<b>Sin presupuesto cargado</b>", cabecera, "", "Importa el presupuesto de material para poder controlar la desviación."].join(
            "\n",
          ) +
          link +
          pie
        );
      }
      const pct = Math.round((c.avance.consumo ?? 0) * 100);
      const excedidos = c.avance.excedidos
        .slice(0, 6)
        .map(
          (r) =>
            `• <b>${esc(r.articuloCodigo)}</b> ${usd(r.desviacionUsd)} por encima (${Math.round((r.consumo ?? 0) * 100)}%)`,
        )
        .join("\n");

      return (
        [
          estado === "excedido"
            ? "<b>🔴 Presupuesto de material excedido</b>"
            : "<b>🟠 Presupuesto de material cerca del límite</b>",
          cabecera,
          "",
          `Presupuestado: ${usd(c.avance.presupuestadoUsd)}`,
          `Consumido: ${usd(c.avance.consumidoUsd)}`,
          `Comprometido sin despachar: ${usd(c.avance.comprometidoUsd)}`,
          `<b>Total ${pct}% del presupuesto</b>`,
          "",
          excedidos ? `<u>Renglones excedidos</u>\n${excedidos}` : "",
          c.avance.comprometidoUsd > 0
            ? "\n<i>Lo comprometido todavía se puede parar: son solicitudes aprobadas sin despachar.</i>"
            : "",
        ]
          .filter(Boolean)
          .join("\n") +
        link +
        pie
      );
    }
  }
}

/** Vista previa sin etiquetas, para enseñar el mensaje en pantalla. */
export function aTextoPlanoObra(html: string): string {
  return html
    .replace(/<a href="[^"]*">([^<]*)<\/a>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
