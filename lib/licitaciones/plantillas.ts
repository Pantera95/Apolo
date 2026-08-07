import { agruparRfq, promedioIndice } from "@/lib/licitaciones/motor";
import { num, pct, usd } from "@/lib/licitaciones/pdf-base";
import type { Estimacion, ObraHistorica, Parametros } from "@/lib/licitaciones/tipos";
import { DISCIPLINAS } from "@/lib/licitaciones/tipos";
import type { Severidad } from "@/lib/logistica/tipos";

/**
 * Plantillas de aviso de la estimación, para Telegram.
 *
 * Funciones PURAS que reciben la estimación y devuelven el HTML del mensaje.
 * Están fuera del componente para poder probarlas: un mensaje que sale a un
 * grupo de veinte personas con una cifra mal formateada no se puede recoger.
 *
 * LA SEVERIDAD NO ES DECORATIVA. Alimenta el mismo freno anti-spam que usa
 * logística: quien se suscribe solo a lo alto no recibe "estimación lista",
 * pero sí recibe la alerta de rendimiento. Sin ese filtro el canal se llena de
 * ruido, la gente lo silencia, y entonces tampoco lee lo que sí importaba.
 */

export type IdPlantillaEst =
  | "resumen"
  | "alerta_rendimiento"
  | "rfq"
  | "disciplinas"
  | "precio";

export interface DefPlantilla {
  id: IdPlantillaEst;
  nombre: string;
  severidad: Severidad;
}

export const PLANTILLAS_EST: DefPlantilla[] = [
  { id: "resumen", nombre: "Estimación lista", severidad: "informativa" },
  // Alta a propósito: es el único mensaje que puede impedir que se firme una
  // oferta por debajo del costo, y tiene que atravesar el filtro de quien solo
  // quiere avisos importantes.
  { id: "alerta_rendimiento", nombre: "Alerta de rendimiento", severidad: "alta" },
  { id: "rfq", nombre: "Solicitud de cotización", severidad: "advertencia" },
  { id: "disciplinas", nombre: "Desglose por disciplina", severidad: "informativa" },
  { id: "precio", nombre: "Estructura del precio", severidad: "informativa" },
];

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface CtxPlantilla {
  proyecto: string;
  cliente: string;
  origen: string;
  archivo: string;
  estimacion: Estimacion;
  parametros: Parametros;
  historico: ObraHistorica[];
  simulado: boolean;
  preparadoPor: string;
}

/** Toneladas de acero y m³ de concreto del cómputo. */
export function volumenes(e: Estimacion) {
  const acero = e.apus.filter((a) => a.renglon.unidad === "kg").reduce((s, a) => s + a.cantidadFinal, 0);
  const concreto = e.apus
    .filter((a) => a.renglon.unidad === "m³" || a.renglon.unidad === "m3")
    .reduce((s, a) => s + a.cantidadFinal, 0);
  return { acero, concreto, toneladas: acero / 1000 };
}

/**
 * Desviación del rendimiento estimado frente al histórico.
 *
 * Devuelve `null` cuando no hay con qué comparar. Un `0` diría "igual que
 * siempre", que es una afirmación distinta de "no lo sé".
 */
export function desviacionHh(c: CtxPlantilla): { estimado: number; historico: number; pct: number } | null {
  const v = volumenes(c.estimacion);
  if (v.toneladas <= 0) return null;
  const estimado = c.estimacion.horasHombre / v.toneladas;
  const historico = promedioIndice(c.historico, (x) => x.hhPorTonelada);
  if (historico === null || historico <= 0) return null;
  return { estimado, historico, pct: ((historico - estimado) / historico) * 100 };
}

const cabecera = (c: CtxPlantilla, titulo: string) =>
  [`<b>${esc(titulo)}</b>`, `${esc(c.proyecto)}`, ""].join("\n");

const firma = (c: CtxPlantilla) => {
  const l = ["", `<i>${esc(c.preparadoPor)} · Apolo</i>`];
  if (c.simulado) {
    // Va en TODOS los mensajes, no solo en el PDF: quien lee el aviso en el
    // teléfono decide con él, y a menudo sin abrir el adjunto.
    l.splice(1, 0, "<i>Cómputo de demostración: no procede de un modelo real.</i>");
  }
  return l.join("\n");
};

export function componer(id: IdPlantillaEst, c: CtxPlantilla): string {
  const e = c.estimacion;
  const v = volumenes(c.estimacion);
  const d = desviacionHh(c);

  switch (id) {
    case "resumen": {
      return [
        cabecera(c, "📐 Estimación lista"),
        `Origen: ${esc(c.origen)} · ${esc(c.archivo)}`,
        `Renglones: ${e.apus.length} en ${e.porDisciplina.length} disciplinas`,
        "",
        `<b>Total ofertado: USD ${usd(e.totalUsd)}</b>`,
        `Plazo: ${Math.ceil(e.diasEstimados)} días · ${c.parametros.cuadrillas} cuadrillas de ${c.parametros.personasPorCuadrilla}`,
        `Horas-hombre: ${num(e.horasHombre, 0)}`,
        `Acero: ${num(v.toneladas, 1)} t · Concreto: ${num(v.concreto, 0)} m³`,
        d && d.pct > 15 ? `\n⚠️ Rendimiento ${num(d.pct, 0)}% más optimista que el histórico.` : "",
        firma(c),
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "alerta_rendimiento": {
      if (!d) {
        // No se inventa una alerta cuando no hay histórico contra el que
        // comparar: un aviso sin base es peor que ningún aviso.
        return [
          cabecera(c, "⚠️ Alerta de rendimiento"),
          "No hay obras históricas con acero registrado para comparar.",
          "La estimación no se puede contrastar con el desempeño real de la empresa.",
          firma(c),
        ].join("\n");
      }
      const arriesgada = d.pct > 15;
      return [
        cabecera(c, arriesgada ? "⚠️ Alerta de rendimiento" : "✅ Rendimiento dentro de rango"),
        `Estimado: <b>${num(d.estimado, 1)} HH/t</b>`,
        `Histórico de la empresa: ${num(d.historico, 1)} HH/t`,
        `Desviación: <b>${d.pct > 0 ? "+" : ""}${num(d.pct, 1)}%</b> ${d.pct > 0 ? "más optimista" : "más conservador"}`,
        "",
        arriesgada
          ? `Se están prometiendo ${num(d.estimado, 0)} HH/t cuando la empresa nunca ha bajado de ${num(d.historico, 0)}. Requiere justificación técnica antes de ofertar.`
          : "El rendimiento estimado es coherente con lo ejecutado en obras anteriores.",
        "",
        `Oferta afectada: USD ${usd(e.totalUsd)} · ${esc(c.proyecto)}`,
        firma(c),
      ].join("\n");
    }

    case "rfq": {
      const familias = agruparRfq(e.apus);
      const top = familias.slice(0, 8);
      const resto = familias.length - top.length;
      return [
        cabecera(c, "🧾 Solicitud de cotización"),
        `${familias.length} familias · Monto material USD ${usd(e.totalMaterialesUsd)}`,
        "",
        ...top.map(
          (f) =>
            `• <b>${esc(f.familia)}</b> — ${f.renglones} renglones · USD ${usd(f.montoEstimadoUsd)}`,
        ),
        resto > 0 ? `• …y ${resto} familias más en el informe adjunto.` : "",
        "",
        // Se dice explícitamente para que ningún proveedor cotice de más.
        "<i>Montos de solo material: no incluyen mano de obra ni utilidad de la contratista.</i>",
        firma(c),
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "disciplinas": {
      return [
        cabecera(c, "🏗 Desglose por disciplina"),
        ...e.porDisciplina.map(
          (p) =>
            `• <b>${esc(DISCIPLINAS.find((x) => x.id === p.disciplina)?.nombre ?? p.disciplina)}</b> — USD ${usd(p.totalUsd)} · ${num(p.horasHombre, 0)} HH · ${Math.ceil(p.dias)} días`,
        ),
        "",
        `<b>Ruta crítica: ${Math.ceil(e.diasEstimados)} días</b>`,
        "<i>El plazo es el de la disciplina más larga, no la suma: los frentes avanzan en paralelo.</i>",
        firma(c),
      ].join("\n");
    }

    case "precio": {
      const p = c.parametros;
      const modo = p.modoMarkup === "cascada" ? "en cascada" : "sobre el costo directo";
      return [
        cabecera(c, "💰 Estructura del precio ofertado"),
        `Materiales: USD ${usd(e.totalMaterialesUsd)} (${pct(e.totalMaterialesUsd / e.totalUsd)})`,
        `Mano de obra: USD ${usd(e.totalManoObraUsd)} (${pct(e.totalManoObraUsd / e.totalUsd)})`,
        `Equipos: USD ${usd(e.totalEquiposUsd)} (${pct(e.totalEquiposUsd / e.totalUsd)})`,
        `<b>Costo directo: USD ${usd(e.totalDirectoUsd)}</b>`,
        "",
        `Indirectos ${pct(p.overhead, 0)}: USD ${usd(e.totalIndirectosUsd)}`,
        `Contingencia ${pct(p.imprevistos, 0)}: USD ${usd(e.totalImprevistosUsd)}`,
        `Utilidad ${pct(p.utilidad, 0)}: USD ${usd(e.totalUtilidadUsd)}`,
        "",
        `<b>TOTAL: USD ${usd(e.totalUsd)}</b>`,
        `<i>Recargos ${modo}. FAS @ ${pct(p.fas - 1, 0)} solo sobre mano de obra.</i>`,
        firma(c),
      ].join("\n");
    }
  }
}

/** Quita el HTML para la vista previa y para el portapapeles. */
export function textoPlano(html: string): string {
  return html
    .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
