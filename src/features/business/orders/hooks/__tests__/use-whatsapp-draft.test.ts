import { act, renderHook, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useWhatsAppDraft } from "../use-whatsapp-draft"
import type { BranchWhatsAppChannel, UpdateBranchWhatsAppChannelDto } from "../../services/whatsapp.service"

vi.mock("@/store/app-store", () => ({
  useAppStore: (select: (s: unknown) => unknown) =>
    select({ session: { tenantId: "tenant-1", user: { id: "user-1" } } }),
}))
const defaults: UpdateBranchWhatsAppChannelDto = {
  enabled: false,
  notifyExternalPlatformOrders: false,
  automaticEvents: [],
  templates: [{ eventCode: "OrderReady", recipientType: "Customer", templateText: "Original", isActive: true }],
}
const channel = {
  ...defaults,
  branchId: "branch-1",
  status: "Disconnected",
  templates: defaults.templates,
} as BranchWhatsAppChannel

describe("WhatsApp draft recovery", () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(cleanup)
  it("preserves an edit across a channel refetch and isolates it from another branch", () => {
    const { result, rerender } = renderHook(
      ({ branchId, current }) => useWhatsAppDraft(branchId, current, defaults, "Leave?"),
      { initialProps: { branchId: "branch-1", current: channel } }
    )
    act(() =>
      result.current.setDraft((draft) => ({
        ...draft,
        templates: [{ ...draft.templates[0], templateText: "Unsaved" }],
      }))
    )
    rerender({ branchId: "branch-1", current: { ...channel, status: "Connecting" } })
    expect(result.current.draft.templates[0].templateText).toBe("Unsaved")
    rerender({ branchId: "branch-2", current: { ...channel, branchId: "branch-2" } })
    expect(result.current.draft.templates[0].templateText).toBe("Original")
    rerender({ branchId: "branch-1", current: channel })
    expect(result.current.draft.templates[0].templateText).toBe("Unsaved")
    act(() => result.current.discard())
    expect(result.current.isDirty).toBe(false)
    expect(result.current.draft.templates[0].templateText).toBe("Original")
  })
  it("does not discard a newer edit when an earlier save completes", () => {
    const { result } = renderHook(() => useWhatsAppDraft("branch-1", channel, defaults, "Leave?"))
    act(() => result.current.setDraft((draft) => ({ ...draft, enabled: true })))
    const sent = result.current.draft
    act(() => result.current.setDraft((draft) => ({ ...draft, notifyExternalPlatformOrders: true })))
    act(() => result.current.saved(sent))
    expect(result.current.draft.notifyExternalPlatformOrders).toBe(true)
    expect(result.current.isDirty).toBe(true)
  })
})
