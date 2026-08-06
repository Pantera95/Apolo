"use client";

import { ImportarFinanzas } from "@/components/premium/importar-finanzas";
import { InformeTelegram } from "@/components/premium/informe-telegram";
import { calcularPanel } from "@/lib/dashboard/fuente-local";
import { FILTROS_INICIALES } from "@/lib/dashboard/tipos";
import { PanelPremium } from "@/components/premium/panel";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  GraficoAntiguedad,
  GraficoClases,
  GraficoMovimiento,
  GraficoObras,
} from "@/components/ui/graficos";
import { Insignia } from "@/components/ui/insignia";
import { Tabla, type Columna } from "@/components/ui/tabla";
import { Tarjeta, TarjetaKpi } from "@/components/ui/tarjeta";
import {
  antiguedadHerramienta,
  distribucionPorClase,
  formatear,
  insights,
  serieMovimientos,
  valorPorObra,
  type Insight,
} from "@/lib/datos/analitica";
import {
  bajoMinimo,
  dinero,
  dineroCompacto,
  herramientaAveriada,
  herramientaSinRetornar,
  movimientosRecientes,
  numero,
  solicitudesPorAprobar,
  valorDisponible,
  valorEnObra,
} from "@/lib/datos/indicadores";
import { construirSemilla } from "@/lib/datos/semilla";
import { setEstado, useEstado, useListo } from "@/lib/db/almacen";
import type { Asiento } from "@/lib/dominio/tipos";
import type { ClaveTexto } from "@/lib/i18n/textos";
import { estaAbierta, pendientePorRecibir } from "@/lib/dominio/compras";
import { usePremium } from "@/lib/dashboard/premium";
import { usePreferencias } from "@/lib/preferencias";
import { useAhora } from "@/lib/tiempo";

/**
 * Panel de operación.
 *
 * Bento con bloque protagonista: en esta empresa los indicadores NO valen lo
 * mismo. El material inmovilizado en obra y la herramienta que no volvió son el
 * problema que trajo al cliente; el resto es contexto.
 *
 * Cada cifra y cada gráfico salen del kardex. Si un dato no se puede derivar de
 * los asientos, no aparece.
 */
/**
 * Panel principal.
 *
 * Con Premium activo se sustituye por el panel de dirección. No se apilan los
 * dos: son dos lecturas del mismo negocio para dos personas distintas, y
 * mostrarlas juntas obligaría a bajar media pantalla para llegar a la que
 * interesa. El conmutador vive en la barra superior, junto a los datos de
 * demostración.
 */
export default function Panel() {
  const premium = usePremium();
  if (premium) return <PanelPremium />;
  return <PanelBase />;
}

function PanelBase() {
  const { t, idioma } = usePreferencias();
  // `Date.now()` durante el render es impuro y desajusta la hidratación: el
  // servidor renderiza en un instante y el cliente en otro.
  const ahoraMs = useAhora();
  const estado = useEstado();
  const listo = useListo();

  const hayDatos = estado.inventario.asientos.length > 0;
  const deuda = herramientaSinRetornar(estado);
  const averiada = herramientaAveriada(estado);
  const porAprobar = solicitudesPorAprobar(estado);
  const escasos = bajoMinimo(estado);

  // Derivados de compras y despacho: no viven en el saldo, se calculan de las
  // órdenes abiertas y de los despachos que están en la calle.
  const porLlegar = estado.ordenes
    .filter(estaAbierta)
    .reduce(
      (s, o) =>
        s +
        o.lineas.reduce(
          (x, l) => x + pendientePorRecibir(l) * l.costoUnitarioUsd,
          0,
        ),
      0,
    );
  const enRuta = estado.despachos.filter((d) => d.estado === "en_ruta").length;

  const serie = serieMovimientos(estado, 45);
  const obras = valorPorObra(estado);
  const clases = distribucionPorClase(estado);
  const tramos = antiguedadHerramienta(estado);
  const observaciones = insights(estado);

  const usd = (v: number) => dinero(v, idioma);
  const num = (v: number) => numero(v, idioma);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 pt-4">
        <div className="min-w-0">
          <Insignia tono="luz">Demo</Insignia>
          <h1 className="mt-3 text-4xl leading-[0.95] tracking-[-0.035em] sm:text-5xl">
            {t("panel.titulo")}
          </h1>
          <p className="mt-3 max-w-xl text-base text-texto-2">
            {t("panel.subtitulo")}
          </p>
        </div>

        {/* La importación de estados financieros vive aquí Y en el Premium: la
            cifra cargada es la misma, y obligar a activar Premium para poder
            subirla seria una traba artificial. */}
        <div className="flex flex-wrap items-center gap-2">
          <ImportarFinanzas compacto={false} />
          {/* Mismo informe que en Premium, sobre los filtros por defecto: el
              panel básico no tiene selectores, así que el mensaje declara que
              cubre los últimos 30 días y todas las obras. */}
          {listo && ahoraMs > 0 && (
            <InformeTelegram
              datos={calcularPanel(estado, FILTROS_INICIALES, ahoraMs)}
              filtros={FILTROS_INICIALES}
              nombreObra={(id) => estado.obras.find((o) => o.id === id)?.nombre ?? id}
              nombreAlmacen={(id) => estado.almacenes.find((a) => a.id === id)?.nombre ?? id}
              compacto={false}
            />
          )}
        </div>
      </div>

      {/*
        Dos filas de igual altura.
        El bloque protagonista ocupa dos columnas pero UNA sola fila: con
        `row-span-2` quedaba el doble de alto que sus vecinas y se abría un
        hueco muerto entre la cifra y su pie.
      */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta={t("panel.kpi.enObra")}
          valor={usd(valorEnObra(estado))}
          pie={t("panel.kpi.pieEnObra")}
          variante="marca"
          destacada
          listo={listo}
          className="sm:col-span-2"
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.herramientaFuera")}
          valor={num(deuda.unidades)}
          pie={t("panel.kpi.pieHerramienta")}
          variante="luz"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.porAprobar")}
          valor={num(porAprobar.length)}
          pie={t("panel.kpi.piePorAprobar")}
          variante="contorno"
          listo={listo}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaKpi
          etiqueta={t("panel.kpi.disponible")}
          valor={usd(valorDisponible(estado))}
          pie={t("panel.kpi.pieDisponible")}
          variante="contorno"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.porLlegar")}
          valor={usd(porLlegar)}
          pie={t("panel.kpi.piePorLlegar")}
          variante="contorno"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.enRuta")}
          valor={num(enRuta)}
          pie={t("panel.kpi.pieEnRuta")}
          variante="contorno"
          listo={listo}
        />
        <TarjetaKpi
          etiqueta={t("panel.kpi.averiada")}
          valor={num(averiada.unidades)}
          pie={t("panel.kpi.pieAveriada")}
          variante="contorno"
          listo={listo}
        />
      </div>

      <p className="mb-6 text-sm font-semibold text-texto-3">{t("demo.aviso")}</p>

      {!hayDatos ? (
        <Tarjeta>
          <EstadoVacio
            icono="inventario"
            titulo={t("panel.sinDatos.titulo")}
            detalle={t("panel.sinDatos.detalle")}
            accion={
              <Boton variante="luz" onClick={() => setEstado(construirSemilla())}>
                {t("panel.sinDatos.accion")}
              </Boton>
            }
          />
        </Tarjeta>
      ) : (
        <>
          {/* Lecturas de los datos */}
          {observaciones.length > 0 && (
            <Tarjeta titulo={t("bi.insights")} className="mb-4">
              <ul className="flex flex-col gap-3">
                {observaciones.map((o) => (
                  <ListaInsight key={o.id} insight={o} />
                ))}
              </ul>
            </Tarjeta>
          )}

          {/* Gráficos */}
          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Tarjeta
              titulo={t("bi.movimiento")}
              descripcion={t("bi.movimientoPie")}
              className="xl:col-span-2"
              accion={
                <div className="flex items-center gap-3 text-xs font-bold">
                  <Leyenda color="var(--luz)">{t("bi.entradas")}</Leyenda>
                  <Leyenda color="var(--marca)">{t("bi.salidas")}</Leyenda>
                </div>
              }
            >
              <GraficoMovimiento
                datos={serie}
                formato={usd}
                formatoEje={(v) => dineroCompacto(v, idioma)}
                etiquetas={{ entradas: t("bi.entradas"), salidas: t("bi.salidas") }}
              />
            </Tarjeta>

            <Tarjeta titulo={t("bi.porClase")}>
              <GraficoClases
                datos={clases}
                formato={usd}
                etiqueta={(c) => t(`clase.${c}` as ClaveTexto)}
              />
              <ul className="mt-3 flex flex-col gap-1.5">
                {clases.map((c) => (
                  <li
                    key={c.clase}
                    className="flex items-center gap-2 text-xs font-bold"
                  >
                    <Leyenda color={colorClase(c.clase)}>
                      {t(`clase.${c.clase}` as ClaveTexto)}
                    </Leyenda>
                    <span className="cifra ml-auto text-texto-2">
                      {Math.round(c.porcentaje)}%
                    </span>
                    <span className="cifra w-24 text-right">{usd(c.valorUsd)}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>

            <Tarjeta titulo={t("bi.porObra")}>
              <GraficoObras datos={obras} formato={usd} />
            </Tarjeta>

            <Tarjeta
              titulo={t("bi.antiguedad")}
              descripcion={t("bi.antiguedadPie")}
              className="xl:col-span-2"
            >
              <GraficoAntiguedad datos={tramos} formato={num} />
            </Tarjeta>
          </div>

          {/* Actividad y alertas */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Tarjeta titulo={t("panel.actividad")} className="xl:col-span-2">
              <TablaMovimientos estado={estado} />
            </Tarjeta>

            <Tarjeta titulo={t("panel.alertas")}>
              <div className="flex flex-col gap-3">
                {deuda.unidades > 0 && (
                  <Alerta tono="advertencia" titulo={t("panel.kpi.herramientaFuera")}>
                    {num(deuda.unidades)} {t("panel.unidades")} · {usd(deuda.valorUsd)}
                  </Alerta>
                )}
                {averiada.unidades > 0 && (
                  <Alerta tono="peligro" titulo={t("panel.averiada")}>
                    {num(averiada.unidades)} {t("panel.unidades")} ·{" "}
                    {usd(averiada.valorUsd)}
                  </Alerta>
                )}
                {escasos.slice(0, 4).map((e) => (
                  <Alerta key={e.articulo.id} tono="info" titulo={e.articulo.codigo}>
                    {num(e.disponible)} {t("panel.disponibleDe")} {num(e.recibido)}
                  </Alerta>
                ))}
              </div>
            </Tarjeta>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function colorClase(clase: string): string {
  if (clase === "consumible") return "var(--marca)";
  if (clase === "retornable") return "var(--luz)";
  return "var(--info)";
}

function Leyenda({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      {children}
    </span>
  );
}

const TONO_PUNTO: Record<Insight["tono"], string> = {
  ok: "bg-ok",
  info: "bg-info",
  advertencia: "bg-advertencia",
  peligro: "bg-peligro",
};

function ListaInsight({ insight }: { insight: Insight }) {
  const { t, idioma } = usePreferencias();

  // Los montos se formatean aquí: la analítica no sabe de idioma ni de moneda.
  const valores: Record<string, string | number> = {};
  for (const [clave, valor] of Object.entries(insight.valores)) {
    valores[clave] =
      typeof valor === "number" && insight.moneda?.includes(clave)
        ? dinero(valor, idioma).replace(/^(USD|\$)\s*/, "")
        : typeof valor === "number"
          ? numero(valor, idioma)
          : valor;
  }

  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONO_PUNTO[insight.tono]}`}
      />
      <p className="text-sm leading-relaxed text-texto-2">
        {formatear(t(insight.clave as ClaveTexto), valores)}
      </p>
    </li>
  );
}

// ---------------------------------------------------------------------------

function TablaMovimientos({
  estado,
}: {
  estado: ReturnType<typeof useEstado>;
}) {
  const { t, idioma } = usePreferencias();
  const articulos = new Map(estado.articulos.map((a) => [a.id, a]));
  const obras = new Map(estado.obras.map((o) => [o.id, o]));

  const columnas: Columna<Asiento>[] = [
    {
      clave: "tipo",
      titulo: t("panel.movimiento"),
      ordenable: true,
      valorOrden: (a) => a.tipo,
      render: (a) => (
        <Insignia tono={tonoMovimiento(a.tipo)} punto>
          {t(`mov.${a.tipo}` as ClaveTexto)}
        </Insignia>
      ),
    },
    {
      clave: "articulo",
      titulo: t("panel.articulo"),
      ordenable: true,
      valorOrden: (a) => articulos.get(a.articuloId)?.codigo ?? "",
      render: (a) => {
        const art = articulos.get(a.articuloId);
        return (
          <div className="min-w-0">
            <span className="codigo text-xs font-bold">{art?.codigo}</span>
            <p className="truncate text-xs text-texto-2">{art?.descripcion}</p>
          </div>
        );
      },
    },
    {
      clave: "obra",
      titulo: t("nav.obras"),
      ordenable: true,
      valorOrden: (a) => (a.obraId ? (obras.get(a.obraId)?.codigo ?? "") : ""),
      render: (a) =>
        a.obraId ? (
          <span className="codigo text-xs">{obras.get(a.obraId)?.codigo}</span>
        ) : (
          <span className="text-texto-3">—</span>
        ),
    },
    {
      clave: "cantidad",
      titulo: t("panel.cantidad"),
      numerica: true,
      ordenable: true,
      valorOrden: (a) => cantidadDe(a),
      render: (a) => (
        <span className="whitespace-nowrap text-sm font-bold">
          {numero(cantidadDe(a), idioma)}{" "}
          <span className="font-semibold text-texto-3">
            {articulos.get(a.articuloId)?.unidadBase}
          </span>
        </span>
      ),
    },
    {
      clave: "fecha",
      titulo: t("panel.fecha"),
      numerica: true,
      ordenable: true,
      valorOrden: (a) => a.fecha,
      render: (a) => (
        <span className="whitespace-nowrap text-xs text-texto-2">
          {new Date(a.fecha).toLocaleDateString(idioma === "es" ? "es-VE" : "en-US")}
        </span>
      ),
    },
  ];

  return (
    <Tabla
      columnas={columnas}
      filas={movimientosRecientes(estado, 24)}
      claveFila={(a) => a.id}
      porPagina={6}
    />
  );
}

/** Cantidad significativa del asiento: el campo que realmente se movió. */
function cantidadDe(a: Asiento): number {
  const campos = [
    a.delta.fisico,
    a.delta.enObra,
    a.delta.reservado,
    a.delta.enTransito,
    a.delta.averiado,
  ];
  return Math.abs(
    campos.reduce((max, v) => (Math.abs(v) > Math.abs(max) ? v : max), 0),
  );
}

function tonoMovimiento(tipo: Asiento["tipo"]) {
  switch (tipo) {
    case "recepcion":
    case "transferencia_entrada":
      return "ok" as const;
    case "retorno":
      return "luz" as const;
    case "ajuste":
    case "conteo":
      return "advertencia" as const;
    case "despacho":
    case "transferencia_salida":
      return "info" as const;
    default:
      return "neutro" as const;
  }
}
