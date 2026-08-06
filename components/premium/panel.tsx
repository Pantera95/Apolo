"use client";

import { useMemo, useState } from "react";

import { EncabezadoPremium } from "@/components/premium/encabezado";
import { SeccionFinanciera } from "@/components/premium/financiero";
import { BarrasAvance, BarrasEstado } from "@/components/premium/graficas";
import {
  TablaAlertas,
  TablaObrasCriticas,
  TablaStockCritico,
} from "@/components/premium/tablas";
import { TarjetaKpiPremium } from "@/components/premium/tarjeta-kpi";
import { Alerta } from "@/components/ui/alerta";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { calcularPanel } from "@/lib/dashboard/fuente-local";
import { definicion } from "@/lib/dashboard/catalogo";
import {
  FILTROS_INICIALES,
  type DatosPanel,
  type Filtros,
  type ValorKpi,
} from "@/lib/dashboard/tipos";
import { aCSV, BOM, nombreArchivo, type ColumnaCsv } from "@/lib/datos/csv";
import { useEstado, useListo } from "@/lib/db/almacen";
import { usePreferencias } from "@/lib/preferencias";
import { useAhora } from "@/lib/tiempo";

type Resultado =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "ok"; datos: DatosPanel };

/**
 * Panel de dirección (Premium).
 *
 * Las tarjetas van en dos filas de intención distinta: arriba el dinero y las
 * obras, que es lo que mira un gerente; debajo la cola de trabajo, que es lo
 * que mira quien opera. Mezclarlas obliga a leer las catorce para encontrar la
 * que importa.
 *
 * El cálculo es síncrono sobre el estado en memoria, pero pasa por
 * `calcularPanel`, que es la misma función que envolverá el adaptador de
 * Supabase. Cambiar de fuente no toca este archivo.
 */
export function PanelPremium() {
  const { t, idioma } = usePreferencias();
  const estado = useEstado();
  const listo = useListo();
  const ahora = useAhora();
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);

  /**
   * El resultado del cálculo se devuelve como unión, no se escribe en estado.
   * Un `setState` dentro de `useMemo` corre durante el render y React lo
   * rechaza; además provocaría un segundo render solo para contar que falló.
   */
  const resultado = useMemo((): Resultado => {
    // Sin reloj todavía no se puede resolver la ventana: `useAhora` devuelve 0
    // hasta que hidrata, y calcular con 0 daría un periodo que empieza en 1970.
    if (!listo || ahora === 0) return { estado: "cargando" };
    try {
      return { estado: "ok", datos: calcularPanel(estado, filtros, ahora) };
    } catch (e) {
      // Un fallo de cálculo no puede tumbar la página entera: se muestra el
      // error y el resto del shell sigue navegable.
      return { estado: "error", mensaje: e instanceof Error ? e.message : String(e) };
    }
  }, [estado, filtros, ahora, listo]);

  if (resultado.estado === "error") {
    return (
      <div className="p-6">
        <Alerta tono="peligro" titulo={t("premium.error")}>
          {resultado.mensaje}
        </Alerta>
      </div>
    );
  }

  if (resultado.estado === "cargando") return <Esqueleto />;

  const datos = resultado.datos;

  const hayOperacion = estado.inventario.asientos.length > 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <EncabezadoPremium
        filtros={filtros}
        onCambio={setFiltros}
        obras={estado.obras}
        almacenes={estado.almacenes}
        generadoEn={datos.generadoEn}
        onExportar={() => exportar(datos, t("premium.sinDatos"))}
      />

      {!hayOperacion && (
        <Alerta tono="info" titulo={t("premium.vacio")}>
          {t("demo.aviso")}
        </Alerta>
      )}

      {/* Lo financiero abre el panel: quien lo consulta decide con dinero. */}
      <SeccionFinanciera datos={datos} />

      <div className="border-t border-borde pt-6">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">
          {t("fin.operativo")}
        </h2>
      </div>

      {/* Dirección: dinero y obra. */}
      {/* Cinco columnas y la principal ocupa dos: con cuatro iguales, "USD
          125.174" no cabe de una pieza y el navegador parte la cifra. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <TarjetaKpiPremium
          valor={datos.kpis.valor_en_obra}
          destacada
          enlace="/obras"
          className="xl:col-span-2"
        />
        <TarjetaKpiPremium valor={datos.kpis.valor_inventario} enlace="/inventario" />
        <TarjetaKpiPremium valor={datos.kpis.valor_por_recibir} enlace="/compras" />
        <TarjetaKpiPremium valor={datos.kpis.rotacion} enlace="/reportes" />
      </section>

      {/* Operación: la cola de trabajo. */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <TarjetaKpiPremium valor={datos.kpis.obras_activas} enlace="/obras" />
        <TarjetaKpiPremium valor={datos.kpis.solicitudes_por_aprobar} enlace="/solicitudes" />
        <TarjetaKpiPremium valor={datos.kpis.aprobadas_sin_preparar} enlace="/despacho" />
        <TarjetaKpiPremium valor={datos.kpis.despachos_activos} enlace="/despacho" />
        <TarjetaKpiPremium valor={datos.kpis.compras_retrasadas} enlace="/compras" />
        <TarjetaKpiPremium valor={datos.kpis.stock_critico} enlace="/inventario" />
        <TarjetaKpiPremium valor={datos.kpis.herramienta_pendiente} enlace="/herramientas" />
        <TarjetaKpiPremium valor={datos.kpis.en_ruta} enlace="/despacho" />
        <TarjetaKpiPremium valor={datos.kpis.entregas_completas} enlace="/despacho" />
        <TarjetaKpiPremium valor={datos.kpis.compras_abiertas} enlace="/compras" />
        {/* Las tres que hoy no se pueden calcular se muestran igual, con el
            motivo escrito. Esconderlas haría creer que el panel las cubre. */}
        <TarjetaKpiPremium valor={datos.kpis.otif} />
        <TarjetaKpiPremium valor={datos.kpis.tiempo_aprobacion} />
      </section>

      <TablaAlertas alertas={datos.alertas} />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarrasEstado
          datos={datos.solicitudesPorEstado}
          titulo={t("premium.solicitudesEstado")}
          vacio={t("premium.vacio")}
          destacar={["solicitada", "aprobada"]}
        />
        <BarrasEstado
          datos={datos.despachosPorEstado}
          titulo={t("premium.despachosEstado")}
          vacio={t("premium.vacio")}
          destacar={["con_discrepancia", "listo"]}
        />
      </section>

      <BarrasAvance
        datos={datos.avanceObras}
        titulo={t("premium.avanceMaterial")}
        nota={t("premium.avanceNota")}
        vacio={t("premium.vacio")}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TablaObrasCriticas filas={datos.obrasCriticas} />
        <TablaStockCritico filas={datos.stockCritico} />
      </section>

      <p className="text-xs text-texto-3">
        {t("premium.actualizado")}{" "}
        {new Date(datos.generadoEn).toLocaleString(idioma === "es" ? "es-VE" : "en-US")}
      </p>
    </div>
  );
}

/**
 * Esqueleto de carga.
 *
 * Reproduce la rejilla real, no un spinner centrado: así el contenido aparece
 * donde el ojo ya está mirando en vez de saltar cuando termina de cargar.
 */
function Esqueleto() {
  return (
    <div className="flex animate-pulse flex-col gap-6 p-4 sm:p-6" aria-hidden="true">
      <div className="h-20 rounded-tarjeta bg-superficie-2" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-tarjeta bg-superficie-2" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-tarjeta bg-superficie-2" />
        ))}
      </div>
      <div className="h-64 rounded-tarjeta bg-superficie-2" />
    </div>
  );
}

/**
 * Exporta el catálogo con sus valores.
 *
 * Un KPI sin datos sale con el texto, no vacío: una celda en blanco en Excel
 * se interpreta como cero y ese es justo el error que el panel evita en
 * pantalla.
 */
function exportar(datos: DatosPanel, sinDatos: string) {
  const columnas: ColumnaCsv<ValorKpi>[] = [
    { clave: "indicador", titulo: "indicador", valor: (k) => definicion(k.id)?.nombre ?? k.id },
    { clave: "id", titulo: "id", valor: (k) => k.id },
    { clave: "valor", titulo: "valor", valor: (k) => (k.valor === null ? sinDatos : k.valor) },
    { clave: "anterior", titulo: "anterior", valor: (k) => (k.anterior === null ? sinDatos : k.anterior) },
    { clave: "unidad", titulo: "unidad", valor: (k) => definicion(k.id)?.unidad ?? "" },
    { clave: "formula", titulo: "formula", valor: (k) => definicion(k.id)?.formula ?? "" },
  ];
  const csv = BOM + aCSV(columnas, Object.values(datos.kpis));
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo("apolo-panel");
  a.click();
  URL.revokeObjectURL(url);
}

/** Reexportado para que la página no tenga que conocer el estado vacío. */
export { EstadoVacio };
