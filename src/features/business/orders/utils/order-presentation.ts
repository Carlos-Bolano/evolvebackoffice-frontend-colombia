export function collectionKey(order: {
  status?: string
  statusCode?: string
  paymentConfirmed?: boolean
  isReconciled?: boolean
}) {
  const status = order.statusCode ?? order.status
  if (status === "Cancelled") return "collection_cancelled"
  if (status === "Refunded") return "collection_refunded"
  if (order.paymentConfirmed) return "phase2_paid"
  if (order.isReconciled) return "phase2_collected"
  return "phase2_collect"
}

export function shortOrderReference(reference: string | null | undefined, id = "") {
  const value = reference || id
  const match = /^(POSCO-)?([a-f\d]{32}|[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12})$/i.exec(value)
  if (match) return `${match[1] ?? ""}${match[2].replaceAll("-", "").slice(0, 8)}`
  return value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-4)}` : value
}

export const PAYMENT_LABEL_KEYS: Record<string, string> = {
  CASH: "cash",
  EFECTIVO: "cash",
  EFFECTIVO: "cash",
  CARD: "payment_card",
  CREDIT_CARD: "payment_card",
  DEBIT_CARD: "payment_card",
  DATAPHONE: "payment_card",
  TRANSFER: "payment_transfer",
  TRANSFERENCIA: "payment_transfer",
  BANK_TRANSFER: "payment_transfer",
}

export const STATUS_LABEL_KEYS: Record<string, string> = {
  Pending: "pending",
  Confirmed: "confirmed",
  Preparing: "preparing",
  Ready: "ready",
  Shipped: "shipped",
  Delivered: "delivered",
  Cancelled: "cancelled",
  Refunded: "refunded",
}
