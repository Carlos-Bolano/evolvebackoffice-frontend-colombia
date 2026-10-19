import { api } from "@/config/axios-client"
import type {
  CreateWriteoffDto,
  InventoryInboxDto,
  InventoryMovementDto,
  ItemPackagingDto,
  PagedResult,
  RecipeDto,
  SaveRecipeDto,
  SaveItemPackagingDto,
  SetStockQuantityDto,
  StockAdjustmentDto,
  StockItemDto,
} from "../types"

export const INVENTORY_PAGE_SIZE = 10

type Paged<T> = { data: T[]; totalCount: number }

export async function getStock(params: {
  branchId: string
  search?: string
  belowMin?: boolean
  negative?: boolean
  pageNumber?: number
}): Promise<PagedResult<StockItemDto>> {
  const { data } = await api.get<Paged<StockItemDto>>("/api/inventory/stock", {
    params: { ...params, search: params.search || undefined, pageSize: INVENTORY_PAGE_SIZE },
  })
  return { items: data?.data ?? [], totalCount: data?.totalCount ?? 0 }
}

export async function getMovements(params: {
  branchId: string
  itemId?: string
  pageNumber?: number
}): Promise<PagedResult<InventoryMovementDto>> {
  const { data } = await api.get<Paged<InventoryMovementDto>>("/api/inventory/movements", {
    params: { ...params, pageSize: INVENTORY_PAGE_SIZE },
  })
  return { items: data?.data ?? [], totalCount: data?.totalCount ?? 0 }
}

export async function getInventoryInbox(branchId: string): Promise<InventoryInboxDto> {
  const { data } = await api.get<InventoryInboxDto>("/api/inventory/inbox", { params: { branchId } })
  return data
}

export async function createWriteoff(payload: CreateWriteoffDto): Promise<StockAdjustmentDto> {
  const { data } = await api.post<StockAdjustmentDto>("/api/inventory/adjustments/writeoff", payload)
  return data
}

export async function setStockQuantity(payload: SetStockQuantityDto): Promise<StockAdjustmentDto> {
  const { data } = await api.post<StockAdjustmentDto>("/api/inventory/adjustments/set-quantity", payload)
  return data
}

export async function voidAdjustment(id: string): Promise<StockAdjustmentDto> {
  const { data } = await api.post<StockAdjustmentDto>(`/api/inventory/adjustments/${id}/void`)
  return data
}

export async function updateStockLevels(
  branchItemId: string,
  payload: { reorderPoint: number; restockLevel: number }
): Promise<void> {
  await api.put(`/api/inventory/stock/${branchItemId}/levels`, payload)
}

// ─── Presentaciones ───────────────────────────────────────────────────────────

export async function getItemPackagings(itemId: string): Promise<ItemPackagingDto[]> {
  const { data } = await api.get<ItemPackagingDto[]>(`/api/items/${itemId}/packagings`)
  return data ?? []
}

export async function createItemPackaging(itemId: string, payload: SaveItemPackagingDto): Promise<ItemPackagingDto> {
  const { data } = await api.post<ItemPackagingDto>(`/api/items/${itemId}/packagings`, payload)
  return data
}

export async function deleteItemPackaging(itemId: string, packagingId: string): Promise<void> {
  await api.delete(`/api/items/${itemId}/packagings/${packagingId}`)
}

// ─── Recetas ─────────────────────────────────────────────────────────────────

/** Receta del producto (null si no tiene). Con sucursal trae costos de esa sucursal. */
export async function getRecipe(itemId: string, branchId: string | null): Promise<RecipeDto | null> {
  const response = await api.get<RecipeDto>(`/api/items/${itemId}/recipe`, {
    params: { branchId: branchId ?? undefined },
  })
  return response.status === 204 ? null : response.data
}

export async function saveRecipe(itemId: string, payload: SaveRecipeDto): Promise<RecipeDto> {
  const { data } = await api.put<RecipeDto>(`/api/items/${itemId}/recipe`, payload)
  return data
}

export async function deleteRecipe(itemId: string): Promise<void> {
  await api.delete(`/api/items/${itemId}/recipe`)
}
