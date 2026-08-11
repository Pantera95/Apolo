import { NextResponse } from "next/server";

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

function autorizado(req: Request): boolean {
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secreto) return false;
  return req.headers.get("x-apolo-secreto") === secreto;
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
  if (!autorizado(req)) {
    return NextResponse.json(
      { ok: false, motivo: "Secreto incorrecto o no configurado." },
      { status: 401 },
    );
  }

  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET as string;
  const url = new URL(req.url);
  const destino = `${url.protocol}//${url.host}/api/telegram/webhook`;

  const registro = await telegram("setWebhook", {
    url: destino,
    secret_token: secreto,
    // Solo mensajes: sin esto Telegram empuja también ediciones, reacciones y
    // cambios de miembros, que este bot no usa y solo gastan invocaciones.
    allowed_updates: ["message"],
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
  if (!autorizado(req)) {
    return NextResponse.json(
      { ok: false, motivo: "Secreto incorrecto o no configurado." },
      { status: 401 },
    );
  }
  const info = await telegram("getWebhookInfo");
  const yo = await telegram("getMe");
  return NextResponse.json({
    ok: true,
    bot: (yo.result as { username?: string } | undefined)?.username ?? null,
    estado: info.result ?? null,
  });
}

/** Quita el webhook. Útil para volver al modo de sondeo. */
export async function DELETE(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json(
      { ok: false, motivo: "Secreto incorrecto o no configurado." },
      { status: 401 },
    );
  }
  const r = await telegram("deleteWebhook", { drop_pending_updates: true });
  return NextResponse.json({ ok: Boolean(r.ok), motivo: r.description ?? null });
}
