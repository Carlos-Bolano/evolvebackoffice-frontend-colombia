import type { OrderListItem, OrderStockCheck, OrderStockItem } from "../types/api"
import type { BulkOrderStatusRequest } from "../types/bulk-status"
import { NEXT_ORDER_STEP } from "./order-status"

export const MAX_BULK_ORDERS = 50

/** Each selected order advances once; courier choices apply only to dispatches. */
export function nextStatusBatches(
  orders: OrderListItem[],
  couriersByBranch: Record<string, string> = {}
): BulkOrderStatusRequest[] {
  const groups = new Map<string, BulkOrderStatusRequest>()
  for (const order of orders) {
    const status = NEXT_ORDER_STEP[order.statusCode]?.next
    if (!status) continue
    const courierId = status === "Shipped" ? couriersByBranch[order.branchId ?? ""] || null : null
    const key = `${status}:${courierId ?? ""}`
    const batch = groups.get(key)
    if (batch) batch.orderIds.push(order.id)
    else groups.set(key, { orderIds: [order.id], status, courierId })
  }
  const flow = ["Confirmed", "Preparing", "Ready", "Shipped", "Delivered"]
  return [...groups.values()].sort((a, b) => flow.indexOf(a.status) - flow.indexOf(b.status))
}

/** Advertencia conjunta: dos pedidos pueden agotar stock aunque cada uno por separado quepa. */
export function bulkStockWarnings(orders: OrderListItem[], checks: OrderStockCheck[]): OrderStockItem[] {
  const grouped = new Map<string, OrderStockItem>()
  checks.forEach((check, index) => {
    check.items
      .filter((item) => item.tracksInventory)
      .forEach((item) => {
        const key = `${orders[index].branchId}:${item.itemId ?? `${orders[index].id}:${item.name}`}`
        const previous = grouped.get(key)
        grouped.set(
          key,
          previous
            ? {
                ...previous,
                requested: previous.requested + item.requested,
                available: Math.min(previous.available, item.available),
              }
            : { ...item }
        )
      })
  })
  return [...grouped.values()].filter((item) => item.requested > item.available)
}

export function isDeliveryOrder(order: OrderListItem): boolean {
  if (order.fulfillmentType?.toLowerCase() === "pickup") return false
  return order.fulfillmentType?.toLowerCase() === "delivery" || !!order.shippingStreet
}
