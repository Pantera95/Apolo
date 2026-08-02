/**
 * Analítica del panel.
 *
 * Todo sale del kardex. No hay una sola cifra escrita a mano: si el dato no se
 * puede derivar de los asientos, no se muestra. Eso es lo que separa un panel
 * que sirve para decidir de una lámina bonita.
 *
 * Funciones puras y testeables, igual que el motor de inventario.
 */

import type { EstadoApolo } from "@/lib/db/almacen";
import type { Articulo, Asiento, ClaseArticulo } from "@/lib/dominio/tipos";
import { disponible } from "@/lib/dominio/tipos";
import {
  diasDeAtraso,
  estaAbierta,
  pendientePorRecibir,
} from "@/lib/dominio/compras";

const DIA_MS = 86_400_000;

function indice(estado: EstadoApolo): Map<string, Articulo> {
  return new Map(estado.articulos.map((a) => [a.id, a]));
}

function costo(articulos: Map<string, Articulo>, id: string): number {
  return articulos.get(id)?.costoPromedioUsd ?? 0;
}

function soloFecha(iso: string): string {
  return iso.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Serie temporal de movimiento físico
// ---------------------------------------------------------------------------

export interface PuntoSerie {
  fecha: string;
  entradas: number;
  salidas: number;
}

/**
 * Valor que entró y salió físicamente del almacén, por día.
 *
 * Se mide sobre `delta.fisico` y no sobre el tipo de movimiento: así ninguna
 * operación nueva queda fuera del gráfico por olvido de actualizar una lista.
 */
export function serieMovimientos(
  estado: EstadoApolo,
  dias = 45,
  ahora: Date = new Date(),
): PuntoSerie[] {
  const articulos = indice(estado);
  const desde = ahora.getTime() - dias * DIA_MS;

  const porDia = new Map<string, { entradas: number; salidas: number }>();
  for (let i = dias - 1; i >= 0; i--) {
    porDia.set(soloFecha(new Date(ahora.getTime() - i * DIA_MS).toISOString()), {
      entradas: 0,
      salidas: 0,
    });
  }

  for (const a of estado.inventario.asientos) {
    const t = Date.parse(a.fecha);
    if (Number.isNaN(t) || t < desde) continue;
    const dia = porDia.get(soloFecha(a.fecha));
    if (!dia) continue;

    const valor = Math.abs(a.delta.fisico) * costo(articulos, a.articuloId);
    if (a.delta.fisico > 0) dia.entradas += valor;
    else if (a.delta.fisico < 0) dia.salidas += valor;
  }

  return [...porDia.entries()].map(([fecha, v]) => ({
    fecha,
    entradas: Math.round(v.entradas),
    salidas: Math.round(v.salidas),
  }));
}

// ---------------------------------------------------------------------------
// Concentración por obra
// ---------------------------------------------------------------------------

export interface ValorObra {
  obraId: string;
  codigo: string;
  nombre: string;
  valorUsd: number;
  porcentaje: number;
}

/**
 * Cuánto valor tiene cada obra inmovilizado.
 *
 * El saldo agregado sabe cuánto hay "en obra" pero no en CUÁL, así que se
 * reconstruye desde el kardex, que sí guarda la obra de cada movimiento.
 */
export function valorPorObra(estado: EstadoApolo): ValorObra[] {
  const articulos = indice(estado);
  const obras = new Map(estado.obras.map((o) => [o.id, o]));
  const acumulado = new Map<string, number>();

  for (const a of estado.inventario.asientos) {
    if (!a.obraId || a.delta.enObra === 0) continue;
    const valor = a.delta.enObra * costo(articulos, a.articuloId);
    acumulado.set(a.obraId, (acumulado.get(a.obraId) ?? 0) + valor);
  }

  const total = [...acumulado.values()].reduce((s, v) => s + Math.max(0, v), 0);

  return [...acumulado.entries()]
    .filter(([, v]) => v > 0)
    .map(([obraId, valorUsd]) => {
      const obra = obras.get(obraId);
      return {
        obraId,
        codigo: obra?.codigo ?? obraId,
        nombre: obra?.nombre ?? obraId,
        valorUsd: Math.round(valorUsd),
        porcentaje: total > 0 ? (valorUsd / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.valorUsd - a.valorUsd);
}

// ---------------------------------------------------------------------------
// Distribución por clase de artículo
// ---------------------------------------------------------------------------

export interface ValorClase {
  clase: ClaseArticulo;
  unidades: number;
  valorUsd: number;
  porcentaje: number;
}

export function distribucionPorClase(estado: EstadoApolo): ValorClase[] {
  const articulos = indice(estado);
  const acumulado = new Map<ClaseArticulo, { unidades: number; valorUsd: number }>();

  for (const [clave, saldo] of estado.inventario.saldos) {
    const articulo = articulos.get(clave.split("|")[0]);
    if (!articulo) continue;
    const cantidad = disponible(saldo);
    const actual = acumulado.get(articulo.clase) ?? { unidades: 0, valorUsd: 0 };
    acumulado.set(articulo.clase, {
      unidades: actual.unidades + cantidad,
      valorUsd: actual.valorUsd + cantidad * articulo.costoPromedioUsd,
    });
  }

  const total = [...acumulado.values()].reduce((s, v) => s + v.valorUsd, 0);

  return [...acumulado.entries()]
    .map(([clase, v]) => ({
      clase,
      unidades: Math.round(v.unidades),
      valorUsd: Math.round(v.valorUsd),
      porcentaje: total > 0 ? (v.valorUsd / total) * 100 : 0,
    }))
    .sort((a, b) => b.valorUsd - a.valorUsd);
}

// ---------------------------------------------------------------------------
// Antigüedad de la deuda de herramienta
// ---------------------------------------------------------------------------

export interface TramoAntiguedad {
  tramo: "0-15" | "16-30" | "31-60" | "60+";
  unidades: number;
  valorUsd: number;
}

interface Pendiente {
  articuloId: string;
  obraId: string;
  unidades: number;
  dias: number;
}

/**
 * Antigüedad real por FIFO: los retornos se descuentan contra las entregas MÁS
 * ANTIGUAS, que es como se comporta el material en la vida real. Sin FIFO, una
 * herramienta prestada hace ocho meses parecería nueva porque hubo un retorno
 * reciente de otra unidad.
 */
export function pendientesDeRetorno(
  estado: EstadoApolo,
  ahora: Date = new Date(),
): Pendiente[] {
  const articulos = indice(estado);

  const entregas = new Map<string, { fecha: string; unidades: number }[]>();
  const retornos = new Map<string, number>();

  for (const a of estado.inventario.asientos) {
    if (!a.obraId) continue;
    const articulo = articulos.get(a.articuloId);
    if (articulo?.clase !== "retornable") continue;

    const clave = `${a.articuloId}|${a.obraId}`;
    if (a.delta.enObra > 0) {
      const lista = entregas.get(clave) ?? [];
      lista.push({ fecha: a.fecha, unidades: a.delta.enObra });
      entregas.set(clave, lista);
    } else if (a.delta.enObra < 0) {
      retornos.set(clave, (retornos.get(clave) ?? 0) + Math.abs(a.delta.enObra));
    }
  }

  const salida: Pendiente[] = [];
  for (const [clave, lista] of entregas) {
    const [articuloId, obraId] = clave.split("|");
    let porDescontar = retornos.get(clave) ?? 0;

    for (const entrega of [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      const consumido = Math.min(porDescontar, entrega.unidades);
      porDescontar -= consumido;
      const restante = entrega.unidades - consumido;
      if (restante <= 0) continue;

      salida.push({
        articuloId,
        obraId,
        unidades: restante,
        dias: Math.max(
          0,
          Math.floor((ahora.getTime() - Date.parse(entrega.fecha)) / DIA_MS),
        ),
      });
    }
  }

  return salida.sort((a, b) => b.dias - a.dias);
}

export function antiguedadHerramienta(
  estado: EstadoApolo,
  ahora: Date = new Date(),
): TramoAntiguedad[] {
  const articulos = indice(estado);
  const tramos: TramoAntiguedad[] = [
    { tramo: "0-15", unidades: 0, valorUsd: 0 },
    { tramo: "16-30", unidades: 0, valorUsd: 0 },
    { tramo: "31-60", unidades: 0, valorUsd: 0 },
    { tramo: "60+", unidades: 0, valorUsd: 0 },
  ];

  for (const p of pendientesDeRetorno(estado, ahora)) {
    const i = p.dias <= 15 ? 0 : p.dias <= 30 ? 1 : p.dias <= 60 ? 2 : 3;
    tramos[i].unidades += p.unidades;
    tramos[i].valorUsd += p.unidades * costo(articulos, p.articuloId);
  }

  return tramos.map((t) => ({ ...t, valorUsd: Math.round(t.valorUsd) }));
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export interface Insight {
  id: string;
  clave: string;
  tono: "ok" | "info" | "advertencia" | "peligro";
  valores: Record<string, string | number>;
  /**
   * Claves de `valores` que son montos. El formateo depende del idioma y este
   * módulo es agnóstico de idioma, así que se señala cuál es dinero y la vista
   * decide cómo escribirlo.
   */
  moneda?: readonly string[];
}

/**
 * Observaciones derivadas de los datos, no textos fijos: si el inventario
 * cambia, cambian. Se devuelve la CLAVE de traducción y sus valores para que
 * funcionen igual en español y en inglés.
 */
export function insights(
  estado: EstadoApolo,
  ahora: Date = new Date(),
): Insight[] {
  const salida: Insight[] = [];
  if (estado.inventario.asientos.length === 0) return salida;

  const articulos = indice(estado);

  // 1. Concentración del material en obra
  const obras = valorPorObra(estado);
  if (obras.length > 0) {
    const top = obras[0];
    salida.push({
      id: "concentracion",
      clave: "insight.concentracion",
      tono: top.porcentaje >= 50 ? "advertencia" : "info",
      valores: {
        pct: Math.round(top.porcentaje),
        obra: top.codigo,
        nombre: top.nombre,
      },
    });
  }

  // 2. Herramienta que lleva demasiado tiempo fuera
  const pendientes = pendientesDeRetorno(estado, ahora);
  const viejas = pendientes.filter((p) => p.dias > 30);
  if (viejas.length > 0) {
    const unidades = viejas.reduce((s, p) => s + p.unidades, 0);
    const valor = viejas.reduce(
      (s, p) => s + p.unidades * costo(articulos, p.articuloId),
      0,
    );
    salida.push({
      id: "herramienta-vieja",
      clave: "insight.herramientaVieja",
      tono: viejas.some((p) => p.dias > 60) ? "peligro" : "advertencia",
      valores: {
        unidades: Math.round(unidades),
        dias: Math.max(...viejas.map((p) => p.dias)),
        valor: Math.round(valor),
      },
      moneda: ["valor"],
    });
  }

  // 3. Solicitudes esperando autorización
  const pendientesAprobacion = estado.solicitudes.filter(
    (s) => s.estado === "solicitada",
  );
  if (pendientesAprobacion.length > 0) {
    const masVieja = pendientesAprobacion
      .map((s) => Math.floor((ahora.getTime() - Date.parse(s.fecha)) / DIA_MS))
      .reduce((max, d) => Math.max(max, d), 0);
    salida.push({
      id: "aprobaciones",
      clave: "insight.aprobaciones",
      tono: masVieja > 7 ? "advertencia" : "info",
      valores: { n: pendientesAprobacion.length, dias: masVieja },
    });
  }

  // 4. Peso del capital inmovilizado en herramienta
  const clases = distribucionPorClase(estado);
  const certificado = clases.find((c) => c.clase === "certificado");
  if (certificado && certificado.porcentaje > 0) {
    salida.push({
      id: "certificado",
      clave: "insight.certificado",
      tono: "info",
      valores: {
        pct: Math.round(certificado.porcentaje),
        valor: certificado.valorUsd,
      },
      moneda: ["valor"],
    });
  }

  // 5. Ritmo del almacén en los últimos 30 días
  const serie = serieMovimientos(estado, 30, ahora);
  const salidas = serie.reduce((s, p) => s + p.salidas, 0);
  const entradas = serie.reduce((s, p) => s + p.entradas, 0);
  if (salidas > 0 || entradas > 0) {
    salida.push({
      id: "ritmo",
      clave: "insight.ritmo",
      tono: salidas > entradas ? "advertencia" : "ok",
      valores: { salidas: Math.round(salidas), entradas: Math.round(entradas) },
      moneda: ["salidas", "entradas"],
    });
  }

  // 6. Compras que debieron llegar y no llegaron
  const enMilis = ahora.getTime();
  const atrasadas = estado.ordenes.filter(
    (o) => estaAbierta(o) && diasDeAtraso(o, enMilis) > 0,
  );
  if (atrasadas.length > 0) {
    const valor = atrasadas.reduce(
      (s, o) =>
        s +
        o.lineas.reduce(
          (x, l) => x + pendientePorRecibir(l) * l.costoUnitarioUsd,
          0,
        ),
      0,
    );
    const peor = atrasadas.reduce((m, o) => Math.max(m, diasDeAtraso(o, enMilis)), 0);
    salida.push({
      id: "compras-atrasadas",
      clave: "insight.comprasAtrasadas",
      tono: peor > 15 ? "peligro" : "advertencia",
      valores: { n: atrasadas.length, dias: peor, valor: Math.round(valor) },
      moneda: ["valor"],
    });
  }

  // 7. Entregas firmadas con una orden que no cuadra
  const conDiscrepancia = estado.despachos.filter(
    (d) => d.estado === "con_discrepancia",
  );
  if (conDiscrepancia.length > 0) {
    salida.push({
      id: "discrepancias",
      clave: "insight.discrepancias",
      tono: "peligro",
      valores: {
        n: conDiscrepancia.length,
        codigos: conDiscrepancia.map((d) => d.codigo).join(", "),
      },
    });
  }

  // 8. Herramienta que volvió rota
  const averiada = acumularAveriado(estado);
  if (averiada.unidades > 0) {
    salida.push({
      id: "averiada",
      clave: "insight.averiada",
      tono: "advertencia",
      valores: {
        unidades: Math.round(averiada.unidades),
        valor: Math.round(averiada.valorUsd),
      },
      moneda: ["valor"],
    });
  }

  // 9. Capital dormido: existencia que nadie ha tocado
  const dormidos = articulosDormidos(estado, enMilis);
  if (dormidos.articulos > 0) {
    salida.push({
      id: "dormidos",
      clave: "insight.dormidos",
      tono: dormidos.valorUsd > 10_000 ? "advertencia" : "info",
      valores: {
        n: dormidos.articulos,
        dias: DIAS_DORMIDO,
        valor: Math.round(dormidos.valorUsd),
      },
      moneda: ["valor"],
    });
  }

  return salida;
}

/** PROVISIONAL: 45 días sin movimiento para considerar la existencia dormida. */
export const DIAS_DORMIDO = 45;

function acumularAveriado(estado: EstadoApolo): {
  unidades: number;
  valorUsd: number;
} {
  const articulos = indice(estado);
  let unidades = 0;
  let valorUsd = 0;

  for (const [clave, saldo] of estado.inventario.saldos) {
    if (saldo.averiado <= 0) continue;
    const articulo = articulos.get(clave.split("|")[0]);
    if (!articulo) continue;
    unidades += saldo.averiado;
    valorUsd += saldo.averiado * articulo.costoPromedioUsd;
  }

  return { unidades, valorUsd };
}

/**
 * Existencia que nadie ha tocado en mucho tiempo.
 *
 * No es un dato bonito: es capital parado. En una constructora que compra
 * material para una obra concreta, lo que lleva meses quieto suele ser sobrante
 * de un contrato que ya cerró.
 */
export function articulosDormidos(
  estado: EstadoApolo,
  ahora: number,
): { articulos: number; valorUsd: number } {
  if (ahora === 0) return { articulos: 0, valorUsd: 0 };

  const articulos = indice(estado);
  const ultimoMovimiento = new Map<string, string>();
  for (const a of estado.inventario.asientos) {
    const previo = ultimoMovimiento.get(a.articuloId);
    if (!previo || a.fecha > previo) ultimoMovimiento.set(a.articuloId, a.fecha);
  }

  const existencia = new Map<string, number>();
  for (const [clave, saldo] of estado.inventario.saldos) {
    const id = clave.split("|")[0];
    existencia.set(id, (existencia.get(id) ?? 0) + disponible(saldo));
  }

  let cuantos = 0;
  let valorUsd = 0;
  for (const [id, cantidad] of existencia) {
    if (cantidad <= 0) continue;
    const articulo = articulos.get(id);
    const ultimo = ultimoMovimiento.get(id);
    if (!articulo || !ultimo) continue;

    const dias = Math.floor((ahora - Date.parse(ultimo)) / DIA_MS);
    if (dias < DIAS_DORMIDO) continue;

    cuantos++;
    valorUsd += cantidad * articulo.costoPromedioUsd;
  }

  return { articulos: cuantos, valorUsd };
}

/**
 * Sustituye marcadores en una plantilla de traducción.
 *
 * Soporta concordancia de número con `{clave:p|singular|plural}`, porque sin
 * ella salen frases como "1 entregas se firmaron" delante del cliente. La
 * decisión se toma con el valor de `clave`: 1 → singular, el resto → plural.
 */
export function formatear(
  plantilla: string,
  valores: Record<string, string | number>,
): string {
  return plantilla
    .replace(
      /\{(\w+):p\|([^|}]*)\|([^}]*)\}/g,
      (_, clave: string, singular: string, plural: string) =>
        Number(valores[clave]) === 1 ? singular : plural,
    )
    .replace(/\{(\w+)\}/g, (_, clave: string) =>
      clave in valores ? String(valores[clave]) : `{${clave}}`,
    );
}

/** Movimientos con los que se alimenta la tabla de actividad. */
export function esEntrada(a: Asiento): boolean {
  return a.delta.fisico > 0;
}
