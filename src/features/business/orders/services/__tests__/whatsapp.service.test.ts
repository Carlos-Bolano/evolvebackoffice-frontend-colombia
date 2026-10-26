import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "@/config/axios-client"
import { getBranchWhatsAppChannel } from "../whatsapp.service"

vi.mock("@/config/axios-client", () => ({ api: { get: vi.fn() } }))
const mockedApi = vi.mocked(api, { deep: true })

describe("WhatsApp channel availability", () => {
  beforeEach(() => vi.clearAllMocks())

  it("treats an existing branch without a configured channel as empty", async () => {
    mockedApi.get.mockResolvedValue({ status: 204, data: "" })
    await expect(getBranchWhatsAppChannel("branch-1")).resolves.toBeNull()
  })

  it("maps the saved channel and its templates", async () => {
    mockedApi.get.mockResolvedValue({
      status: 200,
      data: {
        id: "channel-1",
        branchId: "branch-1",
        status: "Disconnected",
        templates: [{ templateCode: "OrderReady", recipientType: "Customer", bodyTemplate: "Ready" }],
      },
    })
    await expect(getBranchWhatsAppChannel("branch-1")).resolves.toMatchObject({
      id: "channel-1",
      templates: [{ eventCode: "OrderReady", templateText: "Ready", recipientType: "Customer", isActive: true }],
    })
  })

  it.each([401, 404, 503])("keeps HTTP %i failures distinct from an unconfigured channel", async (status) => {
    const failure = { response: { status } }
    mockedApi.get.mockRejectedValue(failure)
    await expect(getBranchWhatsAppChannel("branch-1")).rejects.toBe(failure)
  })
})
