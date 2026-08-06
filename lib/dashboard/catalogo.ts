import type { DefinicionKpi } from "@/lib/dashboard/tipos";

/**
 * Catálogo de KPIs.
 *
 * Fuente única. Un componente no escribe nunca el nombre ni el umbral de una
 * métrica: los lee de aquí. Así el tooltip que explica el número y el cálculo
 * que lo produce no pueden desincronizarse.
 *
 * Varias métricas del encargo NO son calculables con lo que Apolo guarda hoy.
 * Están igualmente en el catálogo, con `faltaDato` explicando qué falta. Eso es
 * deliberado: documenta la carencia en vez de esconderla, y evita que alguien
 * la "implemente" rellenando con un supuesto.
 */
export const CATALOGO: DefinicionKpi[] = [
  {
    id: "obras_activas",
    nombre: "Obras activas",
    descripcion: "Obras en ejecución, sin contar suspendidas ni cerradas.",
    formula: "count(obras donde estado = activa)",
    unidad: "conteo",
    fuente: "obras",
    periodicidad: "evento",
    dimensiones: [],
    direccion: "neutra",
    visualizacion: "Tarjeta",
  },
  {
    id: "solicitudes_por_aprobar",
    nombre: "Solicitudes por aprobar",
    descripcion:
      "Solicitudes en estado solicitada. Nada se prepara ni se despacha mientras estén aquí.",
    formula: "count(solicitudes donde estado = solicitada)",
    unidad: "conteo",
    fuente: "solicitudes",
    periodicidad: "evento",
    dimensiones: ["obra"],
    direccion: "menos-es-mejor",
    umbralAdvertencia: 3,
    umbralCritico: 8,
    visualizacion: "Tarjeta con enlace al módulo",
  },
  {
    id: "aprobadas_sin_preparar",
    nombre: "Aprobadas sin preparar",
    descripcion:
      "Ya tienen autorización pero nadie ha empezado a prepararlas. Es la cola que realmente frena la obra.",
    formula: "count(solicitudes donde estado = aprobada)",
    unidad: "conteo",
    fuente: "solicitudes",
    periodicidad: "evento",
    dimensiones: ["obra"],
    direccion: "menos-es-mejor",
    umbralAdvertencia: 3,
    umbralCritico: 6,
    visualizacion: "Tarjeta",
  },
  {
    id: "tiempo_aprobacion",
    nombre: "Tiempo de aprobación",
    descripcion: "Cuánto tarda de media una solicitud en pasar de creada a aprobada.",
    formula: "promedio(fecha_aprobacion - fecha_solicitud)",
    unidad: "dias",
    fuente: "solicitudes",
    periodicidad: "dia",
    dimensiones: ["obra"],
    direccion: "menos-es-mejor",
    umbralAdvertencia: 2,
    umbralCritico: 5,
    visualizacion: "Tarjeta con tendencia",
    faltaDato:
      "La solicitud guarda quién aprobó pero no CUÁNDO. Hace falta un sello de tiempo por transición de estado; hoy solo existe la fecha de creación.",
  },
  {
    id: "despachos_activos",
    nombre: "Despachos activos",
    descripcion: "En preparación, listos o en ruta. Material comprometido que aún no llegó.",
    formula: "count(despachos donde estado in (en_preparacion, listo, en_ruta))",
    unidad: "conteo",
    fuente: "despachos",
    periodicidad: "evento",
    dimensiones: ["obra"],
    direccion: "neutra",
    visualizacion: "Tarjeta",
  },
  {
    id: "en_ruta",
    nombre: "En ruta",
    descripcion: "Despachos que ya salieron del almacén y no han sido recibidos.",
    formula: "count(despachos donde estado = en_ruta)",
    unidad: "conteo",
    fuente: "despachos",
    periodicidad: "evento",
    dimensiones: ["obra"],
    direccion: "neutra",
    visualizacion: "Tarjeta",
  },
  {
    id: "entregas_completas",
    nombre: "Entregas completas",
    descripcion:
      "Porcentaje de entregas donde lo recibido coincidió con lo despachado, sin faltantes ni sobrantes.",
    formula: "entregas_sin_diferencias / total_entregas_completadas * 100",
    unidad: "porcentaje",
    fuente: "despachos entregados",
    periodicidad: "dia",
    dimensiones: ["obra", "almacen"],
    direccion: "mas-es-mejor",
    umbralAdvertencia: 95,
    umbralCritico: 85,
    visualizacion: "Tarjeta con tendencia",
  },
  {
    id: "otif",
    nombre: "OTIF",
    descripcion: "Entregas a tiempo Y completas sobre el total de entregas cerradas.",
    formula: "entregas_a_tiempo_y_completas / total_entregas_completadas * 100",
    unidad: "porcentaje",
    fuente: "despachos entregados",
    periodicidad: "dia",
    dimensiones: ["obra"],
    direccion: "mas-es-mejor",
    umbralAdvertencia: 95,
    umbralCritico: 85,
    visualizacion: "Tarjeta con tendencia",
    faltaDato:
      "La mitad 'completa' sí se calcula, pero la de 'a tiempo' no: un despacho no lleva fecha comprometida de entrega, solo salida y llegada reales. Sin fecha prometida no hay puntualidad que medir.",
  },
  {
    id: "compras_abiertas",
    nombre: "Compras abiertas",
    descripcion: "Órdenes enviadas o parcialmente recibidas.",
    formula: "count(ordenes donde estado in (enviada, parcial))",
    unidad: "conteo",
    fuente: "ordenes",
    periodicidad: "evento",
    dimensiones: ["proveedor"],
    direccion: "neutra",
    visualizacion: "Tarjeta",
  },
  {
    id: "compras_retrasadas",
    nombre: "Compras retrasadas",
    descripcion: "Órdenes abiertas cuya fecha esperada ya pasó.",
    formula: "count(ordenes abiertas donde fecha_esperada < hoy)",
    unidad: "conteo",
    fuente: "ordenes",
    periodicidad: "dia",
    dimensiones: ["proveedor"],
    direccion: "menos-es-mejor",
    umbralAdvertencia: 1,
    umbralCritico: 4,
    visualizacion: "Tarjeta con enlace",
  },
  {
    id: "valor_por_recibir",
    nombre: "Valor por recibir",
    descripcion: "Dinero ya comprometido en órdenes que todavía no han llegado.",
    formula: "suma(pendiente_por_recibir * costo_unitario) sobre ordenes abiertas",
    unidad: "usd",
    fuente: "ordenes",
    periodicidad: "evento",
    dimensiones: ["proveedor"],
    direccion: "neutra",
    visualizacion: "Tarjeta",
  },
  {
    id: "cumplimiento_proveedor",
    nombre: "Cumplimiento de proveedores",
    descripcion: "Órdenes recibidas dentro de la fecha esperada sobre el total recibido.",
    formula: "entregas_proveedor_a_tiempo / total_entregas_proveedor * 100",
    unidad: "porcentaje",
    fuente: "ordenes recibidas",
    periodicidad: "dia",
    dimensiones: ["proveedor"],
    direccion: "mas-es-mejor",
    umbralAdvertencia: 90,
    umbralCritico: 75,
    visualizacion: "Barras por proveedor",
    faltaDato:
      "La orden no registra la fecha real de recepción completa, solo cantidades recibidas por línea. Sin fecha de cierre no se puede comparar contra la esperada.",
  },
  {
    id: "valor_inventario",
    nombre: "Valor de inventario",
    descripcion: "Existencia física valorizada al costo promedio ponderado.",
    formula: "suma(saldo_fisico * costo_promedio) por artículo",
    unidad: "usd",
    fuente: "saldos",
    periodicidad: "evento",
    dimensiones: ["almacen", "clase"],
    direccion: "neutra",
    visualizacion: "Tarjeta + barras por almacén",
  },
  {
    id: "valor_en_obra",
    nombre: "Material en obra",
    descripcion: "Despachado y todavía no consumido ni devuelto. Es deuda abierta contra la obra.",
    formula: "suma(saldo_en_obra * costo_promedio)",
    unidad: "usd",
    fuente: "saldos",
    periodicidad: "evento",
    dimensiones: ["obra"],
    direccion: "neutra",
    visualizacion: "Tarjeta",
  },
  {
    id: "stock_critico",
    nombre: "Artículos en stock crítico",
    descripcion:
      "Artículos cuya cobertura estimada no llega a la ventana de reposición.",
    formula: "count(articulos donde disponible / consumo_diario < DIAS_COBERTURA_MINIMA)",
    unidad: "conteo",
    fuente: "saldos + kardex",
    periodicidad: "hora",
    dimensiones: ["almacen", "obra"],
    direccion: "menos-es-mejor",
    umbralAdvertencia: 1,
    umbralCritico: 5,
    visualizacion: "Tarjeta + tabla",
  },
  {
    id: "rotacion",
    nombre: "Rotación de inventario",
    descripcion: "Cuántas veces se consumió el inventario medio durante el periodo.",
    formula: "consumo_del_periodo / inventario_promedio",
    unidad: "veces",
    fuente: "kardex + saldos",
    periodicidad: "dia",
    dimensiones: ["almacen", "clase"],
    direccion: "mas-es-mejor",
    visualizacion: "Tarjeta con tendencia",
  },
  {
    id: "herramienta_pendiente",
    nombre: "Herramienta sin retornar",
    descripcion: "Unidades retornables que salieron a obra y no han vuelto.",
    formula: "suma(saldo_en_obra) sobre artículos de clase retornable",
    unidad: "conteo",
    fuente: "saldos",
    periodicidad: "evento",
    dimensiones: ["obra"],
    direccion: "menos-es-mejor",
    visualizacion: "Tarjeta + antigüedad FIFO",
  },
  {
    id: "exactitud_inventario",
    nombre: "Exactitud de inventario",
    descripcion: "Conteos físicos que coincidieron con el sistema.",
    formula: "registros_sin_diferencia / total_registros_auditados * 100",
    unidad: "porcentaje",
    fuente: "conteos cíclicos",
    periodicidad: "dia",
    dimensiones: ["almacen"],
    direccion: "mas-es-mejor",
    umbralAdvertencia: 97,
    umbralCritico: 92,
    visualizacion: "Tarjeta",
    faltaDato:
      "No existe módulo de conteo cíclico. Los ajustes del kardex registran una corrección, pero no cuántas posiciones se auditaron sin encontrar diferencia, que es el denominador.",
  },
  {
    id: "cumplimiento_plan_obra",
    nombre: "Cumplimiento del plan de obra",
    descripcion: "Avance real contra el planificado.",
    formula: "avance_real / avance_planificado * 100",
    unidad: "porcentaje",
    fuente: "cronograma de obra",
    periodicidad: "dia",
    dimensiones: ["obra"],
    direccion: "mas-es-mejor",
    umbralAdvertencia: 95,
    umbralCritico: 85,
    visualizacion: "Barras comparadas",
    faltaDato:
      "Apolo no guarda cronograma: la obra solo tiene código, nombre, ubicación y estado. Sin fechas de plan ni partidas no hay avance planificado contra el que comparar. El panel muestra en su lugar el AVANCE DE MATERIAL, que sí es dato real, y no lo llama avance de obra.",
  },
];

const PORID = new Map(CATALOGO.map((k) => [k.id, k]));

export function definicion(id: string): DefinicionKpi | undefined {
  return PORID.get(id);
}

/**
 * Estado de un valor frente a sus umbrales.
 *
 * La dirección importa: en OTIF quedarse corto es malo, en compras retrasadas
 * lo malo es pasarse. Un solo comparador para los dos casos daría el semáforo
 * invertido en la mitad de las tarjetas.
 */
export function estadoUmbral(
  def: DefinicionKpi,
  valor: number | null,
): "normal" | "advertencia" | "critico" | "sin-datos" {
  if (valor === null) return "sin-datos";
  const { umbralAdvertencia: adv, umbralCritico: cri, direccion } = def;
  if (adv === undefined) return "normal";
  if (direccion === "mas-es-mejor") {
    if (cri !== undefined && valor < cri) return "critico";
    return valor < adv ? "advertencia" : "normal";
  }
  if (direccion === "menos-es-mejor") {
    if (cri !== undefined && valor > cri) return "critico";
    return valor > adv ? "advertencia" : "normal";
  }
  return "normal";
}
