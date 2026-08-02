/**
 * Vista de almacén sobre la herramienta retornable.
 *
 * Obras responde "¿qué me debe esta obra?". Aquí se responde la otra mitad,
 * que es la que hace el jefe de almacén: "¿dónde está mi esmeril?" y "¿cuánta
 * herramienta tengo fuera en total?".
 *
 * La antigüedad se reutiliza de `deudaDeObra`, que ya descuenta los retornos
 * por FIFO. Reimplementar ese cálculo aquí sería garantizar que un día las dos
 * pantallas muestren números distintos del mismo hecho.
 */

import type { EstadoApolo } from "@/lib/db/almacen";
import type { Articulo, Obra } from "@/lib/dominio/tipos";
import { deudaDeObra } from "./obras";

export interface PrestamoAbierto {
  id: string;
  articulo: Articulo;
  obra: Obra;
  unidades: number;
  dias: number;
  valorUsd: number;
  almacenId: string;
  ubicacionId: string;
}

/** Todo lo retornable que está fuera, sin importar de qué obra. */
export function prestamosAbiertos(
  estado: EstadoApolo,
  ahora: number,
): PrestamoAbierto[] {
  const salida: PrestamoAbierto[] = [];

  for (const obra of estado.obras) {
    for (const d of deudaDeObra(estado, obra.id, ahora)) {
      salida.push({
        id: `${obra.id}|${d.articulo.id}`,
        articulo: d.articulo,
        obra,
        unidades: d.unidades,
        dias: d.diasMax,
        valorUsd: d.valorUsd,
        almacenId: d.almacenId,
        ubicacionId: d.ubicacionId,
      });
    }
  }

  // Lo más viejo primero: es lo que hay que ir a buscar.
  return salida.sort((a, b) => b.dias - a.dias);
}

export interface FichaHerramienta {
  articulo: Articulo;
  total: number;
  enAlmacen: number;
  disponible: number;
  fuera: number;
  averiado: number;
  valorFuera: number;
  obras: number;
  diasMax: number;
}

/**
 * Una ficha por herramienta con su reparto completo.
 *
 * `total` incluye lo averiado a propósito: sigue siendo un activo de la
 * empresa aunque no se pueda usar, y desaparecerlo del recuento es como se
 * pierde la pista de lo que hay que reparar o dar de baja.
 */
export function fichasHerramienta(
  estado: EstadoApolo,
  ahora: number,
): FichaHerramienta[] {
  const retornables = estado.articulos.filter((a) => a.clase === "retornable");
  const prestamos = prestamosAbiertos(estado, ahora);

  return retornables
    .map((articulo) => {
      let enAlmacen = 0;
      let reservado = 0;
      let averiado = 0;
      let fuera = 0;

      for (const [clave, saldo] of estado.inventario.saldos) {
        if (clave.split("|")[0] !== articulo.id) continue;
        enAlmacen += saldo.fisico;
        reservado += saldo.reservado;
        averiado += saldo.averiado;
        fuera += saldo.enObra;
      }

      const suyos = prestamos.filter((p) => p.articulo.id === articulo.id);

      return {
        articulo,
        total: enAlmacen + fuera,
        enAlmacen,
        disponible: enAlmacen - reservado - averiado,
        fuera,
        averiado,
        valorFuera: fuera * articulo.costoPromedioUsd,
        obras: new Set(suyos.map((p) => p.obra.id)).size,
        diasMax: suyos.reduce((m, p) => Math.max(m, p.dias), 0),
      };
    })
    .sort((a, b) => b.fuera - a.fuera);
}

export interface ResumenHerramientas {
  articulos: number;
  unidadesFuera: number;
  valorFuera: number;
  averiadas: number;
  prestamosVencidos: number;
  obrasConDeuda: number;
}

/** PROVISIONAL: 60 días como umbral de "lleva demasiado tiempo fuera". */
export const DIAS_VENCIDO = 60;

export function resumenHerramientas(
  estado: EstadoApolo,
  ahora: number,
): ResumenHerramientas {
  const fichas = fichasHerramienta(estado, ahora);
  const prestamos = prestamosAbiertos(estado, ahora);

  return {
    articulos: fichas.length,
    unidadesFuera: fichas.reduce((s, f) => s + f.fuera, 0),
    valorFuera: fichas.reduce((s, f) => s + f.valorFuera, 0),
    averiadas: fichas.reduce((s, f) => s + f.averiado, 0),
    prestamosVencidos: prestamos.filter((p) => p.dias > DIAS_VENCIDO).length,
    obrasConDeuda: new Set(prestamos.map((p) => p.obra.id)).size,
  };
}
