import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/config/axios-client"
import {
  getDeliveryProof,
  getDeliveryProofImage,
} from "@/features/business/orders/services/delivery-enhancements.service"

vi.mock("@/config/axios-client", () => ({ api: { get: vi.fn() } }))
const mockedApi = vi.mocked(api, { deep: true })

describe("prueba de entrega privada", () => {
  beforeEach(() => vi.clearAllMocks())

  it("pide los metadatos sin la imagen", async () => {
    mockedApi.get.mockResolvedValue({ data: { orderId: "o1", kind: "Photo", sizeBytes: 10 } })
    const proof = await getDeliveryProof("o1")
    expect(mockedApi.get).toHaveBeenCalledWith("/api/delivery-enhancements/orders/o1/proof")
    expect(proof.sizeBytes).toBe(10)
  })

  it("descarga la imagen autenticada como blob (no por /media)", async () => {
    const blob = new Blob(["png"], { type: "image/png" })
    mockedApi.get.mockResolvedValue({ data: blob })
    const result = await getDeliveryProofImage("o1")
    expect(mockedApi.get).toHaveBeenCalledWith("/api/delivery-enhancements/orders/o1/proof/image", {
      responseType: "blob",
    })
    expect(result).toBe(blob)
  })
})
