import { NextResponse } from "next/server";

/**
 * Descubrimiento del `chat_id` — SOLO servidor.
 *
 * Telegram no dice el identificador de un chat en ninguna parte de la interfaz.
 * La única forma de obtenerlo es leer las actualizaciones del bot después de
 * que alguien le escriba, y esta ruta hace justo eso: el usuario manda `/start`
 * al bot (o lo añade a un grupo y escribe algo), abre esta ruta y ve el número.
 *
 * Sin esto, configurar el destino obliga a pelearse con `getUpdates` a mano
 * desde una terminal, que es exactamente donde la gente pega el token en sitios
 * que no debería.
 *
 * NO devuelve el token ni nada que permita deducirlo. Devuelve el mínimo para
 * identificar el chat: id, tipo y nombre.
 */

export const runtime = "nodejs";
// Sin caché: el objetivo es ver el mensaje que se acaba de enviar.
export const dynamic = "force-dynamic";

interface ChatTelegram {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
}

interface Actualizacion {
  message?: { chat?: ChatTelegram };
  channel_post?: { chat?: ChatTelegram };
  my_chat_member?: { chat?: ChatTelegram };
}

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return NextResponse.json({
      configurado: false,
      motivo:
        "Falta TELEGRAM_BOT_TOKEN en el servidor. Configúralo en Vercel y vuelve a abrir esta ruta.",
      chats: [],
    });
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`, {
      cache: "no-store",
    });
    const datos = (await r.json()) as {
      ok?: boolean;
      description?: string;
      result?: Actualizacion[];
    };

    if (!datos.ok) {
      return NextResponse.json({
        configurado: true,
        motivo: datos.description ?? `Telegram respondió ${r.status}.`,
        chats: [],
      });
    }

    // Un mismo chat aparece en cada mensaje: se deduplica por id.
    const vistos = new Map<number, { id: number; tipo: string; nombre: string }>();
    for (const u of datos.result ?? []) {
      const c = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
      if (!c) continue;
      vistos.set(c.id, {
        id: c.id,
        tipo: c.type,
        nombre: c.title ?? c.username ?? c.first_name ?? "—",
      });
    }

    const chats = [...vistos.values()];

    return NextResponse.json({
      configurado: true,
      chats,
      // La ayuda va en la respuesta: quien abre esta ruta suele estar
      // atascado, y un array vacío sin explicación no le dice qué hacer.
      ayuda:
        chats.length === 0
          ? "No hay actualizaciones. Escribe /start al bot desde tu Telegram —o añádelo a un grupo y manda un mensaje— y recarga esta página. Ojo: si el bot ya tiene un webhook configurado, getUpdates no devuelve nada."
          : "Copia el id que corresponda. Los grupos empiezan por -100. Ese valor va en TELEGRAM_DEFAULT_CHAT_ID.",
    });
  } catch (e) {
    return NextResponse.json({
      configurado: true,
      motivo: e instanceof Error ? e.message : "No se pudo contactar con Telegram.",
      chats: [],
    });
  }
}
