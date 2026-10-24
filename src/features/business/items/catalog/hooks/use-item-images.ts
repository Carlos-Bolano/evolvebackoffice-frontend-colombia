import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  copyItemImage,
  deleteItemImage,
  getItemImages,
  reorderItemImages,
  setItemImagePrivacy,
  suggestItemBySku,
  uploadItemImage,
} from "../services/item-images.service"
import type { UploadEntityImageDto } from "../types"

export function useItemImages(itemId: string) {
  return useQuery({
    queryKey: ["item-images", itemId],
    queryFn: () => getItemImages(itemId),
    enabled: Boolean(itemId),
  })
}

/** Refresca la galería y los listados (miniatura del catálogo y encabezado del producto). */
function useInvalidateImages(itemId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ["item-images", itemId] })
    queryClient.invalidateQueries({ queryKey: ["items"] })
  }
}

export function useUploadItemImage(itemId: string) {
  const invalidate = useInvalidateImages(itemId)
  return useMutation({
    mutationFn: (payload: UploadEntityImageDto) => uploadItemImage(itemId, payload),
    onSettled: invalidate,
  })
}

export function useSetItemImagePrivacy(itemId: string) {
  const invalidate = useInvalidateImages(itemId)
  return useMutation({
    mutationFn: ({ imageId, isPrivate }: { imageId: string; isPrivate: boolean }) =>
      setItemImagePrivacy(itemId, imageId, isPrivate),
    onSuccess: invalidate,
  })
}

export function useReorderItemImages(itemId: string) {
  const invalidate = useInvalidateImages(itemId)
  return useMutation({
    mutationFn: (imageIds: string[]) => reorderItemImages(itemId, imageIds),
    onSuccess: invalidate,
  })
}

export function useDeleteItemImage(itemId: string) {
  const invalidate = useInvalidateImages(itemId)
  return useMutation({
    mutationFn: (imageId: string) => deleteItemImage(itemId, imageId),
    onSuccess: invalidate,
  })
}

/** Copia a un producto recién creado las imágenes elegidas de una sugerencia. */
export function useCopyItemImages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, urls }: { itemId: string; urls: string[] }) => {
      // En orden, para que la primera siga siendo la principal.
      for (const url of urls) await copyItemImage(itemId, url)
    },
    onSettled: (_data, _error, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: ["item-images", itemId] })
      queryClient.invalidateQueries({ queryKey: ["items"] })
    },
  })
}

/** Sugerencia por SKU (solo al crear y con un SKU de al menos 4 caracteres). */
export function useItemSuggestion(sku: string, enabled: boolean) {
  const value = sku.trim()
  return useQuery({
    queryKey: ["item-suggestion", value],
    queryFn: () => suggestItemBySku(value),
    enabled: enabled && value.length >= 4,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
