import type { OrderStatus } from "../types/api"

export const NEXT_ORDER_STEP: Partial<Record<string, { next: OrderStatus; labelKey: string }>> = {
  Pending: { next: "Confirmed", labelKey: "next_confirm" },
  NeedsReview: { next: "Confirmed", labelKey: "next_confirm" },
  Confirmed: { next: "Preparing", labelKey: "next_prepare" },
  Preparing: { next: "Ready", labelKey: "next_ready" },
  Ready: { next: "Shipped", labelKey: "next_dispatch" },
  Shipped: { next: "Delivered", labelKey: "next_deliver" },
}
