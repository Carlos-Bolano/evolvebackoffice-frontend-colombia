import { z } from "zod"
import { useOrderWorkspaceKey, useWorkspaceState } from "./use-order-workspace"

const viewSchema = z.object({
  platformFilter: z.enum(["all", "CLUVI", "WOOCOMMERCE", "POSCO"]),
  orderScope: z.enum(["active", "history"]),
  datePreset: z.enum(["all", "today", "yesterday", "last7"]),
  fulfillmentFilter: z.enum(["", "delivery", "pickup"]),
  courierFilter: z.string().max(36),
  paymentFilter: z.enum(["", "paid", "reconciled", "pending"]),
  syncAlertFilter: z.enum(["", "error", "pending"]),
  quickView: z.enum(["", "ready_unassigned", "pending", "sync_error"]),
})
export type OrderViewPreferences = z.infer<typeof viewSchema>
export const DEFAULT_ORDER_VIEW: OrderViewPreferences = {
  platformFilter: "all",
  orderScope: "active",
  datePreset: "all",
  fulfillmentFilter: "",
  courierFilter: "",
  paymentFilter: "",
  syncAlertFilter: "",
  quickView: "",
}
const validView = (value: unknown): value is OrderViewPreferences => viewSchema.safeParse(value).success

export function useOrderViewPreferences() {
  const [stored, setView] = useWorkspaceState(
    useOrderWorkspaceKey("order-view"),
    DEFAULT_ORDER_VIEW,
    localStorage,
    validView
  )
  return [viewSchema.parse(stored), setView] as const
}
