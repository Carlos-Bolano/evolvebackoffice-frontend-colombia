import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useManualOrderDraft } from "../use-manual-order-draft"

vi.mock("@/store/app-store", () => ({
  useAppStore: (select: (s: unknown) => unknown) =>
    select({ session: { tenantId: "tenant", user: { id: "operator" } } }),
}))
vi.mock("@/hooks/use-notify", () => ({ notify: { error: vi.fn() } }))
vi.mock("@/i18n/use-i18n", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

describe("manual order draft recovery", () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(cleanup)
  it("recovers session data after unmount and isolates branches", () => {
    const first = renderHook(() => useManualOrderDraft("north"))
    act(() => first.result.current.update("customerName", "QA customer"))
    act(() => first.result.current.update("notes", "Keep this note"))
    first.unmount()
    const second = renderHook(({ branch }) => useManualOrderDraft(branch), { initialProps: { branch: "north" } })
    expect(second.result.current.recovered).toBe(true)
    expect(second.result.current.draft.customerName).toBe("QA customer")
    second.rerender({ branch: "south" })
    expect(second.result.current.draft.customerName).toBe("")
    second.rerender({ branch: "north" })
    expect(second.result.current.draft.notes).toBe("Keep this note")
    act(() => second.result.current.discard())
    expect(sessionStorage.getItem("order-draft:tenant:operator:north")).toBeNull()
  })
  it("does not erase edits made after a creation request started", () => {
    const { result } = renderHook(() => useManualOrderDraft("north"))
    act(() => result.current.update("customerName", "Original"))
    const submitted = result.current.draft
    act(() => result.current.update("customerName", "Next order"))
    act(() => result.current.discard(submitted))
    expect(result.current.draft.customerName).toBe("Next order")
    const current = result.current.draft
    act(() => result.current.discard(current))
    expect(result.current.dirty).toBe(false)
  })
  it("rejects corrupt and unsupported stored drafts", () => {
    sessionStorage.setItem(
      "order-draft:tenant:operator:north",
      JSON.stringify({ version: 1, value: { lines: [{ quantity: -1 }] } })
    )
    const { result } = renderHook(() => useManualOrderDraft("north"))
    expect(result.current.dirty).toBe(false)
    expect(result.current.draft.lines).toEqual([])
  })
})
