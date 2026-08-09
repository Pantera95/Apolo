"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Expediente } from "@/components/procura/expediente";
import { Boton } from "@/components/ui/boton";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { TarjetaKpi } from "@/components/ui/tarjeta";
import { dinero, dineroCompacto, numero } from "@/lib/datos/indicadores";
import {
  activos,
  ahorroUsd,
  leadTimeDias,
  porEtapa,
  puedeAvanzar,
  puedeMover,
} from "@/lib/procura/nucleo";
import { PROCESOS_DEMO } from "@/lib/procura/simulado";
import { ETAPAS, type Criticidad, type EtapaProcura, type ProcesoProcura } from "@/lib/procura/tipos";

/**
 * Procura — tablero del ciclo de compra.
 *
 * EL TABLERO NO ES DECORATIVO: mover una tarjeta ejecuta la misma puerta que
 * validaría un backend. Un expediente no sale de licitación sin tres ofertas y
 * las aclaraciones cerradas, ni de evaluación sin dictamen técnico. Un Kanban
 * donde todo se arrastra a cualquier sitio produce compras que ningún auditor
 * puede justificar después.
 *
 * El estado vive en memoria porque Apolo todavía no tiene backend. Las reglas,
 * en cambio, son funciones puras y con pruebas: cuando entre la base de datos
 * cambia quién las llama, no lo que hacen.
 */

const TONO_ETAPA: Record<EtapaProcura, TonoInsignia> = {
  requisicion: "neutro",
  licitacion: "info",
  evaluacion: "advertencia",
  adjudicacion: "marca",
  cierre: "ok",
};

const TONO_CRITICIDAD: Record<Criticidad, TonoInsignia> = {
  critica: "peligro",
  alta: "advertencia",
  normal: "neutro",
};

function tono(css: string): string {
  if (typeof window === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(css).trim() || "#888";
}

export function TableroProcura() {
  const [procesos, setProcesos] = useState<ProcesoProcura[]>(PROCESOS_DEMO);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [filtroEtapa, setFiltroEtapa] = useState<EtapaProcura | "todas">("todas");
  const [busqueda, setBusqueda] = useState("");
  const [rechazo, setRechazo] = useState<{ codigo: string; faltan: string[] } | null>(null);

  const visibles = useMemo(
    () =>
      procesos.filter((p) => {
        if (filtroEtapa !== "todas" && p.etapa !== filtroEtapa) return false;
        const q = busqueda.trim().toLowerCase();
        if (!q) return true;
        return (
          p.codigo.toLowerCase().includes(q) ||
          p.titulo.toLowerCase().includes(q) ||
          p.departamento.toLowerCase().includes(q) ||
          p.ofertas.some((o) => o.proveedorNombre.toLowerCase().includes(q))
        );
      }),
    [procesos, filtroEtapa, busqueda],
  );

  // Los KPI se calculan sobre TODO, no sobre lo filtrado: un indicador que
  // cambia al escribir en el buscador no es un indicador, es un resultado de
  // búsqueda con aspecto de indicador.
  const kpi = useMemo(
    () => ({
      activos: activos(procesos),
      lead: leadTimeDias(procesos),
      ahorro: ahorroUsd(procesos),
      etapas: porEtapa(procesos),
    }),
    [procesos],
  );

  function mover(id: string, destino: EtapaProcura) {
    const p = procesos.find((x) => x.id === id);
    if (!p) return;
    const v = puedeMover(p, destino);
    if (!v.puede) {
      setRechazo({ codigo: p.codigo, faltan: v.faltan });
      return;
    }
    setRechazo(null);
    setProcesos((ps) => ps.map((x) => (x.id === id ? { ...x, etapa: destino } : x)));
  }

  const expediente = procesos.find((p) => p.id === abierto) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_16rem]">
        <TarjetaKpi
          etiqueta="Requisiciones activas"
          valor={numero(kpi.activos.total)}
          pie={`${dineroCompacto(kpi.activos.valorUsd)} en juego`}
          variante="marca"
        />
        <TarjetaKpi
          etiqueta="Lead time promedio"
          // `null` no es cero: sin expedientes cerrados el dato no existe,
          // y un "0 días" diría que la procura es instantánea.
          valor={kpi.lead === null ? "—" : `${Math.round(kpi.lead)} d`}
          pie={kpi.lead === null ? "sin órdenes aprobadas aún" : "de requisición a OC aprobada"}
          variante="contorno"
        />
        <TarjetaKpi
          etiqueta="Ahorro negociado"
          valor={dinero(kpi.ahorro.montoUsd)}
          pie={`${kpi.ahorro.pct >= 0 ? "" : "sobrecosto de "}${Math.abs(kpi.ahorro.pct).toFixed(1)}% vs. presupuesto`}
          variante={kpi.ahorro.montoUsd >= 0 ? "luz" : "contorno"}
        />
        <AnilloEtapas datos={kpi.etapas} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Código, título, departamento o proveedor"
          className="min-h-11 min-w-0 flex-1 rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {([["todas", "Todas"], ...ETAPAS.map((e) => [e.id, e.corto] as const)] as const).map(
            ([id, texto]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filtroEtapa === id}
                onClick={() => setFiltroEtapa(id as EtapaProcura | "todas")}
                className={`flex min-h-11 items-center rounded-pildora border px-3 text-[11px] font-bold transition-colors ${
                  filtroEtapa === id
                    ? "border-marca bg-marca-tenue text-marca"
                    : "border-borde bg-superficie-2 text-texto-2 hover:text-texto"
                }`}
              >
                {texto}
              </button>
            ),
          )}
        </div>
      </div>

      {rechazo && (
        <div
          data-mov="aviso"
          className="rounded-control border border-advertencia bg-advertencia-tenue p-3 text-xs"
        >
          <p className="font-bold text-advertencia">
            {rechazo.codigo} no puede avanzar todavía
          </p>
          <ul className="mt-1 list-disc pl-5 text-texto-2">
            {rechazo.faltan.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/*
        Columnas en scroll horizontal propio. El cuerpo de la página nunca debe
        desplazarse en horizontal: rompe la lectura de todo lo demás.
      */}
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="flex min-w-max gap-3">
          {ETAPAS.map((etapa) => {
            const enEtapa = visibles.filter((p) => p.etapa === etapa.id);
            return (
              <section key={etapa.id} className="flex w-72 shrink-0 flex-col gap-2">
                <header className="flex items-center justify-between gap-2 border-b-2 border-borde-fuerte pb-2">
                  <div className="min-w-0">
                    <p className="mono text-[10px] font-bold tracking-[0.12em] text-texto-3">
                      {etapa.edt}
                    </p>
                    <h3 className="truncate text-xs font-extrabold uppercase tracking-[0.04em]">
                      {etapa.corto}
                    </h3>
                  </div>
                  <Insignia tono={TONO_ETAPA[etapa.id]}>{enEtapa.length}</Insignia>
                </header>

                {enEtapa.length === 0 ? (
                  <p className="rounded-control border border-dashed border-borde p-4 text-center text-[11px] text-texto-3">
                    Sin expedientes
                  </p>
                ) : (
                  enEtapa.map((p) => (
                    <Tarjetita
                      key={p.id}
                      proceso={p}
                      onAbrir={() => setAbierto(p.id)}
                      onMover={mover}
                    />
                  ))
                )}
              </section>
            );
          })}
        </div>
      </div>

      {expediente && (
        <Expediente
          proceso={expediente}
          onCerrar={() => setAbierto(null)}
          onActualizar={(p) =>
            setProcesos((ps) => ps.map((x) => (x.id === p.id ? p : x)))
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Tarjetita({
  proceso: p,
  onAbrir,
  onMover,
}: {
  proceso: ProcesoProcura;
  onAbrir: () => void;
  onMover: (id: string, destino: EtapaProcura) => void;
}) {
  const v = puedeAvanzar(p);
  const idx = ETAPAS.findIndex((e) => e.id === p.etapa);
  const anterior = idx > 0 ? ETAPAS[idx - 1].id : null;

  return (
    <article className="rounded-tarjeta border border-borde bg-superficie p-3">
      <button
        type="button"
        onClick={onAbrir}
        className="block w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="mono text-[10px] font-bold text-texto-3">{p.codigo}</span>
          <Insignia tono={TONO_CRITICIDAD[p.criticidad]}>{p.criticidad}</Insignia>
        </div>
        <p className="mt-1 text-xs font-bold leading-snug">{p.titulo}</p>
        <p className="mt-1 text-[11px] text-texto-3">{p.departamento}</p>
        <p className="mt-1.5 text-sm font-extrabold text-marca">
          {dinero(p.adjudicadoUsd ?? p.presupuestoUsd)}
        </p>
        {p.adjudicadoUsd !== null && (
          <p className="text-[10px] text-texto-3">
            presupuesto {dineroCompacto(p.presupuestoUsd)}
          </p>
        )}
      </button>

      {/*
        Lo que falta se enseña EN LA TARJETA, no al intentar mover. Descubrir
        el bloqueo solo al arrastrar obliga a probar para saber.
      */}
      {v.faltan.length > 0 && (
        <p className="mt-2 border-t border-borde pt-2 text-[10px] leading-snug text-advertencia">
          Falta: {v.faltan[0]}
          {v.faltan.length > 1 && ` (+${v.faltan.length - 1})`}
        </p>
      )}

      <div className="mt-2 flex gap-1.5">
        {anterior && (
          <Boton compacto variante="suave" onClick={() => onMover(p.id, anterior)}>
            ←
          </Boton>
        )}
        {v.siguiente && (
          <Boton
            compacto
            variante={v.puede ? "primario" : "suave"}
            onClick={() => onMover(p.id, v.siguiente as EtapaProcura)}
            // No se deshabilita: pulsar explica QUÉ falta. Un botón muerto no
            // enseña nada y el usuario no sabe si está roto.
          >
            Avanzar →
          </Boton>
        )}
      </div>
    </article>
  );
}

function AnilloEtapas({
  datos,
}: {
  datos: { etapa: EtapaProcura; total: number; valorUsd: number }[];
}) {
  const conDatos = datos.filter((d) => d.total > 0);
  const colores = ["--serie-1", "--serie-2", "--serie-3", "--serie-4", "--serie-5"];

  return (
    <div className="rounded-tarjeta border border-borde bg-superficie p-3">
      <p className="mono mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-texto-3">
        Por etapa
      </p>
      {conDatos.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-texto-3">Sin expedientes</p>
      ) : (
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={conDatos}
                dataKey="total"
                nameKey="etapa"
                innerRadius="55%"
                outerRadius="88%"
                paddingAngle={2}
                stroke="none"
              >
                {conDatos.map((d, i) => (
                  <Cell key={d.etapa} fill={tono(colores[i % colores.length])} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => {
                  const total = Number(v);
                  return [
                    `${total} expediente${total === 1 ? "" : "s"}`,
                    ETAPAS.find((e) => e.id === String(n))?.corto ?? String(n),
                  ];
                }}
                contentStyle={{
                  background: "var(--superficie)",
                  border: "1px solid var(--borde-fuerte)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
