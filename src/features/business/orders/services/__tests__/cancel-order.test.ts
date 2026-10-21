import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "@/config/axios-client"
import { cancelOrder } from "../orders.service"

vi.mock("@/config/axios-client", () => ({ api: { post: vi.fn() } }))
const mockedApi = vi.mocked(api, { deep: true })

describe("cancelOrder service", () => {
  beforeEach(() => vi.clearAllMocks())

  it("llama a POST /api/orders/{id}/cancel con el payload de disposición y motivo", async () => {
    mockedApi.post.mockResolvedValue({ data: null })

    await cancelOrder("order-123", {
      cancellationType: "Waste",
      reason: "Producto dañado en cocina",
    })

    expect(mockedApi.post).toHaveBeenCalledWith("/api/orders/order-123/cancel", {
      cancellationType: "Waste",
      reason: "Producto dañado en cocina",
    })
  })

  it("llama a POST /api/orders/{id}/cancel con payload vacío por defecto", async () => {
    mockedApi.post.mockResolvedValue({ data: null })

    await cancelOrder("order-456")

    expect(mockedApi.post).toHaveBeenCalledWith("/api/orders/order-456/cancel", {})
  })

  it("llama a POST /api/orders/{id}/cancel con disposiciones específicas por ítem", async () => {
    mockedApi.post.mockResolvedValue({ data: null })

    await cancelOrder("order-789", {
      cancellationType: "Waste",
      reason: "Bebidas selladas devueltas, comida a merma",
      items: [
        { orderItemId: "item-burger", disposition: "Waste" },
        { orderItemId: "item-coke", disposition: "Restocked" },
      ],
    })

    expect(mockedApi.post).toHaveBeenCalledWith("/api/orders/order-789/cancel", {
      cancellationType: "Waste",
      reason: "Bebidas selladas devueltas, comida a merma",
      items: [
        { orderItemId: "item-burger", disposition: "Waste" },
        { orderItemId: "item-coke", disposition: "Restocked" },
      ],
    })
  })
})
