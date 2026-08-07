import type { Composicion } from "@/lib/licitaciones/tipos";

/**
 * Composiciones de precio unitario de la base de la empresa.
 *
 * NO SALEN DEL MODELO BIM y es importante entender por qué: un schedule de
 * Revit sabe que hay 1.240 m³ de concreto, pero no sabe que vaciarlos requiere
 * un capataz, dos encofradores y tres ayudantes por cada m³. Eso es la base de
 * precios de la constructora, que se construye con años de obra ejecutada y es
 * el activo que de verdad diferencia una oferta de otra.
 *
 * Aquí van las de demostración, indexadas por código de renglón. Los renglones
 * sin entrada emiten un APU agregado y el documento lo declara.
 */
export const COMPOSICIONES_DEMO: Record<string, Composicion> = {
  // Calcada de la planilla del cliente, línea por línea. Sirve de prueba viva:
  // si el motor cambia y este APU deja de dar 297,73 USD/m³, algo se rompió.
  "CIV-CON-04": {
    materiales: [
      { descripcion: "Concreto premezclado 280 kg/cm²", unidad: "m³", cantidadPorUnidad: 1.05, precioUnitarioUsd: 115 },
      { descripcion: "Madera de encofrado", unidad: "m²", cantidadPorUnidad: 2.2, precioUnitarioUsd: 12.5 },
      { descripcion: "Desmoldante y curador", unidad: "Gl", cantidadPorUnidad: 0.15, precioUnitarioUsd: 18 },
    ],
    equipos: [
      { descripcion: "Bomba de concreto 32 m", unidad: "HM", rendimientoPorUnidad: 0.05, precioUnitarioUsd: 180 },
      { descripcion: "Vibrador de concreto 2 HP", unidad: "HM", rendimientoPorUnidad: 0.1, precioUnitarioUsd: 15 },
    ],
    cuadrilla: [
      { categoria: "Capataz", hhPorUnidad: 0.1, tarifaHoraUsd: 25 },
      { categoria: "Oficial encofrador / concretero", hhPorUnidad: 0.8, tarifaHoraUsd: 18 },
      { categoria: "Ayudante / peón", hhPorUnidad: 1.2, tarifaHoraUsd: 12 },
    ],
    herramientasMenoresPct: 0.05,
  },

  "CIV-ACE-07": {
    materiales: [
      { descripcion: "Cabilla ASTM A615 Gr.60", unidad: "kg", cantidadPorUnidad: 1.04, precioUnitarioUsd: 1.18 },
      { descripcion: "Alambre de amarre recocido", unidad: "kg", cantidadPorUnidad: 0.02, precioUnitarioUsd: 2.4 },
      { descripcion: "Separadores plásticos", unidad: "und", cantidadPorUnidad: 0.35, precioUnitarioUsd: 0.18 },
    ],
    equipos: [
      { descripcion: "Cizalla y dobladora eléctrica", unidad: "HM", rendimientoPorUnidad: 0.012, precioUnitarioUsd: 9.5 },
    ],
    cuadrilla: [
      { categoria: "Capataz", hhPorUnidad: 0.004, tarifaHoraUsd: 25 },
      { categoria: "Oficial cabillero", hhPorUnidad: 0.022, tarifaHoraUsd: 18 },
      { categoria: "Ayudante", hhPorUnidad: 0.018, tarifaHoraUsd: 12 },
    ],
    herramientasMenoresPct: 0.05,
  },

  "EST-A36-11": {
    materiales: [
      { descripcion: "Perfil estructural ASTM A36 fabricado", unidad: "kg", cantidadPorUnidad: 1.05, precioUnitarioUsd: 1.94 },
      { descripcion: "Pernos de alta resistencia A325", unidad: "kg", cantidadPorUnidad: 0.03, precioUnitarioUsd: 6.2 },
      { descripcion: "Electrodo E7018", unidad: "kg", cantidadPorUnidad: 0.014, precioUnitarioUsd: 4.8 },
      { descripcion: "Fondo anticorrosivo", unidad: "Gl", cantidadPorUnidad: 0.004, precioUnitarioUsd: 32 },
    ],
    equipos: [
      { descripcion: "Grúa telescópica 60 t", unidad: "HM", rendimientoPorUnidad: 0.0065, precioUnitarioUsd: 145 },
      { descripcion: "Máquina de soldar 400 A", unidad: "HM", rendimientoPorUnidad: 0.012, precioUnitarioUsd: 11 },
      { descripcion: "Manlift articulado 45 ft", unidad: "HM", rendimientoPorUnidad: 0.008, precioUnitarioUsd: 38 },
    ],
    cuadrilla: [
      { categoria: "Capataz de montaje", hhPorUnidad: 0.005, tarifaHoraUsd: 26 },
      { categoria: "Soldador certificado 6G", hhPorUnidad: 0.014, tarifaHoraUsd: 24 },
      { categoria: "Montador estructural", hhPorUnidad: 0.016, tarifaHoraUsd: 19 },
      { categoria: "Ayudante / señalero", hhPorUnidad: 0.012, tarifaHoraUsd: 12 },
    ],
    herramientasMenoresPct: 0.06,
  },

  "PIP-TUB-18": {
    materiales: [
      { descripcion: 'Tubería ASTM A106 Gr.B Sch 40 6"', unidad: "m", cantidadPorUnidad: 1.03, precioUnitarioUsd: 54 },
      { descripcion: "Accesorios: codos, tees, reducciones", unidad: "gl", cantidadPorUnidad: 1, precioUnitarioUsd: 8.4 },
      { descripcion: "Electrodo E6010 / E7018", unidad: "kg", cantidadPorUnidad: 0.28, precioUnitarioUsd: 4.8 },
      { descripcion: "Gas de protección y consumibles GTAW", unidad: "gl", cantidadPorUnidad: 1, precioUnitarioUsd: 2.6 },
    ],
    equipos: [
      { descripcion: "Máquina de soldar 400 A", unidad: "HM", rendimientoPorUnidad: 0.42, precioUnitarioUsd: 11 },
      { descripcion: "Biseladora / tronzadora", unidad: "HM", rendimientoPorUnidad: 0.15, precioUnitarioUsd: 7.5 },
      { descripcion: "Grúa de apoyo 25 t", unidad: "HM", rendimientoPorUnidad: 0.04, precioUnitarioUsd: 95 },
    ],
    cuadrilla: [
      { categoria: "Capataz de piping", hhPorUnidad: 0.12, tarifaHoraUsd: 26 },
      { categoria: "Soldador certificado 6G", hhPorUnidad: 0.48, tarifaHoraUsd: 24 },
      { categoria: "Tubero / armador", hhPorUnidad: 0.45, tarifaHoraUsd: 20 },
      { categoria: "Ayudante", hhPorUnidad: 0.3, tarifaHoraUsd: 12 },
    ],
    herramientasMenoresPct: 0.06,
  },

  "ELE-CAB-31": {
    materiales: [
      { descripcion: "Cable XLPE 15 kV 3x120 mm²", unidad: "m", cantidadPorUnidad: 1.06, precioUnitarioUsd: 34 },
      { descripcion: "Terminaciones y empalmes", unidad: "gl", cantidadPorUnidad: 1, precioUnitarioUsd: 2.8 },
      { descripcion: "Identificadores y precintos", unidad: "gl", cantidadPorUnidad: 1, precioUnitarioUsd: 0.45 },
    ],
    equipos: [
      { descripcion: "Winche de tendido de cable", unidad: "HM", rendimientoPorUnidad: 0.035, precioUnitarioUsd: 42 },
      { descripcion: "Equipo de prueba de aislamiento", unidad: "HM", rendimientoPorUnidad: 0.01, precioUnitarioUsd: 28 },
    ],
    cuadrilla: [
      { categoria: "Capataz eléctrico", hhPorUnidad: 0.03, tarifaHoraUsd: 26 },
      { categoria: "Electricista de potencia", hhPorUnidad: 0.14, tarifaHoraUsd: 21 },
      { categoria: "Ayudante", hhPorUnidad: 0.11, tarifaHoraUsd: 12 },
    ],
    herramientasMenoresPct: 0.05,
  },

  "INS-TRA-38": {
    materiales: [
      { descripcion: "Transmisor de presión HART SIL 2", unidad: "und", cantidadPorUnidad: 1, precioUnitarioUsd: 1_380 },
      { descripcion: "Manifold de 3 vías y tubing 1/2\"", unidad: "und", cantidadPorUnidad: 1, precioUnitarioUsd: 145 },
      { descripcion: "Soporte, caja de conexión y prensaestopas", unidad: "und", cantidadPorUnidad: 1, precioUnitarioUsd: 88 },
    ],
    equipos: [
      { descripcion: "Calibrador de lazo / comunicador HART", unidad: "HM", rendimientoPorUnidad: 1.2, precioUnitarioUsd: 18 },
      { descripcion: "Bomba de prueba hidrostática", unidad: "HM", rendimientoPorUnidad: 0.6, precioUnitarioUsd: 12 },
    ],
    cuadrilla: [
      { categoria: "Supervisor de instrumentación", hhPorUnidad: 0.8, tarifaHoraUsd: 30 },
      { categoria: "Instrumentista certificado", hhPorUnidad: 4.2, tarifaHoraUsd: 23 },
      { categoria: "Ayudante", hhPorUnidad: 2.4, tarifaHoraUsd: 12 },
    ],
    herramientasMenoresPct: 0.04,
  },
};
