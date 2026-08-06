#!/usr/bin/env bash
#
# Configura el bot de Telegram sin que el token pase por el chat.
#
# POR QUÉ ESTE SCRIPT EXISTE
#
# El token no puede pasar por la conversación con el asistente: quedaría en el
# registro, y quien tenga el token de un bot puede leer y escribir en todos sus
# chats. Aquí el valor va de tu teclado a Vercel directamente — no se imprime en
# pantalla, no se guarda en ningún archivo del repositorio y no aparece en el
# historial del terminal.
#
# Uso:
#   bash scripts/configurar-telegram.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

echo
echo "  Configuración del bot de Telegram para Apolo"
echo "  ============================================"
echo
echo "  El token NO se mostrará mientras lo escribes y NO se guardará en disco."
echo "  Si el token que tienes ya se compartió por chat o correo, revócalo antes"
echo "  en BotFather con /revoke y usa el nuevo."
echo

# `read -s` no hace eco: el token no queda ni en pantalla ni en el scrollback.
read -r -s -p "  Pega el TOKEN del bot (BotFather) y pulsa Enter: " TOKEN
echo
echo

if [[ -z "${TOKEN}" ]]; then
  echo "  No se recibió ningún token. Nada que hacer." >&2
  exit 1
fi

# Comprobación de forma antes de gastar una llamada: un token de bot es
# "<números>:<cadena>". Si no encaja, casi seguro se pegó incompleto.
if [[ ! "${TOKEN}" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
  echo "  Ese valor no tiene forma de token de bot (esperado: 123456:AA...)." >&2
  echo "  Revisa que lo hayas copiado entero." >&2
  exit 1
fi

echo "  Verificando el token contra Telegram…"
RESPUESTA="$(curl -s "https://api.telegram.org/bot${TOKEN}/getMe")"

if ! printf '%s' "${RESPUESTA}" | grep -q '"ok":true'; then
  echo "  Telegram rechazó el token:" >&2
  # Se imprime solo la descripción del error, nunca el token.
  printf '%s\n' "${RESPUESTA}" | sed 's/.*"description":"\([^"]*\)".*/  \1/' >&2
  exit 1
fi

NOMBRE_BOT="$(printf '%s' "${RESPUESTA}" | sed 's/.*"username":"\([^"]*\)".*/\1/')"
echo "  Token válido. Bot: @${NOMBRE_BOT}"
echo

# ---------------------------------------------------------------------------
# chat_id
# ---------------------------------------------------------------------------
echo "  Ahora hace falta el chat de destino."
echo "  Escríbele /start a @${NOMBRE_BOT} desde tu Telegram, o añádelo a un"
echo "  grupo y manda cualquier mensaje. Luego pulsa Enter."
read -r -p "  [Enter cuando lo hayas hecho] " _

ACTUALIZACIONES="$(curl -s "https://api.telegram.org/bot${TOKEN}/getUpdates?limit=50")"
CHATS="$(printf '%s' "${ACTUALIZACIONES}" \
  | grep -o '"chat":{"id":-\?[0-9]*[^}]*}' \
  | sed 's/"chat":{"id":\(-\?[0-9]*\).*"type":"\([a-z]*\)".*/  \1  (\2)/' \
  | sort -u || true)"

if [[ -z "${CHATS}" ]]; then
  echo
  echo "  No se recibió ningún mensaje todavía."
  echo "  Si el bot ya tiene un webhook configurado, getUpdates no devuelve nada."
  read -r -p "  Escribe el chat_id a mano (o Enter para omitir): " CHAT_ID
else
  echo
  echo "  Chats encontrados:"
  printf '%s\n' "${CHATS}"
  echo
  echo "  Los grupos empiezan por -100."
  read -r -p "  Escribe el chat_id que quieres usar por defecto: " CHAT_ID
fi

# ---------------------------------------------------------------------------
# Vercel
# ---------------------------------------------------------------------------
echo
echo "  Guardando en Vercel…"

# `vercel env add` lee el valor de stdin, así que nunca aparece como argumento
# —los argumentos SÍ quedan en el historial del terminal y en `ps`—.
for ENTORNO in production preview development; do
  printf '%s' "${TOKEN}" | npx vercel env add TELEGRAM_BOT_TOKEN "${ENTORNO}" --force >/dev/null 2>&1 \
    && echo "    TELEGRAM_BOT_TOKEN → ${ENTORNO}" \
    || echo "    aviso: no se pudo escribir TELEGRAM_BOT_TOKEN en ${ENTORNO}"

  if [[ -n "${CHAT_ID:-}" ]]; then
    printf '%s' "${CHAT_ID}" | npx vercel env add TELEGRAM_DEFAULT_CHAT_ID "${ENTORNO}" --force >/dev/null 2>&1 \
      && echo "    TELEGRAM_DEFAULT_CHAT_ID → ${ENTORNO}" \
      || echo "    aviso: no se pudo escribir TELEGRAM_DEFAULT_CHAT_ID en ${ENTORNO}"
  fi
done

# ---------------------------------------------------------------------------
# Local
# ---------------------------------------------------------------------------
echo
read -r -p "  ¿Escribir también .env.local para desarrollo? [s/N] " LOCAL
if [[ "${LOCAL}" =~ ^[sSyY]$ ]]; then
  # .env.local está en .gitignore: no se sube al repositorio.
  {
    echo "TELEGRAM_BOT_TOKEN=${TOKEN}"
    [[ -n "${CHAT_ID:-}" ]] && echo "TELEGRAM_DEFAULT_CHAT_ID=${CHAT_ID}"
  } > .env.local
  chmod 600 .env.local
  echo "    .env.local escrito con permisos 600 (solo tu usuario puede leerlo)."
fi

# La variable deja de existir en cuanto termina el script.
unset TOKEN

echo
echo "  Listo. Falta desplegar para que producción tome las variables:"
echo
echo "    npx vercel deploy --prod --yes"
echo
echo "  Después, comprueba el estado sin revelar nada:"
echo
echo "    curl -s https://apolo-swift.vercel.app/api/telegram | python3 -m json.tool"
echo
echo "  Debe responder \"configurado\": true."
echo
