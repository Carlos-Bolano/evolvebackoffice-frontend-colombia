// ─── Producción (backend fase 4) ─────────────────────────────────────────────
// Cantidades en unidad base del producto/ingrediente.

export type ProductionStatus = "Planned" | "Completed" | "Cancelled" | "Voided"

export interface ProducibleItemDto {
  itemId: string
  itemName: string
  sku: string | null
  baseUnit: number
  yieldQuantity: number
  onHand: number
  unitCost: number
}

export interface ProductionIngredientDto {
  itemId: string
  itemName: string
  sku: string | null
  baseUnit: number
  required: number
  onHand: number
  shortage: number
  unitCost: number
  totalCost: number
}

export interface ProductionPreviewDto {
  itemId: string
  itemName: string
  baseUnit: number
  quantity: number
  yieldQuantity: number
  canProduce: boolean
  totalCost: number
  unitCost: number
  ingredients: ProductionIngredientDto[]
}

export interface ProductionIngredientInput {
  itemId: string
  quantity: number
}

export interface CreateProductionOrderDto {
  branchId: string
  itemId: string
  plannedQuantity: number
  producedQuantity: number | null
  ingredients: ProductionIngredientInput[] | null
  notes: string | null
  complete: boolean
}

export interface ProductionOrderLineDto {
  itemId: string
  itemName: string
  sku: string | null
  baseUnit: number
  theoreticalQuantity: number
  actualQuantity: number | null
  unitCost: number
  totalCost: number
}

export interface ProductionOrderSummaryDto {
  id: string
  number: string
  branchId: string
  branchName: string
  itemId: string
  itemName: string
  baseUnit: number
  plannedQuantity: number
  producedQuantity: number | null
  status: ProductionStatus
  totalCost: number
  unitCost: number
  createdAt: string
  completedAt: string | null
}

export interface ProductionOrderDto extends ProductionOrderSummaryDto {
  sku: string | null
  efficiency: number | null
  notes: string | null
  createdBy: string | null
  completedBy: string | null
  voidedAt: string | null
  lines: ProductionOrderLineDto[]
}
