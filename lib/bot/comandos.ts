import {
  fondoDeManiobra,
  razonCorriente,
  rentabilidadSobreVentas,
} from "@/lib/dashboard/finanzas";
import { serieFinancieraDemo } from "@/lib/dashboard/semilla-finanzas";
import { construirSemilla } from "@/lib/datos/semilla";
import {
  bajoMinimo,
  dinero,
  dineroCompacto,
  herramientaAveriada,
  herramientaSinRetornar,
  numero,
  solicitudesPorAprobar,
  valorDisponible,
  valorEnObra,
} from "@/lib/datos/indicadores";
import type { EstadoApolo } from "@/lib/db/almacen";
import {
  diasDeAtraso,
  estaAbierta,
  pendientePorRecibir,
  totalOrden,
  type LineaOrden,
} from "@/lib/dominio/compras";
import { etaDeRuta, posicionSimulada, rutasDemo, LUGARES_DEMO, VEHICULOS_DEMO, CHOFERES_DEMO } from "@/lib/logistica/simulado";
import { progresoViaje, siguienteParada } from "@/lib/logistica/nucleo";
import { activos, ahorroUsd, leadTimeDias, porEtapa } from "@/lib/procura/nucleo";
import { PROCESOS_DEMO } from "@/lib/procura/simulado";
import { ETAPAS } from "@/lib/procura/tipos";

/**
 * Comandos que el bot de Telegram sabe responder.
 *
 * SOLO LECTURA, Y ESTO NO ES NEGOCIABLE. Ningún comando cambia el estado de
 * Apolo. Aprobar una solicitud, cancelar una orden o dar por entregado un
 * despacho no puede dispararse desde un chat: un mensaje de Telegram se
 * reenvía, se copia y se falsifica sin esfuerzo, y no hay forma de saber quién
 * pulsó de verdad. Las operaciones que mueven inventario viven en la
 * aplicación, detrás de una sesión.
 *
 * DE DÓNDE SALEN LOS DATOS. El bot corre en el servidor y los datos de la
 * demostración viven en el navegador de quien la mira, así que el servidor NO
 * PUEDE LEER lo que hay en pantalla. Lo que sí puede es reconstruir la misma
 * semilla: `construirSemilla()` y `serieFinancieraDemo()` son deterministas, de
 * modo que el bot responde con las MISMAS cifras que muestra la aplicación.
 *
 * Eso funciona porque es una demostración. Con backend real, estas funciones
 * pasarían a leer de la base de datos y ni la forma de los comandos ni sus
 * respuestas cambiarían.
 */

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Telegram rechaza por encima de 4096; se deja margen para el pie. */
const LIMITE = 3900;

export interface DefComando {
  /** Sin la barra. */
  nombre: string;
  /** Lo que se registra en BotFather. Debe ser corto. */
  descripcion: string;
  /** Argumento opcional, para la ayuda. */
  uso?: string;
  grupo: "Operación" | "Almacén" | "Logística" | "Compras" | "Dirección";
}

export const COMANDOS: DefComando[] = [
  { nombre: "ayuda", descripcion: "Lista de comandos disponibles", grupo: "Operación" },
  { nombre: "panel", descripcion: "Indicadores de la operación ahora mismo", grupo: "Operación" },
  { nombre: "informe_diario", descripcion: "Informe completo del día", grupo: "Operación" },
  { nombre: "solicitudes", descripcion: "Solicitudes esperando aprobación", grupo: "Operación" },
  { nombre: "obra", descripcion: "Ficha de una obra", uso: "/obra OBR-2402", grupo: "Operación" },

  { nombre: "inventario", descripcion: "Existencia, o búsqueda de artículo", uso: "/inventario cabilla", grupo: "Almacén" },
  { nombre: "minimos", descripcion: "Artículos bajo el mínimo de reposición", grupo: "Almacén" },
  { nombre: "herramienta", descripcion: "Herramienta sin retornar y averiada", grupo: "Almacén" },

  { nombre: "flota", descripcion: "Viajes en curso con ETA", grupo: "Logística" },
  { nombre: "viaje", descripcion: "Detalle de un viaje", uso: "/viaje RTA-0241", grupo: "Logística" },

  { nombre: "compras", descripcion: "Órdenes abiertas y atrasadas", grupo: "Compras" },
  { nombre: "procura", descripcion: "Expedientes de procura por etapa", grupo: "Compras" },

  { nombre: "finanzas", descripcion: "Indicadores del último corte", grupo: "Dirección" },
  { nombre: "ventas", descripcion: "Ventas de las últimas semanas", uso: "/ventas 8", grupo: "Dirección" },
];

// ---------------------------------------------------------------------------

export interface Peticion {
  comando: string;
  /** Todo lo que venía después del comando. */
  argumento: string;
  /** Instante de referencia. Se inyecta para poder probar con reloj fijo. */
  ahoraMs: number;
}

/**
 * Separa `/comando@mi_bot argumento` en sus partes.
 *
 * EL SUFIJO `@nombre_del_bot` HAY QUE QUITARLO: en un grupo, Telegram entrega
 * los comandos con el nombre del bot pegado, y sin recortarlo ningún comando
 * respondería nunca dentro de un grupo — que es justo donde vive este bot.
 */
export function parsear(texto: string, ahoraMs: number): Peticion | null {
  const limpio = texto.trim();
  if (!limpio.startsWith("/")) return null;

  const [cabeza, ...resto] = limpio.slice(1).split(/\s+/);
  const comando = cabeza.split("@")[0].toLowerCase();
  return { comando, argumento: resto.join(" ").trim(), ahoraMs };
}

// ---------------------------------------------------------------------------
// Utilidades de presentación
// ---------------------------------------------------------------------------

const fecha = (ms: number) =>
  new Date(ms).toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" });

/** Etiqueta corta del corte: "ago 2026". */
const etiquetaCorte = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("es-VE", { month: "short", year: "numeric" })
    : "sin fecha";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

function pie(): string {
  return "\n\n<i>Datos de demostración · Apolo</i>";
}

/**
 * Valor de lo que falta por recibir.
 *
 * `pendientePorRecibir` opera sobre una LÍNEA, no sobre la orden, y devuelve
 * CANTIDAD, no dinero: hay que valorizarla por su costo unitario. Sumarlas sin
 * multiplicar daría un "USD" que en realidad son unidades.
 */
function valorPorLlegar(ordenes: { lineas: LineaOrden[] }[]): number {
  return ordenes.reduce(
    (s, o) => s + o.lineas.reduce((x, l) => x + pendientePorRecibir(l) * l.costoUnitarioUsd, 0),
    0,
  );
}

/** Corta una lista larga diciendo cuántas quedaron fuera, en vez de truncar. */
function recortar(lineas: string[], max: number): string[] {
  if (lineas.length <= max) return lineas;
  return [...lineas.slice(0, max), `<i>…y ${lineas.length - max} más.</i>`];
}

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------

function ayuda(): string {
  const grupos = [...new Set(COMANDOS.map((c) => c.grupo))];
  const bloques = grupos.map((g) => {
    const del = COMANDOS.filter((c) => c.grupo === g)
      .map((c) => `/${c.nombre} — ${c.descripcion}${c.uso ? `\n   <i>${esc(c.uso)}</i>` : ""}`)
      .join("\n");
    return `<b>${g}</b>\n${del}`;
  });
  return [
    "<b>🤖 Apolo · comandos disponibles</b>",
    "",
    ...bloques,
    "",
    "<i>El bot solo consulta. Aprobar, despachar o cancelar se hace en la aplicación.</i>",
  ].join("\n");
}

function panel(e: EstadoApolo, ahoraMs: number): string {
  const sinRetornar = herramientaSinRetornar(e);
  const averiada = herramientaAveriada(e);
  const porAprobar = solicitudesPorAprobar(e);
  const abiertas = e.ordenes.filter(estaAbierta);
  const porLlegar = valorPorLlegar(abiertas);

  return [
    `<b>📊 Panel de operación</b>`,
    `<i>${fecha(ahoraMs)}</i>`,
    "",
    `Material en obra: <b>${dinero(valorEnObra(e))}</b>`,
    `Existencia disponible: <b>${dinero(valorDisponible(e))}</b>`,
    `Por llegar: ${dinero(porLlegar)} · ${abiertas.length} órdenes abiertas`,
    "",
    `Solicitudes por aprobar: <b>${porAprobar.length}</b>`,
    `Herramienta sin retornar: <b>${numero(sinRetornar.unidades)}</b> unidades · ${dinero(sinRetornar.valorUsd)}`,
    `Herramienta averiada: ${numero(averiada.unidades)} unidades`,
  ].join("\n");
}

function solicitudes(e: EstadoApolo, ahoraMs: number): string {
  const pend = solicitudesPorAprobar(e);
  if (pend.length === 0) {
    return "<b>✅ Solicitudes</b>\n\nNo hay solicitudes esperando aprobación.";
  }
  const filas = pend.map((s) => {
    const dias = Math.floor((ahoraMs - Date.parse(s.fecha)) / 86_400_000);
    const obra = e.obras.find((o) => o.id === s.obraId)?.codigo ?? "—";
    return `• <b>${esc(s.codigo)}</b> · ${esc(obra)} · ${s.lineas.length} renglones · ${dias} d esperando`;
  });
  return [
    `<b>⏳ Solicitudes por aprobar: ${pend.length}</b>`,
    "",
    ...recortar(filas, 15),
    "",
    "<i>La aprobación es bloqueante: nada se prepara hasta que alguien apruebe.</i>",
  ].join("\n");
}

function inventario(e: EstadoApolo, busqueda: string): string {
  const q = busqueda.toLowerCase();
  const arts = q
    ? e.articulos.filter(
        (a) => a.descripcion.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q),
      )
    : [];

  if (!q) {
    return [
      "<b>📦 Inventario</b>",
      "",
      `Artículos en catálogo: <b>${numero(e.articulos.length)}</b>`,
      `Valor disponible: <b>${dinero(valorDisponible(e))}</b>`,
      `Valor en obra: ${dinero(valorEnObra(e))}`,
      "",
      "<i>Para buscar: /inventario cabilla</i>",
    ].join("\n");
  }

  if (arts.length === 0) {
    return `<b>📦 Inventario</b>\n\nNingún artículo coincide con «${esc(busqueda)}».`;
  }

  const filas = arts.map((a) => {
    // `saldos` es un Map indexado por clave compuesta, no un array.
    let saldo = 0;
    for (const [clave, s] of e.inventario.saldos) {
      if (clave.startsWith(`${a.id}|`)) saldo += s.fisico;
    }
    return `• <b>${esc(a.codigo)}</b> ${esc(a.descripcion)}\n   ${numero(saldo)} ${esc(a.unidadBase)} · ${esc(a.clase)}`;
  });
  return [
    `<b>📦 ${arts.length} coincidencia${arts.length === 1 ? "" : "s"} para «${esc(busqueda)}»</b>`,
    "",
    ...recortar(filas, 12),
  ].join("\n");
}

function minimos(e: EstadoApolo): string {
  const bajo = bajoMinimo(e);
  if (bajo.length === 0) {
    return "<b>✅ Mínimos</b>\n\nNingún artículo está por debajo de su mínimo.";
  }
  const filas = bajo.map(
    (b) =>
      `• <b>${esc(b.articulo.codigo)}</b> ${esc(b.articulo.descripcion)}\n   quedan ${numero(b.disponible)} ${esc(b.articulo.unidadBase)} · se recibieron ${numero(b.recibido)}`,
  );
  return [
    `<b>⚠️ ${bajo.length} artículo${bajo.length === 1 ? "" : "s"} bajo mínimo</b>`,
    "",
    ...recortar(filas, 15),
  ].join("\n");
}

function herramienta(e: EstadoApolo): string {
  const sin = herramientaSinRetornar(e);
  const ave = herramientaAveriada(e);
  return [
    "<b>🔧 Herramienta</b>",
    "",
    `Sin retornar: <b>${numero(sin.unidades)}</b> unidades · ${dinero(sin.valorUsd)}`,
    `Averiada: ${numero(ave.unidades)} unidades · ${dinero(ave.valorUsd)}`,
    "",
    "<i>La herramienta retornable genera deuda contra una obra y una persona.</i>",
  ].join("\n");
}

function obra(e: EstadoApolo, codigo: string): string {
  if (!codigo) {
    const lista = e.obras.map((o) => `• <b>${esc(o.codigo)}</b> — ${esc(o.nombre)}`);
    return ["<b>🏗 Obras</b>", "", ...recortar(lista, 15), "", "<i>Detalle: /obra OBR-2402</i>"].join("\n");
  }
  const o = e.obras.find((x) => x.codigo.toLowerCase() === codigo.toLowerCase());
  if (!o) return `No encuentro la obra «${esc(codigo)}». Usa /obra para ver la lista.`;

  const sol = e.solicitudes.filter((s) => s.obraId === o.id);
  const desp = e.despachos.filter((d) => d.obraId === o.id);
  return [
    `<b>🏗 ${esc(o.codigo)} — ${esc(o.nombre)}</b>`,
    "",
    `Estado: ${esc(o.estado)}`,
    `Solicitudes: ${sol.length}`,
    `Despachos: ${desp.length}`,
  ].join("\n");
}

function flota(ahoraMs: number): string {
  const rutas = rutasDemo(ahoraMs);
  const filas = rutas.map((r) => {
    const pos = posicionSimulada(r, ahoraMs);
    const info = pos ? etaDeRuta(r, pos, ahoraMs) : null;
    const sig = siguienteParada(r.paradas);
    const lugar = sig ? (LUGARES_DEMO.find((l) => l.id === sig.lugarId)?.nombre ?? "—") : "—";
    const veh = VEHICULOS_DEMO.find((v) => v.id === r.vehiculoId)?.descripcion ?? r.vehiculoId;
    const desvio = info ? Math.round(info.eta.desviacionMin) : 0;
    const marca = desvio > 10 ? `⚠️ +${desvio} min` : "✅ en tiempo";
    return [
      `• <b>${esc(r.codigo)}</b> · ${esc(r.estado.replace(/_/g, " "))}`,
      `   ${esc(veh)} · ${esc(CHOFERES_DEMO[r.vehiculoId] ?? "—")}`,
      `   → ${esc(lugar)}${info ? ` · ETA ${hora(info.eta.llegadaEstimada)} · ${marca}` : ""}`,
      `   ${Math.round(progresoViaje(r.paradas) * 100)}% del viaje`,
    ].join("\n");
  });
  return [`<b>🚚 Flota · ${rutas.length} viajes</b>`, "", ...filas].join("\n");
}

function viaje(codigo: string, ahoraMs: number): string {
  const rutas = rutasDemo(ahoraMs);
  if (!codigo) {
    return ["<b>🚚 Viajes</b>", "", ...rutas.map((r) => `• <b>${esc(r.codigo)}</b>`), "", "<i>Detalle: /viaje RTA-0241</i>"].join("\n");
  }
  const r = rutas.find((x) => x.codigo.toLowerCase() === codigo.toLowerCase());
  if (!r) return `No encuentro el viaje «${esc(codigo)}». Usa /flota para ver los activos.`;

  const pos = posicionSimulada(r, ahoraMs);
  const info = pos ? etaDeRuta(r, pos, ahoraMs) : null;
  const paradas = r.paradas.map((p) => {
    const lugar = LUGARES_DEMO.find((l) => l.id === p.lugarId)?.nombre ?? "—";
    const marca = p.estado === "completada" ? "✅" : p.estado === "llegada_detectada" ? "📍" : "◻️";
    return `${marca} ${esc(lugar)} · ${esc(p.despachoId)} · ${numero(p.pesoKg)} kg`;
  });
  return [
    `<b>🚚 ${esc(r.codigo)}</b>`,
    `${esc(VEHICULOS_DEMO.find((v) => v.id === r.vehiculoId)?.descripcion ?? r.vehiculoId)} · ${esc(CHOFERES_DEMO[r.vehiculoId] ?? "—")}`,
    "",
    info
      ? `ETA siguiente parada: <b>${hora(info.eta.llegadaEstimada)}</b> (${Math.round(info.eta.minutosRestantes)} min)`
      : "Sin posición reportada.",
    `Progreso: ${Math.round(progresoViaje(r.paradas) * 100)}%`,
    "",
    "<b>Paradas</b>",
    ...paradas,
  ].join("\n");
}

function compras(e: EstadoApolo, ahoraMs: number): string {
  const abiertas = e.ordenes.filter(estaAbierta);
  const atrasadas = abiertas.filter((o) => diasDeAtraso(o, ahoraMs) > 0);
  const porLlegar = valorPorLlegar(abiertas);

  const filas = atrasadas.map(
    (o) =>
      `• <b>${esc(o.codigo)}</b> · ${diasDeAtraso(o, ahoraMs)} d de atraso · ${dinero(valorPorLlegar([o]))} sin recibir`,
  );

  return [
    "<b>🧾 Compras</b>",
    "",
    `Órdenes abiertas: <b>${abiertas.length}</b>`,
    `Valor por llegar: <b>${dinero(porLlegar)}</b>`,
    `Valor total emitido: ${dineroCompacto(e.ordenes.reduce((s, o) => s + totalOrden(o), 0))}`,
    ...(atrasadas.length > 0
      ? ["", `<b>⚠️ ${atrasadas.length} atrasada${atrasadas.length === 1 ? "" : "s"}</b>`, ...recortar(filas, 10)]
      : ["", "✅ Ninguna orden atrasada."]),
  ].join("\n");
}

function procura(): string {
  const act = activos(PROCESOS_DEMO);
  const ahorro = ahorroUsd(PROCESOS_DEMO);
  const lead = leadTimeDias(PROCESOS_DEMO);
  const etapas = porEtapa(PROCESOS_DEMO).filter((x) => x.total > 0);

  return [
    "<b>📋 Procura</b>",
    "",
    `Expedientes activos: <b>${act.total}</b> · ${dineroCompacto(act.valorUsd)} en juego`,
    lead === null ? "Lead time: sin órdenes aprobadas aún" : `Lead time promedio: <b>${Math.round(lead)} días</b>`,
    `Ahorro negociado: <b>${dinero(ahorro.montoUsd)}</b> (${ahorro.pct.toFixed(1)}%)`,
    "",
    "<b>Por etapa</b>",
    ...etapas.map(
      (x) =>
        `• ${esc(ETAPAS.find((z) => z.id === x.etapa)?.corto ?? x.etapa)}: ${x.total} · ${dineroCompacto(x.valorUsd)}`,
    ),
  ].join("\n");
}

function finanzas(ahoraMs: number): string {
  const serie = serieFinancieraDemo(ahoraMs);
  const ultimo = serie[serie.length - 1];
  if (!ultimo) return "Sin estados financieros cargados.";

  // `null` y no cero cuando falta el dato: un ratio que no se puede calcular no
  // vale cero, vale desconocido, y un 0,00 en pantalla se lee como quiebra.
  const fm = fondoDeManiobra(ultimo.activoCorriente, ultimo.pasivoCorriente);
  const rc = razonCorriente(ultimo.activoCorriente, ultimo.pasivoCorriente);
  const margen = rentabilidadSobreVentas(ultimo.utilidadNeta, ultimo.ventasNetas);

  return [
    "<b>💰 Situación financiera</b>",
    `<i>Corte: ${esc(etiquetaCorte(ultimo.corte))}</i>`,
    "",
    fm === null ? "Fondo de maniobra: —" : `Fondo de maniobra: <b>${dinero(fm)}</b>`,
    rc === null ? "Razón corriente: —" : `Razón corriente: <b>${rc.toFixed(2)}</b>`,
    "",
    `Ventas netas: <b>${dinero(ultimo.ventasNetas ?? 0)}</b>`,
    `Utilidad neta: ${dinero(ultimo.utilidadNeta ?? 0)}`,
    margen === null ? "" : `Margen sobre ventas: ${margen.toFixed(1)}%`,
    "",
    "<i>Ver la serie completa: /ventas</i>",
  ]
    .filter(Boolean)
    .join("\n");
}

function ventas(argumento: string, ahoraMs: number): string {
  const pedidos = Number.parseInt(argumento, 10);
  // Sin argumento válido, seis cortes: bastantes para ver tendencia sin que el
  // mensaje se vuelva ilegible en un teléfono.
  const cuantos = Number.isFinite(pedidos) && pedidos > 0 ? Math.min(pedidos, 12) : 6;

  const serie = serieFinancieraDemo(ahoraMs).slice(-cuantos);
  if (serie.length === 0) return "Sin estados financieros cargados.";

  const valores = serie.map((c) => c.ventasNetas ?? 0);
  const max = Math.max(...valores, 1);

  const filas = serie.map((c, i) => {
    const v = valores[i];
    // Barra de texto: en un teléfono una tendencia se ve mejor así que con
    // seis cifras en columna.
    const barra = "█".repeat(Math.max(1, Math.round((v / max) * 12)));
    const prev = i > 0 ? valores[i - 1] : null;
    const delta =
      prev && prev !== 0 ? ` ${v >= prev ? "▲" : "▼"}${Math.abs(((v - prev) / prev) * 100).toFixed(0)}%` : "";
    return `${esc(etiquetaCorte(c.corte).padEnd(9))} ${barra} ${dineroCompacto(v)}${delta}`;
  });

  const total = valores.reduce((s, v) => s + v, 0);
  return [
    `<b>📈 Ventas · últimos ${serie.length} cortes</b>`,
    "",
    `<pre>${filas.join("\n")}</pre>`,
    `Total del período: <b>${dinero(total)}</b>`,
    `Promedio por corte: ${dinero(total / serie.length)}`,
  ].join("\n");
}

function informeDiario(e: EstadoApolo, ahoraMs: number): string {
  const sinRetornar = herramientaSinRetornar(e);
  const porAprobar = solicitudesPorAprobar(e);
  const bajo = bajoMinimo(e);
  const abiertas = e.ordenes.filter(estaAbierta);
  const atrasadas = abiertas.filter((o) => diasDeAtraso(o, ahoraMs) > 0);
  const rutas = rutasDemo(ahoraMs);

  // Lo que EXIGE ACCIÓN va primero. Un informe que abre con cifras neutras y
  // esconde los problemas al final se lee entero el primer día y por encima el
  // resto.
  const atencion: string[] = [];
  if (porAprobar.length > 0) atencion.push(`• ${porAprobar.length} solicitudes bloqueadas esperando aprobación`);
  if (atrasadas.length > 0) atencion.push(`• ${atrasadas.length} órdenes de compra atrasadas`);
  if (bajo.length > 0) atencion.push(`• ${bajo.length} artículos bajo mínimo`);
  if (sinRetornar.unidades > 0)
    atencion.push(`• ${numero(sinRetornar.unidades)} unidades de herramienta sin retornar (${dinero(sinRetornar.valorUsd)})`);

  return [
    "<b>📰 Informe diario</b>",
    `<i>${fecha(ahoraMs)}</i>`,
    "",
    ...(atencion.length > 0
      ? ["<b>⚠️ Requiere atención</b>", ...atencion, ""]
      : ["<b>✅ Sin puntos que requieran atención</b>", ""]),
    "<b>Almacén</b>",
    `Disponible ${dinero(valorDisponible(e))} · en obra ${dinero(valorEnObra(e))}`,
    "",
    "<b>Compras</b>",
    `${abiertas.length} órdenes abiertas · ${dinero(valorPorLlegar(abiertas))} por llegar`,
    "",
    "<b>Logística</b>",
    `${rutas.length} viajes · ${rutas.filter((r) => r.estado === "en_ruta").length} en ruta`,
  ].join("\n");
}

// ---------------------------------------------------------------------------

export interface Respuesta {
  html: string;
  /** Falso cuando el comando no existe: sirve para no registrarlo como uso. */
  reconocido: boolean;
}

/**
 * Resuelve una petición. Función PURA: no toca red ni almacenamiento, así que
 * cada comando se puede probar contra un reloj fijo.
 */
export function responder(p: Peticion): Respuesta {
  const e = construirSemilla(new Date(p.ahoraMs));
  const recortarSalida = (html: string): Respuesta => ({
    html: (html.length > LIMITE ? `${html.slice(0, LIMITE)}\n<i>…recortado.</i>` : html) + pie(),
    reconocido: true,
  });

  switch (p.comando) {
    case "start":
    case "inicio":
    case "ayuda":
    case "help":
      return recortarSalida(ayuda());
    case "panel":
      return recortarSalida(panel(e, p.ahoraMs));
    case "informe_diario":
    case "informe":
      return recortarSalida(informeDiario(e, p.ahoraMs));
    case "solicitudes":
      return recortarSalida(solicitudes(e, p.ahoraMs));
    case "obra":
      return recortarSalida(obra(e, p.argumento));
    case "inventario":
      return recortarSalida(inventario(e, p.argumento));
    case "minimos":
      return recortarSalida(minimos(e));
    case "herramienta":
      return recortarSalida(herramienta(e));
    case "flota":
      return recortarSalida(flota(p.ahoraMs));
    case "viaje":
      return recortarSalida(viaje(p.argumento, p.ahoraMs));
    case "compras":
      return recortarSalida(compras(e, p.ahoraMs));
    case "procura":
      return recortarSalida(procura());
    case "finanzas":
      return recortarSalida(finanzas(p.ahoraMs));
    case "ventas":
      return recortarSalida(ventas(p.argumento, p.ahoraMs));
    default:
      return {
        html: `No conozco el comando /${esc(p.comando)}.\n\nEscribe /ayuda para ver la lista.`,
        reconocido: false,
      };
  }
}

/** Lo que se pega en BotFather con `/setcommands`. */
export function listaParaBotFather(): string {
  return COMANDOS.map((c) => `${c.nombre} - ${c.descripcion}`).join("\n");
}
