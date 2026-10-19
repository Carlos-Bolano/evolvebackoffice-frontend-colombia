import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  cancelProductionOrder,
  completeProductionOrder,
  createProductionOrder,
  getProducibleItems,
  getProductionOrder,
  getProductionOrders,
  getProductionPreview,
  voidProductionOrder,
} from "../services/production.service"

/** Producir mueve ingredientes, producto y la bandeja. */
const PRODUCTION_KEYS = [
  "production-orders",
  "production-order",
  "production-products",
  "inventory-stock",
  "inventory-movements",
  "inventory-inbox",
]

export function useProducibleItems(branchId: string | null) {
  return useQuery({
    queryKey: ["production-products", branchId],
    queryFn: () => getProducibleItems(branchId!),
    enabled: Boolean(branchId),
  })
}

export function useProductionPreview(branchId: string | null, itemId: string | null, quantity: number) {
  return useQuery({
    queryKey: ["production-preview", branchId, itemId, quantity],
    queryFn: () => getProductionPreview(branchId!, itemId!, quantity),
    enabled: Boolean(branchId && itemId) && quantity > 0,
    placeholderData: keepPreviousData,
  })
}

export function useProductionOrders(params: { branchId: string | null; status?: string; pageNumber: number }) {
  return useQuery({
    queryKey: ["production-orders", params],
    queryFn: () => getProductionOrders({ ...params, branchId: params.branchId! }),
    enabled: Boolean(params.branchId),
    placeholderData: keepPreviousData,
  })
}

export function useProductionOrder(id: string | null) {
  return useQuery({ queryKey: ["production-order", id], queryFn: () => getProductionOrder(id!), enabled: Boolean(id) })
}

function useProductionMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => PRODUCTION_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  })
}

export const useCreateProduction = () => useProductionMutation(createProductionOrder)
export const useCompleteProduction = () =>
  useProductionMutation((args: { id: string } & Parameters<typeof completeProductionOrder>[1]) =>
    completeProductionOrder(args.id, args)
  )
export const useCancelProduction = () => useProductionMutation(cancelProductionOrder)
export const useVoidProduction = () => useProductionMutation(voidProductionOrder)
