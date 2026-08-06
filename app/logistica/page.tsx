"use client";

import { useMemo, useState } from "react";

import dynamic from "next/dynamic";

import { MapaControl } from "@/components/logistica/mapa";
import { PanelTelegram } from "@/components/logistica/panel-telegram";
import { Alerta } from "@/components/ui/alerta";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import {
  progresoViaje,
  siguienteParada,
  usoCapacidad,
} from "@/lib/logistica/nucleo";
import {
  CHOFERES_DEMO,
  LUGARES_DEMO,
  SUSCRIPCIONES_DEMO,
  VEHICULOS_DEMO,
  etaDeRuta,
  eventosDeRuta,
  formatearMensaje,
  posicionSimulada,
  rutasDemo,
} from "@/lib/logistica/simulado";
import type { EstadoViaje, PlanRuta, PosicionVehiculo } from "@/lib/logistica/tipos";
import { numero } from "@/lib/datos/indicadores";
import { usePremium } from "@/lib/dashboard/premium";
import { usePreferencias } from "@/lib/preferencias";
import { useAhora } from "@/lib/tiempo";

/**
 * El mapa real se carga en diferido y sin SSR.
 *
 * MapLibre toca `window` al construirse, así que renderizarlo en el servidor
 * rompe la compilación. Y pesa ~800 KB: cargarlo con la página penalizaría a
 * quien solo viene a mirar el panel lateral.
 */
const MapaReal = dynamic(
  () => import("@/components/logistica/mapa-real").then((m) => m.MapaReal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-superficie-2 text-sm text-texto-3">
        Cargando callejero…
      </div>
    ),
  },
);

const TONO_VIAJE: Partial<Record<EstadoViaje, TonoInsignia>> = {
  en_ruta: "ok",
  en_carga: "info",
  cargado: "info",
  listo_para_salida: "info",
  proximo: "advertencia",
  en_geocerca: "advertencia",
  descargando: "advertencia",
  con_incidencia: "peligro",
  fallido: "peligro",
  completado: "neutro",
};

/**
 * Centro de Control Logístico — primer incremento.
 *
 * Todo lo que se ve aquí sale de proveedores SIMULADOS que cumplen los mismos
 * puertos que Traccar, VROOM y Telegram cumplirán después. No hay ninguna
 * llamada a Internet, ninguna clave y ningún dispositivo real: el encargo lo
 * prohíbe explícitamente en esta fase.
 *
 * La pantalla depende de las interfaces, no de los simuladores. Cambiar de
 * proveedor es sustituir el módulo que los construye.
 */
export default function CentroControl() {
  const { idioma, tema } = usePreferencias();
  const premium = usePremium();
  const ahora = useAhora();
  const [seleccion, setSeleccion] = useState<string | null>("ruta-1");
  // El callejero es el valor por defecto: es lo que un supervisor necesita.
  // El esquema se conserva porque funciona sin red, y en una obra eso pasa.
  const [vistaMapa, setVistaMapa] = useState<"calle" | "esquema">("calle");

  const rutas = useMemo(() => (ahora === 0 ? [] : rutasDemo(ahora)), [ahora]);

  const posiciones = useMemo(() => {
    const m = new Map<string, PosicionVehiculo>();
    for (const r of rutas) m.set(r.vehiculoId, posicionSimulada(r, ahora));
    return m;
  }, [rutas, ahora]);

  // Sin reloj todavía no hay nada que situar: `useAhora` devuelve 0 hasta que
  // hidrata, y calcular con 0 pondría los camiones en 1970.
  if (ahora === 0 || rutas.length === 0) return <Esqueleto />;

  const activa = rutas.find((r) => r.id === seleccion) ?? rutas[0];
  const posActiva = posiciones.get(activa.vehiculoId);

  const fmtHora = (iso: string) =>
    new Date(iso).toLocaleTimeString(idioma === "es" ? "es-VE" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const nombreLugar = (id: string) =>
    LUGARES_DEMO.find((l) => l.id === id)?.nombre ?? id;

  const vehiculoDe = (r: PlanRuta) =>
    VEHICULOS_DEMO.find((v) => v.id === r.vehiculoId);

  const sinGps = VEHICULOS_DEMO.filter((v) => !v.dispositivoGpsId);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Insignia tono="marca">Logística</Insignia>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">
            Centro de Control
          </h1>
          <p className="mt-1 text-sm text-texto-2">
            Rutas, seguimiento y entregas · {rutas.length} viajes activos
          </p>
        </div>
        <span className="mono flex items-center gap-2 text-[11px] text-texto-3">
          <span
            aria-hidden="true"
            className="h-2 w-2 animate-pulse rounded-full bg-luz"
          />
          Simulado · actualizado {fmtHora(new Date(ahora).toISOString())}
        </span>
      </header>

      <Alerta tono="info" titulo="Datos simulados, sin conexión externa">
        Las posiciones, rutas y mensajes salen de proveedores simulados que
        cumplen los mismos puertos que Traccar, VROOM y Telegram. No se contacta
        con ningún servicio ni se envía ningún mensaje real.
      </Alerta>

      {sinGps.length > 0 && (
        <Alerta tono="advertencia" titulo="Vehículos sin dispositivo GPS">
          {sinGps.map((v) => `${v.descripcion} (${v.placa})`).join(" · ")} — sin
          dispositivo no hay seguimiento posible, y eso es una alerta por sí sola.
        </Alerta>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_22rem]">
        <section className="min-w-0 overflow-hidden rounded-tarjeta border border-borde-fuerte bg-superficie">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-3 py-2">
            <span className="mono text-[11px] font-bold uppercase tracking-[0.12em] text-texto-3">
              {vistaMapa === "calle" ? "Callejero · OpenStreetMap" : "Esquema · sin red"}
            </span>
            <div className="flex gap-1" role="tablist" aria-label="Vista del mapa">
              {(["calle", "esquema"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={v === vistaMapa}
                  onClick={() => setVistaMapa(v)}
                  className={`mono flex min-h-11 items-center rounded-pildora px-3 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                    v === vistaMapa
                      ? "bg-marca-fondo text-white"
                      : "bg-superficie-2 text-texto-2 hover:text-texto"
                  }`}
                >
                  {v === "calle" ? "Calles" : "Esquema"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[26rem] w-full sm:h-[34rem]">
            {vistaMapa === "calle" ? (
              <MapaReal
                lugares={LUGARES_DEMO}
                rutas={rutas}
                posiciones={posiciones}
                seleccion={activa.id}
                onSeleccionar={setSeleccion}
                oscuro={tema === "oscuro"}
                etiquetaVehiculo={(id) => {
                  const r = rutas.find((x) => x.id === id);
                  return r ? (vehiculoDe(r)?.descripcion ?? r.vehiculoId) : id;
                }}
              />
            ) : (
              <MapaControl
                lugares={LUGARES_DEMO}
                rutas={rutas}
                posiciones={posiciones}
                seleccion={activa.id}
                onSeleccionar={setSeleccion}
                etiquetaVehiculo={(id) => {
                  const r = rutas.find((x) => x.id === id);
                  return r ? (vehiculoDe(r)?.descripcion ?? r.vehiculoId) : id;
                }}
              />
            )}
          </div>
        </section>

        {/* Panel lateral: la cola de viajes. */}
        <aside className="flex min-w-0 flex-col gap-3">
          {rutas.map((r) => {
            const v = vehiculoDe(r);
            const p = posiciones.get(r.vehiculoId);
            const info = p ? etaDeRuta(r, p, ahora) : null;
            const uso = v ? usoCapacidad(r.paradas, v.capacidad) : null;
            const activaEsta = r.id === activa.id;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSeleccion(r.id)}
                aria-pressed={activaEsta}
                className={`min-h-11 rounded-tarjeta border p-3 text-left transition-colors ${
                  activaEsta
                    ? "border-marca bg-marca-tenue"
                    : "border-borde-fuerte bg-superficie hover:border-borde-fuerte"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="codigo text-xs font-bold">{r.codigo}</span>
                  <Insignia tono={TONO_VIAJE[r.estado] ?? "neutro"} punto>
                    {r.estado.replace(/_/g, " ")}
                  </Insignia>
                </div>
                <p className="mt-1 truncate text-xs text-texto-2">
                  {v?.descripcion} · {CHOFERES_DEMO[r.vehiculoId]}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-texto-3">
                  <span>
                    {Math.round(progresoViaje(r.paradas) * 100)}% · {r.paradas.length} paradas
                  </span>
                  {uso && (
                    <span className={uso.excedePeso || uso.excedeVolumen ? "text-peligro" : ""}>
                      {Math.round(uso.pctPeso)}% peso · {Math.round(uso.pctVolumen)}% vol.
                    </span>
                  )}
                </div>
                {info && (
                  <p className="mono mt-1 text-[11px] text-texto-3">
                    ETA {fmtHora(info.eta.llegadaEstimada)} →{" "}
                    {nombreLugar(info.parada.lugarId)}
                    {info.eta.desviacionMin > 10 && (
                      <span className="text-peligro">
                        {" "}
                        (+{Math.round(info.eta.desviacionMin)} min)
                      </span>
                    )}
                  </p>
                )}
              </button>
            );
          })}
        </aside>
      </div>

      {/* El panel de informes es Premium: la operación base ve el mapa y la
          línea de tiempo, pero el canal de avisos es lo que se vende aparte. */}
      {premium && <PanelTelegram rutas={rutas} posiciones={posiciones} ahora={ahora} />}

      <DetalleViaje
        ruta={activa}
        posicion={posActiva}
        ahora={ahora}
        nombreLugar={nombreLugar}
        fmtHora={fmtHora}
        idioma={idioma}
      />
    </div>
  );
}

function DetalleViaje({
  ruta,
  posicion,
  ahora,
  nombreLugar,
  fmtHora,
  idioma,
}: {
  ruta: PlanRuta;
  posicion?: PosicionVehiculo;
  ahora: number;
  nombreLugar: (id: string) => string;
  fmtHora: (iso: string) => string;
  idioma: "es" | "en";
}) {
  const eventos = posicion ? eventosDeRuta(ruta, posicion, ahora) : [];
  const info = posicion ? etaDeRuta(ruta, posicion, ahora) : null;
  const proxima = siguienteParada(ruta.paradas);

  // Mensajes tal y como saldrían por Telegram. Se muestran para poder
  // revisarlos antes de conectar el bot: no se envía ninguno.
  const mensajes = eventos.slice(0, 3).map((e) =>
    formatearMensaje({
      clave: e.id,
      destino: SUSCRIPCIONES_DEMO[0].chatId,
      severidad: e.tipo === "desvio" ? "alta" : "advertencia",
      titulo: e.detalle,
      cuerpo: [
        `Despacho: ${proxima?.despachoId ?? "—"}`,
        `Vehículo: ${ruta.vehiculoId}`,
        `Ruta: ${ruta.codigo}`,
        `Hora: ${fmtHora(e.en)}`,
      ].join("\n"),
      enlace: `https://apolo-swift.vercel.app/logistica`,
    }),
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="min-w-0 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.06em]">
          Línea de tiempo · {ruta.codigo}
        </h2>

        <ol className="mt-4 flex flex-col">
          <Hito
            titulo="Ruta publicada"
            detalle={`${numero(ruta.distanciaPlanKm, idioma)} km planificados · v${ruta.version}`}
            hora={ruta.publicadaEn ? fmtHora(ruta.publicadaEn) : "—"}
            hecho
          />
          {ruta.paradas.map((p) => (
            <Hito
              key={p.id}
              titulo={`${p.orden}. ${nombreLugar(p.lugarId)}`}
              detalle={`${p.despachoId} · ${numero(p.pesoKg, idioma)} kg · ${p.estado.replace(/_/g, " ")}`}
              hora={p.llegadaReal ? fmtHora(p.llegadaReal) : fmtHora(p.llegadaPlanificada)}
              hecho={p.estado === "completada"}
              activo={p.id === proxima?.id}
            />
          ))}
          {info && (
            <Hito
              titulo="ETA a la siguiente parada"
              detalle={`${Math.round(info.eta.distanciaRestanteKm)} km · ${Math.round(info.eta.minutosRestantes)} min`}
              hora={fmtHora(info.eta.llegadaEstimada)}
            />
          )}
        </ol>
      </section>

      <section className="min-w-0 rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.06em]">
          Avisos que se enviarían
        </h2>
        <p className="mt-1 text-xs text-texto-3">
          Formato final del mensaje de Telegram. En modo prueba no se envía nada.
        </p>

        {mensajes.length === 0 ? (
          <p className="mt-4 text-sm text-texto-3">
            Sin eventos que notificar en este momento.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {mensajes.map((m, i) => (
              <pre
                key={i}
                className="mono overflow-x-auto whitespace-pre-wrap rounded-control border border-borde bg-superficie-2 p-3 text-[11px] leading-relaxed text-texto-2"
              >
                {m}
              </pre>
            ))}
          </div>
        )}

        <h3 className="mono mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-texto-3">
          Suscripciones
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {SUSCRIPCIONES_DEMO.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-2 text-xs last:border-0"
            >
              <span className="min-w-0">
                <span className="font-bold">{s.etiqueta}</span>
                {/* El chat_id nunca se muestra completo. */}
                <span className="mono ml-2 text-texto-3">{s.chatId}</span>
              </span>
              <Insignia tono={s.activa ? "ok" : "neutro"}>
                {s.activa ? `≥ ${s.severidadMinima}` : "silenciada"}
              </Insignia>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Hito({
  titulo,
  detalle,
  hora,
  hecho = false,
  activo = false,
}: {
  titulo: string;
  detalle: string;
  hora: string;
  hecho?: boolean;
  activo?: boolean;
}) {
  return (
    <li className="flex gap-3 border-l-2 border-borde pb-4 pl-4 last:pb-0">
      <span
        aria-hidden="true"
        className={`-ml-[21px] mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${
          hecho
            ? "border-luz bg-luz"
            : activo
              ? "border-marca bg-superficie"
              : "border-borde-fuerte bg-superficie"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-bold">{titulo}</p>
          <span className="mono text-[11px] text-texto-3">{hora}</span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-texto-3">{detalle}</p>
      </div>
    </li>
  );
}

function Esqueleto() {
  return (
    <div className="flex animate-pulse flex-col gap-5 p-4 sm:p-6" aria-hidden="true">
      <div className="h-20 rounded-tarjeta bg-superficie-2" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="h-[34rem] rounded-tarjeta bg-superficie-2" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-tarjeta bg-superficie-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
