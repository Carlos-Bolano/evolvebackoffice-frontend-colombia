/** Unidad base de inventario (backend `BaseUnit`): todo se guarda en esta unidad. */
export const BASE_UNIT = { unit: 0, gram: 1, milliliter: 2 } as const

export type BaseUnitValue = (typeof BASE_UNIT)[keyof typeof BASE_UNIT]

export const BASE_UNIT_OPTIONS: { value: BaseUnitValue; labelKey: string; symbol: string }[] = [
  { value: BASE_UNIT.unit, labelKey: "unit_und", symbol: "und" },
  { value: BASE_UNIT.gram, labelKey: "unit_g", symbol: "g" },
  { value: BASE_UNIT.milliliter, labelKey: "unit_ml", symbol: "ml" },
]

export function unitSymbol(baseUnit: number): string {
  return BASE_UNIT_OPTIONS.find((o) => o.value === baseUnit)?.symbol ?? "und"
}

const numberFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })
const moneyFormat = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })

/**
 * Cantidad legible en la unidad que entiende la persona: 25000 g → "25 kg",
 * 1500 ml → "1,5 L", 12 und → "12 und".
 */
export function formatQuantity(quantity: number, baseUnit: number): string {
  const abs = Math.abs(quantity)
  if (baseUnit === BASE_UNIT.gram && abs >= 1000) return `${numberFormat.format(quantity / 1000)} kg`
  if (baseUnit === BASE_UNIT.milliliter && abs >= 1000) return `${numberFormat.format(quantity / 1000)} L`
  return `${numberFormat.format(quantity)} ${unitSymbol(baseUnit)}`
}

/** Equivalente en presentación: 50000 g con "Bulto 25 kg" (25000) → "2 × Bulto 25 kg". */
export function formatInPackaging(
  quantity: number,
  packaging?: { name: string; factor: number } | null
): string | null {
  if (!packaging || packaging.factor <= 0) return null
  return `${numberFormat.format(quantity / packaging.factor)} × ${packaging.name}`
}

export function formatMoney(value: number): string {
  return moneyFormat.format(value)
}

const unitCostFormat = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 })

/** Costo por unidad base: un gramo puede costar $3,20. */
export function formatUnitCost(value: number): string {
  return unitCostFormat.format(value)
}

/**
 * Uso del producto en inventario: atajo que marca "¿se guarda?" y "¿se vende?".
 * Semielaborado y producto terminado se distinguen cuando el producto tiene receta.
 */
export const INVENTORY_USES = {
  ingredient: { trackInventory: true, isSellable: false },
  resale: { trackInventory: true, isSellable: true },
  menuDish: { trackInventory: false, isSellable: true },
  internal: { trackInventory: false, isSellable: false },
} as const

export type InventoryUse = keyof typeof INVENTORY_USES

export function inventoryUseOf(trackInventory: boolean, isSellable: boolean): InventoryUse {
  if (trackInventory) return isSellable ? "resale" : "ingredient"
  return isSellable ? "menuDish" : "internal"
}

export const BASE_UNIT_KEY = "base"

export type QuantityUnitValue = {
  /** Lo que escribió la persona, en la unidad elegida. */
  amount: string
  /** BASE_UNIT_KEY o el id de una presentación. */
  unitKey: string
}

/** Cantidad en unidad base, o null si no es un número válido. */
export function toBaseQuantity(value: QuantityUnitValue, packagings: { id: string; factor: number }[]): number | null {
  const amount = Number(value.amount)
  if (value.amount.trim() === "" || Number.isNaN(amount)) return null
  if (value.unitKey === BASE_UNIT_KEY) return amount
  const packaging = packagings.find((p) => p.id === value.unitKey)
  return packaging ? amount * packaging.factor : null
}
