/**
 * Diccionarios de Apolo. Sin dependencias externas: son objetos planos y el
 * tipo `ClaveTexto` obliga a que cada clave exista en los dos idiomas — si
 * falta una traducción, no compila.
 *
 * El español es el idioma por defecto: es el que habla el almacén.
 */

export const textos = {
  es: {
    "app.nombre": "Apolo",
    "app.lema": "Control de almacén y obra",

    "nav.panel": "Panel",
    "nav.obras": "Obras",
    "nav.inventario": "Inventario",
    "nav.solicitudes": "Solicitudes",
    "nav.despacho": "Despacho",
    "nav.herramientas": "Herramientas",
    "nav.compras": "Compras",
    "nav.importacion": "Importación",
    "nav.reportes": "Reportes",
    "nav.seccionOperacion": "Operación",
    "nav.seccionAlmacen": "Almacén",
    "nav.seccionDatos": "Datos",

    "acc.abrirMenu": "Abrir menú de navegación",
    "acc.cerrarMenu": "Cerrar menú de navegación",
    "acc.temaClaro": "Cambiar a tema claro",
    "acc.temaOscuro": "Cambiar a tema oscuro",
    "acc.idioma": "Cambiar idioma",

    "panel.titulo": "Panel de operación",
    "panel.subtitulo": "Lo que está pasando ahora mismo en almacén y obra",
    "panel.kpi.disponible": "Valor disponible",
    "panel.kpi.enObra": "Material en obra",
    "panel.kpi.herramientaFuera": "Herramienta sin retornar",
    "panel.kpi.porAprobar": "Solicitudes por aprobar",
    "panel.kpi.pieDisponible": "Existencia vendible valorizada",
    "panel.kpi.pieEnObra": "Despachado y aún no consumido",
    "panel.kpi.pieHerramienta": "Deuda abierta contra obras",
    "panel.kpi.piePorAprobar": "Bloqueadas hasta que alguien apruebe",
    "panel.actividad": "Movimientos recientes",
    "panel.alertas": "Requiere tu atención",
    "panel.sinDatos.titulo": "Todavía no hay movimientos",
    "panel.sinDatos.detalle":
      "Cuando se registre la primera recepción o el primer despacho, el panel se llena solo.",
    "panel.sinDatos.accion": "Cargar datos de demostración",

    "demo.aviso":
      "Demostración: los datos viven en este navegador y los permisos son estructura, no seguridad.",
    "demo.reiniciar": "Reiniciar a cero",
    "demo.cargar": "Cargar datos de demostración",
    "demo.ficticios": "Datos ficticios, no son cifras del cliente.",

    "panel.movimiento": "Movimiento",
    "panel.articulo": "Artículo",
    "panel.cantidad": "Cantidad",
    "panel.fecha": "Fecha",
    "panel.averiada": "Herramienta averiada",
    "panel.bajoMinimo": "Bajo mínimo",
    "panel.disponibleDe": "disponible de",
    "panel.sinAlertas": "Nada requiere tu atención",
    "panel.unidades": "unidades",

    "mov.recepcion": "Recepción",
    "mov.ajuste": "Ajuste",
    "mov.reserva": "Reserva",
    "mov.liberacion_reserva": "Liberación",
    "mov.despacho": "Despacho",
    "mov.entrega": "Entrega",
    "mov.retorno": "Retorno",
    "mov.transferencia_salida": "Transferencia salida",
    "mov.transferencia_entrada": "Transferencia entrada",
    "mov.conteo": "Conteo",

    "tabla.sinResultados": "No hay resultados",
    "tabla.pagina": "Página",
    "tabla.de": "de",
    "tabla.anterior": "Anterior",
    "tabla.siguiente": "Siguiente",
    "tabla.mostrando": "Mostrando",
    "tabla.registros": "registros",
    "tabla.ordenarPor": "Ordenar por",

    "estado.borrador": "Borrador",
    "estado.solicitada": "Solicitada",
    "estado.aprobada": "Aprobada",
    "estado.rechazada": "Rechazada",
    "estado.en_preparacion": "En preparación",
    "estado.despachada": "Despachada",
    "estado.entregada": "Entregada",
    "estado.cerrada": "Cerrada",
    "estado.anulada": "Anulada",

    "clase.consumible": "Consumible",
    "clase.retornable": "Retornable",
    "clase.certificado": "Certificado",
  },

  en: {
    "app.nombre": "Apolo",
    "app.lema": "Warehouse and site control",

    "nav.panel": "Overview",
    "nav.obras": "Projects",
    "nav.inventario": "Inventory",
    "nav.solicitudes": "Requests",
    "nav.despacho": "Dispatch",
    "nav.herramientas": "Tools",
    "nav.compras": "Purchasing",
    "nav.importacion": "Import",
    "nav.reportes": "Reports",
    "nav.seccionOperacion": "Operations",
    "nav.seccionAlmacen": "Warehouse",
    "nav.seccionDatos": "Data",

    "acc.abrirMenu": "Open navigation menu",
    "acc.cerrarMenu": "Close navigation menu",
    "acc.temaClaro": "Switch to light theme",
    "acc.temaOscuro": "Switch to dark theme",
    "acc.idioma": "Change language",

    "panel.titulo": "Operations overview",
    "panel.subtitulo": "What is happening right now in the warehouse and on site",
    "panel.kpi.disponible": "Available value",
    "panel.kpi.enObra": "Material on site",
    "panel.kpi.herramientaFuera": "Tools not returned",
    "panel.kpi.porAprobar": "Requests awaiting approval",
    "panel.kpi.pieDisponible": "Sellable stock at cost",
    "panel.kpi.pieEnObra": "Dispatched and not yet consumed",
    "panel.kpi.pieHerramienta": "Open debt against projects",
    "panel.kpi.piePorAprobar": "Blocked until someone approves",
    "panel.actividad": "Recent movements",
    "panel.alertas": "Needs your attention",
    "panel.sinDatos.titulo": "No movements yet",
    "panel.sinDatos.detalle":
      "Once the first receipt or dispatch is recorded, this overview fills itself in.",
    "panel.sinDatos.accion": "Load demo data",

    "demo.aviso":
      "Demo: data lives in this browser and permissions are structure, not security.",
    "demo.reiniciar": "Reset to zero",
    "demo.cargar": "Load demo data",
    "demo.ficticios": "Fictional data, not the client's figures.",

    "panel.movimiento": "Movement",
    "panel.articulo": "Item",
    "panel.cantidad": "Quantity",
    "panel.fecha": "Date",
    "panel.averiada": "Damaged tools",
    "panel.bajoMinimo": "Below minimum",
    "panel.disponibleDe": "available of",
    "panel.sinAlertas": "Nothing needs your attention",
    "panel.unidades": "units",

    "mov.recepcion": "Receipt",
    "mov.ajuste": "Adjustment",
    "mov.reserva": "Allocation",
    "mov.liberacion_reserva": "Release",
    "mov.despacho": "Dispatch",
    "mov.entrega": "Delivery",
    "mov.retorno": "Return",
    "mov.transferencia_salida": "Transfer out",
    "mov.transferencia_entrada": "Transfer in",
    "mov.conteo": "Count",

    "tabla.sinResultados": "No results",
    "tabla.pagina": "Page",
    "tabla.de": "of",
    "tabla.anterior": "Previous",
    "tabla.siguiente": "Next",
    "tabla.mostrando": "Showing",
    "tabla.registros": "records",
    "tabla.ordenarPor": "Sort by",

    "estado.borrador": "Draft",
    "estado.solicitada": "Requested",
    "estado.aprobada": "Approved",
    "estado.rechazada": "Rejected",
    "estado.en_preparacion": "Picking",
    "estado.despachada": "Dispatched",
    "estado.entregada": "Delivered",
    "estado.cerrada": "Closed",
    "estado.anulada": "Cancelled",

    "clase.consumible": "Consumable",
    "clase.retornable": "Returnable",
    "clase.certificado": "Certified",
  },
} as const;

export type Idioma = keyof typeof textos;
export type ClaveTexto = keyof (typeof textos)["es"];

/** Si `en` pierde una clave que `es` tiene, esto deja de compilar. */
const _completo: Record<Idioma, Record<ClaveTexto, string>> = textos;
void _completo;
