import { describe, expect, it } from "vitest"
import { cluviWebhookUrl, readCluviStoreId, withCluviStoreId } from "../cluvi-settings"

describe("Existing Cluvi connection settings", () => {
  it("preserves payment mappings and webhook authentication when editing the store", () => {
    const original = {
      storeId: "old",
      webhookToken: "qa-token",
      paymentMethodMappings: { cash: "EFFECTIVO" },
      custom: true,
    }
    expect(JSON.parse(withCluviStoreId(JSON.stringify(original), " 34511 "))).toEqual({ ...original, storeId: "34511" })
  })
  it("accepts numeric store IDs returned by older configurations", () => {
    expect(readCluviStoreId('{"storeId":34511}')).toBe("34511")
  })
  it.each(["not-json", "null", "[]"])("handles invalid legacy settings without crashing: %s", (value) => {
    expect(readCluviStoreId(value)).toBe("")
  })
  it("never advertises an unauthenticated webhook URL", () => {
    expect(cluviWebhookUrl("https://posco.example", "tenant", '{"storeId":"34511"}')).toBeNull()
  })
  it("includes the configured token and safely encodes the store identifier", () => {
    const url = cluviWebhookUrl("https://posco.example/", "tenant", '{"storeId":"a&b","webhookToken":"qa token"}')
    expect(url).toBe("https://posco.example/api/webhooks/cluvi/tenant/qa%20token?storeId=a%26b")
  })
})
