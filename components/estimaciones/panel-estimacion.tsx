"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PanelTelegramEstimacion } from "@/components/estimaciones/panel-telegram";
import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { aCSV, BOM, nombreArchivo, type ColumnaCsv } from "@/lib/datos/csv";
import { dinero, dineroCompacto, numero } from "@/lib/datos/indicadores";
import {
  HISTORICO_DEMO,
  ingestaLocal,
  plantillaScheduleCsv,
} from "@/lib/licitaciones/ingesta";
import { archivoDeModelo, MODELOS_DEMO } from "@/lib/licitaciones/modelos-demo";
import {
  agruparRfq,
  desempeno,
  desviacionRendimiento,
  estimar,
  promedioIndice,
} from "@/lib/licitaciones/motor";
import {
  DISCIPLINAS,
  ORIGENES,
  PARAMETROS_INICIALES,
  type Apu,
  type Disciplina,
  type OrigenModelo,
  type Parametros,
  type ResultadoIngesta,
} from "@/lib/licitaciones/tipos";
import { usePreferencias } from "@/lib/preferencias";

type Pestana = "mto" | "apu" | "rfq" | "benchmark";

/**
 * Identidad de los documentos.
 *
 * Van aquí y no en el motor porque son de PRESENTACIÓN: el mismo cómputo
 * emitido por otra constructora lleva otro membrete sin que cambie un número.
 * Cuando la estimación se guarde en base de datos, saldrán de la ficha del
 * proyecto.
 */
const CLIENTE = "Multiservicios y Construcciones Global XXI, C.A.";
const PROYECTO_POR_DEFECTO = "Plataforma de procesamiento y módulos civiles · Fase 1";
const PREPARADO_POR = "Departamento de Estimaciones y Costos";

function tono(css: string): string {
  if (typeof window === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(css).trim() || "#888";
}

/**
 * Estimación desde modelos BIM/CAD — el módulo de Estimaciones.
 *
 * Vivió como pestaña de Compras y ahí estaba mal: el cómputo termina en
 * solicitudes de cotización, pero eso solo describe la salida. El trabajo
 * —calcular cantidades, rendimientos y precios unitarios para decidir si se
 * oferta— es del departamento de estimaciones y ocurre antes de que exista
 * ninguna orden.
 *
 * LA FRONTERA SE DECLARA EN PANTALLA. Un `.rvt` no se lee en un navegador, y
 * la interfaz lo dice antes de que nadie suba nada — no después, con un
 * resultado simulado ya delante.
 */
export function PanelEstimacion() {
  const { idioma } = usePreferencias();
  const [origen, setOrigen] = useState<OrigenModelo>("csv");
  const [ingesta, setIngesta] = useState<ResultadoIngesta | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [pestana, setPestana] = useState<Pestana>("mto");
  const [parametros, setParametros] = useState<Parametros>(PARAMETROS_INICIALES);
  // Qué modelo de muestra se cargó, si fue alguno. Da el nombre del proyecto y
  // el sello de "datos ficticios" que llevan los documentos.
  const [muestra, setMuestra] = useState<(typeof MODELOS_DEMO)[number] | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const estimacion = useMemo(
    () => (ingesta ? estimar(ingesta.renglones, parametros) : null),
    [ingesta, parametros],
  );

  async function procesar(archivo: File, deMuestra: (typeof MODELOS_DEMO)[number] | null = null) {
    setMuestra(deMuestra);
    setProcesando(true);
    try {
      // Pausa deliberada: procesar 25 renglones es instantáneo, y un resultado
      // que aparece sin transición se lee como que no se hizo nada.
      const [r] = await Promise.all([
        ingestaLocal().procesar(archivo, origen),
        new Promise((res) => setTimeout(res, 700)),
      ]);
      setIngesta(r);
      setPestana("mto");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono="marca">Premium</Insignia>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.06em]">
              Estimación desde modelo BIM / CAD
            </h2>
          </div>
          <p className="mt-1 text-xs text-texto-3">
            Cómputo métrico, precios unitarios y solicitudes de cotización a
            partir del modelo de diseño.
          </p>
        </div>
        {ingesta && (
          <Boton compacto variante="suave" onClick={() => setIngesta(null)}>
            Nuevo cómputo
          </Boton>
        )}
      </div>

      {!ingesta ? (
        <Ingesta
          onModelo={(m) => void procesar(archivoDeModelo(m), m)}
          origen={origen}
          onOrigen={setOrigen}
          arrastrando={arrastrando}
          onArrastrando={setArrastrando}
          procesando={procesando}
          onArchivo={procesar}
          entrada={entrada}
        />
      ) : (
        <>
          {ingesta.simulado && (
            <Alerta tono="advertencia" titulo="Cómputo simulado">
              {ingesta.avisos.join(" ")}
            </Alerta>
          )}
          {!ingesta.simulado && ingesta.avisos.length > 0 && (
            <Alerta tono="advertencia" titulo="Avisos del procesamiento">
              {ingesta.avisos.slice(0, 5).join(" · ")}
            </Alerta>
          )}

          {estimacion && (
            <>
              <Resumen estimacion={estimacion} idioma={idioma} />
              <Ajustes parametros={parametros} onCambio={setParametros} />

              <PanelTelegramEstimacion
                ctx={{
                  proyecto: muestra?.nombre ?? PROYECTO_POR_DEFECTO,
                  cliente: CLIENTE,
                  origen: ORIGENES.find((o) => o.id === ingesta.origen)?.nombre ?? ingesta.origen,
                  archivo: ingesta.archivo,
                  estimacion,
                  parametros,
                  historico: HISTORICO_DEMO,
                  simulado: ingesta.simulado,
                  muestra: Boolean(muestra),
                  preparadoPor: PREPARADO_POR,
                }}
                informe={{
                  proyecto: muestra?.nombre ?? PROYECTO_POR_DEFECTO,
                  cliente: CLIENTE,
                  origen: ORIGENES.find((o) => o.id === ingesta.origen)?.nombre ?? ingesta.origen,
                  archivo: ingesta.archivo,
                  estimacion,
                  parametros,
                  historico: HISTORICO_DEMO,
                  simulado: ingesta.simulado,
                  muestra: Boolean(muestra),
                  preparadoPor: PREPARADO_POR,
                }}
                apu={{
                  proyecto: muestra?.nombre ?? PROYECTO_POR_DEFECTO,
                  cliente: CLIENTE,
                  // Solo los renglones con composición cargada: emitir 25 hojas
                  // donde 19 dicen "desglose agregado" no es un entregable, es
                  // relleno. Las que faltan salen cuando se cargue su análisis.
                  apus: estimacion.apus.filter((a) => a.desglose.detallado),
                  parametros,
                  simulado: ingesta.simulado,
                  muestra: Boolean(muestra),
                  preparadoPor: PREPARADO_POR,
                }}
              />

              <div className="flex flex-wrap gap-1.5" role="tablist">
                {(
                  [
                    ["mto", "Cómputo (MTO)"],
                    ["apu", "Precios unitarios"],
                    ["rfq", "Cotizaciones"],
                    ["benchmark", "Contra el histórico"],
                  ] as const
                ).map(([id, nombre]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={pestana === id}
                    onClick={() => setPestana(id)}
                    className={`flex min-h-11 items-center rounded-pildora border px-4 text-xs font-bold transition-colors ${
                      pestana === id
                        ? "border-marca bg-marca-tenue text-marca"
                        : "border-borde bg-superficie-2 text-texto-2 hover:text-texto"
                    }`}
                  >
                    {nombre}
                  </button>
                ))}
              </div>

              {pestana === "mto" && <TablaMto apus={estimacion.apus} idioma={idioma} />}
              {pestana === "apu" && <ListaApu apus={estimacion.apus} idioma={idioma} />}
              {pestana === "rfq" && <Cotizaciones apus={estimacion.apus} idioma={idioma} />}
              {pestana === "benchmark" && (
                <Benchmark estimacion={estimacion} idioma={idioma} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ingesta
// ---------------------------------------------------------------------------

function Ingesta({
  onModelo,
  origen,
  onOrigen,
  arrastrando,
  onArrastrando,
  procesando,
  onArchivo,
  entrada,
}: {
  onModelo: (m: (typeof MODELOS_DEMO)[number]) => void;
  origen: OrigenModelo;
  onOrigen: (o: OrigenModelo) => void;
  arrastrando: boolean;
  onArrastrando: (v: boolean) => void;
  procesando: boolean;
  onArchivo: (f: File) => void;
  entrada: React.RefObject<HTMLInputElement | null>;
}) {
  const def = ORIGENES.find((o) => o.id === origen);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          onArrastrando(true);
        }}
        onDragLeave={() => onArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          onArrastrando(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onArchivo(f);
        }}
        className={`flex min-h-[16rem] flex-col items-center justify-center rounded-tarjeta border-2 border-dashed p-8 text-center transition-colors ${
          arrastrando
            ? "border-marca bg-marca-tenue"
            : "border-borde-fuerte bg-superficie-2"
        }`}
      >
        {procesando ? (
          <>
            {/* Análisis en curso: la barra indeterminada dice "trabajando" sin
                prometer un porcentaje que no se puede calcular. */}
            <span
              aria-hidden="true"
              className="h-1.5 w-48 overflow-hidden rounded-pildora bg-superficie"
            >
              <span className="block h-full w-1/3 animate-pulse rounded-pildora bg-marca-fondo" />
            </span>
            <p className="mt-4 text-sm font-bold">Analizando objetos del modelo…</p>
            <p className="mt-1 text-xs text-texto-3">
              Extrayendo cantidades, especificaciones y disciplinas
            </p>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="text-4xl">
              ⬚
            </span>
            <p className="mt-3 text-sm font-bold">
              Arrastra el modelo o el schedule aquí
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-texto-3">
              {def?.extensiones.join(", ")} · o pulsa para elegirlo
            </p>
            <input
              ref={entrada}
              type="file"
              accept=".csv,.txt,.xml,.ifc,.rvt,.mac,.dat"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onArchivo(f);
                e.target.value = "";
              }}
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Boton variante="primario" onClick={() => entrada.current?.click()}>
                Elegir archivo
              </Boton>
              <Boton variante="suave" onClick={descargarPlantilla}>
                Descargar plantilla CSV
              </Boton>
            </div>

            {/*
              Los modelos de muestra van AQUÍ, dentro de la zona de carga, y no
              en una barra aparte: es lo primero que hace falta en una
              demostración, y esconderlo obliga a buscarlo delante del cliente.

              Son schedules CSV de verdad y pasan por el mismo lector que un
              export real. Una demostración que toma un atajo prueba el atajo.
            */}
            <div className="mt-6 w-full border-t border-borde pt-4">
              <p className="mono mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-texto-3">
                O carga un modelo de muestra
              </p>
              <p className="mb-3 text-[11px] text-texto-3">
                Schedules completos con datos ficticios. Se procesan de verdad.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODELOS_DEMO.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onModelo(m)}
                    className="min-h-11 rounded-control border border-borde-fuerte bg-superficie p-3 text-left transition-colors hover:border-marca"
                  >
                    <span className="block text-xs font-bold text-texto">{m.nombre}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-texto-3">
                      {m.gancho}
                    </span>
                    <span className="mono mt-1 block text-[10px] text-texto-3">
                      {m.filas.length} renglones · {m.archivo}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-2">
        <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
          Origen del modelo
        </p>
        {ORIGENES.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={o.id === origen}
            onClick={() => onOrigen(o.id)}
            className={`min-h-11 rounded-control border p-3 text-left transition-colors ${
              o.id === origen
                ? "border-marca bg-marca-tenue"
                : "border-borde bg-superficie hover:border-borde-fuerte"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold">{o.nombre}</span>
              {/* El soporte real se declara ANTES de subir nada, no después de
                  enseñar un resultado simulado. */}
              <Insignia
                tono={
                  o.soporte === "nativo" ? "ok" : o.soporte === "export" ? "info" : "advertencia"
                }
              >
                {o.soporte === "nativo"
                  ? "Se procesa"
                  : o.soporte === "export"
                    ? "Vía export"
                    : "Simulado"}
              </Insignia>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-texto-3">{o.nota}</p>
          </button>
        ))}
      </aside>
    </div>
  );
}

function descargarPlantilla() {
  const blob = new Blob(["﻿" + plantillaScheduleCsv()], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "apolo-schedule-plantilla.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Resumen ejecutivo
// ---------------------------------------------------------------------------

function Resumen({
  estimacion,
  idioma,
}: {
  estimacion: ReturnType<typeof estimar>;
  idioma: "es" | "en";
}) {
  const acero = estimacion.apus
    .filter((a) => a.renglon.unidad === "kg")
    .reduce((s, a) => s + a.cantidadFinal, 0);
  const concreto = estimacion.apus
    .filter((a) => a.renglon.unidad === "m³" || a.renglon.unidad === "m3")
    .reduce((s, a) => s + a.cantidadFinal, 0);

  const margen =
    estimacion.totalUsd > 0
      ? (estimacion.totalUtilidadUsd / estimacion.totalUsd) * 100
      : 0;

  const cifras = [
    { e: "Costo total ofertado", v: dinero(estimacion.totalUsd, idioma), d: "con indirectos y utilidad", destacada: true },
    { e: "Duración estimada", v: `${numero(Math.ceil(estimacion.diasEstimados), idioma)} días`, d: "ruta más larga, no la suma" },
    { e: "Horas-hombre", v: numero(Math.round(estimacion.horasHombre), idioma), d: "total del proyecto" },
    { e: "Acero", v: `${numero(Math.round(acero / 1000), idioma)} t`, d: "con desperdicio aplicado" },
    { e: "Concreto", v: `${numero(Math.round(concreto), idioma)} m³`, d: "con desperdicio aplicado" },
    { e: "Margen de utilidad", v: `${numero(margen, idioma)}%`, d: "sobre el precio ofertado" },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {cifras.map((c) => (
        <div
          key={c.e}
          className={`min-w-0 rounded-control border p-3 ${
            c.destacada
              ? "border-advertencia/50 bg-advertencia-tenue"
              : "border-borde bg-superficie-2"
          }`}
        >
          <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.08em] text-texto-3">
            {c.e}
          </p>
          <p className="cifra mt-1.5 break-words text-[clamp(1rem,1.6vw,1.35rem)] font-extrabold leading-none">
            {c.v}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-texto-3">{c.d}</p>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

function Ajustes({
  parametros,
  onCambio,
}: {
  parametros: Parametros;
  onCambio: (p: Parametros) => void;
}) {
  // Solo las claves numéricas: `modoMarkup` es una opción y va aparte.
  type ClaveNumerica = {
    [K in keyof Parametros]: Parametros[K] extends number ? K : never;
  }[keyof Parametros];

  const campos: { k: ClaveNumerica; nombre: string; paso: number }[] = [
    { k: "cuadrillas", nombre: "Cuadrillas", paso: 1 },
    { k: "personasPorCuadrilla", nombre: "Personas/cuadrilla", paso: 1 },
    { k: "horasJornada", nombre: "Horas/jornada", paso: 1 },
    { k: "costoHoraHombreUsd", nombre: "Costo HH (USD)", paso: 0.5 },
    { k: "fas", nombre: "FAS", paso: 0.1 },
    { k: "overhead", nombre: "Indirectos", paso: 0.01 },
    { k: "imprevistos", nombre: "Imprevistos", paso: 0.01 },
    { k: "utilidad", nombre: "Utilidad", paso: 0.01 },
  ];

  return (
    <section className="rounded-tarjeta border border-borde bg-superficie p-4">
      <p className="mono text-[11px] font-bold uppercase tracking-[0.12em] text-texto-3">
        Parámetros del estimador
      </p>
      <p className="mt-1 text-[11px] text-texto-3">
        Ninguno tiene un valor correcto universal: dependen de la empresa, el
        país y el contrato. Cambiarlos recalcula todo al instante.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {campos.map((c) => (
          <label key={c.k} className="min-w-0 text-xs">
            <span className="mb-1 block font-bold uppercase tracking-[0.06em] text-texto-3">
              {c.nombre}
            </span>
            <input
              type="number"
              step={c.paso}
              min={0}
              value={parametros[c.k]}
              onChange={(e) =>
                onCambio({
                  ...parametros,
                  [c.k]: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="min-h-11 w-full rounded-control border border-borde-fuerte bg-superficie px-2 text-sm text-texto"
            />
          </label>
        ))}

        <label className="min-w-0 text-xs sm:col-span-2">
          <span className="mb-1 block font-bold uppercase tracking-[0.06em] text-texto-3">
            Modo de recargo
          </span>
          <select
            value={parametros.modoMarkup}
            onChange={(e) =>
              onCambio({
                ...parametros,
                modoMarkup: e.target.value as Parametros["modoMarkup"],
              })
            }
            className="min-h-11 w-full rounded-control border border-borde-fuerte bg-superficie px-2 text-sm text-texto"
          >
            <option value="aditivo">Aditivo · sobre el costo directo</option>
            <option value="cascada">Cascada · sobre el subtotal anterior</option>
          </select>
        </label>
      </div>

      <p className="mt-3 text-[11px] text-texto-3">
        {parametros.modoMarkup === "aditivo" ? (
          <>
            Los tres recargos se calculan sobre el costo directo, como en la
            planilla del cliente. Suman{" "}
            <strong className="text-texto">
              {(
                (parametros.overhead + parametros.imprevistos + parametros.utilidad) *
                100
              ).toFixed(1)}
              %
            </strong>
            .
          </>
        ) : (
          <>
            Cada recargo se calcula sobre el subtotal anterior, así que también
            sobre los recargos: el total no es la suma de los tres, sino{" "}
            <strong className="text-texto">
              {(
                ((1 + parametros.overhead) *
                  (1 + parametros.imprevistos) *
                  (1 + parametros.utilidad) -
                  1) *
                100
              ).toFixed(1)}
              %
            </strong>
            . Rinde más, pero si el pliego trae la planilla del cliente, gana la
            planilla.
          </>
        )}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// MTO
// ---------------------------------------------------------------------------

function TablaMto({ apus, idioma }: { apus: Apu[]; idioma: "es" | "en" }) {
  const [filtro, setFiltro] = useState<Disciplina | "todas">("todas");
  const [busqueda, setBusqueda] = useState("");

  const filas = apus.filter((a) => {
    if (filtro !== "todas" && a.renglon.disciplina !== filtro) return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      a.renglon.codigo.toLowerCase().includes(q) ||
      a.renglon.descripcion.toLowerCase().includes(q) ||
      a.renglon.especificacion.toLowerCase().includes(q)
    );
  });

  return (
    <section className="rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.06em]">
          Cómputo métrico · {filas.length} renglones
        </h3>
        <Boton compacto variante="suave" onClick={() => exportarMto(apus)}>
          Exportar CSV
        </Boton>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar código, descripción o especificación"
          className="min-h-11 min-w-0 flex-1 rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
        />
        <div className="flex flex-wrap gap-1">
          {(["todas", ...DISCIPLINAS.map((d) => d.id)] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={filtro === d}
              onClick={() => setFiltro(d as Disciplina | "todas")}
              className={`flex min-h-11 items-center rounded-pildora border px-3 text-[11px] font-bold transition-colors ${
                filtro === d
                  ? "border-marca bg-marca-tenue text-marca"
                  : "border-borde bg-superficie-2 text-texto-3 hover:text-texto"
              }`}
            >
              {d === "todas" ? "Todas" : DISCIPLINAS.find((x) => x.id === d)?.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-xs">
          <thead>
            <tr className="border-b border-borde text-texto-3">
              <th className="py-2 font-bold">Código / descripción</th>
              <th className="py-2 font-bold">Especificación</th>
              <th className="py-2 text-right font-bold">Base</th>
              <th className="py-2 text-right font-bold">Merma</th>
              <th className="py-2 text-right font-bold">A comprar</th>
              <th className="py-2 text-right font-bold">HH</th>
              <th className="py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((a) => (
              <tr key={a.renglon.id} className="border-b border-borde last:border-0">
                <td className="py-2">
                  <span className="codigo font-bold">{a.renglon.codigo}</span>
                  <p className="truncate text-[11px] text-texto-3">
                    {a.renglon.descripcion}
                  </p>
                </td>
                <td className="py-2 text-[11px] text-texto-2">
                  {a.renglon.especificacion}
                </td>
                <td className="cifra py-2 text-right text-texto-3">
                  {numero(a.renglon.cantidadBase, idioma)}
                </td>
                <td className="py-2 text-right">
                  <span className="mono text-[11px] text-advertencia">
                    +{numero(a.renglon.factorDesperdicio * 100, idioma)}%
                  </span>
                </td>
                <td className="cifra py-2 text-right font-bold">
                  {numero(Math.round(a.cantidadFinal), idioma)} {a.renglon.unidad}
                </td>
                <td className="cifra py-2 text-right text-texto-2">
                  {numero(Math.round(a.horasHombre), idioma)}
                </td>
                <td className="cifra py-2 text-right font-bold">
                  {dineroCompacto(a.totalUsd, idioma)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function exportarMto(apus: Apu[]) {
  const columnas: ColumnaCsv<Apu>[] = [
    { clave: "disciplina", titulo: "Disciplina", valor: (a) => a.renglon.disciplina },
    { clave: "codigo", titulo: "Codigo", valor: (a) => a.renglon.codigo },
    { clave: "descripcion", titulo: "Descripcion", valor: (a) => a.renglon.descripcion },
    { clave: "spec", titulo: "Especificacion", valor: (a) => a.renglon.especificacion },
    { clave: "unidad", titulo: "Unidad", valor: (a) => a.renglon.unidad },
    { clave: "base", titulo: "Cantidad base", valor: (a) => a.renglon.cantidadBase },
    { clave: "merma", titulo: "Desperdicio", valor: (a) => a.renglon.factorDesperdicio },
    { clave: "final", titulo: "Cantidad a comprar", valor: (a) => a.cantidadFinal },
    { clave: "hh", titulo: "Horas hombre", valor: (a) => a.horasHombre },
    { clave: "pu", titulo: "Precio unitario USD", valor: (a) => a.precioUnitarioUsd },
    { clave: "total", titulo: "Total USD", valor: (a) => a.totalUsd },
  ];
  const blob = new Blob([BOM + aCSV(columnas, apus)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo("apolo-computo-mto");
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// APU
// ---------------------------------------------------------------------------

function ListaApu({ apus, idioma }: { apus: Apu[]; idioma: "es" | "en" }) {
  const [abierto, setAbierto] = useState<string | null>(apus[0]?.renglon.id ?? null);

  return (
    <section className="rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <h3 className="text-sm font-extrabold uppercase tracking-[0.06em]">
        Análisis de precios unitarios
      </h3>
      <p className="mt-1 text-[11px] text-texto-3">
        El FAS multiplica solo la mano de obra. Los indirectos y la utilidad se
        aplican en cascada, no sumados.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {apus.slice(0, 30).map((a) => {
          const activo = abierto === a.renglon.id;
          return (
            <li key={a.renglon.id} className="rounded-control border border-borde">
              <button
                type="button"
                aria-expanded={activo}
                onClick={() => setAbierto(activo ? null : a.renglon.id)}
                className="flex min-h-12 w-full flex-wrap items-center justify-between gap-2 p-3 text-left"
              >
                <span className="min-w-0">
                  <span className="codigo text-xs font-bold">{a.renglon.codigo}</span>
                  <span className="ml-2 text-xs text-texto-2">
                    {a.renglon.descripcion}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="cifra text-xs font-bold">
                    {dinero(a.precioUnitarioUsd, idioma)}/{a.renglon.unidad}
                  </span>
                  <span aria-hidden="true" className="text-texto-3">
                    {activo ? "−" : "+"}
                  </span>
                </span>
              </button>

              {activo && (
                <div className="border-t border-borde p-3">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                    {[
                      ["Materiales", a.materialesUsd],
                      ["Mano de obra (con FAS)", a.manoObraUsd],
                      ["Equipos", a.equiposUsd],
                      ["Costo directo", a.costoDirectoUsd],
                      ["Indirectos", a.indirectosUsd],
                      ["Utilidad", a.utilidadUsd],
                      ["Total del renglón", a.totalUsd],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="min-w-0">
                        <dt className="text-[10px] uppercase tracking-[0.06em] text-texto-3">
                          {k}
                        </dt>
                        <dd className="cifra mt-0.5 font-bold">
                          {dinero(Number(v), idioma)}
                        </dd>
                      </div>
                    ))}
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-[0.06em] text-texto-3">
                        Horas-hombre
                      </dt>
                      <dd className="cifra mt-0.5 font-bold">
                        {numero(Math.round(a.horasHombre), idioma)}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {apus.length > 30 && (
        <p className="mt-3 text-[11px] text-texto-3">
          Mostrando 30 de {apus.length}. El CSV del cómputo los trae todos.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// RFQ
// ---------------------------------------------------------------------------

function Cotizaciones({ apus, idioma }: { apus: Apu[]; idioma: "es" | "en" }) {
  const familias = agruparRfq(apus);

  return (
    <section className="rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.06em]">
            Solicitudes de cotización · {familias.length} familias
          </h3>
          <p className="mt-1 text-[11px] text-texto-3">
            Solo material: a un proveedor no se le pide que cotice la mano de
            obra ni la utilidad de la constructora.
          </p>
        </div>
        <Boton compacto variante="suave" onClick={() => exportarRfq(familias)}>
          Exportar RFQ
        </Boton>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {familias.map((f) => (
          <li
            key={`${f.familia}-${f.disciplina}`}
            className="rounded-control border border-borde bg-superficie-2 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="codigo text-xs font-bold">{f.familia}</span>
                <span className="ml-2 text-[11px] text-texto-3">
                  {DISCIPLINAS.find((d) => d.id === f.disciplina)?.nombre} ·{" "}
                  {f.renglones} renglones
                </span>
              </span>
              <Insignia tono="info">{dinero(f.montoEstimadoUsd, idioma)}</Insignia>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function exportarRfq(familias: ReturnType<typeof agruparRfq>) {
  type Fila = { familia: string; codigo: string; descripcion: string; spec: string; unidad: string; cantidad: number };
  const filas: Fila[] = familias.flatMap((f) =>
    f.items.map((i) => ({
      familia: f.familia,
      codigo: i.codigo,
      descripcion: i.descripcion,
      spec: i.especificacion,
      unidad: i.unidad,
      cantidad: i.cantidad,
    })),
  );
  const columnas: ColumnaCsv<Fila>[] = [
    { clave: "familia", titulo: "Familia", valor: (f) => f.familia },
    { clave: "codigo", titulo: "Codigo", valor: (f) => f.codigo },
    { clave: "descripcion", titulo: "Descripcion", valor: (f) => f.descripcion },
    { clave: "spec", titulo: "Especificacion", valor: (f) => f.spec },
    { clave: "unidad", titulo: "Unidad", valor: (f) => f.unidad },
    { clave: "cantidad", titulo: "Cantidad", valor: (f) => f.cantidad },
  ];
  const blob = new Blob([BOM + aCSV(columnas, filas)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo("apolo-rfq");
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Benchmark
// ---------------------------------------------------------------------------

function Benchmark({
  estimacion,
  idioma,
}: {
  estimacion: ReturnType<typeof estimar>;
  idioma: "es" | "en";
}) {
  const acero = estimacion.apus
    .filter((a) => a.renglon.unidad === "kg")
    .reduce((s, a) => s + a.cantidadFinal, 0);
  const hhPorTonEstimado = acero > 0 ? estimacion.horasHombre / (acero / 1000) : 0;
  const hhPorTonHistorico = promedioIndice(HISTORICO_DEMO, (d) => d.hhPorTonelada);
  const desviacion = desviacionRendimiento(hhPorTonEstimado, hhPorTonHistorico);

  const spi = promedioIndice(HISTORICO_DEMO, (d) => d.spi);
  const cpi = promedioIndice(HISTORICO_DEMO, (d) => d.cpi);

  const filas = HISTORICO_DEMO.map((o) => {
    const d = desempeno(o);
    return { nombre: o.codigo, spi: d.spi ?? 0, cpi: d.cpi ?? 0 };
  });

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { e: "SPI histórico", v: spi === null ? "—" : numero(spi, idioma), d: "bajo 1 = atrasado" },
          { e: "CPI histórico", v: cpi === null ? "—" : numero(cpi, idioma), d: "bajo 1 = sobrecosto" },
          {
            e: "HH/t estimadas",
            v: numero(Math.round(hhPorTonEstimado), idioma),
            d: hhPorTonHistorico === null ? "sin histórico" : `histórico ${Math.round(hhPorTonHistorico)}`,
          },
          {
            e: "Desviación",
            v: desviacion === null ? "—" : `${numero(desviacion, idioma)}%`,
            d: desviacion !== null && desviacion > 0 ? "más optimista que la historia" : "conservador",
            alerta: desviacion !== null && desviacion > 15,
          },
        ].map((c) => (
          <div
            key={c.e}
            className={`min-w-0 rounded-control border p-3 ${
              c.alerta ? "border-peligro/50 bg-peligro-tenue" : "border-borde bg-superficie-2"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-texto-3">
              {c.e}
            </p>
            <p className="cifra mt-1.5 text-lg font-extrabold leading-none">{c.v}</p>
            <p className="mt-1 text-[10px] leading-tight text-texto-3">{c.d}</p>
          </div>
        ))}
      </section>

      {desviacion !== null && desviacion > 15 && (
        <Alerta tono="peligro" titulo="La estimación es más optimista que el histórico">
          Se está prometiendo montar el acero un {Math.round(desviacion)}% más
          rápido de lo que esta empresa lo ha hecho nunca. O el rendimiento
          cargado es demasiado bueno, o hace falta justificar por qué esta obra
          será distinta.
        </Alerta>
      )}

      <section className="rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.06em]">
          Desempeño de obras anteriores
        </h3>
        <p className="mt-1 text-[11px] text-texto-3">
          Barras, no líneas: se comparan obras entre sí, no una evolución en el
          tiempo. La referencia es 1.
        </p>
        <ResponsiveContainer width="100%" height={220} className="mt-4">
          <BarChart data={filas} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} stroke={tono("--grafico-rejilla")} />
            <XAxis dataKey="nombre" stroke={tono("--grafico-eje")} fontSize={11} />
            <YAxis stroke={tono("--grafico-eje")} fontSize={11} width={42} domain={[0, 1.3]} />
            <Tooltip
              cursor={{ fill: tono("--superficie-2") }}
              contentStyle={{
                background: tono("--superficie"),
                border: `1px solid ${tono("--borde-fuerte")}`,
                borderRadius: 10,
                color: tono("--texto"),
                fontSize: 12,
              }}
              formatter={(v, n) => [numero(Number(v) || 0, idioma), String(n).toUpperCase()]}
            />
            <Bar dataKey="spi" radius={[4, 4, 0, 0]}>
              {filas.map((f) => (
                <Cell
                  key={`spi-${f.nombre}`}
                  // Rojo cuando el índice cae por debajo de 1: es el umbral que
                  // separa "cumplió" de "no cumplió", no un degradado.
                  fill={f.spi < 1 ? tono("--peligro") : tono("--serie-3")}
                />
              ))}
            </Bar>
            <Bar dataKey="cpi" radius={[4, 4, 0, 0]}>
              {filas.map((f) => (
                <Cell
                  key={`cpi-${f.nombre}`}
                  fill={f.cpi < 1 ? tono("--serie-2") : tono("--serie-4")}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
