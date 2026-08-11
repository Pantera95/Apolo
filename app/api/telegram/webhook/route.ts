import { NextResponse } from "next/server";

import { parsear, responder } from "@/lib/bot/comandos";

/**
 * Webhook del bot: Telegram empuja aquí cada mensaje que recibe.
 *
 * ES UN ENDPOINT PÚBLICO Y ENTRANTE, que es lo que lo distingue del resto de
 * rutas de Apolo. Cualquiera que adivine la URL puede llamarlo, así que la
 * seguridad no es opcional y va por tres capas:
 *
 *   1. SECRETO DE CABECERA. Telegram reenvía el valor que se registró al hacer
 *      `setWebhook`, en `X-Telegram-Bot-Api-Secret-Token`. Si no coincide, la
 *      petición no viene de Telegram y se descarta.
 *   2. LISTA BLANCA DE CHATS. Aunque la petición sea legítima, solo responde a
 *      los chats autorizados. Sin esto, cualquiera que encuentre el bot en
 *      Telegram obtiene los datos de la empresa escribiéndole.
 *   3. LÍMITE POR CHAT. Un bucle de comandos no puede convertirse en una
 *      factura de cómputo.
 *
 * SOLO LECTURA. Ningún comando cambia el estado de Apolo. Aprobar una
 * solicitud o cancelar una orden desde un chat es indefendible: un mensaje de
 * Telegram se reenvía y se falsifica sin esfuerzo, y no hay forma de saber
 * quién pulsó de verdad.
 *
 * SIEMPRE SE RESPONDE 200, incluso al rechazar. Telegram reintenta ante
 * cualquier otro código y acabaría reintentando en bucle un mensaje que nunca
 * vamos a aceptar.
 */

export const runtime = "nodejs";

/**
 * Últimas decisiones del webhook.
 *
 * AVISO: EN VERCEL ESTO ES POCO FIABLE Y HAY QUE SABERLO. Cada petición puede
 * atenderla una instancia distinta, así que el mensaje se anota en una y la
 * consulta puede leer otra, vacía. Sirve cuando coincide la instancia y no
 * sirve cuando no — o sea que una bitácora vacía NO PRUEBA que Telegram no
 * haya llegado.
 *
 * Para diagnosticar de verdad manda `getWebhookInfo`, que lo responde Telegram
 * y es autoritativo: dice si el webhook está puesto, cuántos mensajes hay en
 * cola y cuál fue el último error de entrega.
 */
const BITACORA: { en: string; decision: string; chat?: number }[] = [];

function anotar(decision: string, chat?: number) {
  BITACORA.unshift({ en: new Date().toISOString(), decision, chat });
  if (BITACORA.length > 20) BITACORA.pop();
}

export function ultimasDecisiones() {
  return BITACORA;
}

interface Mensaje {
  text?: string;
  chat?: { id?: number; type?: string };
  from?: { id?: number; username?: string };
}

/**
 * Un update de Telegram.
 *
 * `channel_post` NO ES OPCIONAL Y AQUÍ ESTUVO EL FALLO. Telegram entrega los
 * mensajes de un GRUPO como `message`, pero los de un CANAL como
 * `channel_post`. Este bot vive en un canal de la empresa, así que mirar solo
 * `message` descartaba todos los mensajes antes de leerlos — y como la ruta
 * responde 200 siempre y no escribe al chat cuando descarta, el síntoma era
 * "el bot no contesta", sin ninguna pista.
 *
 * `edited_*` se ignoran a propósito: reejecutar un comando porque alguien
 * corrigió una tilde no aporta nada.
 */
interface Update {
  message?: Mensaje;
  channel_post?: Mensaje;
}

const MAX_POR_MINUTO = 20;
const ventana = new Map<string, number[]>();

function permitido(clave: string, ahora: number): boolean {
  const previos = (ventana.get(clave) ?? []).filter((t) => ahora - t < 60_000);
  if (previos.length >= MAX_POR_MINUTO) return false;
  previos.push(ahora);
  ventana.set(clave, previos);
  return true;
}

/**
 * Chats a los que el bot responde.
 *
 * `TELEGRAM_CHATS_PERMITIDOS` es una lista separada por comas. Si está vacía,
 * se cae al chat por defecto. NUNCA se abre a todo el mundo: un bot que
 * responde a cualquiera es una filtración con forma de función.
 */
function autorizado(chatId: number): boolean {
  const lista = (process.env.TELEGRAM_CHATS_PERMITIDOS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (lista.length > 0) return lista.includes(String(chatId));

  const porDefecto = process.env.TELEGRAM_DEFAULT_CHAT_ID?.trim();
  return Boolean(porDefecto) && String(chatId) === porDefecto;
}

async function responderA(chatId: number, html: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      // HTML y no Markdown: un guion bajo en un código de obra rompe el
      // Markdown de Telegram y el mensaje llega sin formato o con error.
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

export async function POST(req: Request) {
  // Capa 1: el secreto. Se compara antes de leer el cuerpo siquiera.
  //
  // SE RECORTA, y no es cosmético: la ruta de registro envía a Telegram el
  // valor RECORTADO, así que Telegram devuelve el recortado en la cabecera.
  // Comparar aquí contra el valor sin recortar hacía que un espacio invisible
  // en la variable de entorno rechazara TODOS los mensajes en silencio — y el
  // síntoma es "el bot no contesta", que no apunta a nada.
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secreto && req.headers.get("x-telegram-bot-api-secret-token")?.trim() !== secreto) {
    anotar("secreto-no-coincide");
    return NextResponse.json({ ok: true, ignorado: "secreto" });
  }

  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return NextResponse.json({ ok: true, ignorado: "cuerpo" });
  }

  // De un grupo llega en `message`; de un canal, en `channel_post`.
  const mensaje = update.message ?? update.channel_post;
  const texto = mensaje?.text;
  const chatId = mensaje?.chat?.id;
  if (!texto || typeof chatId !== "number") {
    anotar("sin-texto");
    return NextResponse.json({ ok: true, ignorado: "sin-texto" });
  }

  // Capa 2: la lista blanca. Se contesta al intruso para que no crea que el
  // bot está roto, pero sin entregarle ni un dato.
  if (!autorizado(chatId)) {
    anotar("chat-no-autorizado", chatId);
    await responderA(
      chatId,
      "Este bot atiende únicamente a los canales autorizados de la empresa.",
    );
    return NextResponse.json({ ok: true, ignorado: "no-autorizado" });
  }

  // Capa 3: el límite por chat.
  if (!permitido(String(chatId), Date.now())) {
    anotar("limite-por-minuto", chatId);
    return NextResponse.json({ ok: true, ignorado: "limite" });
  }

  const peticion = parsear(texto, Date.now());
  // Texto normal en un grupo: se ignora en silencio. Un bot que contesta a
  // cada mensaje de una conversación es insoportable y acaba silenciado.
  if (!peticion) {
    anotar("texto-normal-ignorado", chatId);
    return NextResponse.json({ ok: true, ignorado: "no-comando" });
  }

  const { html } = responder(peticion);
  await responderA(chatId, html);
  anotar(`respondido /${peticion.comando}`, chatId);

  return NextResponse.json({ ok: true });
}

/** Diagnóstico: dice si el webhook está listo, sin revelar ningún secreto. */
export async function GET() {
  return NextResponse.json({
    listo: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    conSecreto: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    conListaBlanca: Boolean(
      process.env.TELEGRAM_CHATS_PERMITIDOS || process.env.TELEGRAM_DEFAULT_CHAT_ID,
    ),
  });
}
