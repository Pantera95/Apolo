import { describe, expect, it } from "vitest";

import {
  ahorroUsd,
  compararOfertas,
  costoDesembarcado,
  firmasExigidas,
  leadTimeDias,
  puedeAvanzar,
  puedeMover,
  recomendada,
  requisitos,
} from "@/lib/procura/nucleo";
import type { OfertaProveedor, ProcesoProcura } from "@/lib/procura/tipos";

const oferta = (p: Partial<OfertaProveedor> = {}): OfertaProveedor => ({
  id: "o1",
  proveedorId: "p1",
  proveedorNombre: "Proveedor",
  puntajeTecnico: 85,
  precioUsd: 100_000,
  incoterm: "DDP",
  fleteUsd: 0,
  seguroUsd: 0,
  aduanaUsd: 0,
  entregaSemanas: 8,
  creditoDias: 30,
  estado: "aprobada_tecnica",
  excepciones: [],
  ...p,
});

const proceso = (p: Partial<ProcesoProcura> = {}): ProcesoProcura => ({
  id: "pr1",
  codigo: "PROC-2026-001",
  titulo: "Válvulas de proceso",
  etapa: "requisicion",
  departamento: "Procura",
  obraId: null,
  criticidad: "normal",
  presupuestoUsd: 200_000,
  adjudicadoUsd: null,
  partidas: [],
  ofertas: [],
  aclaraciones: [],
  orden: null,
  creadoIso: "2026-01-01T00:00:00.000Z",
  ordenAprobadaIso: null,
  partidaPresupuestaria: "PRE-01",
  ...p,
});

// ---------------------------------------------------------------------------

describe("costo desembarcado", () => {
  /**
   * El error caro del módulo, y por qué existe esta función.
   *
   * Un FOB de 100.000 parece mejor que un DDP de 118.000, pero el FOB no
   * incluye flete, seguro ni aranceles. Con 25.000 de esos costos, el "barato"
   * cuesta 125.000. Quien compara la columna de precio adjudica mal siempre.
   */
  it("el FOB barato acaba siendo el caro", () => {
    const fob = oferta({
      incoterm: "FOB",
      precioUsd: 100_000,
      fleteUsd: 18_000,
      seguroUsd: 2_000,
      aduanaUsd: 5_000,
    });
    const ddp = oferta({ id: "o2", incoterm: "DDP", precioUsd: 118_000 });

    expect(fob.precioUsd).toBeLessThan(ddp.precioUsd);
    expect(costoDesembarcado(fob)).toBe(125_000);
    expect(costoDesembarcado(ddp)).toBe(118_000);
    expect(costoDesembarcado(fob)).toBeGreaterThan(costoDesembarcado(ddp));
  });

  it("no suma dos veces lo que el incoterm ya cubre", () => {
    // En un DDP el flete es problema del proveedor y ya está en su precio.
    const ddp = oferta({ incoterm: "DDP", precioUsd: 100_000, fleteUsd: 20_000 });
    expect(costoDesembarcado(ddp)).toBe(100_000);
  });

  it("el CIF solo necesita que se le sume la aduana", () => {
    const cif = oferta({
      incoterm: "CIF",
      precioUsd: 100_000,
      fleteUsd: 15_000,
      seguroUsd: 2_000,
      aduanaUsd: 8_000,
    });
    expect(costoDesembarcado(cif)).toBe(108_000);
  });
});

describe("cuadro comparativo", () => {
  it("ordena por costo desembarcado, no por precio", () => {
    const filas = compararOfertas([
      oferta({ id: "barata-en-papel", incoterm: "FOB", precioUsd: 100_000, fleteUsd: 30_000 }),
      oferta({ id: "cara-en-papel", incoterm: "DDP", precioUsd: 118_000 }),
    ]);
    expect(filas[0].oferta.id).toBe("cara-en-papel");
  });

  /**
   * Las rechazadas se listan pero no compiten. El expediente tiene que enseñar
   * a quién se dejó fuera, o la adjudicación no es auditable.
   */
  it("las rechazadas técnicamente van al final, sin desaparecer", () => {
    const filas = compararOfertas([
      oferta({ id: "rechazada", precioUsd: 50_000, estado: "rechazada_tecnica" }),
      oferta({ id: "aprobada", precioUsd: 90_000, estado: "aprobada_tecnica" }),
    ]);
    expect(filas).toHaveLength(2);
    expect(filas[0].oferta.id).toBe("aprobada");
    expect(filas[1].elegible).toBe(false);
  });

  it("el sobreprecio se mide contra la mejor ELEGIBLE", () => {
    // Si se midiera contra la rechazada de 50.000, la adjudicada parecería un
    // 80% cara cuando en realidad no había alternativa.
    const filas = compararOfertas([
      oferta({ id: "rechazada", precioUsd: 50_000, estado: "rechazada_tecnica" }),
      oferta({ id: "mejor", precioUsd: 90_000, estado: "aprobada_tecnica" }),
      oferta({ id: "otra", precioUsd: 99_000, estado: "aprobada_tecnica" }),
    ]);
    expect(filas.find((f) => f.oferta.id === "mejor")!.sobreMejorPct).toBeCloseTo(0);
    expect(filas.find((f) => f.oferta.id === "otra")!.sobreMejorPct).toBeCloseTo(10);
  });
});

describe("recomendada", () => {
  it("no recomienda 'la menos mala' cuando ninguna pasa", () => {
    // Una oferta que no cumple la norma no es una opción cara: no es opción.
    const r = recomendada([
      oferta({ estado: "rechazada_tecnica" }),
      oferta({ id: "o2", estado: "rechazada_tecnica" }),
    ]);
    expect(r).toBeNull();
  });

  it("elige la más barata desembarcada de las aprobadas", () => {
    const r = recomendada([
      oferta({ id: "a", precioUsd: 100_000, incoterm: "FOB", fleteUsd: 40_000 }),
      oferta({ id: "b", precioUsd: 120_000, incoterm: "DDP" }),
    ]);
    expect(r?.id).toBe("b");
  });
});

describe("puertas de etapa", () => {
  it("una requisición sin fichas técnicas no avanza", () => {
    const p = proceso({
      partidas: [
        { id: "i1", descripcion: "Válvula", cantidad: 10, unidad: "und", norma: "API 600", fichaTecnicaUrl: null },
      ],
    });
    const v = puedeAvanzar(p);
    expect(v.puede).toBe(false);
    expect(v.faltan).toContain("Todas las partidas con ficha técnica adjunta");
  });

  it("una licitación con dos ofertas no avanza", () => {
    // Tres invitados es la práctica; con menos hace falta justificar la fuente
    // única, y eso es una decisión, no un descuido.
    const p = proceso({ etapa: "licitacion", ofertas: [oferta(), oferta({ id: "o2" })] });
    expect(puedeAvanzar(p).faltan).toContain("Al menos tres ofertas recibidas");
  });

  it("una aclaración sin responder bloquea la licitación", () => {
    const p = proceso({
      etapa: "licitacion",
      ofertas: [oferta(), oferta({ id: "o2" }), oferta({ id: "o3" })],
      aclaraciones: [
        { id: "a1", proveedorNombre: "X", pregunta: "¿Clase 300?", respuesta: null, emiteBoletin: false, fechaIso: "2026-01-05T00:00:00.000Z" },
      ],
    });
    expect(puedeAvanzar(p).faltan).toContain("Sin aclaraciones técnicas abiertas");
  });

  it("evaluación sin dictamen en todas las ofertas no avanza", () => {
    const p = proceso({
      etapa: "evaluacion",
      ofertas: [oferta({ estado: "adjudicada" }), oferta({ id: "o2", estado: "en_revision" })],
      adjudicadoUsd: 100_000,
    });
    expect(puedeAvanzar(p).faltan).toContain(
      "Dictamen técnico emitido para todas las ofertas",
    );
  });

  it("con todo cumplido, avanza", () => {
    const p = proceso({
      partidas: [
        { id: "i1", descripcion: "Válvula", cantidad: 10, unidad: "und", norma: "API 600", fichaTecnicaUrl: "/f.pdf" },
      ],
    });
    const v = puedeAvanzar(p);
    expect(v.puede).toBe(true);
    expect(v.siguiente).toBe("licitacion");
  });

  it("el cierre no tiene etapa siguiente", () => {
    const p = proceso({ etapa: "cierre" });
    expect(puedeAvanzar(p).siguiente).toBeNull();
  });
});

describe("mover entre etapas", () => {
  it("no deja saltarse etapas hacia adelante", () => {
    const v = puedeMover(proceso({ etapa: "requisicion" }), "adjudicacion");
    expect(v.puede).toBe(false);
    expect(v.faltan[0]).toMatch(/saltar etapas/);
  });

  /**
   * Retroceder es sano y no pide requisitos: un expediente vuelve a licitación
   * porque llegó una aclaración que cambia el alcance.
   */
  it("deja retroceder sin condiciones", () => {
    const v = puedeMover(proceso({ etapa: "evaluacion" }), "licitacion");
    expect(v.puede).toBe(true);
    expect(v.faltan).toEqual([]);
  });

  it("mover a la misma etapa no hace nada", () => {
    expect(puedeMover(proceso({ etapa: "evaluacion" }), "evaluacion").puede).toBe(false);
  });
});

describe("matriz de autorización", () => {
  it("los tramos se acumulan", () => {
    // Una orden grande la firman TODOS los niveles por debajo, no solo el
    // último. Al revés tendría menos control que una orden pequeña.
    expect(firmasExigidas(30_000)).toEqual(["Analista de Procura"]);
    expect(firmasExigidas(800_000)).toEqual([
      "Analista de Procura",
      "Gerente de Procura",
      "Dirección de Operaciones",
    ]);
    expect(firmasExigidas(5_000_000)).toHaveLength(4);
  });

  it("un monto inválido no exige firmas", () => {
    expect(firmasExigidas(0)).toEqual([]);
    expect(firmasExigidas(Number.NaN)).toEqual([]);
  });
});

describe("indicadores", () => {
  it("el lead time solo cuenta expedientes con orden aprobada", () => {
    // Incluir los abiertos haría que el promedio bajara al entrar trabajo
    // nuevo, que es lo contrario de lo que mide.
    const d = leadTimeDias([
      proceso({ creadoIso: "2026-01-01T00:00:00.000Z", ordenAprobadaIso: "2026-01-31T00:00:00.000Z" }),
      proceso({ id: "abierto" }),
    ]);
    expect(d).toBeCloseTo(30, 0);
  });

  it("sin expedientes cerrados devuelve null, no cero", () => {
    // Cero días diría "instantáneo"; null dice "todavía no se sabe".
    expect(leadTimeDias([proceso()])).toBeNull();
  });

  it("el ahorro ignora lo que aún no se ha adjudicado", () => {
    const a = ahorroUsd([
      proceso({ presupuestoUsd: 100_000, adjudicadoUsd: 90_000 }),
      proceso({ id: "abierto", presupuestoUsd: 500_000, adjudicadoUsd: null }),
    ]);
    expect(a.montoUsd).toBe(10_000);
    expect(a.pct).toBeCloseTo(10);
  });

  it("un sobrecosto sale negativo, no se esconde en cero", () => {
    const a = ahorroUsd([proceso({ presupuestoUsd: 100_000, adjudicadoUsd: 115_000 })]);
    expect(a.montoUsd).toBe(-15_000);
    expect(a.pct).toBeCloseTo(-15);
  });
});

describe("requisitos del cierre", () => {
  it("exige pago ejecutado", () => {
    const p = proceso({
      etapa: "cierre",
      orden: {
        numero: "OC-1",
        montoUsd: 90_000,
        estadoAprobacion: "acusada",
        firmas: [],
        acusadaIso: "2026-02-01T00:00:00.000Z",
        pdfUrl: "/oc.pdf",
        estadoFinanciero: "facturado",
      },
    });
    expect(requisitos(p).find((r) => r.texto === "Pago ejecutado")?.cumple).toBe(false);
  });
});
