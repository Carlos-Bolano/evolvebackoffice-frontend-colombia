import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/config/axios-client"
import { assignOrderCourier, getCouriers, getDeliveryBoard } from "@/features/business/orders/services/couriers.service"
import { deleteDeliveryZone } from "@/features/business/orders/services/delivery-enhancements.service"
import {
  cancelOrderFromClosing,
  reconcileOrderPayments,
} from "@/features/business/orders/services/order-closings.service"
import { cancelOrder, getOrders, updateOrderStatus } from "@/features/business/orders/services/orders.service"
import {
  connectBranchWhatsAppChannel,
  getBranchWhatsAppQr,
  resendOrderWhatsAppMessage,
  retryOrderWhatsAppMessage,
  sendOrderWhatsAppNotification,
} from "@/features/business/orders/services/whatsapp.service"

vi.mock("@/config/axios-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const mockedApi = vi.mocked(api, { deep: true })

describe("couriers.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getCouriers normaliza { data, totalCount } y omite filtros vacíos", async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [{ id: "c1", name: "Pedro" }], totalCount: 21 } })

    const result = await getCouriers({ branchId: null, pageSize: 20 })

    expect(mockedApi.get).toHaveBeenCalledWith("/api/couriers", {
      params: { pageNumber: 1, pageSize: 20, branchId: undefined, includeInactive: undefined, searchValue: undefined },
    })
    expect(result.data).toHaveLength(1)
    expect(result.totalCount).toBe(21)
    expect(result.totalPages).toBe(2)
  })

  it("getCouriers tolera una respuesta sin data", async () => {
    mockedApi.get.mockResolvedValue({ data: null })
    const result = await getCouriers({})
    expect(result).toEqual({ data: [], totalCount: 0, totalPages: 0 })
  })

  it("assignOrderCourier envía null para quitar el domiciliario", async () => {
    mockedApi.put.mockResolvedValue({})
    await assignOrderCourier("o1", null)
    expect(mockedApi.put).toHaveBeenCalledWith("/api/orders/o1/courier", { courierId: null })
  })

  it("getDeliveryBoard pasa sucursal y fecha solo si existen", async () => {
    mockedApi.get.mockResolvedValue({ data: { couriers: [], unassigned: [] } })
    await getDeliveryBoard({ branchId: "b1", date: "" })
    expect(mockedApi.get).toHaveBeenCalledWith("/api/orders/deliveries", {
      params: { branchId: "b1", courierId: undefined, date: undefined },
    })
  })
})

describe("estado y conciliación con domiciliario", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updateOrderStatus incluye courierId solo cuando viene", async () => {
    mockedApi.put.mockResolvedValue({})
    await updateOrderStatus("o1", "Shipped", "c1")
    await updateOrderStatus("o1", "Delivered")
    expect(mockedApi.put).toHaveBeenNthCalledWith(1, "/api/orders/o1/status", { status: "Shipped", courierId: "c1" })
    expect(mockedApi.put).toHaveBeenNthCalledWith(2, "/api/orders/o1/status", { status: "Delivered" })
  })

  it("reconcileOrderPayments envía los pagos con efectivo recibido", async () => {
    mockedApi.put.mockResolvedValue({ data: { orderId: "o1", reconciled: true, payments: [], totals: [] } })
    const payments = [
      { paymentMethodCode: "EFECTIVO", amount: 30000, tenderedAmount: 50000 },
      { paymentMethodCode: "TARJETA", amount: 25000, reference: "1234" },
    ]
    const result = await reconcileOrderPayments("o1", payments)
    expect(mockedApi.put).toHaveBeenCalledWith("/api/orders/o1/reconcile", { payments })
    expect(result.reconciled).toBe(true)
  })

  it("cancelOrderFromClosing y cancelOrder envían reason y cancellationType en el body JSON", async () => {
    mockedApi.post.mockResolvedValue({})
    await cancelOrderFromClosing("o1", "Cliente no contestó", "Waste")
    await cancelOrder("o2", { reason: "Error de captura", cancellationType: "Restocked" })
    expect(mockedApi.post).toHaveBeenNthCalledWith(1, "/api/orders/o1/cancel", {
      reason: "Cliente no contestó",
      cancellationType: "Waste",
    })
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, "/api/orders/o2/cancel", {
      reason: "Error de captura",
      cancellationType: "Restocked",
    })
  })

  it("getOrders transmite filtros enriquecidos y omite valores vacíos", async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [], totalCount: 0 } })
    await getOrders(1, 20, {
      branchId: "b1",
      search: "ORD-101",
      fulfillmentType: "delivery",
      origin: "Cluvi",
      paymentState: "pending",
      syncAlert: "error",
    })
    expect(mockedApi.get).toHaveBeenCalledWith("/api/orders", {
      params: {
        pageNumber: 1,
        pageSize: 20,
        branchId: "b1",
        search: "ORD-101",
        fulfillmentType: "delivery",
        origin: "Cluvi",
        paymentState: "pending",
        syncAlert: "error",
      },
    })
  })

  it("deleteDeliveryZone invoca DELETE /api/delivery-enhancements/zones/{id}", async () => {
    mockedApi.delete.mockResolvedValue({})
    await deleteDeliveryZone("zone-123")
    expect(mockedApi.delete).toHaveBeenCalledWith("/api/delivery-enhancements/zones/zone-123")
  })
})

describe("whatsapp.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getBranchWhatsAppQr retorna null en 204", async () => {
    mockedApi.get.mockResolvedValue({ status: 204, data: null })
    const qr = await getBranchWhatsAppQr("b1")
    expect(qr).toBeNull()
  })

  it("connect, send, retry y resend incluyen header Idempotency-Key", async () => {
    mockedApi.post
      .mockResolvedValueOnce({ data: { id: "channel1", templates: [] } })
      .mockResolvedValue({ data: { id: "m1", status: "Sent" } })

    await connectBranchWhatsAppChannel("b1", "idem-connect-1")
    await sendOrderWhatsAppNotification(
      "o1",
      { recipientType: "Customer", templateCode: "OrderReady", previewVersion: "v1" },
      "idem-send-1"
    )
    await retryOrderWhatsAppMessage("o1", "m1", "idem-retry-1")
    await resendOrderWhatsAppMessage(
      "o1",
      "m1",
      { acknowledgeDuplicateRisk: true, reason: "Cliente solicitó reenvío" },
      "idem-resend-1"
    )

    expect(mockedApi.post).toHaveBeenNthCalledWith(
      1,
      "/api/branches/b1/whatsapp/connect",
      {},
      { headers: { "Idempotency-Key": "idem-connect-1" } }
    )
    expect(mockedApi.post).toHaveBeenNthCalledWith(
      2,
      "/api/orders/o1/whatsapp/notifications",
      { recipientType: "Customer", templateCode: "OrderReady", previewVersion: "v1" },
      { headers: { "Idempotency-Key": "idem-send-1" } }
    )
    expect(mockedApi.post).toHaveBeenNthCalledWith(
      3,
      "/api/orders/o1/whatsapp/messages/m1/retry",
      {},
      { headers: { "Idempotency-Key": "idem-retry-1" } }
    )
    expect(mockedApi.post).toHaveBeenNthCalledWith(
      4,
      "/api/orders/o1/whatsapp/messages/m1/resend",
      { acknowledgeDuplicateRisk: true, reason: "Cliente solicitó reenvío" },
      { headers: { "Idempotency-Key": "idem-resend-1" } }
    )
  })
})
