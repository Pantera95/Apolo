import { NextResponse } from "next/server";

import { ultimasDecisiones } from "@/app/api/telegram/webhook/route";

/**
 * Registra el webhook del bot desde el propio servidor.
 *
 * EXISTE PARA QUE EL TOKEN NUNCA SALGA DE VERCEL. La forma habitual de
 * registrar un webhook es un `curl` a `api.telegram.org/botTOKEN/setWebhook`,
 * lo que obliga a la persona a tener el token en su terminal, pegarlo en un
 * comando y dejarlo en el historial del shell. Aquí el servidor ya tiene el
 * token en `TELEGRAM_BOT_TOKEN`: puede llamar a Telegram él mismo.
 *
 * SE PROTEGE CON EL MISMO SECRETO DEL WEBHOOK. Solo quien conoce
 * `TELEGRAM_WEBHOOK_SECRET` puede disparar esto, y esa persona es justamente
 * quien lo configuró. No hace falta inventar una credencial nueva para una
 * operación que se ejecuta dos veces en la vida del proyecto.
 *
 * La URL de destino se DEDUCE de la petición y no se recibe como parámetro:
 * aceptarla de fuera permitiría a quien tuviera el secreto desviar los
 * mensajes del bot a un servidor ajeno.
 */

export const runtime = "nodejs";

interface RespuestaTelegram {
  ok?: boolean;
  result?: unknown;
  description?: string;
}

interface Veredicto {
  ok: boolean;
  /** Diagnóstico SIN revelar el secreto: solo longitudes y presencia. */
  motivo: string;
}

/**
 * Comprueba el secreto.
 *
 * SE RECORTAN LOS DOS LADOS, y no es paranoia: guardar el secreto con `echo`
 * en vez de `printf` mete un salto de línea al final del valor almacenado, y
 * entonces la comparación falla para siempre por un carácter invisible. Es un
 * fallo que puede costar una tarde porque nada de lo que se ve en pantalla lo
 * delata.
 *
 * El motivo distingue "no configurado" de "no coincide" y da las longitudes.
 * Para un secreto hexadecimal de 32 bytes, saber que mide 64 caracteres no le
 * sirve de nada a un atacante, y a quien lo está configurando le ahorra la
 * media hora de adivinar si la variable de su terminal venía vacía.
 */
function autorizado(req: Request): Veredicto {
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secreto) {
    return {
      ok: false,
      motivo:
        "El servidor no tiene TELEGRAM_WEBHOOK_SECRET. Añádelo en Vercel y vuelve a desplegar.",
    };
  }

  const recibido = req.headers.get("x-apolo-secreto")?.trim();
  if (!recibido) {
    return {
      ok: false,
      motivo:
        "No llegó la cabecera x-apolo-secreto, o llegó vacía. Suele ser que $SECRETO no existe en esa terminal.",
    };
  }

  if (recibido !== secreto) {
    return {
      ok: false,
      motivo: `El secreto no coincide. Enviaste ${recibido.length} caracteres; el servidor guarda ${secreto.length}.`,
    };
  }

  return { ok: true, motivo: "" };
}

async function telegram(metodo: string, cuerpo?: unknown): Promise<RespuestaTelegram> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "Falta TELEGRAM_BOT_TOKEN en el servidor." };

  const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo ?? {}),
  });
  return (await r.json()) as RespuestaTelegram;
}

export async function POST(req: Request) {
  const v = autorizado(req);
  if (!v.ok) return NextResponse.json({ ok: false, motivo: v.motivo }, { status: 401 });

  const secreto = (process.env.TELEGRAM_WEBHOOK_SECRET as string).trim();
  const url = new URL(req.url);
  const destino = `${url.protocol}//${url.host}/api/telegram/webhook`;

  const registro = await telegram("setWebhook", {
    url: destino,
    secret_token: secreto,
    // LOS DOS TIPOS. Un grupo entrega `message`; un canal, `channel_post`.
    // Pedir solo `message` dejaba al bot sordo en canales, que es donde vive.
    // Lo demás —ediciones, reacciones, cambios de miembros— no se pide: no se
    // usa y solo gastaría invocaciones.
    allowed_updates: ["message", "channel_post"],
    // Los mensajes acumulados mientras no había webhook se descartan: no tiene
    // sentido responder de golpe a comandos de hace días.
    drop_pending_updates: true,
  });

  if (!registro.ok) {
    return NextResponse.json({
      ok: false,
      paso: "setWebhook",
      motivo: registro.description ?? "Telegram rechazó el registro.",
    });
  }

  // Se devuelve el estado REAL consultado a Telegram, no un "listo" optimista:
  // un registro que dice haber funcionado y un webhook que no está puesto es
  // exactamente el fallo que cuesta media hora encontrar.
  const info = await telegram("getWebhookInfo");
  const yo = await telegram("getMe");

  return NextResponse.json({
    ok: true,
    registradoEn: destino,
    bot: (yo.result as { username?: string } | undefined)?.username ?? null,
    estado: info.result ?? null,
  });
}

/** Estado actual, sin registrar nada. Requiere el mismo secreto. */
export async function GET(req: Request) {
  const v = autorizado(req);
  if (!v.ok) return NextResponse.json({ ok: false, motivo: v.motivo }, { status: 401 });

  const info = await telegram("getWebhookInfo");
  const yo = await telegram("getMe");
  return NextResponse.json({
    ok: true,
    bot: (yo.result as { username?: string } | undefined)?.username ?? null,
    estado: info.result ?? null,
    // Orientativo: en Vercel cada petición puede ir a otra instancia, así que
    // una lista vacía NO prueba que Telegram no haya llegado. Lo autoritativo
    // es `estado`, que lo responde Telegram.
    ultimasDecisionesDeEstaInstancia: ultimasDecisiones(),
  });
}

/** Quita el webhook. Útil para volver al modo de sondeo. */
export async function DELETE(req: Request) {
  const v = autorizado(req);
  if (!v.ok) return NextResponse.json({ ok: false, motivo: v.motivo }, { status: 401 });

  const r = await telegram("deleteWebhook", { drop_pending_updates: true });
  return NextResponse.json({ ok: Boolean(r.ok), motivo: r.description ?? null });
}
