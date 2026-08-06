import { describe, expect, it } from "vitest";

import { proximaEjecucion, toca, VENTANA_MIN, type Programado } from "@/lib/dashboard/vencimiento";

// Lunes 3 de agosto de 2026, 07:05 hora local.
const LUNES_0705 = new Date(2026, 7, 3, 7, 5, 0, 0).getTime();

const base: Programado = { activa: true, hora: 7, minuto: 0, dias: [] };

describe("toca", () => {
  it("envía dentro de la ventana", () => {
    expect(toca(base, LUNES_0705).debe).toBe(true);
  });

  it("no envía antes de la hora", () => {
    const antes = new Date(2026, 7, 3, 6, 55).getTime();
    const r = toca(base, antes);
    expect(r.debe).toBe(false);
    expect(r.motivo).toContain("hora");
  });

  it("no envía pasada la ventana", () => {
    // Un resumen de las 7:00 recibido a las 18:00 desinforma más que informa.
    const tarde = new Date(2026, 7, 3, 18, 0).getTime();
    expect(toca(base, tarde).debe).toBe(false);
  });

  it("el borde de la ventana sigue enviando", () => {
    const borde = new Date(2026, 7, 3, 7, VENTANA_MIN).getTime();
    expect(toca(base, borde).debe).toBe(true);
  });

  it("una programación desactivada nunca envía", () => {
    expect(toca({ ...base, activa: false }, LUNES_0705).debe).toBe(false);
  });

  it("respeta los días elegidos", () => {
    // Lunes = 1. Programada solo para sábados y domingos.
    expect(toca({ ...base, dias: [0, 6] }, LUNES_0705).debe).toBe(false);
    expect(toca({ ...base, dias: [1] }, LUNES_0705).debe).toBe(true);
  });

  it("días vacío significa todos los días", () => {
    expect(toca({ ...base, dias: [] }, LUNES_0705).debe).toBe(true);
  });

  it("no repite si ya se envió hoy", () => {
    // Sin este freno, cada recarga reenviaría el mismo resumen al grupo.
    const yaHoy = { ...base, ultimoEnvio: new Date(2026, 7, 3, 7, 1).toISOString() };
    const r = toca(yaHoy, LUNES_0705);
    expect(r.debe).toBe(false);
    expect(r.motivo).toContain("hoy");
  });

  it("un envío de ayer no bloquea el de hoy", () => {
    const ayer = { ...base, ultimoEnvio: new Date(2026, 7, 2, 7, 1).toISOString() };
    expect(toca(ayer, LUNES_0705).debe).toBe(true);
  });

  it("un ultimoEnvio ilegible no bloquea el envío", () => {
    expect(toca({ ...base, ultimoEnvio: "basura" }, LUNES_0705).debe).toBe(true);
  });
});

describe("proximaEjecucion", () => {
  it("si hoy ya pasó, salta al día siguiente", () => {
    const tarde = new Date(2026, 7, 3, 20, 0).getTime();
    const p = proximaEjecucion(base, tarde);
    expect(p.getDate()).toBe(4);
    expect(p.getHours()).toBe(7);
  });

  it("salta a un día programado, no a mañana sin más", () => {
    // Solo viernes (5). Desde el lunes, la próxima es el viernes 7.
    const p = proximaEjecucion({ ...base, dias: [5] }, LUNES_0705);
    expect(p.getDay()).toBe(5);
    expect(p.getDate()).toBe(7);
  });

  it("nunca devuelve un instante ya pasado", () => {
    const p = proximaEjecucion(base, LUNES_0705);
    expect(p.getTime()).toBeGreaterThan(LUNES_0705);
  });
});
