# Indicadores financieros

Fórmulas: [`lib/dashboard/finanzas.ts`](../../lib/dashboard/finanzas.ts) ·
34 pruebas en [`finanzas.test.ts`](../../lib/dashboard/finanzas.test.ts).

## El problema de origen

**Apolo no tiene balance general ni cuenta de resultados.** Es un sistema de
almacén y obra: guarda inventario, órdenes de compra y consumo. No tiene ventas
—nunca factura, es una regla del producto—, ni patrimonio, ni caja, ni cuentas
por cobrar.

De los 17 indicadores, **4 salen del kardex y 13 necesitan que alguien aporte el
balance**. La solución no es inventarlos: es importarlos y decir siempre cuál es
cuál.

| Origen | Qué significa | Cuántos |
|---|---|---|
| `DEL KARDEX` | Apolo lo midió | 1 |
| `MIXTO` | Fórmula estándar alimentada con kardex + declarado | 4 |
| `DECLARADO` | Lo aportó el contador en un archivo | 12 |

Cada tarjeta lleva su etiqueta de origen. Mezclarlos sin distinguir haría pasar
por medición lo que es la declaración de un tercero, y en un tablero financiero
eso no es un matiz de presentación.

## Lo que Apolo aporta por sí mismo

- **Inventario valorizado**: `Σ(existencia física × costo promedio ponderado)`.
  Es más fiable que el declarado porque se reconcilia contra el kardex, así que
  si el contador no declara inventario, **se usa este**.
- **Consumo a coste**: lo que salió a obra y no volvió, valorizado. Es el
  análogo del costo de ventas del almacén, y se **anualiza** antes de entrar en
  los ratios de gestión: comparar 30 días de consumo contra un inventario de
  corte daría una rotación doce veces menor de la real.
- **Comprometido con proveedores**: órdenes abiertas pendientes de recibir. Es
  una cuenta por pagar en formación.

## Dos correcciones a las fórmulas del encargo

**Margen de utilidad bruta y rentabilidad sobre ventas.** El encargo las escribe
como `UB / (VN * 100)`. Eso da la razón dividida por cien: un margen del 20 %
saldría `0,002`. Se implementa `UB / VN * 100`, que es la fórmula estándar y la
que hace que el número coincida con el ejemplo del propio encargo.

**"Rentabilidad por dividendo".** El encargo la define como
`Utilidad Neta / Acciones en circulación`, que es el **beneficio por acción**,
no el dividend yield. Se implementa lo que la fórmula dice y se nombra por lo
que es. Llamarlo "yield" llevaría a compararlo con yields de mercado, que es
otra magnitud.

## Formato de importación — PROVISIONAL

Dos columnas: concepto y valor.

```
Concepto;Valor
Activo corriente;480000
Pasivo corriente;210000
Utilidad neta;186000
```

- El separador se **detecta** (`;`, `,` o tabulador). Excel en español exporta
  con punto y coma y en inglés con coma; obligar a uno garantiza soporte técnico.
- Los conceptos se normalizan sin tildes ni mayúsculas.
- Los conceptos **no reconocidos se listan en pantalla**, no se descartan en
  silencio: quien importa tiene que ver que su fila "Caja y bancos" no entró en
  ningún indicador, en vez de descubrirlo cuando un ratio no cuadra.
- Un valor no numérico señala su número de fila.
- Un archivo vacío es un error explícito, nunca un balance en cero.

Se eligió el formato largo (una fila por concepto) y no una fila con dieciocho
columnas porque un contador lo exporta de cualquier sistema y lo puede escribir
a mano sin equivocarse de posición.

**El formato definitivo queda pendiente de que el cliente confirme el suyo.**

### `.xlsx`

Hoy **no se lee**. Un `.xlsx` es un zip; se detecta por su cabecera `PK` y se
avisa al usuario de que lo guarde como CSV. Parsear xlsx requiere una librería
(~1 MB) y el formato definitivo todavía no está acordado: añadirla ahora sería
comprometer bundle por un formato que va a cambiar. Cuando el cliente confirme
el suyo, se añade SheetJS con importación dinámica.

## Bandas de interpretación

Salen del encargo. Donde es ambiguo se elige el criterio conservador: es
preferible que un indicador aparezca como "revisar" de más a que pase por bueno
de menos.

| Indicador | Favorable | Aceptable | Desfavorable |
|---|---|---|---|
| Fondo de maniobra | ≥ 0 | — | < 0 |
| Razón corriente | > 2 | 1–2 | ≤ 1 |
| Prueba ácida | > 1 | — | ≤ 1 |
| Endeudamiento total | ≤ 60 % | 60–100 % | > 100 % |
| Endeudamiento corto plazo | 20–30 % | < 20 % | > 30 % |
| Endeudamiento largo plazo | < 1 | — | ≥ 1 |
| Apalancamiento | < 1 | — | ≥ 1 |
| Margen bruto | ≥ 20 % | 0–20 % | ≤ 0 |
| ROA | > 5 % | 0–5 % | ≤ 0 |
| Índice de rotación | ≥ 4 | 2–4 | < 2 |
| Días de inventario | ≤ 60 | 60–120 | > 120 |

Los umbrales de rotación usan el rango **industrial** del encargo (4–5), no el
de supermercados (≥ 25): una constructora no rota como un supermercado.

## Desgloses

La misma magnitud —dinero inmovilizado— repartida por tres dimensiones:
almacén, clase de artículo y obra. Que sean la misma magnitud vista desde tres
ángulos es lo que permite compararlas; tres gráficas de tres cosas distintas no
se comparan, solo se miran.

Cada desglose lleva gráfica **y** tabla con el porcentaje sobre el total: una
barra no da la cifra exacta ni se puede copiar a un correo.
