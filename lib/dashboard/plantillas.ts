import { definicion } from "@/lib/dashboard/catalogo";
import type { IndicadorFinanciero } from "@/lib/dashboard/finanzas";
import type { DatosPanel, Filtros } from "@/lib/dashboard/tipos";

/**
 * Plantillas de informe para Telegram.
 *
 * REGLA: el informe se compone de los datos QUE ESTÁN EN PANTALLA, con los
 * filtros aplicados. Un mensaje que dijera cifras distintas a las que el gerente
 * acaba de mirar destruiría la confianza en las dos cosas a la vez.
 *
 * Por eso todas reciben `datos` y `filtros` y ninguna vuelve a calcular nada:
 * leen del mismo `DatosPanel` que pintó el panel.
 *
 * Formato HTML, no Markdown: un guion bajo en un código de obra rompe el
 * Markdown de Telegram y el mensaje llega sin formato o con error.
 */

export type IdPlantilla =
  | "resumen_direccion"
  | "alertas_criticas"
  | "financiero"
  | "obras_criticas"
  | "stock_critico";

export interface Plantilla {
  id: IdPlantilla;
  nombre: string;
  descripcion: string;
  /** Para quién está escrita. Ayuda a elegir sin abrirlas todas. */
  destinatario: string;
}

export const PLANTILLAS: Plantilla[] = [
  {
    id: "resumen_direccion",
    nombre: "Resumen de dirección",
    descripcion: "Dinero, obras activas y cola de trabajo en una pantalla de móvil.",
    destinatario: "Gerencia · Operaciones",
  },
  {
    id: "alertas_criticas",
    nombre: "Alertas críticas",
    descripcion: "Solo lo que exige una acción hoy, con el enlace al módulo.",
    destinatario: "Logística · Almacén",
  },
  {
    id: "financiero",
    nombre: "Situación financiera",
    descripcion: "Liquidez, endeudamiento y rentabilidad con su veredicto.",
    destinatario: "Gerencia · Administración",
  },
  {
    id: "obras_criticas",
    nombre: "Obras que requieren atención",
    descripcion: "Ranking de obras por alertas abiertas y material bloqueado.",
    destinatario: "Gerencia de obra",
  },
  {
    id: "stock_critico",
    nombre: "Materiales en riesgo",
    descripcion: "Artículos por debajo de la ventana de reposición.",
    destinatario: "Compras · Almacén",
  },
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function cabeceraFiltros(
  filtros: Filtros,
  nombreObra: (id: string) => string,
  nombreAlmacen: (id: string) => string,
  generadoEn: string,
): string {
  const periodos: Record<string, string> = {
    hoy: "Hoy",
    "7d": "Últimos 7 días",
    "30d": "Últimos 30 días",
    mes: "Mes actual",
    trimestre: "Trimestre",
    anio: "Año",
    personalizado: "Rango personalizado",
  };
  const partes = [
    `Periodo: ${periodos[filtros.periodo] ?? filtros.periodo}`,
    `Obra: ${filtros.obraId ? nombreObra(filtros.obraId) : "Todas"}`,
    `Almacén: ${filtros.almacenId ? nombreAlmacen(filtros.almacenId) : "Todos"}`,
  ];
  // Los filtros van en el mensaje SIEMPRE. Sin ellos, "USD 60.638 en obra" no
  // se puede interpretar: ¿de qué obra, de qué mes?
  return `<i>${esc(partes.join(" · "))}</i>\n<i>Generado: ${esc(
    new Date(generadoEn).toLocaleString("es-VE"),
  )}</i>`;
}

function usd(n: number | null): string {
  if (n === null) return "sin datos";
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function num(n: number | null): string {
  if (n === null) return "sin datos";
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 }).format(n);
}

export interface ContextoInforme {
  datos: DatosPanel;
  filtros: Filtros;
  indicadores: IndicadorFinanciero[];
  nombreObra: (id: string) => string;
  nombreAlmacen: (id: string) => string;
  enlaceBase: string;
  /** Cierto cuando las cifras son de demostración. Se avisa en el mensaje. */
  demo: boolean;
}

export function componer(id: IdPlantilla, ctx: ContextoInforme): string {
  const { datos, filtros, nombreObra, nombreAlmacen, enlaceBase } = ctx;
  const cab = cabeceraFiltros(filtros, nombreObra, nombreAlmacen, datos.generadoEn);
  const k = datos.kpis;

  // El aviso de datos ficticios va DENTRO del mensaje, no solo en la pantalla:
  // el mensaje se reenvía y llega a gente que nunca vio el panel.
  const pie = ctx.demo
    ? `\n\n⚠️ <i>Cifras de demostración. No son datos reales del cliente.</i>`
    : "";

  const enlace = `\n\n<a href="${esc(enlaceBase)}">Abrir en Apolo</a>`;

  switch (id) {
    case "resumen_direccion": {
      const lineas = [
        `<b>📊 Resumen de dirección</b>`,
        cab,
        "",
        `<b>Material en obra:</b> ${usd(k.valor_en_obra?.valor ?? null)}`,
        `<b>Inventario:</b> ${usd(k.valor_inventario?.valor ?? null)}`,
        `<b>Por recibir:</b> ${usd(k.valor_por_recibir?.valor ?? null)}`,
        "",
        `Obras activas: ${num(k.obras_activas?.valor ?? null)}`,
        `Por aprobar: ${num(k.solicitudes_por_aprobar?.valor ?? null)}`,
        `Aprobadas sin preparar: ${num(k.aprobadas_sin_preparar?.valor ?? null)}`,
        `Despachos activos: ${num(k.despachos_activos?.valor ?? null)}`,
        `Compras retrasadas: ${num(k.compras_retrasadas?.valor ?? null)}`,
        `Stock crítico: ${num(k.stock_critico?.valor ?? null)} artículos`,
        "",
        `Alertas abiertas: <b>${datos.alertas.length}</b>`,
      ];
      return lineas.join("\n") + enlace + pie;
    }

    case "alertas_criticas": {
      const criticas = datos.alertas.filter(
        (a) => a.severidad === "critica" || a.severidad === "alta",
      );
      if (criticas.length === 0) {
        return [
          `<b>✅ Sin alertas críticas</b>`,
          cab,
          "",
          "Todo dentro de umbral en el periodo consultado.",
        ].join("\n") + pie;
      }
      const cuerpo = criticas
        .slice(0, 10)
        .map(
          (a) =>
            `${a.severidad === "critica" ? "🔴" : "🟠"} <b>${esc(a.titulo)}</b>\n   ${esc(
              a.detalle,
            )}\n   → ${esc(a.accion)}`,
        )
        .join("\n\n");
      const resto =
        criticas.length > 10 ? `\n\n<i>y ${criticas.length - 10} más</i>` : "";
      return (
        [`<b>🚨 ${criticas.length} alertas requieren acción</b>`, cab, "", cuerpo].join("\n") +
        resto +
        enlace +
        pie
      );
    }

    case "financiero": {
      const porFamilia = (f: string) =>
        ctx.indicadores
          .filter((i) => i.familia === f && i.valor !== null)
          .slice(0, 4)
          .map((i) => {
            const marca =
              i.veredicto === "bueno" ? "🟢" : i.veredicto === "aceptable" ? "🟡" : "🔴";
            const v =
              i.unidad === "usd"
                ? usd(i.valor)
                : i.unidad === "porcentaje"
                  ? `${num(i.valor)}%`
                  : i.unidad === "dias"
                    ? `${num(i.valor)} d`
                    : num(i.valor);
            return `${marca} ${esc(i.nombre)}: <b>${v}</b>`;
          })
          .join("\n");

      return (
        [
          `<b>💰 Situación financiera</b>`,
          cab,
          "",
          `<u>Liquidez</u>`,
          porFamilia("liquidez") || "sin datos",
          "",
          `<u>Endeudamiento</u>`,
          porFamilia("endeudamiento") || "sin datos",
          "",
          `<u>Rentabilidad</u>`,
          porFamilia("rentabilidad") || "sin datos",
          "",
          `<u>Gestión</u>`,
          porFamilia("gestion") || "sin datos",
        ].join("\n") +
        enlace +
        pie
      );
    }

    case "obras_criticas": {
      const filas = datos.obrasCriticas.slice(0, 8);
      if (filas.length === 0) {
        return [`<b>Obras</b>`, cab, "", "Sin obras que requieran atención."].join("\n") + pie;
      }
      const cuerpo = filas
        .map(
          (o) =>
            `<b>${esc(o.codigo)}</b> ${esc(o.nombre)}\n   ${
              o.avanceMaterial === null
                ? "avance sin datos"
                : `${Math.round(o.avanceMaterial * 100)}% material`
            } · ${o.solicitudesBloqueadas} bloqueadas · ${o.materialesCriticos} críticos · ${usd(
              o.valorEnObraUsd,
            )}`,
        )
        .join("\n");
      return [`<b>🏗 Obras que requieren atención</b>`, cab, "", cuerpo].join("\n") + enlace + pie;
    }

    case "stock_critico": {
      const filas = datos.stockCritico.slice(0, 10);
      if (filas.length === 0) {
        return (
          [`<b>✅ Sin materiales en riesgo</b>`, cab, "", "Ningún artículo por debajo de la ventana de reposición."].join(
            "\n",
          ) + pie
        );
      }
      const cuerpo = filas
        .map(
          (a) =>
            `⚠️ <b>${esc(a.codigo)}</b> ${esc(a.descripcion)}\n   ${
              a.cobertura === null ? "cobertura sin datos" : `${Math.floor(a.cobertura)} días`
            } · ${Math.round(a.disponible)} disponibles · ${a.obrasAfectadas} obras`,
        )
        .join("\n");
      return [`<b>📦 Materiales en riesgo de agotamiento</b>`, cab, "", cuerpo].join("\n") + enlace + pie;
    }
  }
}

/** Vista previa en texto plano, para enseñar el mensaje sin las etiquetas. */
export function aTextoPlano(html: string): string {
  return html
    .replace(/<a href="[^"]*">([^<]*)<\/a>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

void definicion;
