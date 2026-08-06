# Telegram

## Principio

Telegram es un **canal de aviso**, no un sistema de registro. Si el mensaje no
sale, la entrega existe igual. Apolo es la fuente de verdad.

## Seguridad

- `TELEGRAM_BOT_TOKEN` **solo** en el servidor. Nunca en el cliente, nunca en
  una variable `NEXT_PUBLIC_`.
- El envío ocurre en una Edge Function, no en el navegador.
- Se valida el secreto del webhook en cada entrada.
- El `chat_id` **nunca se muestra completo** en pantalla (en el demo aparece
  enmascarado: `-100••••4821`).
- Los comandos del bot son de **solo consulta**. Aprobar, cancelar o completar
  una entrega exige entrar en Apolo por enlace: una operación crítica no puede
  dispararse desde un chat donde cualquiera reenvía un mensaje.

## Anti-spam — tres frenos, y los tres hacen falta

1. **Severidad mínima** por suscriptor. Quien solo quiere críticas no recibe
   "vehículo en ruta".
2. **Deduplicación por clave.** "Vehículo detenido" es el mismo aviso a los
   treinta segundos que al minuto.
3. **Enfriamiento por tiempo**, distinto según severidad (crítica 5 min,
   informativa 60 min).

**Excepción deliberada:** si la severidad **sube**, se envía aunque el
enfriamiento siga activo. Que lo que era advertencia pase a crítica es
información nueva.

Sin esto el canal se vuelve ruido, la gente lo silencia, y entonces tampoco lee
la alerta que sí importaba.

El ETA no avisa por variaciones menores de **10 minutos**: un camión en tráfico
cambia de ETA cada treinta segundos.

## Formato

```
[ALTA] Vehículo detenido
Despacho: DSP-025
Vehículo: veh-07
Ruta: RTA-0241
Hora: 09:41
Ver seguimiento:
https://apolo-swift.vercel.app/logistica
```

Breve y accionable: quién, qué, dónde, cuándo y el enlace para actuar. Un
mensaje que obliga a abrir la app para entender qué pasó no sirve a pie de obra.

## Variables de entorno (sin valores)

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_DEFAULT_CHAT_ID=
TRACCAR_BASE_URL=
TRACCAR_API_TOKEN=
TRACCAR_WEBHOOK_SECRET=
VROOM_BASE_URL=
GRAPHHOPPER_BASE_URL=
GRAPHHOPPER_API_KEY=
NEXT_PUBLIC_MAP_PROVIDER=
NEXT_PUBLIC_MAP_STYLE_URL=
```
