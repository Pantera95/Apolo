import { firmasExigidas } from "@/lib/procura/nucleo";
import type { FirmaDoa, ProcesoProcura } from "@/lib/procura/tipos";

/**
 * Expedientes de demostración.
 *
 * Uno por etapa, y no cinco variantes del mismo: el tablero tiene que enseñar
 * el ciclo entero de un vistazo. Cada uno lleva además una situación distinta
 * —una fuente única, una oferta rechazada por norma, un FOB que parece barato—
 * para que las reglas se vean funcionando y no solo declaradas.
 *
 * Datos ficticios. Los proveedores son inventados.
 */

const dias = (n: number) => {
  const d = new Date("2026-08-07T12:00:00.000Z");
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const firmas = (monto: number, firmadas: number): FirmaDoa[] =>
  firmasExigidas(monto).map((rol, i) => ({
    rol,
    nombre: ["C. Mendoza", "R. Salazar", "A. Perdomo", "Comité"][i] ?? "—",
    firmadoIso: i < firmadas ? dias(6 - i) : null,
  }));

export const PROCESOS_DEMO: ProcesoProcura[] = [
  // --- 1.1 Requisición: le falta una ficha técnica, así que no avanza ------
  {
    id: "prc-1",
    codigo: "PROC-2026-014",
    titulo: "Válvulas de control para planta deshidratadora",
    etapa: "requisicion",
    departamento: "Ingeniería de Procesos",
    obraId: null,
    criticidad: "alta",
    presupuestoUsd: 186_000,
    adjudicadoUsd: null,
    partidaPresupuestaria: "CAPEX-2026-03",
    creadoIso: dias(9),
    ordenAprobadaIso: null,
    partidas: [
      { id: "p1", descripcion: 'Válvula de control globo 3"', cantidad: 12, unidad: "und", norma: "ISA 75.01 · ASME B16.5", fichaTecnicaUrl: "/fichas/val-globo-3.pdf" },
      { id: "p2", descripcion: "Posicionador digital HART", cantidad: 12, unidad: "und", norma: "IEC 61508 SIL 2", fichaTecnicaUrl: "/fichas/posicionador.pdf" },
      // Sin ficha: es lo que mantiene el expediente en esta etapa.
      { id: "p3", descripcion: "Actuador neumático de resorte", cantidad: 12, unidad: "und", norma: "ASME B16.34", fichaTecnicaUrl: null },
    ],
    ofertas: [],
    aclaraciones: [],
    orden: null,
  },

  // --- 1.2 Licitación: dos aclaraciones, una abierta ----------------------
  {
    id: "prc-2",
    codigo: "PROC-2026-011",
    titulo: "Tubería de acero al carbono y accesorios · línea de crudo",
    etapa: "licitacion",
    departamento: "Procura",
    obraId: null,
    criticidad: "critica",
    presupuestoUsd: 742_000,
    adjudicadoUsd: null,
    partidaPresupuestaria: "CAPEX-2026-01",
    creadoIso: dias(24),
    ordenAprobadaIso: null,
    partidas: [
      { id: "p1", descripcion: 'Tubería ASTM A106 Gr.B Sch 40 · 6"', cantidad: 3_820, unidad: "m", norma: "ASTM A106 · ASME B31.3", fichaTecnicaUrl: "/fichas/a106-6.pdf" },
      { id: "p2", descripcion: "Accesorios: codos, tees y reducciones", cantidad: 640, unidad: "und", norma: "ASME B16.9", fichaTecnicaUrl: "/fichas/accesorios.pdf" },
    ],
    ofertas: [
      { id: "of1", proveedorId: "v1", proveedorNombre: "Tubulares del Caribe", puntajeTecnico: null, precioUsd: 698_000, incoterm: "FOB", fleteUsd: 41_000, seguroUsd: 6_200, aduanaUsd: 22_400, entregaSemanas: 14, creditoDias: 45, estado: "en_revision", excepciones: [] },
      { id: "of2", proveedorId: "v2", proveedorNombre: "Aceros Industriales C.A.", puntajeTecnico: null, precioUsd: 764_000, incoterm: "DDP", fleteUsd: 0, seguroUsd: 0, aduanaUsd: 0, entregaSemanas: 10, creditoDias: 30, estado: "en_revision", excepciones: [] },
      { id: "of3", proveedorId: "v3", proveedorNombre: "Global Pipe Supply", puntajeTecnico: null, precioUsd: 721_000, incoterm: "CIF", fleteUsd: 28_000, seguroUsd: 4_100, aduanaUsd: 19_800, entregaSemanas: 12, creditoDias: 60, estado: "en_revision", excepciones: ["Certificado de colada por lote, no por pieza"] },
    ],
    aclaraciones: [
      { id: "a1", proveedorNombre: "Aceros Industriales C.A.", pregunta: "¿Se acepta Sch 80 en los tramos enterrados?", respuesta: "Sí, con el mismo grado. Se emite boletín 01.", emiteBoletin: true, fechaIso: dias(11) },
      // Abierta: bloquea el paso a evaluación.
      { id: "a2", proveedorNombre: "Global Pipe Supply", pregunta: "¿El certificado de colada se exige por pieza o por lote?", respuesta: null, emiteBoletin: false, fechaIso: dias(4) },
    ],
    orden: null,
  },

  // --- 1.3 Evaluación: el FOB barato pierde al desembarcar ----------------
  {
    id: "prc-3",
    codigo: "PROC-2026-008",
    titulo: "Bombas centrífugas API 610 · estación EB-04",
    etapa: "evaluacion",
    departamento: "Mecánica",
    obraId: null,
    criticidad: "critica",
    presupuestoUsd: 468_000,
    adjudicadoUsd: null,
    partidaPresupuestaria: "CAPEX-2026-01",
    creadoIso: dias(41),
    ordenAprobadaIso: null,
    partidas: [
      { id: "p1", descripcion: "Bomba centrífuga API 610 BB2", cantidad: 4, unidad: "und", norma: "API 610 11ª ed.", fichaTecnicaUrl: "/fichas/api610.pdf" },
      { id: "p2", descripcion: "Bomba booster OH2", cantidad: 2, unidad: "und", norma: "API 610 11ª ed.", fichaTecnicaUrl: "/fichas/oh2.pdf" },
    ],
    ofertas: [
      // Parece la más barata en la columna de precio; con flete y aduana
      // desembarca por encima de la siguiente.
      { id: "of1", proveedorId: "v4", proveedorNombre: "Hidromecánica Andina", puntajeTecnico: 82, precioUsd: 392_000, incoterm: "FOB", fleteUsd: 47_000, seguroUsd: 5_800, aduanaUsd: 31_000, entregaSemanas: 22, creditoDias: 30, estado: "aprobada_tecnica", excepciones: [] },
      { id: "of2", proveedorId: "v5", proveedorNombre: "PumpTech International", puntajeTecnico: 91, precioUsd: 448_000, incoterm: "DDP", fleteUsd: 0, seguroUsd: 0, aduanaUsd: 0, entregaSemanas: 16, creditoDias: 45, estado: "aprobada_tecnica", excepciones: [] },
      // Rechazada: sigue en el cuadro, para que se vea a quién se dejó fuera.
      { id: "of3", proveedorId: "v6", proveedorNombre: "Equipos del Sur", puntajeTecnico: 54, precioUsd: 338_000, incoterm: "DDP", fleteUsd: 0, seguroUsd: 0, aduanaUsd: 0, entregaSemanas: 12, creditoDias: 15, estado: "rechazada_tecnica", excepciones: ["No cumple API 610 11ª ed.", "Sello mecánico sin certificar API 682"] },
    ],
    aclaraciones: [
      { id: "a1", proveedorNombre: "PumpTech International", pregunta: "¿Se exige prueba de desempeño con testigo?", respuesta: "Sí, con testigo del cliente en fábrica.", emiteBoletin: false, fechaIso: dias(28) },
    ],
    orden: null,
  },

  // --- 1.4 Adjudicación: firmas a medias ----------------------------------
  {
    id: "prc-4",
    codigo: "PROC-2026-005",
    titulo: "Cable de potencia XLPE 15 kV y bandeja portacables",
    etapa: "adjudicacion",
    departamento: "Electricidad",
    obraId: null,
    criticidad: "normal",
    presupuestoUsd: 264_000,
    adjudicadoUsd: 241_500,
    partidaPresupuestaria: "CAPEX-2026-02",
    creadoIso: dias(58),
    ordenAprobadaIso: null,
    partidas: [
      { id: "p1", descripcion: "Cable XLPE 15 kV 3x120 mm²", cantidad: 4_600, unidad: "m", norma: "IEC 60502-2", fichaTecnicaUrl: "/fichas/xlpe.pdf" },
      { id: "p2", descripcion: "Bandeja portacables galvanizada 600 mm", cantidad: 2_150, unidad: "m", norma: "NEMA VE 1", fichaTecnicaUrl: "/fichas/bandeja.pdf" },
    ],
    ofertas: [
      { id: "of1", proveedorId: "v7", proveedorNombre: "Conductores Nacionales", puntajeTecnico: 88, precioUsd: 241_500, incoterm: "DDP", fleteUsd: 0, seguroUsd: 0, aduanaUsd: 0, entregaSemanas: 9, creditoDias: 45, estado: "adjudicada", excepciones: [] },
      { id: "of2", proveedorId: "v8", proveedorNombre: "ElectroSuministros", puntajeTecnico: 79, precioUsd: 258_000, incoterm: "DAP", fleteUsd: 0, seguroUsd: 0, aduanaUsd: 9_400, entregaSemanas: 11, creditoDias: 30, estado: "aprobada_tecnica", excepciones: [] },
      { id: "of3", proveedorId: "v9", proveedorNombre: "Cables del Orinoco", puntajeTecnico: 61, precioUsd: 229_000, incoterm: "EXW", fleteUsd: 14_000, seguroUsd: 2_100, aduanaUsd: 8_600, entregaSemanas: 15, creditoDias: 0, estado: "rechazada_tecnica", excepciones: ["Sin ensayo de retardo de llama IEC 60332-3"] },
    ],
    aclaraciones: [],
    orden: {
      numero: "OC-2026-0117",
      montoUsd: 241_500,
      estadoAprobacion: "en_firmas",
      firmas: firmas(241_500, 1),
      acusadaIso: null,
      pdfUrl: null,
      estadoFinanciero: "sin_iniciar",
    },
  },

  // --- 1.5 Cierre: facturado pero sin pagar -------------------------------
  {
    id: "prc-5",
    codigo: "PROC-2026-002",
    titulo: "Instrumentación de campo · transmisores y válvulas",
    etapa: "cierre",
    departamento: "Instrumentación",
    obraId: null,
    criticidad: "normal",
    presupuestoUsd: 198_000,
    adjudicadoUsd: 172_400,
    partidaPresupuestaria: "CAPEX-2026-02",
    creadoIso: dias(96),
    ordenAprobadaIso: dias(38),
    partidas: [
      { id: "p1", descripcion: "Transmisor de presión HART SIL 2", cantidad: 94, unidad: "und", norma: "IEC 61508 SIL 2", fichaTecnicaUrl: "/fichas/transmisor.pdf" },
    ],
    ofertas: [
      { id: "of1", proveedorId: "v10", proveedorNombre: "Instrumentos Delta", puntajeTecnico: 94, precioUsd: 172_400, incoterm: "DDP", fleteUsd: 0, seguroUsd: 0, aduanaUsd: 0, entregaSemanas: 8, creditoDias: 60, estado: "adjudicada", excepciones: [] },
      { id: "of2", proveedorId: "v11", proveedorNombre: "Field Systems", puntajeTecnico: 86, precioUsd: 181_000, incoterm: "CIF", fleteUsd: 6_400, seguroUsd: 1_100, aduanaUsd: 7_900, entregaSemanas: 10, creditoDias: 30, estado: "aprobada_tecnica", excepciones: [] },
      { id: "of3", proveedorId: "v12", proveedorNombre: "Medición Total", puntajeTecnico: 71, precioUsd: 189_500, incoterm: "DDP", fleteUsd: 0, seguroUsd: 0, aduanaUsd: 0, entregaSemanas: 14, creditoDias: 45, estado: "aprobada_tecnica", excepciones: [] },
    ],
    aclaraciones: [
      { id: "a1", proveedorNombre: "Field Systems", pregunta: "¿Se acepta calibración de fábrica sin certificado trazable?", respuesta: "No. Se exige certificado trazable a patrón nacional.", emiteBoletin: true, fechaIso: dias(74) },
    ],
    orden: {
      numero: "OC-2026-0091",
      montoUsd: 172_400,
      estadoAprobacion: "acusada",
      firmas: firmas(172_400, 2),
      acusadaIso: dias(35),
      pdfUrl: "/oc/OC-2026-0091.pdf",
      // Facturado pero no pagado: es lo que mantiene abierto el cierre.
      estadoFinanciero: "facturado",
    },
  },
];
