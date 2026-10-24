import { api } from "@/config/axios-client"
import type { PagedResult } from "../types"
import type { CreateWholesaleSaleDto, ItemPriceDto, ProductMarginDto, WholesaleSaleDto } from "../types/sales"
import { INVENTORY_PAGE_SIZE } from "./inventory.service"

type Paged<T> = { data: T[]; totalCount: number }

export async function getMargins(params: {
  branchId: string
  search?: string
  pageNumber: number
}): Promise<PagedResult<ProductMarginDto>> {
  const { data } = await api.get<Paged<ProductMarginDto>>("/api/inventory/margins", {
    params: { ...params, search: params.search?.trim() || undefined, pageSize: INVENTORY_PAGE_SIZE },
  })
  return { items: data?.data ?? [], totalCount: data?.totalCount ?? 0 }
}

export async function getItemPrice(branchId: string, itemId: string): Promise<ItemPriceDto> {
  const { data } = await api.get<ItemPriceDto>("/api/inventory/price", { params: { branchId, itemId } })
  return data
}

export async function getSales(branchId: string, pageNumber: number): Promise<PagedResult<WholesaleSaleDto>> {
  const { data } = await api.get<Paged<WholesaleSaleDto>>("/api/sales", {
    params: { branchId, pageNumber, pageSize: INVENTORY_PAGE_SIZE },
  })
  return { items: data?.data ?? [], totalCount: data?.totalCount ?? 0 }
}

export async function getSale(id: string): Promise<WholesaleSaleDto> {
  const { data } = await api.get<WholesaleSaleDto>(`/api/sales/${id}`)
  return data
}

export async function createSale(payload: CreateWholesaleSaleDto): Promise<WholesaleSaleDto> {
  const { data } = await api.post<WholesaleSaleDto>("/api/sales", payload)
  return data
}

export async function voidSale(id: string): Promise<WholesaleSaleDto> {
  const { data } = await api.post<WholesaleSaleDto>(`/api/sales/${id}/void`)
  return data
}
