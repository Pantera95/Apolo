import type { Metadata } from "next";
import Link from "next/link";

import { MarcaApolo } from "@/components/ui/icono";

import "./landing.css";

/**
 * Landing de Apolo.
 *
 * COPIA LA ESTRUCTURA DE LA REFERENCIA, sección por sección: héroe centrado con
 * rótulo de arcos, "sobre nosotros", rejilla de funciones, beneficios,
 * indicadores, testimonio, pasos, planes y cierre. Lo que cambia es el
 * contenido, que es el de Apolo y no el de una plantilla de IA.
 *
 * Es un componente de SERVIDOR. No hay estado en toda la página: el revelado al
 * hacer scroll corre en CSS con `animation-timeline: view()`, así que la
 * landing no envía ni un kilobyte de JavaScript propio.
 *
 * NADA DE FACTURAS. Apolo no emite documentos fiscales y la página no puede
 * insinuar lo contrario: quien llegue aquí no debe irse creyendo que sustituye
 * a su sistema de facturación.
 */

export const metadata: Metadata = {
  title: "Apolo — Control de almacén y obra",
  description:
    "Inventario, despacho, obras y procura de una constructora de Oil & Gas en una sola pantalla. Kardex inmutable y trazabilidad de punta a punta.",
};

const MODULOS = [
  {
    titulo: "Inventario con kardex inmutable",
    texto:
      "Cada movimiento queda asentado y no se edita ni se borra. Un error se corrige con un asiento contrario, así que el histórico siempre cuadra con lo que hay en el estante.",
  },
  {
    titulo: "Despacho y ruta",
    texto:
      "Qué salió, hacia qué obra, con qué guía y en manos de quién. El material en tránsito deja de ser una llamada telefónica.",
  },
  {
    titulo: "Obras y consumo",
    texto:
      "El material despachado y aún no consumido se ve por obra, no agregado. Es la cifra que suele estar escondida en una hoja de cálculo.",
  },
  {
    titulo: "Herramienta asignada",
    texto:
      "Deuda abierta por obra y por responsable, con antigüedad. La herramienta sin retornar deja de descubrirse en el inventario anual.",
  },
  {
    titulo: "Solicitudes y aprobación",
    texto:
      "Pedidos de obra con su cadena de firmas según monto. Nada avanza de etapa sin los requisitos de esa etapa cubiertos.",
  },
  {
    titulo: "Procura y estimaciones",
    texto:
      "Comparación de ofertas a costo desembarcado real —incoterm, flete, seguro y aduana— y cómputos métricos con su análisis de precio unitario.",
  },
];

const PASOS = [
  {
    n: "01",
    titulo: "Se importa lo que ya existe",
    texto:
      "Apolo consume los exports del ERP del cliente. La integración es de un solo sentido: nunca escribe en el sistema de origen, así que adoptarlo no pone en riesgo nada de lo que ya funciona.",
  },
  {
    n: "02",
    titulo: "El almacén opera contra Apolo",
    texto:
      "Entradas, despachos, devoluciones y traslados. Cada operación devuelve un resultado explícito: un descuadre es una condición de negocio que se informa, no un error que se traga.",
  },
  {
    n: "03",
    titulo: "La dirección lo ve sin pedirlo",
    texto:
      "Panel, informes en PDF y consultas por Telegram desde el canal de la empresa. El bot es de solo lectura: consulta, nunca aprueba ni cancela.",
  },
];

const INDICADORES = [
  { cifra: "11", pie: "módulos operativos" },
  { cifra: "631", pie: "pruebas automáticas en verde" },
  { cifra: "1", pie: "sentido de integración: Apolo nunca escribe en el ERP" },
  { cifra: "0", pie: "documentos fiscales emitidos, por diseño" },
];

export default function Presentacion() {
  return (
    <div className="landing">
      {/* El halo ancho va en su propia capa, con desenfoque distinto al de las
          cintas: compartiendo capa, el blur del halo borra la dirección del
          trazo y las cintas vuelven a ser niebla. */}
      <div className="halo" aria-hidden="true" />

      {/* ── Navegación ─────────────────────────────────────────────────── */}
      <header className="landing-ancho flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <MarcaApolo tam={30} />
          <span className="text-[1.0625rem] font-medium tracking-[-0.02em] text-[color:var(--tinta)]">
            Apolo
          </span>
        </div>
        <Link href="/" className="pildora pildora--fantasma">
          Entrar a la aplicación
        </Link>
      </header>

      {/* ── Héroe ──────────────────────────────────────────────────────── */}
      <section className="landing-ancho pb-8 pt-10 text-center sm:pt-16">
        <p className="rotulo" data-revelar>
          Almacén y obra
        </p>

        <h1 className="mx-auto mt-6 max-w-[18ch]" data-revelar>
          Todo el almacén y la obra en una sola pantalla
        </h1>

        <p
          className="mx-auto mt-5 text-balance text-[1.0625rem] text-[color:var(--tinta-2)]"
          data-revelar
        >
          Inventario, despacho, obras y procura para una constructora de Oil &amp; Gas.
          Con el kardex inmutable como base, para que el histórico siempre cuadre.
        </p>

        <div
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
          data-revelar
        >
          <Link href="/" className="pildora pildora--solida">
            Ver la demostración
          </Link>
          <Link href="#modulos" className="pildora pildora--fantasma">
            Qué incluye
          </Link>
        </div>

        {/*
          El marco del producto. En la referencia va una captura de la
          aplicación; aquí se dibuja la silueta del panel real —barra lateral
          oscura y tarjetas— para no depender de una imagen que quede desfasada
          en cuanto cambie una pantalla.
        */}
        <div className="marco mx-auto mt-14 max-w-4xl" data-revelar>
          <div className="flex gap-2 rounded-xl bg-[#00031c] p-2 text-left">
            <div className="hidden w-40 shrink-0 flex-col gap-1.5 rounded-lg bg-white/[0.03] p-2.5 sm:flex">
              {["Panel", "Obras", "Solicitudes", "Despacho", "Inventario", "Compras"].map(
                (n, i) => (
                  <span
                    key={n}
                    className={`rounded-md px-2 py-1.5 text-[11px] ${
                      i === 0
                        ? "bg-white/10 text-[color:var(--tinta)]"
                        : "text-[color:var(--tinta-3)]"
                    }`}
                  >
                    {n}
                  </span>
                ),
              )}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ["Material en obra", "USD 60.638"],
                ["Valor disponible", "USD 122.326"],
                ["Herramienta sin retornar", "146"],
                ["Por llegar", "USD 47.266"],
                ["Solicitudes por aprobar", "3"],
                ["En ruta", "USD 18.904"],
              ].map(([r, v]) => (
                <div key={r} className="rounded-lg bg-white/[0.04] p-3">
                  <p className="truncate text-[10px] text-[color:var(--tinta-3)]">{r}</p>
                  <p className="mt-1 text-[15px] tabular-nums text-[color:var(--tinta)]">
                    {v}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Qué resuelve ───────────────────────────────────────────────── */}
      <section className="landing-ancho landing-seccion">
        <p className="rotulo" data-revelar>
          Qué resuelve
        </p>
        <h2 className="mx-auto mt-6 max-w-[22ch] text-center" data-revelar>
          El material existe. Lo que falta es saber dónde está
        </h2>
        <p
          className="mx-auto mt-5 text-balance text-center text-[color:var(--tinta-2)]"
          data-revelar
        >
          En una obra grande el inventario se lleva en hojas de cálculo que nadie
          concilia, la herramienta se presta de palabra y el material despachado
          desaparece del radar hasta que alguien lo busca. Apolo cierra ese hueco sin
          pedirle a nadie que cambie de ERP.
        </p>
      </section>

      {/* ── Módulos ────────────────────────────────────────────────────── */}
      <section id="modulos" className="landing-ancho landing-seccion scroll-mt-8">
        <p className="rotulo" data-revelar>
          Módulos
        </p>
        <h2 className="mx-auto mt-6 max-w-[20ch] text-center" data-revelar>
          Lo que Apolo controla
        </h2>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => (
            <article key={m.titulo} className="panel" data-revelar>
              <h3>{m.titulo}</h3>
              <p className="mt-2.5 text-[0.9375rem] text-[color:var(--tinta-2)]">
                {m.texto}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Indicadores ────────────────────────────────────────────────── */}
      <section className="landing-ancho landing-seccion">
        <p className="rotulo" data-revelar>
          Estado
        </p>
        <h2 className="mx-auto mt-6 max-w-[20ch] text-center" data-revelar>
          Lo que hay construido hoy
        </h2>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INDICADORES.map((i) => (
            <div key={i.pie} className="panel text-center" data-revelar>
              <p className="text-[2.5rem] leading-none tracking-[-0.04em] text-[color:var(--tinta)]">
                {i.cifra}
              </p>
              <p className="mt-2.5 text-[0.8125rem] text-[color:var(--tinta-3)]">
                {i.pie}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ──────────────────────────────────────────────── */}
      <section className="landing-ancho landing-seccion">
        <p className="rotulo" data-revelar>
          Cómo funciona
        </p>
        <h2 className="mx-auto mt-6 max-w-[20ch] text-center" data-revelar>
          Tres pasos, sin migrar nada
        </h2>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {PASOS.map((p) => (
            <article key={p.n} className="panel" data-revelar>
              <span className="text-[0.8125rem] tabular-nums text-[color:var(--luz-rosa)]">
                {p.n}
              </span>
              <h3 className="mt-3">{p.titulo}</h3>
              <p className="mt-2.5 text-[0.9375rem] text-[color:var(--tinta-2)]">
                {p.texto}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Límites ────────────────────────────────────────────────────── */}
      <section className="landing-ancho landing-seccion">
        <p className="rotulo" data-revelar>
          Límites
        </p>
        <h2 className="mx-auto mt-6 max-w-[24ch] text-center" data-revelar>
          Lo que Apolo no hace, y no va a hacer
        </h2>
        <p
          className="mx-auto mt-5 text-balance text-center text-[color:var(--tinta-2)]"
          data-revelar
        >
          Decirlo por delante ahorra una conversación incómoda más tarde.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            [
              "No emite facturas",
              "Ni ningún documento fiscal. Ese papel sale del sistema que ya lo emite hoy, y Apolo no toca nada que roce cumplimiento tributario.",
            ],
            [
              "No escribe en tu ERP",
              "Consume sus exports y punto. Si Apolo se apaga mañana, el sistema de origen queda exactamente igual que estaba.",
            ],
            [
              "No integra transportistas",
              "Sin marketplaces ni conectores de mensajería. El seguimiento de ruta es interno, contra tus propias guías.",
            ],
          ].map(([t, d]) => (
            <article key={t} className="panel" data-revelar>
              <h3>{t}</h3>
              <p className="mt-2.5 text-[0.9375rem] text-[color:var(--tinta-2)]">{d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Cierre ─────────────────────────────────────────────────────── */}
      <section className="landing-ancho landing-seccion">
        <div className="panel px-6 py-14 text-center sm:px-12" data-revelar>
          <h2 className="mx-auto max-w-[20ch]">Míralo funcionando con datos cargados</h2>
          <p className="mx-auto mt-4 text-balance text-[color:var(--tinta-2)]">
            La demostración trae inventario, obras, despachos y solicitudes ya poblados.
            Son cifras ficticias: ninguna procede de un cliente real.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="pildora pildora--solida">
              Abrir la demostración
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-ancho flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-8 text-[0.8125rem] text-[color:var(--tinta-3)]">
        <div className="flex items-center gap-2">
          <MarcaApolo tam={22} />
          <span>Apolo — Control de almacén y obra</span>
        </div>
        <span>Demostración con datos ficticios</span>
      </footer>
    </div>
  );
}
