import type { Disciplina } from "@/lib/licitaciones/tipos";

/**
 * Modelos de muestra, precargados para demostración.
 *
 * SON SCHEDULES EN CSV DE VERDAD, no cómputos simulados. Se escriben como
 * texto y pasan por el mismo lector que usaría un export real de Revit, así
 * que la demostración prueba el camino que el cliente va a usar — no un atajo
 * que solo funciona en la presentación.
 *
 * Los DATOS son ficticios: cantidades, precios y rendimientos de un orden de
 * magnitud realista para cada tipo de obra, pero inventados. El documento lo
 * declara en todas sus páginas.
 *
 * Cuatro obras distintas y no cuatro copias de la misma: cada una carga el
 * peso en una disciplina diferente, de modo que el desglose, la ruta crítica y
 * la matriz de cotización salen distintos. Cuatro variantes del mismo proyecto
 * enseñarían siempre el mismo gráfico.
 */

export interface ModeloDemo {
  id: string;
  nombre: string;
  /** Qué enseña este modelo que los otros no. */
  gancho: string;
  archivo: string;
  disciplinaDominante: Disciplina;
  filas: Fila[];
}

type Fila = [
  disciplina: string,
  codigo: string,
  descripcion: string,
  especificacion: string,
  unidad: string,
  cantidad: number,
  desperdicio: number,
  costoMaterial: number,
  rendimientoHh: number,
  costoEquipo: number,
];

export const MODELOS_DEMO: ModeloDemo[] = [
  {
    id: "plataforma",
    nombre: "Plataforma de procesamiento · Fase 1",
    gancho: "Obra completa, seis disciplinas. El caso grande.",
    archivo: "plataforma-procesamiento-fase1.csv",
    disciplinaDominante: "estructural",
    filas: [
      ["Civil", "CIV-CON-04", "Vaciado de concreto en fundaciones (incl. curado y encofrado)", "f'c=280 kg/cm2", "m3", 1500, 0.05, 118, 2.4, 14],
      ["Civil", "CIV-CON-02", "Concreto de limpieza", "f'c=210 kg/cm2", "m3", 180, 0.08, 96, 1.6, 9],
      ["Civil", "CIV-ACE-07", "Acero de refuerzo", "ASTM A615 Gr.60", "kg", 96500, 0.04, 1.32, 0.035, 0.1],
      ["Civil", "CIV-ENC-09", "Encofrado metalico", "Panel modular", "m2", 3150, 0.03, 22, 0.55, 3.2],
      ["Civil", "CIV-EXC-01", "Excavacion mecanica", "Material tipo II", "m3", 4800, 0.02, 0, 0.08, 6.4],
      ["Estructural", "EST-A36-11", "Acero estructural fabricado y montado", "ASTM A36", "kg", 412000, 0.05, 2.15, 0.042, 0.28],
      ["Estructural", "EST-GRT-14", "Rejilla de piso galvanizada", "Grating 30x3", "m2", 1680, 0.04, 78, 0.72, 2.1],
      ["Estructural", "EST-PIN-16", "Pintura de acabado industrial", "Epoxico 3 capas", "m2", 9400, 0.1, 9.4, 0.18, 0.6],
      ["Piping", "PIP-TUB-18", 'Tuberia de acero al carbono 6"', "ASTM A106 Gr.B Sch 40", "m", 3820, 0.03, 62, 1.35, 3.8],
      ["Piping", "PIP-TUB-19", 'Tuberia de acero al carbono 4"', "ASTM A106 Gr.B Sch 40", "m", 5140, 0.05, 41, 1.05, 3.1],
      ["Piping", "PIP-VAL-23", 'Valvula de compuerta 6" flangeada', "API 600 Clase 150 WCB", "und", 46, 0, 1840, 9.5, 22],
      ["Piping", "PIP-SOP-26", "Soporteria de tuberia", "Fabricada en sitio", "kg", 28400, 0.07, 2.4, 0.055, 0.32],
      ["Piping", "PIP-JUN-27", "Junta soldada de campo", "GTAW raiz + SMAW relleno", "und", 2340, 0, 12, 3.4, 5.6],
      ["Mecanica", "MEC-EQU-28", "Bomba centrifuga API 610", "OH2 · 150 m3/h · 45 m", "und", 6, 0, 42000, 62, 180],
      ["Mecanica", "MEC-EQU-29", "Intercambiador de calor", "TEMA AES · 320 m2", "und", 3, 0, 118000, 96, 340],
      ["Mecanica", "MEC-EQU-30", "Tanque atmosferico", "API 650 · 2.500 m3", "und", 2, 0, 268000, 480, 1250],
      ["Electricidad", "ELE-CAB-31", "Cable de potencia 3x120 mm2", "XLPE 15 kV", "m", 4600, 0.06, 38, 0.28, 1.4],
      ["Electricidad", "ELE-BAN-33", "Bandeja portacables galvanizada", "600 mm · escalera", "m", 2150, 0.05, 46, 0.42, 1.8],
      ["Electricidad", "ELE-TAB-35", "Centro de control de motores", "480 V · 12 celdas", "und", 4, 0, 62000, 88, 240],
      ["Electricidad", "ELE-ILU-36", "Luminaria LED antiexplosion", "Clase I Div 2 · 150 W", "und", 186, 0.03, 620, 2.8, 4.5],
      ["Instrumentacion", "INS-TRA-38", "Transmisor de presion", "4-20 mA HART · SIL 2", "und", 94, 0, 1450, 6.4, 12],
      ["Instrumentacion", "INS-VAL-40", "Valvula de control", 'Globo 3" · posicionador digital', "und", 22, 0, 8900, 18, 42],
      ["Instrumentacion", "INS-CAB-42", "Cable de instrumentacion apantallado", "2x1.5 mm2 · par trenzado", "m", 8200, 0.1, 6.8, 0.14, 0.5],
    ],
  },

  {
    id: "bombeo",
    nombre: "Estación de bombeo de crudo EB-04",
    gancho: "Dominada por piping y mecánica. La ruta crítica cambia de frente.",
    archivo: "estacion-bombeo-eb04.csv",
    disciplinaDominante: "piping",
    filas: [
      ["Civil", "CIV-CON-04", "Vaciado de concreto en bases de bombas", "f'c=280 kg/cm2", "m3", 340, 0.05, 118, 2.4, 14],
      ["Civil", "CIV-ACE-07", "Acero de refuerzo en bases y pedestales", "ASTM A615 Gr.60", "kg", 22400, 0.04, 1.32, 0.035, 0.1],
      ["Piping", "PIP-TUB-18", 'Tuberia de succion y descarga 6"', "ASTM A106 Gr.B Sch 40", "m", 1840, 0.03, 62, 1.35, 3.8],
      ["Piping", "PIP-TUB-21", 'Tuberia de proceso inoxidable 3"', "ASTM A312 TP316L Sch 10S", "m", 620, 0.06, 128, 1.65, 4.2],
      ["Piping", "PIP-VAL-23", 'Valvula de compuerta 6" flangeada', "API 600 Clase 150 WCB", "und", 38, 0, 1840, 9.5, 22],
      ["Piping", "PIP-VAL-24", 'Valvula de retencion 6" flangeada', "API 594 Clase 150", "und", 16, 0, 1420, 8.1, 19],
      ["Piping", "PIP-JUN-27", "Junta soldada de campo", "GTAW raiz + SMAW relleno", "und", 1180, 0, 12, 3.4, 5.6],
      ["Piping", "PIP-SOP-26", "Soporteria de tuberia y anclajes", "Fabricada en sitio", "kg", 9600, 0.07, 2.4, 0.055, 0.32],
      ["Mecanica", "MEC-EQU-28", "Bomba centrifuga API 610 principal", "BB2 · 320 m3/h · 120 m", "und", 4, 0, 96000, 84, 260],
      ["Mecanica", "MEC-EQU-31", "Bomba booster de respaldo", "OH2 · 180 m3/h · 40 m", "und", 2, 0, 38000, 52, 165],
      ["Mecanica", "MEC-FIL-32", "Filtro tipo canasta de succion", 'Carcasa acero al carbono 8"', "und", 6, 0, 7400, 14, 32],
      ["Electricidad", "ELE-CAB-31", "Cable de potencia a motores", "XLPE 5 kV", "m", 1420, 0.06, 38, 0.28, 1.4],
      ["Electricidad", "ELE-TAB-35", "Arrancador suave y tablero de fuerza", "480 V · 6 celdas", "und", 2, 0, 48000, 76, 210],
      ["Instrumentacion", "INS-TRA-38", "Transmisor de presion en descarga", "4-20 mA HART · SIL 2", "und", 24, 0, 1450, 6.4, 12],
      ["Instrumentacion", "INS-FLU-44", "Medidor de flujo tipo coriolis", 'DN 150 · brida clase 150', "und", 4, 0, 18600, 22, 48],
    ],
  },

  {
    id: "tanques",
    nombre: "Patio de tanques · 2 × 5.000 m³",
    gancho: "Casi todo acero. Dispara la alerta de rendimiento con fuerza.",
    archivo: "patio-tanques-api650.csv",
    disciplinaDominante: "estructural",
    filas: [
      ["Civil", "CIV-EXC-01", "Excavacion y conformacion de dique", "Material tipo II", "m3", 12400, 0.02, 0, 0.08, 6.4],
      ["Civil", "CIV-CON-04", "Vaciado de concreto en anillo de fundacion", "f'c=280 kg/cm2", "m3", 980, 0.05, 118, 2.4, 14],
      ["Civil", "CIV-ACE-07", "Acero de refuerzo en anillo y losa", "ASTM A615 Gr.60", "kg", 74200, 0.04, 1.32, 0.035, 0.1],
      ["Civil", "CIV-IMP-12", "Membrana impermeabilizante de dique", "HDPE 1.5 mm", "m2", 4800, 0.08, 14, 0.22, 0.9],
      ["Estructural", "EST-A36-11", "Placa de fondo y envolvente de tanque", "ASTM A36 · API 650", "kg", 245000, 0.05, 2.15, 0.042, 0.28],
      ["Estructural", "EST-TEC-13", "Techo flotante interno de aluminio", "API 650 Apendice H", "m2", 640, 0.03, 168, 1.4, 4.6],
      ["Estructural", "EST-ESC-15", "Escalera helicoidal y baranda perimetral", "ASTM A36 galvanizado", "kg", 18600, 0.06, 2.65, 0.058, 0.34],
      ["Estructural", "EST-PIN-16", "Pintura y recubrimiento interno epoxico", "Epoxico fenolico 3 capas", "m2", 8900, 0.1, 16.4, 0.24, 0.7],
      ["Piping", "PIP-TUB-18", 'Tuberia de llenado y vaciado 8"', "ASTM A106 Gr.B Sch 40", "m", 740, 0.03, 88, 1.55, 4.2],
      ["Piping", "PIP-VAL-23", 'Valvula de compuerta 8" flangeada', "API 600 Clase 150 WCB", "und", 14, 0, 2680, 11.5, 26],
      ["Electricidad", "ELE-CAB-31", "Cable de puesta a tierra y proteccion catodica", "Cobre desnudo 70 mm2", "m", 1180, 0.06, 22, 0.24, 1.1],
      ["Instrumentacion", "INS-NIV-46", "Medidor de nivel por radar", "Guiado · certificado custody transfer", "und", 4, 0, 12800, 18, 36],
      ["Instrumentacion", "INS-TRA-38", "Transmisor de temperatura multipunto", "RTD · 6 puntos", "und", 8, 0, 3200, 9.2, 14],
    ],
  },

  {
    id: "subestacion",
    nombre: "Subestación eléctrica 34,5 / 13,8 kV",
    gancho: "Electricidad e instrumentación. Poco acero: el benchmark no aplica.",
    archivo: "subestacion-34kv.csv",
    disciplinaDominante: "electricidad",
    filas: [
      ["Civil", "CIV-CON-04", "Vaciado de concreto en fundaciones de equipos", "f'c=280 kg/cm2", "m3", 260, 0.05, 118, 2.4, 14],
      ["Civil", "CIV-ACE-07", "Acero de refuerzo", "ASTM A615 Gr.60", "kg", 16800, 0.04, 1.32, 0.035, 0.1],
      ["Civil", "CIV-CAN-05", "Canalizacion electrica y bancada de ductos", "PVC Sch 40 embebido", "m", 1240, 0.05, 34, 0.62, 2.4],
      ["Estructural", "EST-A36-11", "Estructura soporte de barras y porticos", "ASTM A36 galvanizado", "kg", 42600, 0.05, 2.45, 0.048, 0.3],
      ["Electricidad", "ELE-TRA-30", "Transformador de potencia 34,5/13,8 kV", "10 MVA · ONAN/ONAF", "und", 2, 0, 285000, 320, 980],
      ["Electricidad", "ELE-CEL-32", "Celda de media tension con interruptor", "15 kV · 1250 A · vacio", "und", 12, 0, 34600, 46, 128],
      ["Electricidad", "ELE-CAB-31", "Cable de potencia 3x240 mm2", "XLPE 15 kV", "m", 3800, 0.06, 68, 0.34, 1.6],
      ["Electricidad", "ELE-BAN-33", "Bandeja portacables galvanizada", "900 mm · escalera", "m", 1680, 0.05, 62, 0.48, 2.1],
      ["Electricidad", "ELE-TIE-37", "Malla de puesta a tierra", "Cobre desnudo 70 mm2 + jabalinas", "m", 2400, 0.08, 24, 0.26, 1.2],
      ["Electricidad", "ELE-ILU-36", "Iluminacion de patio y emergencia", "LED 200 W · IP66", "und", 84, 0.03, 480, 2.4, 4.1],
      ["Instrumentacion", "INS-REL-48", "Rele de proteccion multifuncion", "IEC 61850 · IED", "und", 18, 0, 8600, 16, 34],
      ["Instrumentacion", "INS-CAB-42", "Cable de control y senal apantallado", "2x1.5 mm2 · par trenzado", "m", 5600, 0.1, 6.8, 0.14, 0.5],
      ["Instrumentacion", "INS-SCA-50", "Estacion de operacion SCADA", "Servidor redundante + HMI", "und", 2, 0, 42000, 64, 96],
    ],
  },
];

/**
 * Escapa un campo para CSV.
 *
 * Hace falta de verdad aquí: los diámetros van con marca de pulgada —`6"`,
 * `3/4"`— y una comilla suelta rompe el parseo y pierde el renglón entero.
 */
function escapar(valor: string, separador = ";"): string {
  const necesita = valor.includes('"') || valor.includes(separador) || /[\r\n]/.test(valor);
  return necesita ? `"${valor.replace(/"/g, '""')}"` : valor;
}

const CABECERA = [
  "Disciplina",
  "Codigo",
  "Descripcion",
  "Especificacion",
  "Unidad",
  "Cantidad",
  "Desperdicio",
  "Costo material",
  "Rendimiento HH",
  "Costo equipo",
];

/** El schedule como texto CSV, tal cual lo exportaría la herramienta de diseño. */
export function csvDeModelo(m: ModeloDemo): string {
  return [CABECERA, ...m.filas.map((f) => f.map(String))]
    .map((f) => f.map((c) => escapar(c)).join(";"))
    .join("\r\n");
}

/** El modelo como `File`, para meterlo por el mismo camino que un archivo real. */
export function archivoDeModelo(m: ModeloDemo): File {
  // Con BOM: si alguien lo abre en Excel en español, las tildes y los acentos
  // se ven bien en vez de salir como caracteres rotos.
  return new File(["﻿" + csvDeModelo(m)], m.archivo, { type: "text/csv" });
}
