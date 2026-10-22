import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "@/config/axios-client"
import { cancelOrder } from "../orders.service"
import { isBeverage } from "../../components/cancel-order-dialog"

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

describe("isBeverage helper", () => {
  it("no clasifica comida preparada como bebida por subcadenas (observaciones CodeRabbit)", () => {
    // Casos reales reportados
    expect(isBeverage("Steak de Res")).toBe(false)
    expect(isBeverage("Porción de Aguacate")).toBe(false)
    expect(isBeverage("Pizza Cuatro Quesos")).toBe(false)
    expect(isBeverage("Tostadas con Paté")).toBe(false)
    expect(isBeverage("Costillas en salsa bbq")).toBe(false)
  })

  it("clasifica correctamente bebidas legítimas y maneja tildes/variantes", () => {
    expect(isBeverage("Coca Cola Zero 400ml")).toBe(true)
    expect(isBeverage("Agua Mineral Cristal")).toBe(true)
    expect(isBeverage("Jugo de Mora")).toBe(true)
    expect(isBeverage("Cerveza Águila")).toBe(true)
    expect(isBeverage("Cerveza Poker")).toBe(true)
    expect(isBeverage("Té helado de durazno")).toBe(true)
    expect(isBeverage("Iced Tea")).toBe(true)
    expect(isBeverage("Gaseosa Postobón Manzana")).toBe(true)
    expect(isBeverage("Gaseosa Quatro")).toBe(true)
    expect(isBeverage("Sprite en lata")).toBe(true)
  })
})
