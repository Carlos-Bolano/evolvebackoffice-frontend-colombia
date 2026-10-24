import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createItemPackaging,
  createWriteoff,
  deleteRecipe,
  deleteItemPackaging,
  getInventoryInbox,
  getItemPackagings,
  getMovements,
  getRecipe,
  getStock,
  saveRecipe,
  setStockQuantity,
  updateStockLevels,
  voidAdjustment,
} from "../services/inventory.service"
import type { CreateWriteoffDto, SaveItemPackagingDto, SaveRecipeDto, SetStockQuantityDto } from "../types"

const INVENTORY_KEYS = ["inventory-stock", "inventory-movements", "inventory-inbox"]

function useInvalidateInventory() {
  const queryClient = useQueryClient()
  return () => INVENTORY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
}

export function useStock(params: {
  branchId: string | null
  search: string
  belowMin: boolean
  negative: boolean
  pageNumber: number
  pageSize?: number
}) {
  return useQuery({
    queryKey: ["inventory-stock", params],
    queryFn: () => getStock({ ...params, branchId: params.branchId! }),
    enabled: Boolean(params.branchId),
    placeholderData: keepPreviousData,
  })
}

export function useMovements(params: { branchId: string | null; itemId?: string; pageNumber: number }) {
  return useQuery({
    queryKey: ["inventory-movements", params],
    queryFn: () => getMovements({ ...params, branchId: params.branchId! }),
    enabled: Boolean(params.branchId),
    placeholderData: keepPreviousData,
  })
}

export function useInventoryInbox(branchId: string | null) {
  return useQuery({
    queryKey: ["inventory-inbox", branchId],
    queryFn: () => getInventoryInbox(branchId!),
    enabled: Boolean(branchId),
  })
}

export function useCreateWriteoff() {
  const invalidate = useInvalidateInventory()
  return useMutation({ mutationFn: (payload: CreateWriteoffDto) => createWriteoff(payload), onSuccess: invalidate })
}

export function useSetStockQuantity() {
  const invalidate = useInvalidateInventory()
  return useMutation({ mutationFn: (payload: SetStockQuantityDto) => setStockQuantity(payload), onSuccess: invalidate })
}

export function useVoidAdjustment() {
  const invalidate = useInvalidateInventory()
  return useMutation({ mutationFn: (id: string) => voidAdjustment(id), onSuccess: invalidate })
}

export function useUpdateStockLevels() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: ({ branchItemId, ...payload }: { branchItemId: string; reorderPoint: number; restockLevel: number }) =>
      updateStockLevels(branchItemId, payload),
    onSuccess: invalidate,
  })
}

export function useItemPackagings(itemId: string | null) {
  return useQuery({
    queryKey: ["item-packagings", itemId],
    queryFn: () => getItemPackagings(itemId!),
    enabled: Boolean(itemId),
  })
}

export function useCreateItemPackaging(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SaveItemPackagingDto) => createItemPackaging(itemId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["item-packagings", itemId] }),
  })
}

export function useDeleteItemPackaging(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (packagingId: string) => deleteItemPackaging(itemId, packagingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["item-packagings", itemId] }),
  })
}

// ─── Recetas ─────────────────────────────────────────────────────────────────

export function useRecipe(itemId: string | null, branchId: string | null) {
  return useQuery({
    queryKey: ["item-recipe", itemId, branchId],
    queryFn: () => getRecipe(itemId!, branchId),
    enabled: Boolean(itemId),
  })
}

export function useSaveRecipe(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SaveRecipeDto) => saveRecipe(itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-recipe", itemId] })
      queryClient.invalidateQueries({ queryKey: ["items"] })
    },
  })
}

export function useDeleteRecipe(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deleteRecipe(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-recipe", itemId] })
      queryClient.invalidateQueries({ queryKey: ["items"] })
    },
  })
}
