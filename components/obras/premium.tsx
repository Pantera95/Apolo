"use client";

import { useRef, useState } from "react";

import { Alerta } from "@/components/ui/alerta";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia, type TonoInsignia } from "@/components/ui/insignia";
import {
  avanceContraPresupuesto,
  deudaEscalada,
  estadoPresupuesto,
  importarPresupuesto,
  plantillaPresupuestoCsv,
  resumirEscalado,
  verificarCierre,
  type Tramo,
} from "@/lib/datos/obra-premium";
import {
  PLANTILLAS_OBRA,
  aTextoPlanoObra,
  componerObra,
  type EventoObra,
} from "@/lib/datos/plantillas-obra";
import {
  guardarPresupuesto,
  limpiarPresupuesto,
  usePresupuesto,
} from "@/lib/datos/presupuesto-store";
import { dinero, numero } from "@/lib/datos/indicadores";
import type { EstadoApolo } from "@/lib/db/almacen";
import type { Obra } from "@/lib/dominio/tipos";
import { usePreferencias } from "@/lib/preferencias";

const TONO_TRAMO: Record<Tramo, TonoInsignia> = {
  reciente: "neutro",
  "30": "advertencia",
  "60": "peligro",
  "90": "peligro",
};

const ETIQUETA_TRAMO: Record<Tramo, string> = {
  reciente: "< 30 días",
  "30": "30–59 días",
  "60": "60–89 días",
  "90": "90+ días",
};

/**
 * Bloque Premium de la ficha de obra.
 *
 * Tres funciones que comparten pantalla porque comparten decisión: si esta obra
 * se puede cerrar, cuánto se ha gastado de lo previsto y qué queda fuera. Un
 * gerente que abre la ficha para decidir el cierre necesita las tres a la vez.
 */
export function ObraPremium({
  estado,
  obra,
  ahora,
  demo,
}: {
  estado: EstadoApolo;
  obra: Obra;
  ahora: number;
  demo: boolean;
}) {
  const { idioma } = usePreferencias();
  const presupuesto = usePresupuesto();

  const avance = avanceContraPresupuesto(estado, obra, presupuesto);
  const cierre = verificarCierre(estado, obra, ahora);
  const deudas = deudaEscalada(estado, obra.id, ahora);
  const escalado = resumirEscalado(deudas);
  const est = estadoPresupuesto(avance.consumo);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Insignia tono="marca">Premium</Insignia>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.06em]">
            Control de obra
          </h2>
        </div>
        <EnviarObra
          obra={obra}
          avance={avance}
          cierre={cierre}
          deudas={deudas}
          escalado={escalado}
          demo={demo}
        />
      </div>

      <Presupuesto avance={avance} estado={est} estadoApolo={estado} idioma={idioma} />
      <CierreObra cierre={cierre} />
      <DeudaEscaladaPanel deudas={deudas} escalado={escalado} idioma={idioma} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1 · Presupuesto
// ---------------------------------------------------------------------------

function Presupuesto({
  avance,
  estado,
  estadoApolo,
  idioma,
}: {
  avance: ReturnType<typeof avanceContraPresupuesto>;
  estado: ReturnType<typeof estadoPresupuesto>;
  estadoApolo: EstadoApolo;
  idioma: "es" | "en";
}) {
  const pct = Math.round((avance.consumo ?? 0) * 100);
  const maximo = Math.max(
    avance.presupuestadoUsd,
    avance.consumidoUsd + avance.comprometidoUsd,
    1,
  );
  const ancho = (v: number) => `${Math.min(100, (v / maximo) * 100)}%`;

  return (
    <section className="rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.06em]">
            Presupuesto de material
          </h3>
          <p className="mt-0.5 text-xs text-texto-3">
            Lo comprometido todavía se puede parar; lo consumido ya no.
          </p>
        </div>
        <ImportarPresupuesto estadoApolo={estadoApolo} />
      </div>

      {estado === "sin-presupuesto" ? (
        <div className="mt-4">
          <Alerta tono="info" titulo="Sin presupuesto cargado">
            Importa el cómputo de material para poder ver la desviación. Sin él,
            el consumo de esta obra es un número sin referencia.
          </Alerta>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <p className="cifra text-3xl font-extrabold leading-none">{pct}%</p>
            <Insignia
              tono={
                estado === "excedido" ? "peligro" : estado === "aviso" ? "advertencia" : "ok"
              }
              punto
            >
              {estado === "excedido"
                ? "Excedido"
                : estado === "aviso"
                  ? "Cerca del límite"
                  : "Dentro del presupuesto"}
            </Insignia>
            <span className="text-xs text-texto-3">
              {avance.desviacionUsd > 0
                ? `${dinero(avance.desviacionUsd, idioma)} por encima`
                : `${dinero(Math.abs(avance.desviacionUsd), idioma)} de margen`}
            </span>
          </div>

          {/* Barras apiladas: consumido y comprometido sobre el presupuesto.
              La marca del 100% se dibuja aparte para que se vea el punto en el
              que se cruza, no solo que se cruzó. */}
          <div className="mt-4 flex flex-col gap-2">
            <Barra
              etiqueta="Presupuestado"
              valor={avance.presupuestadoUsd}
              ancho={ancho(avance.presupuestadoUsd)}
              clase="bg-borde-fuerte"
              idioma={idioma}
            />
            <Barra
              etiqueta="Consumido"
              valor={avance.consumidoUsd}
              ancho={ancho(avance.consumidoUsd)}
              clase={estado === "excedido" ? "bg-peligro" : "bg-marca-fondo"}
              idioma={idioma}
            />
            <Barra
              etiqueta="Comprometido"
              valor={avance.comprometidoUsd}
              ancho={ancho(avance.comprometidoUsd)}
              clase="bg-advertencia"
              idioma={idioma}
            />
          </div>

          {avance.excedidos.length > 0 && (
            <div className="mt-4">
              <p className="mono mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-texto-3">
                Renglones excedidos
              </p>
              <ul className="flex flex-col gap-1.5">
                {avance.excedidos.slice(0, 6).map((r) => (
                  <li
                    key={r.articuloCodigo}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-1.5 text-xs last:border-0"
                  >
                    <span className="min-w-0 truncate">
                      <span className="codigo font-bold">{r.articuloCodigo}</span>
                      {r.presupuestadoUsd === 0 && (
                        <span className="ml-2 text-texto-3">sin presupuestar</span>
                      )}
                    </span>
                    <Insignia tono="peligro">
                      +{dinero(r.desviacionUsd, idioma)}
                    </Insignia>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Barra({
  etiqueta,
  valor,
  ancho,
  clase,
  idioma,
}: {
  etiqueta: string;
  valor: number;
  ancho: string;
  clase: string;
  idioma: "es" | "en";
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="text-texto-2">{etiqueta}</span>
        <span className="cifra font-bold">{dinero(valor, idioma)}</span>
      </div>
      <span
        aria-hidden="true"
        className="mt-1 block h-2.5 overflow-hidden rounded-pildora bg-superficie-2"
      >
        <span className={`block h-full rounded-pildora ${clase}`} style={{ width: ancho }} />
      </span>
    </div>
  );
}

function ImportarPresupuesto({ estadoApolo }: { estadoApolo: EstadoApolo }) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState<{
    lineas: number;
    errores: string[];
    desconocidos: string[];
  } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const presupuesto = usePresupuesto();

  async function alElegir(archivo: File) {
    const texto = await archivo.text();
    if (texto.startsWith("PK")) {
      setResultado({
        lineas: 0,
        errores: ["Es un .xlsx. Ábrelo en Excel y guárdalo como CSV."],
        desconocidos: [],
      });
      return;
    }
    const codigos = new Set(estadoApolo.articulos.map((a) => a.codigo));
    const r = importarPresupuesto(texto, codigos);
    setResultado({ lineas: r.lineas.length, errores: r.errores, desconocidos: r.desconocidos });
    if (r.lineas.length > 0) {
      guardarPresupuesto({
        lineas: r.lineas,
        importadoEn: new Date().toISOString(),
        archivo: archivo.name,
      });
    }
  }

  return (
    <>
      <Boton compacto variante={presupuesto ? "suave" : "luz"} onClick={() => setAbierto(true)}>
        <span aria-hidden="true" className="mr-1.5">
          ↥
        </span>
        {presupuesto ? "Presupuesto cargado" : "Importar presupuesto"}
      </Boton>

      <Dialogo
        abierto={abierto}
        titulo="Importar presupuesto de material"
        onCerrar={() => {
          setAbierto(false);
          setResultado(null);
        }}
      >
        <div className="flex flex-col gap-4">
          <Alerta tono="info" titulo="Formato">
            Cuatro columnas: obra, artículo, cantidad y costo unitario. El
            separador se detecta solo.
          </Alerta>

          <div className="rounded-control border border-borde bg-superficie-2 p-3">
            <p className="mono text-[11px] leading-relaxed text-texto-2">
              Obra;Articulo;Cantidad;Costo unitario
              <br />
              OBR-2401;CEM-42R;1200;8.40
              <br />
              OBR-2401;ACE-12MM;3400;1.15
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={entrada}
              type="file"
              accept=".csv,text/csv,.txt"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void alElegir(f);
                e.target.value = "";
              }}
            />
            <Boton variante="primario" onClick={() => entrada.current?.click()}>
              Elegir archivo
            </Boton>
            <Boton variante="suave" onClick={descargarPlantilla}>
              Descargar plantilla
            </Boton>
            {presupuesto && (
              <Boton
                variante="peligro"
                onClick={() => {
                  limpiarPresupuesto();
                  setResultado(null);
                }}
              >
                Borrar
              </Boton>
            )}
          </div>

          {resultado && (
            <div className="flex flex-col gap-2">
              {resultado.lineas > 0 && (
                <Alerta tono="luz" titulo="Importado">
                  {resultado.lineas} renglones de presupuesto.
                </Alerta>
              )}
              {resultado.desconocidos.length > 0 && (
                <Alerta tono="advertencia" titulo="Códigos que no están en el catálogo">
                  {/* Se listan: un código mal escrito nunca cruzaría con un
                      consumo y la obra parecería gastar de menos. */}
                  {resultado.desconocidos.join(", ")}
                </Alerta>
              )}
              {resultado.errores.length > 0 && (
                <Alerta tono="peligro" titulo="Errores">
                  {resultado.errores.join(" · ")}
                </Alerta>
              )}
            </div>
          )}
        </div>
      </Dialogo>
    </>
  );
}

function descargarPlantilla() {
  const blob = new Blob(["﻿" + plantillaPresupuestoCsv()], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "apolo-presupuesto-plantilla.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// 3 · Cierre
// ---------------------------------------------------------------------------

function CierreObra({ cierre }: { cierre: ReturnType<typeof verificarCierre> }) {
  return (
    <section className="rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.06em]">
          Cierre de obra
        </h3>
        <Insignia tono={cierre.puedeCerrar ? "ok" : "peligro"} punto>
          {cierre.puedeCerrar ? "Lista para cerrar" : `${cierre.bloqueos.length} bloqueos`}
        </Insignia>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {[...cierre.bloqueos, ...cierre.advertencias].map((b) => (
          <li
            key={b.id}
            className={`rounded-control border p-3 ${
              b.gravedad === "bloqueante"
                ? "border-peligro/40 bg-peligro-tenue"
                : "border-advertencia/40 bg-advertencia-tenue"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold">
                {b.gravedad === "bloqueante" ? "🔴" : "🟡"} {b.titulo}
              </span>
              <a
                href={b.enlace}
                className="flex min-h-11 items-center text-xs font-bold text-marca hover:underline"
              >
                Resolver →
              </a>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-texto-3">{b.detalle}</p>
          </li>
        ))}
        {cierre.bloqueos.length === 0 && cierre.advertencias.length === 0 && (
          <li className="text-sm text-texto-3">
            Sin pendientes. No queda material, herramienta ni saldo por resolver.
          </li>
        )}
      </ul>

      {/*
        El botón se DESHABILITA cuando hay bloqueos, no se oculta: esconderlo
        dejaría al usuario buscando dónde está, en vez de entender por qué no
        puede usarlo. Es la misma regla que el resto del producto — el sistema
        no ofrece el paso, en vez de dejar hacerlo y avisar después.
      */}
      <div className="mt-4">
        <Boton
          variante="primario"
          disabled={!cierre.puedeCerrar}
          title={
            cierre.puedeCerrar
              ? "Cerrar la obra"
              : "Resuelve los bloqueos antes de poder cerrar"
          }
        >
          Cerrar obra
        </Boton>
        {!cierre.puedeCerrar && (
          <p className="mt-2 text-[11px] text-texto-3">
            Cerrar con saldo vivo lo haría desaparecer del panel sin haberse
            resuelto.
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5 · Deuda escalada
// ---------------------------------------------------------------------------

function DeudaEscaladaPanel({
  deudas,
  escalado,
  idioma,
}: {
  deudas: ReturnType<typeof deudaEscalada>;
  escalado: ReturnType<typeof resumirEscalado>;
  idioma: "es" | "en";
}) {
  if (deudas.length === 0) return null;

  const tramos: Tramo[] = ["reciente", "30", "60", "90"];

  return (
    <section className="rounded-tarjeta border border-borde-fuerte bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.06em]">
          Deuda de herramienta
        </h3>
        {escalado.enRiesgoUsd > 0 && (
          <Insignia tono="peligro" punto>
            {dinero(escalado.enRiesgoUsd, idioma)} en riesgo
          </Insignia>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tramos.map((t) => (
          <div
            key={t}
            className={`rounded-control border p-2.5 ${
              t === "60" || t === "90"
                ? "border-peligro/40 bg-peligro-tenue"
                : "border-borde bg-superficie-2"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-texto-3">
              {ETIQUETA_TRAMO[t]}
            </p>
            <p className="cifra mt-1 text-lg font-extrabold leading-none">
              {numero(Math.round(escalado.porTramo[t].unidades), idioma)}
            </p>
            <p className="mt-0.5 text-[10px] text-texto-3">
              {dinero(escalado.porTramo[t].valorUsd, idioma)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-xs">
          <thead>
            <tr className="border-b border-borde text-texto-3">
              <th className="py-2 font-bold">Artículo</th>
              <th className="py-2 text-right font-bold">Und.</th>
              <th className="py-2 text-right font-bold">Días</th>
              <th className="py-2 font-bold">Registró</th>
              <th className="py-2 text-right font-bold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {deudas.slice(0, 10).map((d) => (
              <tr key={d.articuloCodigo} className="border-b border-borde last:border-0">
                <td className="py-2">
                  <span className="codigo font-bold">{d.articuloCodigo}</span>
                  <p className="truncate text-[11px] text-texto-3">{d.descripcion}</p>
                </td>
                <td className="cifra py-2 text-right">{numero(Math.round(d.unidades), idioma)}</td>
                <td className="py-2 text-right">
                  <Insignia tono={TONO_TRAMO[d.tramo]}>{d.diasMax}</Insignia>
                </td>
                <td className="py-2 text-texto-2">{d.responsable}</td>
                <td className="cifra py-2 text-right font-bold">
                  {dinero(d.valorUsd, idioma)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-texto-3">
        &laquo;Registró&raquo; es quien anotó la salida en el sistema, no
        necesariamente quien custodia la herramienta. Para eso haría falta un
        campo de custodio en el préstamo.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Envío por Telegram
// ---------------------------------------------------------------------------

function EnviarObra({
  obra,
  avance,
  cierre,
  deudas,
  escalado,
  demo,
}: {
  obra: Obra;
  avance: ReturnType<typeof avanceContraPresupuesto>;
  cierre: ReturnType<typeof verificarCierre>;
  deudas: ReturnType<typeof deudaEscalada>;
  escalado: ReturnType<typeof resumirEscalado>;
  demo: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [evento, setEvento] = useState<EventoObra>("cierre");
  const [chatId, setChatId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; motivo: string } | null>(null);

  const html = componerObra(evento, {
    obra,
    avance,
    cierre,
    deudas,
    escalado,
    enlace:
      typeof window === "undefined"
        ? `https://apolo-swift.vercel.app/obras/${obra.id}`
        : `${window.location.origin}/obras/${obra.id}`,
    demo,
  });

  async function enviar() {
    setEnviando(true);
    setResultado(null);
    try {
      const r = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: html,
          chatId: chatId.trim() || undefined,
          clave: `${obra.id}|${evento}`,
        }),
      });
      const d = (await r.json()) as { enviado?: boolean; motivo?: string };
      setResultado({
        ok: Boolean(d.enviado),
        motivo: d.motivo ?? "Telegram aceptó el mensaje.",
      });
    } catch (e) {
      setResultado({ ok: false, motivo: e instanceof Error ? e.message : String(e) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Boton compacto variante="suave" onClick={() => setAbierto(true)}>
        <span aria-hidden="true" className="mr-1.5">
          ✈
        </span>
        Enviar por Telegram
      </Boton>

      <Dialogo
        abierto={abierto}
        titulo={`Informe de obra · ${obra.codigo}`}
        onCerrar={() => {
          setAbierto(false);
          setResultado(null);
        }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
              Plantilla
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PLANTILLAS_OBRA.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === evento}
                  onClick={() => {
                    setEvento(p.id);
                    setResultado(null);
                  }}
                  className={`min-h-11 rounded-control border p-3 text-left transition-colors ${
                    p.id === evento
                      ? "border-marca bg-marca-tenue"
                      : "border-borde bg-superficie hover:border-borde-fuerte"
                  }`}
                >
                  <span className="block text-xs font-bold">{p.nombre}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-texto-3">
                    {p.descripcion}
                  </span>
                  <span className="mono mt-1 block text-[10px] uppercase tracking-[0.1em] text-texto-3">
                    {p.cuando}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="text-xs">
            <span className="mb-1.5 block font-extrabold uppercase tracking-[0.08em] text-texto-2">
              Chat de destino
            </span>
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Vacío = chat por defecto del servidor"
              className="min-h-12 w-full rounded-control border border-borde-fuerte bg-superficie px-3 text-sm text-texto"
            />
          </label>

          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-texto-2">
              Vista previa
            </p>
            {/* El mensaje exacto, antes de enviarlo: un botón de envío sin vista
                previa manda a ciegas a un grupo de la empresa. */}
            <pre className="mono max-h-64 overflow-auto whitespace-pre-wrap rounded-control border border-borde bg-superficie-2 p-3 text-[11px] leading-relaxed text-texto-2">
              {aTextoPlanoObra(html)}
            </pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <Boton variante="primario" onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar ahora"}
            </Boton>
            <Boton
              variante="suave"
              onClick={() => void navigator.clipboard?.writeText(aTextoPlanoObra(html))}
            >
              Copiar texto
            </Boton>
          </div>

          {resultado && (
            <Alerta
              tono={resultado.ok ? "luz" : "advertencia"}
              titulo={resultado.ok ? "Mensaje enviado" : "No se envió"}
            >
              {resultado.motivo}
            </Alerta>
          )}
        </div>
      </Dialogo>
    </>
  );
}
