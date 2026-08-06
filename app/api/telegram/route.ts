import { NextResponse } from "next/server";

/**
 * Envío real a Telegram — SOLO servidor.
 *
 * El token vive en `TELEGRAM_BOT_TOKEN`, una variable de entorno del servidor.
 * Nunca se llama `NEXT_PUBLIC_` y nunca sale al navegador: quien tiene el token
 * de un bot puede leer y escribir en todos sus chats, y una variable pública en
 * Next queda incrustada en el JavaScript que descarga cualquiera.
 *
 * Si no hay token configurado, la ruta responde 200 con `enviado: false` y el
 * motivo. No es un error del sistema: es el estado normal de un demo sin
 * credenciales, y la interfaz lo muestra como tal.
 *
 * Esta ruta NO cambia ningún estado de Apolo. Solo emite un aviso. Una
 * operación crítica —aprobar, cancelar, completar una entrega— no puede
 * dispararse desde un chat donde cualquiera reenvía un mensaje.
 */

export const runtime = "nodejs";

const LIMITE_CUERPO = 3800; // Telegram corta en 4096; se deja margen.

interface Peticion {
  texto?: string;
  chatId?: string;
  /** Clave de deduplicación; se registra en la respuesta para trazar. */
  clave?: string;
}

/** Ventana simple contra ráfagas. En memoria: basta para un demo. */
const ventana = new Map<string, number[]>();
const MAX_POR_MINUTO = 8;

function permitido(clave: string, ahora: number): boolean {
  const previos = (ventana.get(clave) ?? []).filter((t) => ahora - t < 60_000);
  if (previos.length >= MAX_POR_MINUTO) return false;
  previos.push(ahora);
  ventana.set(clave, previos);
  return true;
}

export async function POST(req: Request) {
  let cuerpo: Peticion;
  try {
    cuerpo = (await req.json()) as Peticion;
  } catch {
    return NextResponse.json(
      { enviado: false, motivo: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }

  const texto = (cuerpo.texto ?? "").trim();
  if (!texto) {
    return NextResponse.json(
      { enviado: false, motivo: "No hay texto que enviar." },
      { status: 400 },
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = cuerpo.chatId?.trim() || process.env.TELEGRAM_DEFAULT_CHAT_ID;

  if (!token || !chatId) {
    // Estado normal del demo. Se devuelve 200 a propósito: no es un fallo, y
    // un 500 haría que la interfaz lo pintara como avería.
    return NextResponse.json({
      enviado: false,
      modo: "no-configurado",
      motivo:
        "Falta TELEGRAM_BOT_TOKEN o TELEGRAM_DEFAULT_CHAT_ID en el servidor. El mensaje se compuso correctamente pero no se envió.",
      vistaPrevia: texto.slice(0, LIMITE_CUERPO),
    });
  }

  if (!permitido(chatId, Date.now())) {
    return NextResponse.json(
      {
        enviado: false,
        modo: "limitado",
        motivo: `Se superó el límite de ${MAX_POR_MINUTO} mensajes por minuto para este chat.`,
      },
      { status: 429 },
    );
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto.slice(0, LIMITE_CUERPO),
        // HTML y no Markdown: un guion bajo en un código de obra rompe el
        // Markdown de Telegram y el mensaje llega sin formato o con error.
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const datos = (await r.json()) as { ok?: boolean; description?: string };

    if (!r.ok || !datos.ok) {
      return NextResponse.json({
        enviado: false,
        modo: "rechazado",
        // Se devuelve el motivo de Telegram tal cual: "chat not found" y
        // "bot was blocked" se arreglan de formas distintas.
        motivo: datos.description ?? `Telegram respondió ${r.status}.`,
      });
    }

    return NextResponse.json({ enviado: true, modo: "enviado", clave: cuerpo.clave ?? null });
  } catch (e) {
    return NextResponse.json({
      enviado: false,
      modo: "error-red",
      motivo: e instanceof Error ? e.message : "No se pudo contactar con Telegram.",
    });
  }
}

/** Diagnóstico: dice si el servidor está configurado, sin revelar el token. */
export async function GET() {
  return NextResponse.json({
    configurado: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    chatPorDefecto: Boolean(process.env.TELEGRAM_DEFAULT_CHAT_ID),
  });
}
