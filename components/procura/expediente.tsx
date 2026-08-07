"use client";

import { useState } from "react";

import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import { aCSV, BOM, nombreArchivo, type ColumnaCsv } from "@/lib/datos/csv";
import { dinero, numero } from "@/lib/datos/indicadores";
import {
  compararOfertas,
  firmasExigidas,
  recomendada,
  requisitos,
  type FilaComparativo,
} from "@/lib/procura/nucleo";
import { ETAPAS, type EstadoOferta, type ProcesoProcura } from "@/lib/procura/tipos";

/**
 * Expediente de procura: las cinco pestañas del EDT.
 *
 * Es la vista que se audita. Todo lo que sostiene la adjudicación —quién
 * cotizó, quién quedó fuera y por qué, qué se preguntó, quién firmó— tiene que
 * poder leerse aquí sin abrir otro sistema.
 */

type Pestana = "requisicion" | "licitacion" | "evaluacion" | "orden" | "cierre";

const TONO_OFERTA: Record<EstadoOferta, TonoInsignia> = {
  recibida: "neutro",
  en_revision: "info",
  aprobada_tecnica: "ok",
  rechazada_tecnica: "peligro",
  adjudicada: "marca",
};

const NOMBRE_OFERTA: Record<EstadoOferta, string> = {
  recibida: "Recibida",
  en_revision: "En revisión",
  aprobada_tecnica: "Aprobada técnica",
  rechazada_tecnica: "Rechazada técnica",
  adjudicada: "Adjudicada",
};

export function Expediente({
  proceso: p,
  onCerrar,
  onActualizar,
}: {
  proceso: ProcesoProcura;
  onCerrar: () => void;
  onActualizar: (p: ProcesoProcura) => void;
}) {
  const [pestana, setPestana] = useState<Pestana>("requisicion");
  const comparativo = compararOfertas(p.ofertas);
  const mejor = recomendada(p.ofertas);

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={`${p.codigo} · ${p.titulo}`}
      descripcion={`${p.departamento} · ${ETAPAS.find((e) => e.id === p.etapa)?.nombre}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {(
            [
              ["requisicion", "1 · Requisición"],
              ["licitacion", "2 · Licitación"],
              ["evaluacion", "3 · Evaluación"],
              ["orden", "4 · Orden de compra"],
              ["cierre", "5 · Cierre"],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pestana === id}
              onClick={() => setPestana(id)}
              className={`flex min-h-11 items-center rounded-pildora border px-3 text-[11px] font-bold transition-colors ${
                pestana === id
                  ? "border-marca bg-marca-tenue text-marca"
                  : "border-borde bg-superficie-2 text-texto-2 hover:text-texto"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        {pestana === "requisicion" && <TabRequisicion proceso={p} />}
        {pestana === "licitacion" && <TabLicitacion proceso={p} onActualizar={onActualizar} />}
        {pestana === "evaluacion" && (
          <TabEvaluacion proceso={p} comparativo={comparativo} mejorId={mejor?.id ?? null} />
        )}
        {pestana === "orden" && <TabOrden proceso={p} />}
        {pestana === "cierre" && <TabCierre proceso={p} />}
      </div>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="mono text-[10px] font-bold uppercase tracking-[0.1em] text-texto-3">
        {etiqueta}
      </p>
      <p className="mt-0.5 text-sm font-bold">{valor}</p>
    </div>
  );
}

function TabRequisicion({ proceso: p }: { proceso: ProcesoProcura }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato etiqueta="Presupuesto base" valor={dinero(p.presupuestoUsd)} />
        <Dato etiqueta="Partida" valor={p.partidaPresupuestaria} />
        <Dato etiqueta="Criticidad" valor={p.criticidad} />
        <Dato etiqueta="Partidas" valor={numero(p.partidas.length)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-xs">
          <thead>
            <tr className="border-b-2 border-borde-fuerte text-left text-[10px] uppercase tracking-[0.08em] text-texto-3">
              <th className="pb-1.5 pr-2 font-bold">Descripción</th>
              <th className="pb-1.5 pr-2 text-right font-bold">Cant.</th>
              <th className="pb-1.5 pr-2 font-bold">Norma</th>
              <th className="pb-1.5 font-bold">Data sheet</th>
            </tr>
          </thead>
          <tbody>
            {p.partidas.map((i) => (
              <tr key={i.id} className="border-b border-borde">
                <td className="py-1.5 pr-2">{i.descripcion}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {numero(i.cantidad)} {i.unidad}
                </td>
                <td className="py-1.5 pr-2 text-texto-2">{i.norma || "—"}</td>
                <td className="py-1.5">
                  {i.fichaTecnicaUrl ? (
                    <Insignia tono="ok">Adjunta</Insignia>
                  ) : (
                    // Sin ficha técnica el proveedor cotiza a ciegas y después
                    // reclama. Se marca en rojo, no en gris.
                    <Insignia tono="peligro">Falta</Insignia>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabLicitacion({
  proceso: p,
  onActualizar,
}: {
  proceso: ProcesoProcura;
  onActualizar: (p: ProcesoProcura) => void;
}) {
  const abiertas = p.aclaraciones.filter((a) => a.respuesta === null).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.06em]">
          Licitantes invitados
        </p>
        <ul className="flex flex-col gap-1.5">
          {p.ofertas.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-1.5 text-xs last:border-0"
            >
              <span className="font-bold">{o.proveedorNombre}</span>
              <span className="flex items-center gap-2">
                <span className="mono text-texto-3">
                  {dinero(o.precioUsd)} · {o.incoterm} · {o.entregaSemanas} sem
                </span>
                <Insignia tono={TONO_OFERTA[o.estado]}>{NOMBRE_OFERTA[o.estado]}</Insignia>
              </span>
            </li>
          ))}
          {p.ofertas.length === 0 && (
            <li className="text-xs text-texto-3">Aún no hay ofertas cargadas.</li>
          )}
        </ul>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.06em]">
            Aclaraciones técnicas (TQ / RFI)
          </p>
          {abiertas > 0 && (
            <Insignia tono="advertencia">{abiertas} sin responder</Insignia>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {p.aclaraciones.map((a) => (
            <li key={a.id} className="rounded-control border border-borde bg-superficie-2 p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{a.proveedorNombre}</span>
                {/*
                  Un boletín cambia el alcance para TODOS los licitantes, no
                  solo para quien preguntó. Por eso se marca aparte.
                */}
                {a.emiteBoletin && <Insignia tono="info">Emite boletín</Insignia>}
              </div>
              <p className="mt-1 text-texto-2">{a.pregunta}</p>
              {a.respuesta ? (
                <p className="mt-1 border-l-2 border-ok pl-2 text-texto">{a.respuesta}</p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Insignia tono="advertencia">Sin responder</Insignia>
                  <Boton
                    compacto
                    variante="suave"
                    onClick={() =>
                      onActualizar({
                        ...p,
                        aclaraciones: p.aclaraciones.map((x) =>
                          x.id === a.id
                            ? { ...x, respuesta: "Respondida en la reunión de aclaratorias." }
                            : x,
                        ),
                      })
                    }
                  >
                    Marcar respondida
                  </Boton>
                </div>
              )}
            </li>
          ))}
          {p.aclaraciones.length === 0 && (
            <li className="text-xs text-texto-3">Sin aclaraciones registradas.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function TabEvaluacion({
  proceso: p,
  comparativo,
  mejorId,
}: {
  proceso: ProcesoProcura;
  comparativo: FilaComparativo[];
  mejorId: string | null;
}) {
  function exportar() {
    const columnas: ColumnaCsv<FilaComparativo>[] = [
      { clave: "proveedor", titulo: "Proveedor", valor: (f) => f.oferta.proveedorNombre },
      { clave: "estado", titulo: "Estado tecnico", valor: (f) => NOMBRE_OFERTA[f.oferta.estado] },
      { clave: "puntaje", titulo: "Puntaje tecnico", valor: (f) => f.oferta.puntajeTecnico },
      { clave: "precio", titulo: "Precio oferta USD", valor: (f) => f.oferta.precioUsd },
      { clave: "incoterm", titulo: "Incoterm", valor: (f) => f.oferta.incoterm },
      { clave: "flete", titulo: "Flete USD", valor: (f) => f.oferta.fleteUsd },
      { clave: "seguro", titulo: "Seguro USD", valor: (f) => f.oferta.seguroUsd },
      { clave: "aduana", titulo: "Aduana USD", valor: (f) => f.oferta.aduanaUsd },
      // La columna que decide la adjudicacion. Va despues de sus sumandos para
      // que quien audite el CSV vea de donde sale.
      { clave: "desembarcado", titulo: "Costo desembarcado USD", valor: (f) => f.costoDesembarcadoUsd },
      { clave: "delta", titulo: "Sobre mejor %", valor: (f) => f.sobreMejorPct.toFixed(1) },
      { clave: "entrega", titulo: "Entrega semanas", valor: (f) => f.oferta.entregaSemanas },
      { clave: "credito", titulo: "Credito dias", valor: (f) => f.oferta.creditoDias },
      { clave: "excepciones", titulo: "Excepciones", valor: (f) => f.oferta.excepciones.join(" | ") },
    ];
    const csv = BOM + aCSV(columnas, comparativo);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo(`comparativo-${p.codigo}`);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-[0.06em]">
          Cuadro comparativo
        </p>
        <Boton compacto variante="suave" onClick={exportar}>
          Exportar CSV
        </Boton>
      </div>

      {/*
        La columna que decide es COSTO DESEMBARCADO, no el precio de oferta.
        Se dice en pantalla porque es exactamente el error que este cuadro
        existe para evitar.
      */}
      <p className="text-[11px] leading-snug text-texto-3">
        Se ordena por <strong className="text-texto">costo desembarcado</strong>: el
        precio de oferta no es comparable entre incoterms distintos, porque un FOB
        no incluye flete, seguro ni aranceles.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-xs">
          <thead>
            <tr className="border-b-2 border-borde-fuerte text-left text-[10px] uppercase tracking-[0.08em] text-texto-3">
              <th className="pb-1.5 pr-2 font-bold">Proveedor</th>
              <th className="pb-1.5 pr-2 text-right font-bold">Téc.</th>
              <th className="pb-1.5 pr-2 text-right font-bold">Oferta</th>
              <th className="pb-1.5 pr-2 font-bold">Incoterm</th>
              <th className="pb-1.5 pr-2 text-right font-bold">Desembarcado</th>
              <th className="pb-1.5 pr-2 text-right font-bold">Δ</th>
              <th className="pb-1.5 pr-2 text-right font-bold">Entrega</th>
              <th className="pb-1.5 font-bold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {comparativo.map((f) => {
              const esMejor = f.oferta.id === mejorId;
              return (
                <tr
                  key={f.oferta.id}
                  className={`border-b border-borde ${f.elegible ? "" : "opacity-60"}`}
                >
                  <td className="py-1.5 pr-2">
                    <span className="font-bold">{f.oferta.proveedorNombre}</span>
                    {esMejor && (
                      <span className="ml-1.5 inline-block align-middle">
                        <Insignia tono="marca">Recomendada</Insignia>
                      </span>
                    )}
                    {f.oferta.excepciones.length > 0 && (
                      <p className="mt-0.5 text-[10px] leading-snug text-advertencia">
                        {f.oferta.excepciones.join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {f.oferta.puntajeTecnico ?? "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-texto-3">
                    {dinero(f.oferta.precioUsd)}
                  </td>
                  <td className="py-1.5 pr-2 mono text-[10px]">{f.oferta.incoterm}</td>
                  <td className="py-1.5 pr-2 text-right font-bold tabular-nums">
                    {dinero(f.costoDesembarcadoUsd)}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-texto-3">
                    {f.elegible && f.sobreMejorPct > 0.05
                      ? `+${f.sobreMejorPct.toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {f.oferta.entregaSemanas} sem
                  </td>
                  <td className="py-1.5">
                    <Insignia tono={TONO_OFERTA[f.oferta.estado]}>
                      {NOMBRE_OFERTA[f.oferta.estado]}
                    </Insignia>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {comparativo.length === 0 && (
        <p className="text-xs text-texto-3">Sin ofertas que comparar.</p>
      )}

      {mejorId === null && comparativo.length > 0 && (
        <p className="rounded-control border border-peligro bg-peligro-tenue p-3 text-xs text-peligro">
          Ninguna oferta pasó el dictamen técnico. No hay recomendación: una
          oferta que no cumple la norma no es una alternativa más cara, es una
          alternativa que no existe.
        </p>
      )}
    </div>
  );
}

function TabOrden({ proceso: p }: { proceso: ProcesoProcura }) {
  const monto = p.adjudicadoUsd ?? 0;
  const exigidas = firmasExigidas(monto);

  if (!p.orden) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-texto-3">
          Todavía no se ha generado la orden de compra. Se genera al adjudicar.
        </p>
        {monto > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.06em]">
              Firmas que exigiría {dinero(monto)}
            </p>
            <ul className="flex flex-col gap-1 text-xs text-texto-2">
              {exigidas.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const o = p.orden;
  const pendientes = o.firmas.filter((f) => f.firmadoIso === null).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato etiqueta="Orden" valor={o.numero} />
        <Dato etiqueta="Monto" valor={dinero(o.montoUsd)} />
        <Dato etiqueta="Aprobación" valor={o.estadoAprobacion.replace(/_/g, " ")} />
        <Dato
          etiqueta="Acuse del proveedor"
          valor={o.acusadaIso ? new Date(o.acusadaIso).toLocaleDateString("es-VE") : "Pendiente"}
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.06em]">
            Matriz de autorización (DOA)
          </p>
          {pendientes > 0 && <Insignia tono="advertencia">{pendientes} pendientes</Insignia>}
        </div>
        {/*
          Los tramos son acumulativos: una orden grande la firman todos los
          niveles por debajo. Se listan en orden de firma.
        */}
        <ul className="flex flex-col gap-1.5">
          {o.firmas.map((f) => (
            <li
              key={f.rol}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-1.5 text-xs last:border-0"
            >
              <span>
                <span className="font-bold">{f.rol}</span>
                <span className="ml-2 text-texto-3">{f.nombre}</span>
              </span>
              {f.firmadoIso ? (
                <Insignia tono="ok">
                  Firmada · {new Date(f.firmadoIso).toLocaleDateString("es-VE")}
                </Insignia>
              ) : (
                <Insignia tono="neutro">Pendiente</Insignia>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TabCierre({ proceso: p }: { proceso: ProcesoProcura }) {
  // El checklist sale de las MISMAS funciones que bloquean el avance: si aquí
  // se listara otra cosa, el expediente diría estar completo y no avanzaría.
  const lista = requisitos({ ...p, etapa: "cierre" });
  const o = p.orden;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato etiqueta="Presupuesto" valor={dinero(p.presupuestoUsd)} />
        <Dato etiqueta="Adjudicado" valor={p.adjudicadoUsd ? dinero(p.adjudicadoUsd) : "—"} />
        <Dato
          etiqueta="Ahorro"
          valor={
            p.adjudicadoUsd ? dinero(p.presupuestoUsd - p.adjudicadoUsd) : "—"
          }
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.06em]">
          Estado financiero
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(["sin_iniciar", "anticipo_pagado", "facturado", "pagado"] as const).map((e) => (
            <Insignia key={e} tono={o?.estadoFinanciero === e ? "marca" : "neutro"}>
              {e.replace(/_/g, " ")}
            </Insignia>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.06em]">
          Checklist de expediente
        </p>
        <ul className="flex flex-col gap-1.5">
          {lista.map((r) => (
            <li
              key={r.texto}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-1.5 text-xs last:border-0"
            >
              <span>{r.texto}</span>
              <Insignia tono={r.cumple ? "ok" : "advertencia"}>
                {r.cumple ? "Completo" : "Pendiente"}
              </Insignia>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
