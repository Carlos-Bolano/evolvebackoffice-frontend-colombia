import { z } from "zod"
import { useOrderWorkspaceKey, useWorkspaceState } from "./use-order-workspace"

const viewSchema = z.object({
  platformFilter: z.enum(["all", "CLUVI", "WOOCOMMERCE", "POSCO"]),
  orderScope: z.enum(["active", "history"]),
  viewMode: z.enum(["kanban", "table"]),
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
  viewMode: "kanban",
  datePreset: "all",
  fulfillmentFilter: "",
  courierFilter: "",
  paymentFilter: "",
  syncAlertFilter: "",
  quickView: "",
}
const validView = (value: unknown): value is OrderViewPreferences => viewSchema.safeParse(value).success
export const savedSchema = z
  .array(z.object({ id: z.string().uuid(), name: z.string().min(1).max(50), view: viewSchema }))
  .max(10)
export type SavedView = z.infer<typeof savedSchema>[number]

export function useOrderViewPreferences() {
  return useWorkspaceState(useOrderWorkspaceKey("order-view"), DEFAULT_ORDER_VIEW, localStorage, validView)
}
