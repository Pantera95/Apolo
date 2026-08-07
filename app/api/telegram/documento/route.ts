import { NextResponse } from "next/server";

/**
 * Envío de un PDF a Telegram — SOLO servidor.
 *
 * Va por `sendDocument` y no por `sendMessage`, que es una API distinta: exige
 * `multipart/form-data` con los bytes del archivo, no JSON.
 *
 * EL PDF LLEGA COMO BINARIO, no en base64. Codificarlo lo engorda un 33% y
 * obliga a materializar toda la cadena en memoria dos veces, en el cliente y en
 * el servidor. Con `FormData` el archivo pasa como `Blob` y se reenvía tal cual.
 *
 * El token nunca sale del servidor: quien lo tiene puede leer y escribir en
 * todos los chats del bot, y una variable `NEXT_PUBLIC_` queda incrustada en el
 * JavaScript que descarga cualquiera.
 */

export const runtime = "nodejs";

/**
 * Telegram acepta hasta 50 MB por documento, pero el límite real es otro: una
 * función de Vercel tiene un cuerpo máximo mucho menor. Se corta en 4 MB, que
 * es de sobra para un informe de veinte páginas —los nuestros pesan ~90 KB— y
 * evita un 413 opaco que el usuario leería como "Telegram falló".
 */
const LIMITE_BYTES = 4 * 1024 * 1024;

/** Ventana contra ráfagas. Más estrecha que la de texto: un PDF pesa. */
const ventana = new Map<string, number[]>();
const MAX_POR_MINUTO = 4;

function permitido(clave: string, ahora: number): boolean {
  const previos = (ventana.get(clave) ?? []).filter((t) => ahora - t < 60_000);
  if (previos.length >= MAX_POR_MINUTO) return false;
  previos.push(ahora);
  ventana.set(clave, previos);
  return true;
}

export async function POST(req: Request) {
  let entrada: FormData;
  try {
    entrada = await req.formData();
  } catch {
    return NextResponse.json(
      { enviado: false, motivo: "La petición no es multipart/form-data válido." },
      { status: 400 },
    );
  }

  const archivo = entrada.get("archivo");
  const leyenda = String(entrada.get("leyenda") ?? "").trim();
  const chatPedido = String(entrada.get("chatId") ?? "").trim();

  if (!(archivo instanceof File)) {
    return NextResponse.json(
      { enviado: false, motivo: "No se recibió ningún archivo." },
      { status: 400 },
    );
  }

  if (archivo.size === 0) {
    return NextResponse.json(
      { enviado: false, motivo: "El archivo llegó vacío." },
      { status: 400 },
    );
  }

  if (archivo.size > LIMITE_BYTES) {
    return NextResponse.json(
      {
        enviado: false,
        modo: "demasiado-grande",
        motivo: `El documento pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el límite es ${LIMITE_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatPedido || process.env.TELEGRAM_DEFAULT_CHAT_ID;

  if (!token || !chatId) {
    // Estado normal de un demo sin credenciales. Se devuelve 200 a propósito:
    // un 500 haría que la interfaz lo pintara como avería del sistema.
    return NextResponse.json({
      enviado: false,
      modo: "no-configurado",
      motivo:
        "Falta TELEGRAM_BOT_TOKEN o TELEGRAM_DEFAULT_CHAT_ID en el servidor. El PDF se generó correctamente pero no se envió.",
      archivo: archivo.name,
      bytes: archivo.size,
    });
  }

  if (!permitido(chatId, Date.now())) {
    return NextResponse.json(
      {
        enviado: false,
        modo: "limitado",
        motivo: `Se superó el límite de ${MAX_POR_MINUTO} documentos por minuto para este chat.`,
      },
      { status: 429 },
    );
  }

  try {
    const salida = new FormData();
    salida.append("chat_id", chatId);
    salida.append("document", archivo, archivo.name);
    if (leyenda) {
      // Telegram corta la leyenda de un documento en 1024 caracteres, bastante
      // menos que los 4096 de un mensaje suelto.
      salida.append("caption", leyenda.slice(0, 1000));
      salida.append("parse_mode", "HTML");
    }

    const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: salida,
    });

    const datos = (await r.json()) as { ok?: boolean; description?: string };

    if (!r.ok || !datos.ok) {
      return NextResponse.json({
        enviado: false,
        modo: "rechazado",
        // El motivo de Telegram va tal cual: "chat not found" y "bot was
        // blocked" se arreglan de formas distintas.
        motivo: datos.description ?? `Telegram respondió ${r.status}.`,
      });
    }

    return NextResponse.json({
      enviado: true,
      modo: "enviado",
      archivo: archivo.name,
      bytes: archivo.size,
    });
  } catch (e) {
    return NextResponse.json({
      enviado: false,
      modo: "error-red",
      motivo: e instanceof Error ? e.message : "No se pudo contactar con Telegram.",
    });
  }
}
