import type { BadgeTone } from "@/components/ui/badge"
import type { PurchaseOrderStatus, TransferStatus } from "../types/purchasing"

export const ORDER_STATUS_TONE: Record<PurchaseOrderStatus, BadgeTone> = {
  Draft: "neutral",
  Sent: "info",
  PartiallyDispatched: "warning",
  Dispatched: "primary",
  PartiallyReceived: "warning",
  Received: "success",
  Closed: "neutral",
  Cancelled: "danger",
}

export const TRANSFER_STATUS_TONE: Record<TransferStatus, BadgeTone> = {
  InTransit: "info",
  Received: "success",
  ReceivedWithDifferences: "warning",
  Closed: "neutral",
}

export const OPEN_ORDER_STATUSES: PurchaseOrderStatus[] = ["Sent", "PartiallyDispatched", "PartiallyReceived"]

const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" })
export const formatDateTime = (value: string | null) => (value ? dateTime.format(new Date(value)) : "—")
