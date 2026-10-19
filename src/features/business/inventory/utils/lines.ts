import type { ProductLine } from "../components/product-lines-editor"
import type { LineInput } from "../types/purchasing"
import { BASE_UNIT_KEY } from "./units"

/** Líneas completas: cantidad > 0 (y precio ≥ 0 si se pide). */
export function linesAreValid(lines: ProductLine[], withPrice = false): boolean {
  return (
    lines.length > 0 &&
    lines.every(
      (l) =>
        Number(l.quantity.amount) > 0 &&
        (!withPrice || (l.unitCost !== undefined && l.unitCost.trim() !== "" && Number(l.unitCost) >= 0))
    )
  )
}

/** Al formato del backend: cantidad en la presentación elegida (o unidad base) + id de presentación. */
export function toLineInputs(lines: ProductLine[]): LineInput[] {
  return lines.map((l) => ({
    itemId: l.itemId,
    quantity: Number(l.quantity.amount),
    packagingId: l.quantity.unitKey === BASE_UNIT_KEY ? null : l.quantity.unitKey,
  }))
}
