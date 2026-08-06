import {
  DIAS_COBERTURA_MINIMA,
  cobertura,
  dentro,
  entregasCompletas,
  resolverVentana,
  rotacion,
} from "@/lib/dashboard/kpis";
import type {
  Alerta,
  Conteo,
  DatosPanel,
  FilaObraCritica,
  FilaStockCritico,
  Filtros,
  FuenteDashboard,
  ValorKpi,
  Ventana,
} from "@/lib/dashboard/tipos";
import { estaAbierta, pendientePorRecibir } from "@/lib/dominio/compras";
import { reconciliar } from "@/lib/dominio/inventario";
import { disponible } from "@/lib/dominio/tipos";
import type { Articulo, Asiento, Saldo } from "@/lib/dominio/tipos";
import type { EstadoApolo } from "@/lib/db/almacen";

/**
 * Implementación del puerto de datos sobre el almacén en memoria.
 *
 * Es UNA implementación, no la única: la pantalla depende de `FuenteDashboard`,
 * así que la versión Supabase será otro archivo que devuelva el mismo
 * `DatosPanel` desde vistas SQL y funciones RPC, sin tocar un componente.
 *
 * Aquí sí se recorre el kardex completo, y en el demo eso es correcto: son
 * cientos de asientos en memoria. Con Supabase NO debe hacerse así — el
 * recorrido equivalente vive en una vista materializada. La frontera está
 * marcada a propósito para que el cambio sea sustituir este archivo.
 */

const DIA_MS = 86_400_000;

function kpi(
  id: string,
  valor: number | null,
  anterior: number | null = null,
  serie: number[] = [],
): ValorKpi {
  return { id, valor, anterior, serie };
}

/** Suma de una faceta del saldo, valorizada al costo del artículo. */
function valorizar(
  saldos: ReadonlyMap<string, Saldo>,
  articulos: Map<string, Articulo>,
  faceta: (s: Saldo) => number,
): number {
  let total = 0;
  for (const [k, saldo] of saldos) {
    const articuloId = k.split("|")[0];
    const art = articulos.get(articuloId);
    if (!art) continue;
    total += faceta(saldo) * art.costoPromedioUsd;
  }
  return total;
}

/**
 * Consumo: lo que salió hacia obra y no volvió.
 *
 * Se mide sobre el kardex, que es la única verdad auditable. Se cuentan las
 * entregas y los ajustes de consumo, NO los despachos: un despacho que todavía
 * viaja no se ha consumido, y contarlo inflaría la rotación.
 */
function consumoEnVentana(
  asientos: readonly Asiento[],
  articulos: Map<string, Articulo>,
  desdeMs: number,
  hastaMs: number,
): { porArticulo: Map<string, number>; valorUsd: number } {
  const porArticulo = new Map<string, number>();
  let valorUsd = 0;

  for (const a of asientos) {
    if (!dentro(a.fecha, desdeMs, hastaMs)) continue;
    const esConsumo =
      a.tipo === "entrega" ||
      (a.tipo === "ajuste" && a.motivo === "consumo_interno");
    if (!esConsumo) continue;

    // El delta viene firmado; el consumo sale como negativo en obra o físico.
    const cantidad = Math.abs(a.delta.enObra || a.delta.fisico || 0);
    if (cantidad <= 0) continue;

    porArticulo.set(a.articuloId, (porArticulo.get(a.articuloId) ?? 0) + cantidad);
    valorUsd += cantidad * (articulos.get(a.articuloId)?.costoPromedioUsd ?? 0);
  }

  return { porArticulo, valorUsd };
}

function contar<T>(items: T[], llave: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of items) {
    const k = llave(x);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// ---------------------------------------------------------------------------

export function calcularPanel(
  estado: EstadoApolo,
  filtros: Filtros,
  ahoraMs: number,
): DatosPanel {
  const v = resolverVentana(filtros, ahoraMs);
  const articulos = new Map(estado.articulos.map((a) => [a.id, a]));

  // El filtro de obra recorta TODO lo que tiene obra; lo que no la tiene
  // (inventario en almacén) no se puede recortar por obra y se deja entero.
  const porObra = <T extends { obraId?: string }>(xs: T[]) =>
    filtros.obraId ? xs.filter((x) => x.obraId === filtros.obraId) : xs;

  const solicitudes = porObra(estado.solicitudes);
  const despachos = porObra(estado.despachos);

  const saldosFiltrados: Map<string, Saldo> = new Map();
  for (const [k, s] of estado.inventario.saldos) {
    if (filtros.almacenId && k.split("|")[1] !== filtros.almacenId) continue;
    saldosFiltrados.set(k, s);
  }

  const asientos = estado.inventario.asientos.filter(
    (a) =>
      (!filtros.obraId || a.obraId === filtros.obraId) &&
      (!filtros.almacenId || a.almacenId === filtros.almacenId),
  );

  // --- Consumo actual y previo, para variación y rotación --------------------
  const consumo = consumoEnVentana(asientos, articulos, v.desdeMs, v.hastaMs);
  const consumoPrevio = consumoEnVentana(
    asientos,
    articulos,
    v.previoDesdeMs,
    v.previoHastaMs,
  );

  const valorInventario = valorizar(saldosFiltrados, articulos, (s) => s.fisico);
  const valorEnObra = valorizar(saldosFiltrados, articulos, (s) => s.enObra);

  // --- Entregas -------------------------------------------------------------
  const entregadosVentana = despachos.filter(
    (d) =>
      (d.estado === "entregado" || d.estado === "con_discrepancia") &&
      d.entregaEn !== undefined &&
      dentro(d.entregaEn, v.desdeMs, v.hastaMs),
  );
  const sinDiscrepancia = entregadosVentana.filter((d) => d.estado === "entregado");

  const entregadosPrevio = despachos.filter(
    (d) =>
      (d.estado === "entregado" || d.estado === "con_discrepancia") &&
      d.entregaEn !== undefined &&
      dentro(d.entregaEn, v.previoDesdeMs, v.previoHastaMs),
  );

  // --- Stock crítico --------------------------------------------------------
  const diasVentana = Math.max((v.hastaMs - v.desdeMs) / DIA_MS, 1);
  const dispPorArticulo = new Map<string, number>();
  const enObraPorArticulo = new Map<string, number>();
  for (const [k, s] of saldosFiltrados) {
    const id = k.split("|")[0];
    dispPorArticulo.set(id, (dispPorArticulo.get(id) ?? 0) + disponible(s));
    enObraPorArticulo.set(id, (enObraPorArticulo.get(id) ?? 0) + s.enObra);
  }

  const stockCritico: FilaStockCritico[] = [];
  for (const [articuloId, disp] of dispPorArticulo) {
    const art = articulos.get(articuloId);
    if (!art || !art.activo || art.clase === "retornable") continue;
    const consumido = consumo.porArticulo.get(articuloId) ?? 0;
    const consumoDiario = consumido > 0 ? consumido / diasVentana : null;
    const cob = consumoDiario === null ? null : cobertura(disp, consumoDiario);
    if (cob === null || cob >= DIAS_COBERTURA_MINIMA) continue;

    stockCritico.push({
      articuloId,
      codigo: art.codigo,
      descripcion: art.descripcion,
      disponible: disp,
      consumoDiario,
      cobertura: cob,
      obrasAfectadas: new Set(
        solicitudes
          .filter((s) => s.lineas.some((l) => l.articuloId === articuloId))
          .map((s) => s.obraId),
      ).size,
    });
  }
  stockCritico.sort((a, b) => (a.cobertura ?? 0) - (b.cobertura ?? 0));

  // --- Compras --------------------------------------------------------------
  const abiertas = estado.ordenes.filter(estaAbierta);
  const retrasadas = abiertas.filter((o) => Date.parse(o.fechaEsperada) < ahoraMs);
  const valorPorRecibir = abiertas.reduce(
    (s, o) =>
      s + o.lineas.reduce((x, l) => x + pendientePorRecibir(l) * l.costoUnitarioUsd, 0),
    0,
  );

  // --- Herramienta ----------------------------------------------------------
  let herramientaPendiente = 0;
  for (const [id, enObra] of enObraPorArticulo) {
    if (articulos.get(id)?.clase === "retornable") herramientaPendiente += enObra;
  }

  // --- Obras críticas -------------------------------------------------------
  const obrasCriticas: FilaObraCritica[] = estado.obras
    .filter((o) => o.estado === "activa")
    .filter((o) => !filtros.obraId || o.id === filtros.obraId)
    .map((o) => {
      const sus = estado.solicitudes.filter((s) => s.obraId === o.id);
      const solicitado = sus.reduce(
        (t, s) => t + s.lineas.reduce((x, l) => x + l.cantidadSolicitada, 0),
        0,
      );
      const despachado = sus.reduce(
        (t, s) => t + s.lineas.reduce((x, l) => x + l.cantidadDespachada, 0),
        0,
      );
      const desps = estado.despachos.filter((d) => d.obraId === o.id);
      const articulosDeLaObra = new Set(
        sus.flatMap((s) => s.lineas.map((l) => l.articuloId)),
      );

      let valorEnObraUsd = 0;
      let pendienteHerramienta = 0;
      for (const a of estado.inventario.asientos) {
        if (a.obraId !== o.id) continue;
        const art = articulos.get(a.articuloId);
        if (!art) continue;
        valorEnObraUsd += a.delta.enObra * art.costoPromedioUsd;
        if (art.clase === "retornable") pendienteHerramienta += a.delta.enObra;
      }

      const bloqueadas = sus.filter(
        (s) => s.estado === "solicitada" || s.estado === "aprobada",
      ).length;
      const conDiscrepancia = desps.filter((d) => d.estado === "con_discrepancia").length;
      const criticos = stockCritico.filter((c) =>
        articulosDeLaObra.has(c.articuloId),
      ).length;

      return {
        obraId: o.id,
        codigo: o.codigo,
        nombre: o.nombre,
        // AVANCE DE MATERIAL, no avance de obra: Apolo no guarda cronograma.
        avanceMaterial: solicitado > 0 ? despachado / solicitado : null,
        solicitudesBloqueadas: bloqueadas,
        materialesCriticos: criticos,
        entregasConDiscrepancia: conDiscrepancia,
        herramientaPendiente: Math.max(0, Math.round(pendienteHerramienta)),
        valorEnObraUsd: Math.max(0, valorEnObraUsd),
        alertas: bloqueadas + conDiscrepancia + criticos,
      };
    })
    .sort((a, b) => b.alertas - a.alertas);

  // --- Series y distribuciones ---------------------------------------------
  const solicitudesPorEstado: Conteo[] = [...contar(solicitudes, (s) => s.estado)]
    .map(([clave, valor]) => ({ clave, etiqueta: clave, valor }))
    .sort((a, b) => b.valor - a.valor);

  const despachosPorEstado: Conteo[] = [...contar(despachos, (d) => d.estado)]
    .map(([clave, valor]) => ({ clave, etiqueta: clave, valor }))
    .sort((a, b) => b.valor - a.valor);

  const avanceObras = obrasCriticas.slice(0, 8).map((o) => {
    const sus = estado.solicitudes.filter((s) => s.obraId === o.obraId);
    return {
      obraId: o.obraId,
      codigo: o.codigo,
      solicitado: sus.reduce(
        (t, s) => t + s.lineas.reduce((x, l) => x + l.cantidadSolicitada, 0),
        0,
      ),
      entregado: sus.reduce(
        (t, s) => t + s.lineas.reduce((x, l) => x + l.cantidadDespachada, 0),
        0,
      ),
    };
  });

  // Serie diaria de valor despachado dentro de la ventana.
  const porDia = new Map<string, number>();
  for (const a of asientos) {
    if (a.tipo !== "despacho" || !dentro(a.fecha, v.desdeMs, v.hastaMs)) continue;
    const dia = a.fecha.slice(0, 10);
    const art = articulos.get(a.articuloId);
    if (!art) continue;
    porDia.set(dia, (porDia.get(dia) ?? 0) + Math.abs(a.delta.fisico) * art.costoPromedioUsd);
  }
  const serieDespacho = [...porDia]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, valorUsd]) => ({ fecha, valorUsd }));

  // --- KPIs -----------------------------------------------------------------
  const inventarioPromedio = valorInventario > 0 ? valorInventario : 0;
  const kpis: Record<string, ValorKpi> = {};
  const add = (k: ValorKpi) => {
    kpis[k.id] = k;
  };

  add(kpi("obras_activas", estado.obras.filter((o) => o.estado === "activa").length));
  add(kpi("solicitudes_por_aprobar", solicitudes.filter((s) => s.estado === "solicitada").length));
  add(kpi("aprobadas_sin_preparar", solicitudes.filter((s) => s.estado === "aprobada").length));
  // Sin sello de tiempo de aprobación no hay tiempo que promediar.
  add(kpi("tiempo_aprobacion", null));
  add(
    kpi(
      "despachos_activos",
      despachos.filter(
        (d) => d.estado === "en_preparacion" || d.estado === "listo" || d.estado === "en_ruta",
      ).length,
    ),
  );
  add(kpi("en_ruta", despachos.filter((d) => d.estado === "en_ruta").length));
  add(
    kpi(
      "entregas_completas",
      entregasCompletas(sinDiscrepancia.length, entregadosVentana.length),
      entregasCompletas(
        entregadosPrevio.filter((d) => d.estado === "entregado").length,
        entregadosPrevio.length,
      ),
    ),
  );
  // Sin fecha comprometida de entrega no hay puntualidad que medir.
  add(kpi("otif", null));
  add(kpi("compras_abiertas", abiertas.length));
  add(kpi("compras_retrasadas", retrasadas.length));
  add(kpi("valor_por_recibir", valorPorRecibir));
  add(kpi("cumplimiento_proveedor", null));
  add(kpi("valor_inventario", valorInventario));
  add(kpi("valor_en_obra", valorEnObra));
  add(kpi("stock_critico", stockCritico.length));
  add(
    kpi(
      "rotacion",
      rotacion(consumo.valorUsd, inventarioPromedio),
      rotacion(consumoPrevio.valorUsd, inventarioPromedio),
    ),
  );
  add(kpi("herramienta_pendiente", Math.round(herramientaPendiente)));
  add(kpi("exactitud_inventario", null));
  add(kpi("cumplimiento_plan_obra", null));

  return {
    generadoEn: new Date(ahoraMs).toISOString(),
    kpis,
    alertas: construirAlertas(estado, stockCritico, ahoraMs, v),
    obrasCriticas,
    stockCritico: stockCritico.slice(0, 12),
    solicitudesPorEstado,
    despachosPorEstado,
    avanceObras,
    serieDespacho,
  };
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

const DIAS_DETENIDO = 3;

/**
 * Alertas derivadas del estado, no almacenadas.
 *
 * Una alerta que se guarda en una tabla se queda encendida cuando la causa ya
 * se resolvió, y entonces nadie vuelve a mirarlas. Estas se recalculan de la
 * condición: si la condición desaparece, la alerta desaparece sola.
 */
function construirAlertas(
  estado: EstadoApolo,
  stockCritico: FilaStockCritico[],
  ahoraMs: number,
  v: Ventana,
): Alerta[] {
  const out: Alerta[] = [];
  const obras = new Map(estado.obras.map((o) => [o.id, o]));

  for (const s of stockCritico.slice(0, 6)) {
    out.push({
      id: `stock:${s.articuloId}`,
      tipo: "stock_critico",
      severidad: (s.cobertura ?? 0) < 3 ? "critica" : "alta",
      titulo: `${s.codigo} con cobertura de ${Math.floor(s.cobertura ?? 0)} días`,
      detalle: `Quedan ${Math.round(s.disponible)} disponibles al ritmo de consumo actual.`,
      desde: new Date(v.desdeMs).toISOString(),
      accion: "Emitir orden de compra",
      enlace: "/compras",
    });
  }

  for (const s of estado.solicitudes.filter((x) => x.estado === "solicitada")) {
    const diasEsperando = (ahoraMs - Date.parse(s.fecha)) / DIA_MS;
    if (diasEsperando < 1) continue;
    out.push({
      id: `aprobar:${s.id}`,
      tipo: "solicitud_sin_aprobar",
      severidad: diasEsperando > DIAS_DETENIDO ? "alta" : "advertencia",
      titulo: `${s.codigo} lleva ${Math.floor(diasEsperando)} días sin aprobar`,
      detalle: `Obra ${obras.get(s.obraId)?.codigo ?? "—"}. Nada se prepara hasta que alguien la autorice.`,
      obraId: s.obraId,
      responsable: s.creadaPor,
      desde: s.fecha,
      accion: "Aprobar o rechazar",
      enlace: "/solicitudes",
    });
  }

  for (const s of estado.solicitudes.filter((x) => x.estado === "aprobada")) {
    out.push({
      id: `preparar:${s.id}`,
      tipo: "aprobada_sin_preparar",
      severidad: "advertencia",
      titulo: `${s.codigo} aprobada y sin preparar`,
      detalle: `Obra ${obras.get(s.obraId)?.codigo ?? "—"}. Tiene autorización pero nadie la ha tomado.`,
      obraId: s.obraId,
      desde: s.fecha,
      accion: "Preparar despacho",
      enlace: "/despacho",
    });
  }

  for (const o of estado.ordenes.filter(estaAbierta)) {
    const atraso = (ahoraMs - Date.parse(o.fechaEsperada)) / DIA_MS;
    if (atraso <= 0) continue;
    out.push({
      id: `compra:${o.id}`,
      tipo: "compra_retrasada",
      severidad: atraso > 7 ? "critica" : "alta",
      titulo: `${o.codigo} lleva ${Math.floor(atraso)} días de atraso`,
      detalle: "La fecha esperada de recepción ya pasó y la orden sigue abierta.",
      desde: o.fechaEsperada,
      accion: "Reclamar al proveedor",
      enlace: "/compras",
    });
  }

  for (const d of estado.despachos.filter((x) => x.estado === "con_discrepancia")) {
    out.push({
      id: `discrepancia:${d.id}`,
      tipo: "entrega_con_discrepancia",
      severidad: "alta",
      titulo: `${d.codigo} llegó con diferencias`,
      detalle: "Lo recibido en obra no coincide con lo despachado del almacén.",
      obraId: d.obraId,
      desde: d.entregaEn ?? d.creadoEn,
      accion: "Conciliar la entrega",
      enlace: "/despacho",
    });
  }

  for (const d of estado.despachos.filter((x) => x.estado === "listo")) {
    const espera = (ahoraMs - Date.parse(d.creadoEn)) / DIA_MS;
    if (espera < DIAS_DETENIDO) continue;
    out.push({
      id: `detenido:${d.id}`,
      tipo: "despacho_detenido",
      severidad: "advertencia",
      titulo: `${d.codigo} listo desde hace ${Math.floor(espera)} días`,
      detalle: "Está preparado en el andén y no ha salido.",
      obraId: d.obraId,
      desde: d.creadoEn,
      accion: "Asignar transporte",
      enlace: "/despacho",
    });
  }

  // El descuadre kardex/saldos es la alerta más grave que puede dar el sistema:
  // significa que las existencias dejaron de ser confiables.
  const discrepancias = reconciliar(estado.inventario);
  if (discrepancias.length > 0) {
    out.push({
      id: "reconciliacion",
      tipo: "inventario_descuadrado",
      severidad: "critica",
      titulo: `${discrepancias.length} posiciones no cuadran con el kardex`,
      detalle:
        "El saldo materializado difiere de la suma de los asientos. Las existencias no son confiables hasta resolverlo.",
      desde: new Date(ahoraMs).toISOString(),
      accion: "Revisar reconciliación",
      enlace: "/reportes",
    });
  }

  const orden: Record<Alerta["severidad"], number> = {
    critica: 0,
    alta: 1,
    advertencia: 2,
    informativa: 3,
  };
  return out.sort(
    (a, b) => orden[a.severidad] - orden[b.severidad] || Date.parse(a.desde) - Date.parse(b.desde),
  );
}

/** Adaptador que cumple el puerto. La versión Supabase sustituye este objeto. */
export function fuenteLocal(estado: EstadoApolo): FuenteDashboard {
  return {
    async obtener(filtros, ahoraMs) {
      return calcularPanel(estado, filtros, ahoraMs);
    },
  };
}
