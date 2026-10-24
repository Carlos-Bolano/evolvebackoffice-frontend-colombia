import { api } from "@/config/axios-client"
import type { EntityImageDto, ItemSuggestDto, UploadEntityImageDto } from "../types"

/**
 * Galería del producto: /api/Items/{id}/images (máx. 5; la primera es la principal).
 */

export async function getItemImages(itemId: string): Promise<EntityImageDto[]> {
  const { data } = await api.get<EntityImageDto[]>(`/api/Items/${itemId}/images`)
  return data
}

export async function uploadItemImage(itemId: string, payload: UploadEntityImageDto): Promise<EntityImageDto> {
  const { data } = await api.post<EntityImageDto>(`/api/Items/${itemId}/images`, payload)
  return data
}

/** Copia una imagen pública de /media (la de una sugerencia) a este producto. */
export async function copyItemImage(itemId: string, url: string): Promise<EntityImageDto> {
  const { data } = await api.post<EntityImageDto>(`/api/Items/${itemId}/images/from-url`, { url })
  return data
}

export async function setItemImagePrivacy(
  itemId: string,
  imageId: string,
  isPrivate: boolean
): Promise<EntityImageDto> {
  const { data } = await api.put<EntityImageDto>(`/api/Items/${itemId}/images/${imageId}`, { isPrivate })
  return data
}

/** El primer id de la lista queda como imagen principal. */
export async function reorderItemImages(itemId: string, imageIds: string[]): Promise<EntityImageDto[]> {
  const { data } = await api.put<EntityImageDto[]>(`/api/Items/${itemId}/images/order`, { imageIds })
  return data
}

export async function deleteItemImage(itemId: string, imageId: string): Promise<void> {
  await api.delete(`/api/Items/${itemId}/images/${imageId}`)
}

/** Producto con el mismo SKU en otro negocio (datos + imágenes públicas). */
export async function suggestItemBySku(sku: string): Promise<ItemSuggestDto> {
  const { data } = await api.get<ItemSuggestDto>("/api/Items/suggest", { params: { sku } })
  return data
}
