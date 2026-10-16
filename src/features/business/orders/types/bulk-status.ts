import type { OrderStatus } from "./api"

export interface BulkOrderStatusRequest {
  orderIds: string[]
  status: OrderStatus
  courierId?: string | null
}
export interface BulkOrderStatusResult {
  results: { orderId: string; succeeded: boolean; statusCode: number; message: string | null }[]
  successCount: number
  failureCount: number
}
