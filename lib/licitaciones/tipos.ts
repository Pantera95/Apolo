/**
 * Estimación de licitaciones desde modelos BIM/CAD.
 *
 * FRONTERA DECLARADA, y hay que entenderla antes de tocar nada:
 *
 * Un `.rvt` de Revit NO se puede leer en un navegador. Es un contenedor OLE
 * propietario cuyo formato Autodesk no publica; extraerlo exige la API de
 * Autodesk Platform Services —de pago, por trabajo asíncrono en la nube— o
 * Revit instalado. Lo mismo con los `.mac` de AVEVA PDMS, que son macros del
 * propio motor.
 *
 * Lo que SÍ es procesable son los EXPORTS que esas herramientas producen:
 *
 *   IFC          estándar abierto (buildingSMART). Parseable, pero necesita
 *                una librería WASM de ~2 MB. Hoy no está instalada.
 *   XML          SmartPlant 3D y Revit exportan schedules en XML. Parseable
 *                sin dependencias.
 *   CSV          el schedule de cualquiera de las tres. Parseable hoy mismo,
 *                y es lo que un estimador realmente tiene a mano.
 *
 * Por eso la ingesta entra por un PUERTO: hoy la cumple un simulador y un
 * lector de CSV/XML; mañana la cumple un adaptador de APS o de web-ifc sin
 * tocar el motor de cálculo ni la pantalla.
 */

// ---------------------------------------------------------------------------
// Origen
// ---------------------------------------------------------------------------

export type OrigenModelo = "revit" | "ifc" | "pdms" | "smartplant" | "csv";

export interface CapacidadOrigen {
  id: OrigenModelo;
  nombre: string;
  extensiones: string[];
  /** Qué se puede hacer HOY con este formato. Sin adornos. */
  soporte: "nativo" | "export" | "simulado";
  nota: string;
}

export const ORIGENES: CapacidadOrigen[] = [
  {
    id: "csv",
    nombre: "Schedule en CSV",
    extensiones: [".csv", ".txt"],
    soporte: "nativo",
    nota: "Se procesa de verdad. Es el export de cantidades de cualquiera de las tres herramientas.",
  },
  {
    id: "smartplant",
    nombre: "SmartPlant 3D · XML",
    extensiones: [".xml"],
    soporte: "export",
    nota: "Se procesa el XML de reporte. El modelo nativo no.",
  },
  {
    id: "ifc",
    nombre: "IFC (buildingSMART)",
    extensiones: [".ifc"],
    soporte: "simulado",
    nota: "Estándar abierto y parseable, pero exige una librería WASM de ~2 MB que aún no está instalada.",
  },
  {
    id: "revit",
    nombre: "Autodesk Revit",
    extensiones: [".rvt"],
    soporte: "simulado",
    nota: "Formato binario propietario. Requiere Autodesk Platform Services, que es de pago. Exporta el schedule a CSV o IFC.",
  },
  {
    id: "pdms",
    nombre: "AVEVA PDMS / E3D",
    extensiones: [".mac", ".dat"],
    soporte: "simulado",
    nota: "Macro propietaria del motor de AVEVA. Exporta el reporte a CSV o XML.",
  },
];

// ---------------------------------------------------------------------------
// Disciplinas y cómputo
// ---------------------------------------------------------------------------

export type Disciplina = "civil" | "estructural" | "mecanica" | "piping" | "electricidad" | "instrumentacion";

export const DISCIPLINAS: { id: Disciplina; nombre: string }[] = [
  { id: "civil", nombre: "Civil" },
  { id: "estructural", nombre: "Estructural" },
  { id: "mecanica", nombre: "Mecánica" },
  { id: "piping", nombre: "Piping" },
  { id: "electricidad", nombre: "Electricidad" },
  { id: "instrumentacion", nombre: "Instrumentación" },
];

/**
 * Un renglón del cómputo métrico (MTO / Material Take-Off).
 *
 * `cantidadBase` es lo que dice el modelo. La cantidad a comprar sale de
 * aplicarle el desperdicio, y se guardan las dos por separado: confundirlas
 * hace imposible auditar de dónde salió la diferencia frente al plano.
 */
export interface RenglonMto {
  id: string;
  disciplina: Disciplina;
  codigo: string;
  descripcion: string;
  /** Especificación técnica: "f'c=280 kg/cm²", "ASTM A106 Gr.B Sch 40". */
  especificacion: string;
  unidad: string;
  cantidadBase: number;
  /** 0.05 = 5%. Depende del material: el concreto se derrama, la válvula no. */
  factorDesperdicio: number;
  costoMaterialUsd: number;
  /** Horas-hombre por unidad. El dato que decide el plazo. */
  rendimientoHh: number;
  costoEquipoUsd: number;
  /**
   * Desglose del precio unitario, cuando se conoce.
   *
   * OPCIONAL A PROPÓSITO. Un schedule exportado de Revit trae cantidades y a lo
   * sumo un costo unitario agregado — no trae la cuadrilla tipo ni los insumos
   * que componen un m³ de concreto. Eso lo aporta la base de precios de la
   * empresa, no el modelo.
   *
   * Cuando falta, el APU se emite igual pero con una sola línea agregada por
   * capítulo, y el documento declara que el desglose no vino del origen. Es
   * preferible a inventar una cuadrilla que nadie aprobó.
   */
  composicion?: Composicion;
}

// ---------------------------------------------------------------------------
// Composición del precio unitario
// ---------------------------------------------------------------------------

/** Un insumo del capítulo de materiales: cuánto entra en UNA unidad de obra. */
export interface InsumoMaterial {
  descripcion: string;
  unidad: string;
  /** Cantidad por unidad de obra. Incluye ya su propia merma si aplica. */
  cantidadPorUnidad: number;
  precioUnitarioUsd: number;
}

/** Un equipo del capítulo de equipos, medido en horas-máquina por unidad. */
export interface InsumoEquipo {
  descripcion: string;
  unidad: string;
  /** Horas-máquina por unidad de obra. */
  rendimientoPorUnidad: number;
  precioUnitarioUsd: number;
}

/**
 * Una categoría de la cuadrilla tipo.
 *
 * Se guarda el HH por unidad de CADA categoría y no un promedio: un capataz a
 * 25 USD/h y un peón a 12 no se promedian sin perder la estructura del costo,
 * que es justo lo que el cliente audita cuando revisa un APU.
 */
export interface InsumoManoObra {
  categoria: string;
  hhPorUnidad: number;
  tarifaHoraUsd: number;
}

export interface Composicion {
  materiales: InsumoMaterial[];
  equipos: InsumoEquipo[];
  cuadrilla: InsumoManoObra[];
  /**
   * Herramientas menores, como porcentaje de la mano de obra DIRECTA.
   *
   * Se calcula sobre la directa y no sobre la cargada con FAS: la herramienta
   * menor —discos, brocas, guantes, cintas— se gasta en proporción al trabajo
   * hecho, no a las prestaciones sociales de quien lo hace.
   */
  herramientasMenoresPct: number;
}

// ---------------------------------------------------------------------------
// Parámetros del estimador
// ---------------------------------------------------------------------------

/**
 * Lo que el estimador ajusta a mano.
 *
 * Ninguno tiene un valor "correcto" universal: dependen de la empresa, del
 * país y del contrato. Por eso son parámetros y no constantes escondidas.
 */
export interface Parametros {
  /** Cuadrillas trabajando en paralelo. Divide el plazo, no las horas. */
  cuadrillas: number;
  /**
   * Personas por cuadrilla.
   *
   * HACE FALTA Y NO ES UN ADORNO. La fórmula clásica `HH / (cuadrillas × 8)`
   * trata cada cuadrilla como UNA persona, y con eso un proyecto de 61.000 HH
   * y tres cuadrillas sale en 2.975 días — ocho años. Una cuadrilla de obra
   * son entre 8 y 15 personas, y sin este factor el plazo es inservible.
   */
  personasPorCuadrilla: number;
  /** Horas por jornada. */
  horasJornada: number;
  /** Costo de la hora-hombre, USD. */
  costoHoraHombreUsd: number;
  /**
   * Factor de Ajuste Salarial: prestaciones, seguridad social, dotación.
   * En Venezuela ronda 1,8–2,4 sobre el salario base.
   */
  fas: number;
  /** Indirectos de campo y oficina, sobre el costo directo. 0.15 = 15%. */
  overhead: number;
  /**
   * Imprevistos y contingencia.
   *
   * Va SEPARADO de los indirectos aunque ambos sean un porcentaje del directo.
   * Fundirlos en un solo número es cómodo para calcular y pésimo para negociar:
   * cuando el cliente pide bajar el precio, la contingencia es lo primero que
   * se discute y los indirectos son un costo real que no se puede regalar.
   */
  imprevistos: number;
  /** Utilidad / fee del contratista. */
  utilidad: number;
  /**
   * Cómo se aplican los recargos sobre el costo directo.
   *
   *   "aditivo"  Directo × (1 + i + c + u). Cada recargo se calcula sobre el
   *              costo directo. Es el modelo de las planillas de licitación de
   *              las operadoras, y por eso es el que trae Apolo por defecto.
   *   "cascada"  Directo × (1+i) × (1+c) × (1+u). Cada recargo se calcula sobre
   *              el subtotal anterior, o sea también sobre los recargos.
   *
   * NO SON EQUIVALENTES y la diferencia no es despreciable: con 15/5/10 el
   * cascada da 32,8% de recargo y el aditivo 30,0%. Sobre un directo de 229
   * USD/m³ y 1.500 m³ son casi 10.000 USD de diferencia en un solo renglón.
   *
   * Se ofrece el cascada porque muchas constructoras lo usan y les rinde más,
   * pero si el pliego trae la planilla de la operadora, gana la planilla: una
   * oferta que no cuadra con el formato del cliente se objeta antes de leerla.
   */
  modoMarkup: "aditivo" | "cascada";
  /** Desperdicio por defecto cuando el renglón no trae el suyo. */
  desperdicioPorDefecto: number;
}

export const PARAMETROS_INICIALES: Parametros = {
  // Escala de un EPC industrial mediano: seis frentes de doce personas.
  cuadrillas: 6,
  personasPorCuadrilla: 12,
  horasJornada: 8,
  costoHoraHombreUsd: 6.5,
  // FAS 2,10 = un recargo del 110% sobre el salario base, que es como lo
  // expresan las planillas: "FAS @ 110%".
  fas: 2.1,
  overhead: 0.15,
  imprevistos: 0.05,
  utilidad: 0.1,
  modoMarkup: "aditivo",
  desperdicioPorDefecto: 0.05,
};

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

/**
 * Una línea del APU ya valorizada, POR UNIDAD de obra.
 *
 * `costoUsd` es el costo en una sola unidad, no en el renglón completo: es lo
 * que el cliente audita cuando pregunta "¿por qué su m³ cuesta 297?".
 */
export interface LineaApu {
  descripcion: string;
  unidad: string;
  /** Cantidad, rendimiento o HH por unidad de obra, según el capítulo. */
  coeficiente: number;
  precioUnitarioUsd: number;
  costoUsd: number;
  /** Cierto en la línea de herramientas menores, que es un % y no un producto. */
  esPorcentaje?: boolean;
}

/** Desglose por capítulos, tal como se imprime en el APU. */
export interface DesgloseApu {
  materiales: LineaApu[];
  equipos: LineaApu[];
  manoObra: LineaApu[];
  /** Suma de las categorías de la cuadrilla, sin FAS. */
  manoObraDirectaUsd: number;
  /** El recargo por prestaciones. */
  fasUsd: number;
  /** Directa + FAS. */
  manoObraCargadaUsd: number;
  /**
   * Falso cuando el origen no traía composición y el desglose se emitió como
   * una sola línea agregada por capítulo. El documento lo declara.
   */
  detallado: boolean;
}

/** Análisis de Precio Unitario de un renglón, desglosado. */
export interface Apu {
  renglon: RenglonMto;
  cantidadFinal: number;
  materialesUsd: number;
  manoObraUsd: number;
  equiposUsd: number;
  costoDirectoUsd: number;
  indirectosUsd: number;
  imprevistosUsd: number;
  utilidadUsd: number;
  /** Precio unitario de venta, ya con indirectos, contingencia y utilidad. */
  precioUnitarioUsd: number;
  totalUsd: number;
  horasHombre: number;
  diasEstimados: number;
  /** Los capítulos, por unidad de obra. */
  desglose: DesgloseApu;
}

export interface Estimacion {
  apus: Apu[];
  totalMaterialesUsd: number;
  totalManoObraUsd: number;
  totalEquiposUsd: number;
  totalDirectoUsd: number;
  totalIndirectosUsd: number;
  totalImprevistosUsd: number;
  totalUtilidadUsd: number;
  totalUsd: number;
  horasHombre: number;
  /** Días de la ruta más larga: las disciplinas avanzan en paralelo. */
  diasEstimados: number;
  porDisciplina: {
    disciplina: Disciplina;
    totalUsd: number;
    horasHombre: number;
    dias: number;
    renglones: number;
  }[];
}

// ---------------------------------------------------------------------------
// Histórico y desempeño
// ---------------------------------------------------------------------------

/** Una obra ya ejecutada, para comparar contra la estimación. */
export interface ObraHistorica {
  codigo: string;
  nombre: string;
  anio: number;
  /** Valor planificado del trabajo: el presupuesto. */
  pvUsd: number;
  /** Valor ganado: presupuesto del trabajo realmente ejecutado. */
  evUsd: number;
  /** Costo real de ese trabajo. */
  acUsd: number;
  horasHombre: number;
  /** Toneladas de acero, para el ratio de material. */
  toneladasAcero: number;
  m3Concreto: number;
}

export interface Desempeno {
  /** SPI = EV / PV. Bajo 1 = atrasado. */
  spi: number | null;
  /** CPI = EV / AC. Bajo 1 = sobrecosto. */
  cpi: number | null;
  /** HH por tonelada de acero montada. */
  hhPorTonelada: number | null;
  /** HH por m³ de concreto vaciado. */
  hhPorM3: number | null;
}

// ---------------------------------------------------------------------------
// Puerto de ingesta
// ---------------------------------------------------------------------------

export interface ResultadoIngesta {
  renglones: RenglonMto[];
  origen: OrigenModelo;
  archivo: string;
  /** Advertencias del proceso. Se muestran, no se descartan. */
  avisos: string[];
  /** Cierto cuando los renglones son simulados y no salen del archivo. */
  simulado: boolean;
  /**
   * Cierto cuando el schedule es uno de los modelos de muestra.
   *
   * NO ES LO MISMO QUE `simulado` y por eso son dos banderas. Un modelo de
   * muestra se PROCESA de verdad —pasa por el lector de CSV, fila por fila—,
   * solo que sus datos son inventados. Un cómputo simulado ni siquiera se leyó.
   * Fundirlas haría que el documento dijera "no procede de un modelo real"
   * sobre un archivo que sí se leyó, o peor, que no dijera nada sobre datos
   * ficticios.
   */
  muestra?: boolean;
}

/**
 * Puerto de ingesta de modelos.
 *
 * Hoy lo cumplen un lector de CSV/XML y un simulador. Mañana lo cumple un
 * adaptador de Autodesk Platform Services o de web-ifc, sin que el motor de
 * cálculo ni la pantalla se enteren.
 */
export interface ProveedorIngesta {
  nombre: string;
  procesar(archivo: File, origen: OrigenModelo): Promise<ResultadoIngesta>;
}
