import { describe, expect, it } from "vitest"
import { collectionKey, shortOrderReference } from "../order-presentation"

describe("Order presentation", () => {
  it.each(["Cancelled", "Refunded"])("never asks to collect a %s order, even with stale payment flags", (status) => {
    for (const flags of [{}, { paymentConfirmed: true }, { isReconciled: true }]) {
      expect(collectionKey({ statusCode: status, ...flags })).toBe(
        status === "Cancelled" ? "collection_cancelled" : "collection_refunded"
      )
    }
  })
  it("distinguishes collected, prepaid and outstanding orders", () => {
    expect(collectionKey({ status: "Ready" })).toBe("phase2_collect")
    expect(collectionKey({ status: "Ready", paymentConfirmed: true })).toBe("phase2_paid")
    expect(collectionKey({ status: "Delivered", isReconciled: true })).toBe("phase2_collected")
  })
  it("keeps enough of generated references to distinguish orders with the same POSCO prefix", () => {
    expect(shortOrderReference("POSCO-fb0a9b5c9dc8467ea904bfc5c70af6af")).toBe("POSCO-fb0a9b5c")
    expect(shortOrderReference("POSCO-fb1a9b5c9dc8467ea904bfc5c70af6af")).not.toBe(
      shortOrderReference("POSCO-fb0a9b5c9dc8467ea904bfc5c70af6af")
    )
    expect(shortOrderReference("102458")).toBe("102458")
  })
})
