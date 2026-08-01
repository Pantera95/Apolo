/**
 * Motor de inventario de Apolo.
 *
 * Funciones PURAS: reciben estado y devuelven estado nuevo. No tocan storage,
 * no leen red, no dependen de React. Cuando entre Supabase cambia quién las
 * llama, no lo que hacen. Es el único módulo donde un bug cuesta dinero real,
 * y por eso es el único que está cubierto por tests desde el primer día.
 *
 * Doble registro, a propósito:
 *   - Los ASIENTOS son la verdad auditable e inmutable.
 *   - Los SALDOS son la verdad operativa, materializada para poder consultarla
 *     sin recorrer cientos de miles de asientos.
 * Los dos se actualizan en la misma operación y `reconciliar()` verifica que no
 * se hayan separado. Un sistema con solo saldos se desincroniza y nadie sabe
 * por qué; uno con solo kardex no aguanta el volumen de esta empresa.
 */

import type {
  Articulo,
  Asiento,
  ClaveSaldo,
  MotivoAjuste,
  Resultado,
  Saldo,
  TipoMovimiento,
} from "./tipos";
import { clave, disponible, fallo, ok, SALDO_CERO } from "./tipos";

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export interface EstadoInventario {
  readonly saldos: ReadonlyMap<string, Saldo>;
  readonly asientos: readonly Asiento[];
}

export const ESTADO_VACIO: EstadoInventario = {
  saldos: new Map(),
  asientos: [],
};

export function saldoDe(estado: EstadoInventario, k: ClaveSaldo): Saldo {
  return estado.saldos.get(clave(k)) ?? { ...SALDO_CERO };
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

interface Comun extends ClaveSaldo {
  cantidad: number;
  usuarioId: string;
  fecha?: string;
  documentoId?: string;
  nota?: string;
}

export type Operacion =
  | ({ tipo: "recepcion" } & Comun)
  | ({ tipo: "ajuste"; signo: 1 | -1; motivo: MotivoAjuste } & Comun)
  | ({ tipo: "reserva"; obraId: string } & Comun)
  | ({ tipo: "liberacion_reserva"; obraId: string } & Comun)
  | ({ tipo: "despacho"; obraId: string } & Comun)
  | ({ tipo: "entrega"; obraId: string } & Comun)
  | ({ tipo: "retorno"; obraId: string; condicion: "bueno" | "averiado" } & Comun)
  | ({ tipo: "conteo"; contado: number; motivo?: MotivoAjuste } & Comun);

type Delta = Partial<Saldo>;

// ---------------------------------------------------------------------------
// Aplicación
// ---------------------------------------------------------------------------

let contador = 0;
function nuevoId(tipo: TipoMovimiento): string {
  contador += 1;
  return `${tipo}-${contador.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Aplica una operación. Devuelve el estado nuevo o un error de negocio.
 *
 * El artículo se pasa porque hay reglas que dependen de su CLASE: un consumible
 * no puede retornar de obra, y aceptarlo silenciosamente inventaría existencias
 * que no existen.
 */
export function aplicar(
  estado: EstadoInventario,
  op: Operacion,
  articulo: Articulo,
): Resultado<{ estado: EstadoInventario; asiento: Asiento }> {
  if (op.tipo !== "conteo" && (!Number.isFinite(op.cantidad) || op.cantidad <= 0)) {
    return fallo("CANTIDAD_INVALIDA", "La cantidad debe ser mayor que cero");
  }

  const actual = saldoDe(estado, op);
  const calculo = deltaDe(op, actual, articulo);
  if (!calculo.ok) return calculo;

  const { delta, motivo } = calculo.valor;
  const siguiente = sumar(actual, delta);

  // Barrera universal: ninguna cantidad puede quedar negativa. No se advierte,
  // se bloquea. El cliente confirmó que no se permite stock negativo.
  const negativa = (Object.keys(siguiente) as (keyof Saldo)[]).find(
    (campo) => redondear(siguiente[campo]) < 0,
  );
  if (negativa) {
    return fallo(
      "STOCK_NEGATIVO",
      `La operación dejaría "${negativa}" en ${redondear(siguiente[negativa])} para ${articulo.codigo}`,
    );
  }

  const asiento: Asiento = Object.freeze({
    id: nuevoId(op.tipo),
    fecha: op.fecha ?? new Date().toISOString(),
    tipo: op.tipo,
    articuloId: op.articuloId,
    almacenId: op.almacenId,
    ubicacionId: op.ubicacionId,
    delta: Object.freeze({ ...SALDO_CERO, ...delta }),
    usuarioId: op.usuarioId,
    obraId: "obraId" in op ? op.obraId : undefined,
    motivo,
    documentoId: op.documentoId,
    nota: op.nota,
  });

  const saldos = new Map(estado.saldos);
  saldos.set(clave(op), redondearSaldo(siguiente));

  return ok({
    estado: { saldos, asientos: [...estado.asientos, asiento] },
    asiento,
  });
}

function deltaDe(
  op: Operacion,
  actual: Saldo,
  articulo: Articulo,
): Resultado<{ delta: Delta; motivo?: MotivoAjuste }> {
  switch (op.tipo) {
    case "recepcion":
      return ok({ delta: { fisico: op.cantidad } });

    case "ajuste": {
      // El motivo es obligatorio por tipo, pero un string vacío pasaría el
      // compilador y no explicaría nada en una auditoría.
      if (!op.motivo) {
        return fallo("MOTIVO_REQUERIDO", "Todo ajuste manual exige un motivo");
      }
      return ok({ delta: { fisico: op.signo * op.cantidad }, motivo: op.motivo });
    }

    case "reserva": {
      // Solo se puede comprometer lo que nadie más comprometió antes.
      if (op.cantidad > disponible(actual)) {
        return fallo(
          "STOCK_INSUFICIENTE",
          `Disponible ${disponible(actual)}, se intenta reservar ${op.cantidad}`,
        );
      }
      return ok({ delta: { reservado: op.cantidad } });
    }

    case "liberacion_reserva":
      return ok({ delta: { reservado: -op.cantidad } });

    case "despacho":
      // Despachar consume la reserva y saca la mercancía del almacén: sigue
      // siendo de la empresa, pero ya no está en el estante.
      return ok({
        delta: {
          fisico: -op.cantidad,
          reservado: -op.cantidad,
          enTransito: op.cantidad,
        },
      });

    case "entrega":
      return ok({
        delta: { enTransito: -op.cantidad, enObra: op.cantidad },
      });

    case "retorno": {
      // Solo los retornables vuelven. Aceptar el retorno de un consumible
      // inventaría existencias: los clavos que se usaron ya no existen.
      if (articulo.clase !== "retornable") {
        return fallo(
          "ARTICULO_NO_RETORNABLE",
          `${articulo.codigo} es "${articulo.clase}" y no admite retorno de obra`,
        );
      }
      return ok({
        delta:
          op.condicion === "averiado"
            ? { enObra: -op.cantidad, averiado: op.cantidad }
            : { enObra: -op.cantidad, fisico: op.cantidad },
      });
    }

    case "conteo": {
      if (!Number.isFinite(op.contado) || op.contado < 0) {
        return fallo("CANTIDAD_INVALIDA", "El conteo no puede ser negativo");
      }
      const diferencia = op.contado - actual.fisico;
      // Un conteo que cuadra no necesita explicación; uno que no cuadra, sí.
      if (diferencia !== 0 && !op.motivo) {
        return fallo(
          "MOTIVO_REQUERIDO",
          `El conteo difiere en ${diferencia} y no trae motivo`,
        );
      }
      return ok({ delta: { fisico: diferencia }, motivo: op.motivo });
    }
  }
}

// ---------------------------------------------------------------------------
// Transferencia entre almacenes
// ---------------------------------------------------------------------------

/**
 * Mover existencia entre ubicaciones o almacenes son DOS asientos, no uno: sale
 * de un sitio y entra en otro. Un solo asiento haría imposible auditar el
 * origen cuando aparezca un descuadre.
 */
export function transferir(
  estado: EstadoInventario,
  origen: ClaveSaldo,
  destino: ClaveSaldo,
  cantidad: number,
  usuarioId: string,
  articulo: Articulo,
  nota?: string,
): Resultado<{ estado: EstadoInventario; asientos: Asiento[] }> {
  if (clave(origen) === clave(destino)) {
    return fallo("CANTIDAD_INVALIDA", "Origen y destino son la misma ubicación");
  }

  const salida = aplicar(
    estado,
    { tipo: "ajuste", signo: -1, motivo: "consumo_interno", cantidad, usuarioId, nota, ...origen },
    articulo,
  );
  if (!salida.ok) return salida;

  const entrada = aplicar(
    salida.valor.estado,
    { tipo: "recepcion", cantidad, usuarioId, nota, ...destino },
    articulo,
  );
  if (!entrada.ok) return entrada;

  // Se reetiquetan como transferencia para que el kardex no los confunda con un
  // ajuste manual ni con una compra.
  const asientos = [
    { ...salida.valor.asiento, tipo: "transferencia_salida" as const, motivo: undefined },
    { ...entrada.valor.asiento, tipo: "transferencia_entrada" as const },
  ];

  const previos = entrada.valor.estado.asientos.slice(0, -2);
  return ok({
    estado: { saldos: entrada.valor.estado.saldos, asientos: [...previos, ...asientos] },
    asientos,
  });
}

// ---------------------------------------------------------------------------
// Reconciliación
// ---------------------------------------------------------------------------

export interface Discrepancia {
  clave: string;
  campo: keyof Saldo;
  segunSaldo: number;
  segunKardex: number;
  diferencia: number;
}

/** Reconstruye los saldos sumando el kardex desde cero. */
export function recalcularDesdeKardex(
  asientos: readonly Asiento[],
): Map<string, Saldo> {
  const saldos = new Map<string, Saldo>();
  for (const a of asientos) {
    const k = clave(a);
    saldos.set(k, redondearSaldo(sumar(saldos.get(k) ?? SALDO_CERO, a.delta)));
  }
  return saldos;
}

/**
 * Compara el saldo materializado contra el kardex. Debe devolver vacío siempre.
 * Si alguna vez devuelve algo, hay un bug y el sistema tiene que gritarlo en
 * vez de seguir operando sobre una cifra falsa.
 */
export function reconciliar(estado: EstadoInventario): Discrepancia[] {
  const recalculado = recalcularDesdeKardex(estado.asientos);
  const claves = new Set([...estado.saldos.keys(), ...recalculado.keys()]);
  const campos: (keyof Saldo)[] = [
    "fisico",
    "reservado",
    "averiado",
    "enTransito",
    "enObra",
  ];

  const salida: Discrepancia[] = [];
  for (const k of claves) {
    const a = estado.saldos.get(k) ?? SALDO_CERO;
    const b = recalculado.get(k) ?? SALDO_CERO;
    for (const campo of campos) {
      const diferencia = redondear(a[campo] - b[campo]);
      if (diferencia !== 0) {
        salida.push({
          clave: k,
          campo,
          segunSaldo: a[campo],
          segunKardex: b[campo],
          diferencia,
        });
      }
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function sumar(saldo: Saldo, delta: Delta): Saldo {
  return {
    fisico: saldo.fisico + (delta.fisico ?? 0),
    reservado: saldo.reservado + (delta.reservado ?? 0),
    averiado: saldo.averiado + (delta.averiado ?? 0),
    enTransito: saldo.enTransito + (delta.enTransito ?? 0),
    enObra: saldo.enObra + (delta.enObra ?? 0),
  };
}

/**
 * Las cantidades fraccionarias (metros, kilos, galones) arrastran error de coma
 * flotante: 0.1 + 0.2 no da 0.3. Sin este redondeo, la reconciliación reportaría
 * discrepancias inventadas de 1e-15 y nadie volvería a confiar en la alerta.
 */
function redondear(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function redondearSaldo(s: Saldo): Saldo {
  return {
    fisico: redondear(s.fisico),
    reservado: redondear(s.reservado),
    averiado: redondear(s.averiado),
    enTransito: redondear(s.enTransito),
    enObra: redondear(s.enObra),
  };
}
