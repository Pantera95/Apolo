import type {
  Apu,
  Desempeno,
  DesgloseApu,
  LineaApu,
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
 * Desglose del precio unitario por capítulos, POR UNIDAD de obra.
 *
 * Cuando el renglón trae composición, cada insumo se valoriza y se conserva
 * para imprimirlo en el APU. Cuando no la trae —lo normal en un schedule
 * exportado de un modelo—, se emite una línea agregada por capítulo y se marca
 * `detallado: false`, para que el documento lo diga en vez de aparentar un
 * detalle que nadie cargó.
 */
function desglosar(renglon: RenglonMto, p: Parametros): DesgloseApu {
  const c = renglon.composicion;

  if (!c) {
    const moDirecta = renglon.rendimientoHh * p.costoHoraHombreUsd;
    const fasUsd = moDirecta * (p.fas - 1);
    return {
      materiales: [
        {
          descripcion: renglon.descripcion || "Material del renglón",
          unidad: renglon.unidad,
          coeficiente: 1,
          precioUnitarioUsd: renglon.costoMaterialUsd,
          costoUsd: renglon.costoMaterialUsd,
        },
      ],
      equipos: [
        {
          descripcion: "Equipos y herramientas",
          unidad: "gl",
          coeficiente: 1,
          precioUnitarioUsd: renglon.costoEquipoUsd,
          costoUsd: renglon.costoEquipoUsd,
        },
      ],
      manoObra: [
        {
          descripcion: "Cuadrilla (promedio)",
          unidad: "HH",
          coeficiente: renglon.rendimientoHh,
          precioUnitarioUsd: p.costoHoraHombreUsd,
          costoUsd: moDirecta,
        },
      ],
      manoObraDirectaUsd: moDirecta,
      fasUsd,
      manoObraCargadaUsd: moDirecta + fasUsd,
      detallado: false,
    };
  }

  const materiales = c.materiales.map((m) => ({
    descripcion: m.descripcion,
    unidad: m.unidad,
    coeficiente: m.cantidadPorUnidad,
    precioUnitarioUsd: m.precioUnitarioUsd,
    costoUsd: m.cantidadPorUnidad * m.precioUnitarioUsd,
  }));

  const manoObra = c.cuadrilla.map((h) => ({
    descripcion: h.categoria,
    unidad: "HH",
    coeficiente: h.hhPorUnidad,
    precioUnitarioUsd: h.tarifaHoraUsd,
    costoUsd: h.hhPorUnidad * h.tarifaHoraUsd,
  }));

  const manoObraDirectaUsd = manoObra.reduce((s, l) => s + l.costoUsd, 0);
  // El FAS se expresa como recargo: FAS 2,10 son prestaciones del 110%.
  const fasUsd = manoObraDirectaUsd * (p.fas - 1);

  const equipos: LineaApu[] = c.equipos.map((e) => ({
    descripcion: e.descripcion,
    unidad: e.unidad,
    coeficiente: e.rendimientoPorUnidad,
    precioUnitarioUsd: e.precioUnitarioUsd,
    costoUsd: e.rendimientoPorUnidad * e.precioUnitarioUsd,
  }));

  if (c.herramientasMenoresPct > 0) {
    equipos.push({
      descripcion: `Herramientas menores (${(c.herramientasMenoresPct * 100).toFixed(1)}% M.O.)`,
      unidad: "%",
      coeficiente: c.herramientasMenoresPct,
      precioUnitarioUsd: 0,
      // Sobre la mano de obra DIRECTA: la herramienta se gasta en proporción
      // al trabajo, no a las prestaciones de quien lo hace.
      costoUsd: manoObraDirectaUsd * c.herramientasMenoresPct,
      esPorcentaje: true,
    });
  }

  return {
    materiales,
    equipos,
    manoObra,
    manoObraDirectaUsd,
    fasUsd,
    manoObraCargadaUsd: manoObraDirectaUsd + fasUsd,
    detallado: true,
  };
}

/**
 * Análisis de Precio Unitario.
 *
 *   Costo directo = Materiales + Equipos + Mano de obra cargada
 *   Precio        = Directo + Indirectos + Contingencia + Utilidad
 *
 * EL FAS SOLO CARGA LA MANO DE OBRA. El Factor de Ajuste Salarial cubre
 * prestaciones, seguridad social y dotación: son cargas sobre el sueldo.
 * Aplicarlo también al material inflaría la oferta un 30–40% y la empresa
 * perdería la licitación sin entender por qué.
 *
 * LOS RECARGOS SE SUMAN SOBRE EL DIRECTO, no se encadenan. Este es el modelo de
 * las planillas de licitación de las operadoras, y es el que Apolo trae por
 * defecto. El modo "cascada" —cada recargo sobre el subtotal anterior— queda
 * disponible en los parámetros porque muchas constructoras lo usan y les rinde
 * un 2,8% más, pero cuando el pliego trae la planilla del cliente, gana la
 * planilla: una oferta que no cuadra con su formato se objeta antes de leerse.
 */
export function calcularApu(renglon: RenglonMto, p: Parametros): Apu {
  const desperdicio =
    renglon.factorDesperdicio > 0 ? renglon.factorDesperdicio : p.desperdicioPorDefecto;

  const cantidad = cantidadFinal(renglon.cantidadBase, desperdicio);
  const desglose = desglosar(renglon, p);

  // Las HH salen de la cuadrilla cuando hay composición: sumar las categorías
  // es el dato real, y el `rendimientoHh` agregado solo es un respaldo.
  const hhPorUnidad = desglose.detallado
    ? desglose.manoObra.reduce((s, l) => s + l.coeficiente, 0)
    : renglon.rendimientoHh;
  const hh = horasHombre(cantidad, hhPorUnidad);

  const unitarioMateriales = desglose.materiales.reduce((s, l) => s + l.costoUsd, 0);
  const unitarioEquipos = desglose.equipos.reduce((s, l) => s + l.costoUsd, 0);

  const materialesUsd = cantidad * unitarioMateriales;
  const equiposUsd = cantidad * unitarioEquipos;
  const manoObraUsd = cantidad * desglose.manoObraCargadaUsd;

  const costoDirectoUsd = materialesUsd + equiposUsd + manoObraUsd;

  let indirectosUsd: number;
  let imprevistosUsd: number;
  let utilidadUsd: number;

  if (p.modoMarkup === "cascada") {
    indirectosUsd = costoDirectoUsd * p.overhead;
    const s1 = costoDirectoUsd + indirectosUsd;
    imprevistosUsd = s1 * p.imprevistos;
    const s2 = s1 + imprevistosUsd;
    utilidadUsd = s2 * p.utilidad;
  } else {
    // Los tres, sobre el costo directo.
    indirectosUsd = costoDirectoUsd * p.overhead;
    imprevistosUsd = costoDirectoUsd * p.imprevistos;
    utilidadUsd = costoDirectoUsd * p.utilidad;
  }

  const totalUsd = costoDirectoUsd + indirectosUsd + imprevistosUsd + utilidadUsd;
  const dias = duracionDias(hh, p.cuadrillas, p.horasJornada, p.personasPorCuadrilla);

  return {
    renglon,
    cantidadFinal: cantidad,
    materialesUsd,
    manoObraUsd,
    equiposUsd,
    costoDirectoUsd,
    indirectosUsd,
    imprevistosUsd,
    utilidadUsd,
    // Precio unitario sobre la cantidad FINAL: es lo que se cotiza por unidad
    // realmente instalada, no por unidad de plano.
    precioUnitarioUsd: cantidad > 0 ? totalUsd / cantidad : 0,
    totalUsd,
    horasHombre: hh,
    diasEstimados: dias ?? 0,
    desglose,
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
    totalImprevistosUsd: suma((a) => a.imprevistosUsd),
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
 * LA FAMILIA ES EL SEGMENTO DE MATERIAL, y cuál es depende de la convención.
 * Conviven dos en la industria:
 *
 *   CIV-CON-04    disciplina · familia · correlativo  → la familia es CON
 *   TUB-A106-6    familia · especificación · medida   → la familia es TUB
 *
 * Tomar siempre el segmento del medio rompería la segunda, y tomar siempre el
 * primero rompería la primera agrupando toda una disciplina en un paquete:
 * pedir una sola cotización por "todo lo civil" mezcla concreto, cabilla y
 * encofrado, que son tres mercados con tres proveedores distintos.
 *
 * Se resuelve mirando si el primer segmento es un código de DISCIPLINA. Si lo
 * es, la familia es el siguiente; si no, es el primero.
 */
const PREFIJOS_DISCIPLINA = new Set(["CIV", "EST", "MEC", "PIP", "ELE", "INS"]);

export function familiaDe(codigo: string): string {
  const partes = codigo.split("-").filter(Boolean);
  if (partes.length === 0) return "OTROS";
  if (partes.length >= 3 && PREFIJOS_DISCIPLINA.has(partes[0].toUpperCase())) {
    return partes[1];
  }
  return partes[0];
}

export function agruparRfq(apus: Apu[]): FamiliaRfq[] {
  const mapa = new Map<string, FamiliaRfq>();

  for (const a of apus) {
    const familia = familiaDe(a.renglon.codigo);
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
