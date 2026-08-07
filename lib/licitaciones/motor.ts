import type {
  Apu,
  Desempeno,
  Disciplina,
  Estimacion,
  ObraHistorica,
  Parametros,
  RenglonMto,
} from "@/lib/licitaciones/tipos";

/**
 * Motor de estimación. Funciones puras.
 *
 * Es lo único de este módulo que se puede probar de verdad, y donde vive el
 * error caro: un precio unitario mal calculado no se detecta hasta que la
 * empresa ya presentó la oferta y la ganó por debajo del costo.
 */

// ---------------------------------------------------------------------------
// Cantidades
// ---------------------------------------------------------------------------

/**
 * Cantidad a comprar = cantidad del modelo × (1 + desperdicio).
 *
 * El desperdicio se aplica sobre la cantidad BASE y no acumulativamente: un
 * 5% sobre 100 son 105, no 105 más otro 5% en la siguiente etapa. Encadenarlo
 * es el error que hace que un cómputo salga 15% por encima sin que nadie sepa
 * de dónde vino.
 */
export function cantidadFinal(base: number, factorDesperdicio: number): number {
  if (!Number.isFinite(base) || base < 0) return 0;
  const f = Number.isFinite(factorDesperdicio) ? Math.max(0, factorDesperdicio) : 0;
  return base * (1 + f);
}

/** Horas-hombre = cantidad × rendimiento por unidad. */
export function horasHombre(cantidad: number, rendimientoHh: number): number {
  if (!Number.isFinite(cantidad) || !Number.isFinite(rendimientoHh)) return 0;
  return Math.max(0, cantidad) * Math.max(0, rendimientoHh);
}

/**
 * Días = HH totales / (cuadrillas × personas × horas por jornada).
 *
 * LA FÓRMULA CLÁSICA `HH / (cuadrillas × 8)` ESTÁ INCOMPLETA: trata cada
 * cuadrilla como una sola persona. Con ella, un proyecto de 61.000 HH y tres
 * cuadrillas da 2.975 días —ocho años— cuando la realidad son unos tres meses.
 * Una cuadrilla de obra son entre 8 y 15 personas, y ese factor decide si la
 * oferta es creíble o se descarta al leer el plazo.
 *
 * Devuelve `null` cuando falta cualquier factor: cero cuadrillas no son "cero
 * días", son un plazo que no se puede calcular, y devolver 0 haría pensar que
 * el trabajo es instantáneo.
 */
export function duracionDias(
  hhTotales: number,
  cuadrillas: number,
  horasJornada: number,
  personasPorCuadrilla = 1,
): number | null {
  if (cuadrillas <= 0 || horasJornada <= 0 || personasPorCuadrilla <= 0) return null;
  if (!Number.isFinite(hhTotales) || hhTotales < 0) return null;
  return hhTotales / (cuadrillas * personasPorCuadrilla * horasJornada);
}

// ---------------------------------------------------------------------------
// APU
// ---------------------------------------------------------------------------

/**
 * Análisis de Precio Unitario.
 *
 *   Costo directo = Materiales + Equipos + (Mano de obra × FAS)
 *   Precio        = Directo × (1 + Overhead) × (1 + Utilidad)
 *
 * EL FAS SOLO MULTIPLICA LA MANO DE OBRA, y esto es lo que más se equivoca:
 * el Factor de Ajuste Salarial cubre prestaciones, seguridad social y
 * dotación, que son cargas sobre el sueldo. Aplicarlo también al material
 * inflaría la oferta un 30–40% y la empresa perdería la licitación sin
 * entender por qué.
 *
 * El overhead y la utilidad se aplican EN CASCADA, no sumados: un 18% de
 * indirectos y un 12% de utilidad no son un 30%, son un 32,2%. Sumarlos deja
 * dinero sobre la mesa en cada renglón.
 */
export function calcularApu(renglon: RenglonMto, p: Parametros): Apu {
  const desperdicio =
    renglon.factorDesperdicio > 0 ? renglon.factorDesperdicio : p.desperdicioPorDefecto;

  const cantidad = cantidadFinal(renglon.cantidadBase, desperdicio);
  const hh = horasHombre(cantidad, renglon.rendimientoHh);

  const materialesUsd = cantidad * renglon.costoMaterialUsd;
  const equiposUsd = cantidad * renglon.costoEquipoUsd;
  // La mano de obra se calcula sobre las HH y se ajusta por FAS.
  const manoObraUsd = hh * p.costoHoraHombreUsd * p.fas;

  const costoDirectoUsd = materialesUsd + equiposUsd + manoObraUsd;
  const indirectosUsd = costoDirectoUsd * p.overhead;
  const conIndirectos = costoDirectoUsd + indirectosUsd;
  const utilidadUsd = conIndirectos * p.utilidad;
  const totalUsd = conIndirectos + utilidadUsd;

  const dias = duracionDias(hh, p.cuadrillas, p.horasJornada, p.personasPorCuadrilla);

  return {
    renglon,
    cantidadFinal: cantidad,
    materialesUsd,
    manoObraUsd,
    equiposUsd,
    costoDirectoUsd,
    indirectosUsd,
    utilidadUsd,
    // Precio unitario sobre la cantidad FINAL: es lo que se cotiza por unidad
    // realmente instalada, no por unidad de plano.
    precioUnitarioUsd: cantidad > 0 ? totalUsd / cantidad : 0,
    totalUsd,
    horasHombre: hh,
    diasEstimados: dias ?? 0,
  };
}

/**
 * Estimación completa del proyecto.
 *
 * EL PLAZO NO ES LA SUMA DE LOS PLAZOS. Las disciplinas avanzan en paralelo —
 * la cuadrilla de piping no espera a que termine la de civil para empezar—,
 * así que el plazo del proyecto es el de la disciplina más larga, no el total
 * acumulado. Sumarlos daría un plazo tres o cuatro veces mayor que el real y
 * la oferta perdería por plazo.
 */
export function estimar(renglones: RenglonMto[], p: Parametros): Estimacion {
  const apus = renglones.map((r) => calcularApu(r, p));

  const suma = (f: (a: Apu) => number) => apus.reduce((s, a) => s + f(a), 0);

  const porDisciplina = agruparPorDisciplina(apus, p);

  return {
    apus,
    totalMaterialesUsd: suma((a) => a.materialesUsd),
    totalManoObraUsd: suma((a) => a.manoObraUsd),
    totalEquiposUsd: suma((a) => a.equiposUsd),
    totalDirectoUsd: suma((a) => a.costoDirectoUsd),
    totalIndirectosUsd: suma((a) => a.indirectosUsd),
    totalUtilidadUsd: suma((a) => a.utilidadUsd),
    totalUsd: suma((a) => a.totalUsd),
    horasHombre: suma((a) => a.horasHombre),
    // La ruta más larga, no el acumulado.
    diasEstimados: porDisciplina.reduce((m, d) => Math.max(m, d.dias), 0),
    porDisciplina,
  };
}

function agruparPorDisciplina(apus: Apu[], p: Parametros) {
  const mapa = new Map<Disciplina, { totalUsd: number; horasHombre: number; renglones: number }>();

  for (const a of apus) {
    const d = a.renglon.disciplina;
    const prev = mapa.get(d) ?? { totalUsd: 0, horasHombre: 0, renglones: 0 };
    prev.totalUsd += a.totalUsd;
    prev.horasHombre += a.horasHombre;
    prev.renglones += 1;
    mapa.set(d, prev);
  }

  // Las cuadrillas se reparten entre las disciplinas activas: tres cuadrillas
  // repartidas en tres frentes son una por frente, no tres en cada uno.
  const activas = Math.max(1, mapa.size);
  const cuadrillasPorFrente = Math.max(1, Math.floor(p.cuadrillas / activas));

  return [...mapa.entries()]
    .map(([disciplina, v]) => ({
      disciplina,
      ...v,
      dias:
        duracionDias(
          v.horasHombre,
          cuadrillasPorFrente,
          p.horasJornada,
          p.personasPorCuadrilla,
        ) ?? 0,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

// ---------------------------------------------------------------------------
// Desempeño histórico
// ---------------------------------------------------------------------------

/**
 * Índices de desempeño del valor ganado.
 *
 *   SPI = EV / PV → por debajo de 1, atrasado
 *   CPI = EV / AC → por debajo de 1, sobrecosto
 *
 * Devuelven `null` con denominador cero en vez de Infinity: una obra sin
 * presupuesto registrado no tiene un SPI infinito, tiene un SPI desconocido.
 */
export function desempeno(o: ObraHistorica): Desempeno {
  const div = (a: number, b: number) => (b > 0 && Number.isFinite(a) ? a / b : null);
  return {
    spi: div(o.evUsd, o.pvUsd),
    cpi: div(o.evUsd, o.acUsd),
    hhPorTonelada: div(o.horasHombre, o.toneladasAcero),
    hhPorM3: div(o.horasHombre, o.m3Concreto),
  };
}

/**
 * Compara el rendimiento estimado contra la media histórica.
 *
 * Positivo = la estimación es MÁS optimista que la historia, y eso es un
 * riesgo: significa que se está prometiendo hacerlo más rápido de lo que la
 * empresa lo ha hecho nunca.
 */
export function desviacionRendimiento(
  hhEstimadasPorUnidad: number,
  hhHistoricasPorUnidad: number | null,
): number | null {
  if (hhHistoricasPorUnidad === null || hhHistoricasPorUnidad <= 0) return null;
  if (hhEstimadasPorUnidad <= 0) return null;
  return ((hhHistoricasPorUnidad - hhEstimadasPorUnidad) / hhHistoricasPorUnidad) * 100;
}

/** Media de un índice sobre varias obras, ignorando las que no lo tienen. */
export function promedioIndice(
  obras: ObraHistorica[],
  f: (d: Desempeno) => number | null,
): number | null {
  const valores = obras.map((o) => f(desempeno(o))).filter((v): v is number => v !== null);
  if (valores.length === 0) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

// ---------------------------------------------------------------------------
// RFQ
// ---------------------------------------------------------------------------

export interface FamiliaRfq {
  familia: string;
  disciplina: Disciplina;
  renglones: number;
  cantidadTotal: number;
  montoEstimadoUsd: number;
  items: { codigo: string; descripcion: string; especificacion: string; unidad: string; cantidad: number }[];
}

/**
 * Agrupa el cómputo en familias para pedir cotización.
 *
 * Se agrupa por familia y NO por renglón porque un proveedor cotiza mejor un
 * paquete: pedir por separado 40 diámetros de tubería del mismo material
 * multiplica el trabajo administrativo y empeora el precio.
 *
 * La familia sale del prefijo del código, que es como están organizados los
 * catálogos de material industrial.
 */
export function agruparRfq(apus: Apu[]): FamiliaRfq[] {
  const mapa = new Map<string, FamiliaRfq>();

  for (const a of apus) {
    const familia = a.renglon.codigo.split("-")[0] || "OTROS";
    const clave = `${familia}|${a.renglon.disciplina}`;
    const prev =
      mapa.get(clave) ??
      ({
        familia,
        disciplina: a.renglon.disciplina,
        renglones: 0,
        cantidadTotal: 0,
        montoEstimadoUsd: 0,
        items: [],
      } as FamiliaRfq);

    prev.renglones += 1;
    prev.cantidadTotal += a.cantidadFinal;
    // El monto de la RFQ es SOLO material: a un proveedor no se le pide que
    // cotice la mano de obra ni la utilidad de la constructora.
    prev.montoEstimadoUsd += a.materialesUsd;
    prev.items.push({
      codigo: a.renglon.codigo,
      descripcion: a.renglon.descripcion,
      especificacion: a.renglon.especificacion,
      unidad: a.renglon.unidad,
      cantidad: a.cantidadFinal,
    });

    mapa.set(clave, prev);
  }

  return [...mapa.values()].sort((a, b) => b.montoEstimadoUsd - a.montoEstimadoUsd);
}
