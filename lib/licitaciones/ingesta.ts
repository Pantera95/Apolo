import { aNumero, leerCsv, normalizarEncabezado } from "@/lib/dominio/importacion";
import { COMPOSICIONES_DEMO } from "@/lib/licitaciones/composiciones";
import type {
  Disciplina,
  ObraHistorica,
  OrigenModelo,
  ProveedorIngesta,
  RenglonMto,
  ResultadoIngesta,
} from "@/lib/licitaciones/tipos";

/**
 * Ingesta de modelos.
 *
 * Dos caminos, y la pantalla dice cuál se tomó:
 *
 *   REAL       CSV y XML se procesan de verdad, fila por fila.
 *   SIMULADO   `.rvt`, `.ifc` y `.mac` producen un cómputo de ejemplo, porque
 *              leerlos exige APS de pago o una librería WASM que no está.
 *
 * Nunca se presenta un resultado simulado como si viniera del archivo: el
 * `ResultadoIngesta` lleva la bandera y la interfaz la muestra en rojo.
 */

const ALIAS_DISCIPLINA: Record<string, Disciplina> = {
  civil: "civil",
  obracivil: "civil",
  estructural: "estructural",
  estructura: "estructural",
  acero: "estructural",
  mecanica: "mecanica",
  equipos: "mecanica",
  piping: "piping",
  tuberia: "piping",
  tuberias: "piping",
  electricidad: "electricidad",
  electrico: "electricidad",
  instrumentacion: "instrumentacion",
  instrumentos: "instrumentacion",
};

function disciplinaDe(texto: string): Disciplina {
  const k = normalizarEncabezado(texto).replace(/\s+/g, "");
  return ALIAS_DISCIPLINA[k] ?? "civil";
}

function detectarSeparador(texto: string): string {
  const primera = texto.split(/\r?\n/, 1)[0] ?? "";
  const pyc = (primera.match(/;/g) ?? []).length;
  const coma = (primera.match(/,/g) ?? []).length;
  const tab = (primera.match(/\t/g) ?? []).length;
  if (tab > pyc && tab > coma) return "\t";
  return pyc >= coma ? ";" : ",";
}

/**
 * Lector de schedules en CSV.
 *
 * Columnas: disciplina, código, descripción, especificación, unidad, cantidad,
 * desperdicio, costo material, rendimiento HH, costo equipo.
 *
 * Las filas ilegibles se DEVUELVEN como aviso en vez de descartarse: un
 * cómputo al que le faltan tres renglones en silencio produce una oferta por
 * debajo del costo, y nadie se entera hasta que ya se ganó la licitación.
 */
export function leerScheduleCsv(texto: string, archivo: string): ResultadoIngesta {
  const avisos: string[] = [];
  const renglones: RenglonMto[] = [];
  const filas = leerCsv(texto, detectarSeparador(texto));

  for (const [i, f] of filas.entries()) {
    if (f.length < 6) continue;
    const primera = normalizarEncabezado(f[0] ?? "");
    if (primera === "disciplina" || primera === "discipline") continue;

    const cantidad = aNumero(f[5] ?? "");
    if (cantidad === null) {
      avisos.push(`Fila ${i + 1}: cantidad ilegible ("${f[5]}"). No se incluyó.`);
      continue;
    }

    renglones.push({
      id: `${archivo}-${i}`,
      disciplina: disciplinaDe(f[0] ?? ""),
      codigo: (f[1] ?? "").trim() || `ITEM-${i}`,
      descripcion: (f[2] ?? "").trim(),
      especificacion: (f[3] ?? "").trim(),
      unidad: (f[4] ?? "und").trim(),
      cantidadBase: cantidad,
      factorDesperdicio: aNumero(f[6] ?? "") ?? 0,
      costoMaterialUsd: aNumero(f[7] ?? "") ?? 0,
      rendimientoHh: aNumero(f[8] ?? "") ?? 0,
      costoEquipoUsd: aNumero(f[9] ?? "") ?? 0,
    });
  }

  if (renglones.length === 0) {
    avisos.push("No se reconoció ningún renglón. Comprueba el orden de las columnas.");
  }

  return { renglones, origen: "csv", archivo, avisos, simulado: false };
}

/**
 * Lector de reportes XML.
 *
 * Se usa `DOMParser` del navegador y no una librería: el XML de un reporte de
 * SmartPlant o de un schedule de Revit es plano, y meter una dependencia para
 * recorrer nodos sería peso sin ganancia.
 */
export function leerReporteXml(texto: string, archivo: string): ResultadoIngesta {
  const avisos: string[] = [];
  const renglones: RenglonMto[] = [];

  try {
    const doc = new DOMParser().parseFromString(texto, "application/xml");
    if (doc.querySelector("parsererror")) {
      return {
        renglones: [],
        origen: "smartplant",
        archivo,
        avisos: ["El XML está mal formado y no se pudo leer."],
        simulado: false,
      };
    }

    // Se aceptan varios nombres de nodo: cada herramienta usa el suyo.
    const nodos = [
      ...doc.querySelectorAll("Item, Row, Component, Part, Element"),
    ];

    for (const [i, n] of nodos.entries()) {
      const attr = (...nombres: string[]) => {
        for (const nm of nombres) {
          const v = n.getAttribute(nm) ?? n.querySelector(nm)?.textContent;
          if (v) return v.trim();
        }
        return "";
      };

      const cantidad = aNumero(attr("Quantity", "Cantidad", "Qty", "Count"));
      if (cantidad === null) {
        avisos.push(`Nodo ${i + 1}: sin cantidad legible. No se incluyó.`);
        continue;
      }

      renglones.push({
        id: `${archivo}-${i}`,
        disciplina: disciplinaDe(attr("Discipline", "Disciplina", "System")),
        codigo: attr("Code", "Codigo", "Tag", "PartNumber") || `ITEM-${i}`,
        descripcion: attr("Description", "Descripcion", "Name"),
        especificacion: attr("Spec", "Especificacion", "Material", "Grade"),
        unidad: attr("Unit", "Unidad", "UOM") || "und",
        cantidadBase: cantidad,
        factorDesperdicio: aNumero(attr("Waste", "Desperdicio")) ?? 0,
        costoMaterialUsd: aNumero(attr("UnitCost", "CostoMaterial")) ?? 0,
        rendimientoHh: aNumero(attr("ManHours", "RendimientoHH")) ?? 0,
        costoEquipoUsd: aNumero(attr("EquipCost", "CostoEquipo")) ?? 0,
      });
    }

    if (renglones.length === 0) {
      avisos.push("No se encontró ningún nodo de ítem reconocible en el XML.");
    }
  } catch (e) {
    avisos.push(e instanceof Error ? e.message : "Error al leer el XML.");
  }

  return { renglones, origen: "smartplant", archivo, avisos, simulado: false };
}

// ---------------------------------------------------------------------------
// Cómputo simulado
// ---------------------------------------------------------------------------

/**
 * Cómputo de una plataforma de proceso industrial.
 *
 * Cantidades, especificaciones y rendimientos de un orden de magnitud
 * realista para un EPC de este tipo. Es material de DEMOSTRACIÓN y la
 * pantalla lo dice: son los insumos los que se inventan, no los cálculos.
 */
export function computoSimulado(archivo: string, origen: OrigenModelo): ResultadoIngesta {
  const r = (
    id: string,
    disciplina: Disciplina,
    codigo: string,
    descripcion: string,
    especificacion: string,
    unidad: string,
    cantidadBase: number,
    factorDesperdicio: number,
    costoMaterialUsd: number,
    rendimientoHh: number,
    costoEquipoUsd: number,
  ): RenglonMto => ({
    id,
    disciplina,
    codigo,
    descripcion,
    especificacion,
    unidad,
    cantidadBase,
    factorDesperdicio,
    costoMaterialUsd,
    rendimientoHh,
    costoEquipoUsd,
  });

  return {
    origen,
    archivo,
    simulado: true,
    avisos: [
      "Los renglones son de demostración: este formato no se lee en el navegador.",
      "Exporta el schedule a CSV desde la herramienta de origen para procesar el modelo real.",
    ],
    renglones: [
      // --- Civil ---
      r("s1", "civil", "CIV-CON-04", "Vaciado de concreto en fundaciones (incl. curado y encofrado)", "f'c=280 kg/cm²", "m³", 1_500, 0.05, 118, 2.4, 14),
      r("s2", "civil", "CIV-CON-02", "Concreto de limpieza", "f'c=210 kg/cm²", "m³", 180, 0.08, 96, 1.6, 9),
      r("s3", "civil", "CIV-ACE-07", "Acero de refuerzo", "ASTM A615 Gr.60", "kg", 96_500, 0.04, 1.32, 0.035, 0.1),
      r("s4", "civil", "CIV-ENC-09", "Encofrado metálico", "Panel modular", "m²", 3_150, 0.03, 22, 0.55, 3.2),
      r("s5", "civil", "CIV-EXC-01", "Excavación mecánica", "Material tipo II", "m³", 4_800, 0.02, 0, 0.08, 6.4),

      // --- Estructural ---
      r("s6", "estructural", "EST-A36-11", "Acero estructural fabricado y montado", "ASTM A36", "kg", 412_000, 0.05, 2.15, 0.042, 0.28),
      r("s7", "estructural", "EST-GRT-14", "Rejilla de piso galvanizada", "Grating 30x3", "m²", 1_680, 0.04, 78, 0.72, 2.1),
      r("s8", "estructural", "EST-PIN-16", "Pintura de acabado industrial", "Epóxico 3 capas", "m²", 9_400, 0.1, 9.4, 0.18, 0.6),

      // --- Piping ---
      r("s9", "piping", "PIP-TUB-18", "Tubería de acero al carbono 6\"", "ASTM A106 Gr.B Sch 40", "m", 3_820, 0.03, 62, 1.35, 3.8),
      r("s10", "piping", "PIP-TUB-19", "Tubería de acero al carbono 4\"", "ASTM A106 Gr.B Sch 40", "m", 5_140, 0.05, 41, 1.05, 3.1),
      r("s11", "piping", "PIP-TUB-21", "Tubería inoxidable 3\"", "ASTM A312 TP316L Sch 10S", "m", 940, 0.06, 128, 1.65, 4.2),
      r("s12", "piping", "PIP-VAL-23", "Válvula de compuerta 6\" flangeada", "API 600 Clase 150 WCB", "und", 46, 0, 1_840, 9.5, 22),
      r("s13", "piping", "PIP-VAL-24", "Válvula de bola 4\" flangeada", "API 608 Clase 150", "und", 78, 0, 1_120, 7.2, 18),
      r("s14", "piping", "PIP-SOP-26", "Soportería de tubería", "Fabricada en sitio", "kg", 28_400, 0.07, 2.4, 0.055, 0.32),
      r("s15", "piping", "PIP-JUN-27", "Junta soldada de campo", "GTAW raíz + SMAW relleno", "und", 2_340, 0, 12, 3.4, 5.6),

      // --- Mecánica ---
      r("s16", "mecanica", "MEC-EQU-28", "Bomba centrífuga API 610", "OH2 · 150 m³/h · 45 m", "und", 6, 0, 42_000, 62, 180),
      r("s17", "mecanica", "MEC-EQU-29", "Intercambiador de calor", "TEMA AES · 320 m²", "und", 3, 0, 118_000, 96, 340),
      r("s18", "mecanica", "MEC-EQU-30", "Tanque atmosférico", "API 650 · 2.500 m³", "und", 2, 0, 268_000, 480, 1_250),

      // --- Electricidad ---
      r("s19", "electricidad", "ELE-CAB-31", "Cable de potencia 3x120 mm²", "XLPE 15 kV", "m", 4_600, 0.06, 38, 0.28, 1.4),
      r("s20", "electricidad", "ELE-BAN-33", "Bandeja portacables galvanizada", "600 mm · escalera", "m", 2_150, 0.05, 46, 0.42, 1.8),
      r("s21", "electricidad", "ELE-TAB-35", "Centro de control de motores", "480 V · 12 celdas", "und", 4, 0, 62_000, 88, 240),
      r("s22", "electricidad", "ELE-ILU-36", "Luminaria LED antiexplosión", "Clase I Div 2 · 150 W", "und", 186, 0.03, 620, 2.8, 4.5),

      // --- Instrumentación ---
      r("s23", "instrumentacion", "INS-TRA-38", "Transmisor de presión", "4-20 mA HART · SIL 2", "und", 94, 0, 1_450, 6.4, 12),
      r("s24", "instrumentacion", "INS-VAL-40", "Válvula de control", "Globo 3\" · posicionador digital", "und", 22, 0, 8_900, 18, 42),
      r("s25", "instrumentacion", "INS-CAB-42", "Cable de instrumentación apantallado", "2x1.5 mm² · par trenzado", "m", 8_200, 0.1, 6.8, 0.14, 0.5),
    ].map(conComposicion),
  };
}

/**
 * Adjunta la composición de la base de precios, cuando existe para ese código.
 *
 * Se hace aquí y no dentro de `r()` porque la composición NO viene del modelo:
 * viene de la base de la empresa, y mezclarlas en el mismo sitio haría pensar
 * que el archivo BIM trae la cuadrilla tipo. No la trae.
 */
function conComposicion(renglon: RenglonMto): RenglonMto {
  const c = COMPOSICIONES_DEMO[renglon.codigo];
  return c ? { ...renglon, composicion: c } : renglon;
}

/** Obras ya ejecutadas, para comparar la estimación contra la historia. */
export const HISTORICO_DEMO: ObraHistorica[] = [
  {
    codigo: "OBR-2201", nombre: "Ampliación planta deshidratadora", anio: 2023,
    pvUsd: 4_200_000, evUsd: 3_990_000, acUsd: 4_305_000,
    horasHombre: 128_400, toneladasAcero: 320, m3Concreto: 1_850,
  },
  {
    codigo: "OBR-2204", nombre: "Estación de bombeo norte", anio: 2023,
    pvUsd: 2_650_000, evUsd: 2_650_000, acUsd: 2_490_000,
    horasHombre: 74_200, toneladasAcero: 186, m3Concreto: 980,
  },
  {
    codigo: "OBR-2308", nombre: "Sistema contra incendio", anio: 2024,
    pvUsd: 1_820_000, evUsd: 1_620_000, acUsd: 1_940_000,
    horasHombre: 58_600, toneladasAcero: 142, m3Concreto: 640,
  },
  {
    codigo: "OBR-2402", nombre: "Módulo de separación trifásica", anio: 2025,
    pvUsd: 6_400_000, evUsd: 6_080_000, acUsd: 6_210_000,
    horasHombre: 172_000, toneladasAcero: 448, m3Concreto: 2_240,
  },
];

// ---------------------------------------------------------------------------
// Proveedor
// ---------------------------------------------------------------------------

/**
 * Elige el lector según el formato.
 *
 * El origen que declara el usuario NO manda sobre el contenido: si dice
 * "Revit" pero sube un CSV, se lee el CSV. Fiarse de la etiqueta produciría un
 * cómputo simulado teniendo el real delante.
 */
export function ingestaLocal(): ProveedorIngesta {
  return {
    nombre: "local",
    async procesar(archivo, origen) {
      const nombre = archivo.name.toLowerCase();

      if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
        return leerScheduleCsv(await archivo.text(), archivo.name);
      }
      if (nombre.endsWith(".xml")) {
        return leerReporteXml(await archivo.text(), archivo.name);
      }
      return computoSimulado(archivo.name, origen);
    },
  };
}

/**
 * Escapa un campo para CSV.
 *
 * HACE FALTA DE VERDAD EN ESTE DOMINIO: los diámetros de tubería se escriben
 * con la marca de pulgada —`6"`, `3/4"`—, y una comilla suelta en medio de un
 * campo rompe el parseo y se pierde el renglón entero. La regla del formato es
 * envolver el campo en comillas y duplicar las de dentro.
 */
function escapar(valor: string, separador = ";"): string {
  const necesita = valor.includes('"') || valor.includes(separador) || /[\r\n]/.test(valor);
  if (!necesita) return valor;
  return `"${valor.replace(/"/g, '""')}"`;
}

/** Plantilla del schedule, para que nadie tenga que adivinar el orden. */
export function plantillaScheduleCsv(): string {
  return [
    [
      "Disciplina", "Codigo", "Descripcion", "Especificacion", "Unidad",
      "Cantidad", "Desperdicio", "Costo material", "Rendimiento HH", "Costo equipo",
    ],
    ["Civil", "CON-280", "Concreto fundaciones", "f'c=280 kg/cm2", "m3", "1240", "0.06", "118", "2.4", "14"],
    ["Piping", "TUB-A106-6", 'Tuberia 6"', "ASTM A106 Gr.B Sch 40", "m", "3820", "0.05", "62", "1.35", "3.8"],
  ]
    .map((f) => f.map((c) => escapar(c)).join(";"))
    .join("\r\n");
}
