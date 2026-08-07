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
  /** Indirectos y administración, sobre el costo directo. 0.18 = 18%. */
  overhead: number;
  /** Utilidad esperada, sobre el costo con indirectos. */
  utilidad: number;
  /** Desperdicio por defecto cuando el renglón no trae el suyo. */
  desperdicioPorDefecto: number;
}

export const PARAMETROS_INICIALES: Parametros = {
  // Escala de un EPC industrial mediano: seis frentes de doce personas.
  cuadrillas: 6,
  personasPorCuadrilla: 12,
  horasJornada: 8,
  costoHoraHombreUsd: 6.5,
  fas: 2.0,
  overhead: 0.18,
  utilidad: 0.12,
  desperdicioPorDefecto: 0.05,
};

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

/** Análisis de Precio Unitario de un renglón, desglosado. */
export interface Apu {
  renglon: RenglonMto;
  cantidadFinal: number;
  materialesUsd: number;
  manoObraUsd: number;
  equiposUsd: number;
  costoDirectoUsd: number;
  indirectosUsd: number;
  utilidadUsd: number;
  /** Precio unitario de venta, ya con indirectos y utilidad. */
  precioUnitarioUsd: number;
  totalUsd: number;
  horasHombre: number;
  diasEstimados: number;
}

export interface Estimacion {
  apus: Apu[];
  totalMaterialesUsd: number;
  totalManoObraUsd: number;
  totalEquiposUsd: number;
  totalDirectoUsd: number;
  totalIndirectosUsd: number;
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
