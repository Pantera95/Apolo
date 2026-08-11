import { describe, expect, it } from "vitest";

import { COMANDOS, listaParaBotFather, parsear, responder } from "@/lib/bot/comandos";

/**
 * Cada comando del bot, ejercitado con un reloj fijo.
 *
 * Estas respuestas salen a un grupo de Telegram donde las lee gente de obra y
 * de dirección. Un comando que devuelve `undefined`, `NaN` o un mensaje que
 * Telegram rechaza por longitud es un fallo que se ve en público.
 */

const AHORA = Date.parse("2026-08-07T15:30:00.000Z");
const pedir = (texto: string) => {
  const p = parsear(texto, AHORA);
  expect(p).not.toBeNull();
  return responder(p!);
};

describe("parseo del comando", () => {
  it("acepta un comando simple", () => {
    expect(parsear("/panel", AHORA)).toMatchObject({ comando: "panel", argumento: "" });
  });

  /**
   * En un GRUPO, Telegram entrega los comandos con el nombre del bot pegado.
   * Sin recortar ese sufijo ningún comando respondería nunca dentro de un
   * grupo, que es justo donde vive este bot.
   */
  it("quita el sufijo @nombre_del_bot", () => {
    expect(parsear("/panel@ApoloGlobalBot", AHORA)?.comando).toBe("panel");
  });

  it("separa el argumento", () => {
    expect(parsear("/inventario cabilla 3/8", AHORA)).toMatchObject({
      comando: "inventario",
      argumento: "cabilla 3/8",
    });
  });

  it("es indiferente a mayúsculas", () => {
    expect(parsear("/PANEL", AHORA)?.comando).toBe("panel");
  });

  it("ignora el texto que no es un comando", () => {
    expect(parsear("hola, buenos días", AHORA)).toBeNull();
  });
});

describe("todos los comandos declarados responden", () => {
  for (const c of COMANDOS) {
    it(`/${c.nombre} devuelve una respuesta utilizable`, () => {
      const r = pedir(`/${c.nombre}`);
      expect(r.reconocido).toBe(true);
      expect(r.html.length).toBeGreaterThan(40);
      expect(r.html).not.toMatch(/undefined|NaN|\[object|Infinity/);
    });

    it(`/${c.nombre} cabe en un mensaje de Telegram`, () => {
      // sendMessage RECHAZA por encima de 4096, no trunca.
      expect(pedir(`/${c.nombre}`).html.length).toBeLessThan(4096);
    });

    it(`/${c.nombre} cierra las etiquetas HTML`, () => {
      const h = pedir(`/${c.nombre}`).html;
      expect((h.match(/<b>/g) ?? []).length).toBe((h.match(/<\/b>/g) ?? []).length);
      expect((h.match(/<i>/g) ?? []).length).toBe((h.match(/<\/i>/g) ?? []).length);
    });
  }
});

describe("comandos con argumento", () => {
  it("/inventario sin argumento da el resumen y explica cómo buscar", () => {
    const h = pedir("/inventario").html;
    expect(h).toMatch(/Artículos en catálogo/);
    expect(h).toContain("/inventario cabilla");
  });

  it("/inventario con un término que no existe lo dice, no devuelve vacío", () => {
    const h = pedir("/inventario zzzzz").html;
    expect(h).toMatch(/Ning[úu]n art[íi]culo coincide/);
  });

  it("/obra sin argumento lista las obras", () => {
    expect(pedir("/obra").html).toContain("OBR-");
  });

  it("/obra con un código inexistente no revienta", () => {
    expect(pedir("/obra XXX-9999").html).toMatch(/No encuentro la obra/);
  });

  it("/viaje con un código inexistente sugiere /flota", () => {
    expect(pedir("/viaje NADA").html).toContain("/flota");
  });

  it("/ventas acepta el número de cortes", () => {
    expect(pedir("/ventas 3").html).toMatch(/últimos 3 cortes/);
  });

  /**
   * Un argumento absurdo no puede producir un mensaje kilométrico: Telegram lo
   * rechazaría entero y el usuario solo vería que "no funciona".
   */
  it("/ventas topa el número pedido", () => {
    const h = pedir("/ventas 9999").html;
    expect(h.length).toBeLessThan(4096);
    expect(h).not.toMatch(/últimos 9999/);
  });

  it("/ventas ignora un argumento no numérico", () => {
    expect(pedir("/ventas muchas").html).toMatch(/últimos \d+ cortes/);
  });
});

describe("seguridad y comportamiento", () => {
  it("un comando desconocido se marca como no reconocido", () => {
    const r = pedir("/borrar_todo");
    expect(r.reconocido).toBe(false);
    expect(r.html).toContain("/ayuda");
  });

  /**
   * SOLO LECTURA. Ningún comando debe insinuar que cambia algo: un mensaje de
   * Telegram se reenvía y se falsifica sin esfuerzo, y no hay forma de saber
   * quién pulsó de verdad.
   */
  it("ningún comando declarado sugiere una acción que modifique datos", () => {
    const prohibidas = /aprobar|cancelar|eliminar|borrar|despachar|confirmar/i;
    for (const c of COMANDOS) {
      expect(c.nombre).not.toMatch(prohibidas);
      expect(c.descripcion).not.toMatch(prohibidas);
    }
  });

  it("/ayuda deja claro que el bot solo consulta", () => {
    expect(pedir("/ayuda").html).toMatch(/solo consulta/i);
  });

  it("toda respuesta declara que son datos de demostración", () => {
    for (const c of COMANDOS) {
      expect(pedir(`/${c.nombre}`).html).toMatch(/demostraci[óo]n/i);
    }
  });

  it("/start y /ayuda dan lo mismo", () => {
    expect(pedir("/start").html).toBe(pedir("/ayuda").html);
  });
});

describe("determinismo", () => {
  /**
   * El bot responde desde la misma semilla que la aplicación. Si dejara de ser
   * determinista, las cifras del chat y las de la pantalla dejarían de coincidir
   * en mitad de una demostración.
   */
  it("el mismo comando en el mismo instante da la misma respuesta", () => {
    expect(pedir("/panel").html).toBe(pedir("/panel").html);
    expect(pedir("/informe_diario").html).toBe(pedir("/informe_diario").html);
  });
});

describe("lista para BotFather", () => {
  it("usa el formato exacto que exige setcommands", () => {
    for (const linea of listaParaBotFather().split("\n")) {
      // `comando - descripción`, en minúsculas y sin barra.
      expect(linea).toMatch(/^[a-z_]+ - .+$/);
    }
  });

  it("ningún comando pasa de 32 caracteres", () => {
    // Límite de Telegram para el nombre de un comando.
    for (const c of COMANDOS) expect(c.nombre.length).toBeLessThanOrEqual(32);
  });
});
