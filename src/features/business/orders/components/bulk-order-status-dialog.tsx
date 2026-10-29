import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTranslation } from "@/i18n/use-i18n"
import { useDeliveryOperations } from "../hooks/use-delivery-operations"
import { BulkStatusNetworkError, checkOrderStock, updateOrderStatusBatches } from "../services/orders.service"
import { KANBAN_COLUMNS, ORDER_STATUS_CONFIG } from "../types"
import type { OrderListItem, OrderStatus, OrderStockItem } from "../types/api"
import type { BulkOrderStatusResult } from "../types/bulk-status"
import { bulkStockWarnings, isDeliveryOrder, nextStatusBatches } from "../utils/bulk-status"
import { NEXT_ORDER_STEP } from "../utils/order-status"
import { getApiErrorMessage } from "../utils/order-helpers"

interface Props {
  orders: OrderListItem[]
  initialStatus?: OrderStatus
  advance?: boolean
  onClose: () => void
  onResults: (result: BulkOrderStatusResult) => void
}

function CourierField({
  branchId,
  value,
  onChange,
  branchName,
}: {
  branchId: string
  value: string
  onChange: (value: string) => void
  branchName?: string
}) {
  const { t } = useTranslation("business-orders")
  const { data, isLoading } = useDeliveryOperations(branchId)
  const label = `${t("courier_select")}${branchName ? ` · ${branchName}` : ""}`
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <select
        aria-label={label}
        className="w-full rounded-md border bg-background p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      >
        <option value="">{t("bulk_keep_couriers")}</option>
        {data?.couriers.map((courier) => (
          <option key={courier.id} value={courier.id}>
            {courier.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function BulkOrderStatusDialog({ orders, initialStatus, advance = false, onClose, onResults }: Props) {
  const { t } = useTranslation("business-orders")
  const qc = useQueryClient()
  const [status, setStatus] = useState<OrderStatus>(initialStatus ?? "Confirmed")
  const [couriersByBranch, setCouriersByBranch] = useState<Record<string, string>>({})
  const [networkUncertain, setNetworkUncertain] = useState(false)
  const [checking, setChecking] = useState(false)
  const [warnings, setWarnings] = useState<OrderStockItem[]>([])
  const [checkedStock, setCheckedStock] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkOrderStatusResult | null>(null)
  const activeOrders = orders.filter((order) => !result?.results.some((r) => r.orderId === order.id && r.succeeded))
  const targetOf = (order: OrderListItem) => (advance ? NEXT_ORDER_STEP[order.statusCode]?.next : status)
  const dispatchOrders = activeOrders.filter((order) => targetOf(order) === "Shipped")
  const branches = [...new Set(dispatchOrders.map((order) => order.branchId).filter((id): id is string => !!id))]
  const needsCourier = dispatchOrders.some(
    (order) => isDeliveryOrder(order) && !order.courierId && !couriersByBranch[order.branchId ?? ""]
  )
  const batches = advance
    ? nextStatusBatches(activeOrders, couriersByBranch)
    : [
        ...new Set(
          activeOrders.map((order) => (status === "Shipped" ? couriersByBranch[order.branchId ?? ""] || null : null))
        ),
      ].map((courierId) => ({
        status,
        courierId,
        orderIds: activeOrders
          .filter(
            (order) => (status === "Shipped" ? couriersByBranch[order.branchId ?? ""] || null : null) === courierId
          )
          .map((order) => order.id),
      }))
  const mutation = useMutation({
    mutationFn: updateOrderStatusBatches,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] })
      void qc.invalidateQueries({ queryKey: ["delivery-operations"] })
      void qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
  const busy = checking || mutation.isPending
  const submit = async () => {
    if (busy || networkUncertain || needsCourier || (warnings.length > 0 && !acknowledged)) return
    setError(null)
    const confirmingOrders = activeOrders.filter((order) => targetOf(order) === "Confirmed")
    if (confirmingOrders.length && !checkedStock) {
      setChecking(true)
      try {
        const checks = await Promise.all(confirmingOrders.map((order) => checkOrderStock(order.id)))
        const missing = bulkStockWarnings(confirmingOrders, checks)
        setWarnings(missing)
        setCheckedStock(true)
        if (missing.length > 0) return
      } catch (err) {
        setError(getApiErrorMessage(err, t("bulk_stock_failed")))
        return
      } finally {
        setChecking(false)
      }
    }
    try {
      const next = await mutation.mutateAsync(batches)
      setResult(next)
      onResults(next)
      // Fallidos conservan su selección. Nunca se reenvían los éxitos al reintentar.
      setCheckedStock(false)
      setWarnings([])
      setAcknowledged(false)
      if (next.failureCount === 0) onClose()
    } catch (err) {
      if (err instanceof BulkStatusNetworkError && err.completed.results.length) {
        const completedIds = new Set(err.completed.results.map((entry) => entry.orderId))
        const pending = activeOrders.filter((order) => !completedIds.has(order.id))
        const partial = {
          ...err.completed,
          results: [
            ...err.completed.results,
            ...pending.map((order) => ({
              orderId: order.id,
              succeeded: false,
              statusCode: 0,
              message: t("bulk_network_failed"),
            })),
          ],
          failureCount: err.completed.failureCount + pending.length,
        }
        setResult(partial)
        onResults(partial)
      }
      setNetworkUncertain(true)
      setError(
        err instanceof BulkStatusNetworkError
          ? t("bulk_network_failed")
          : getApiErrorMessage(err, t("bulk_network_failed"))
      )
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{t(advance ? "bulk_next_title" : "bulk_title", { count: activeOrders.length })}</DialogTitle>
          <DialogDescription>{t("bulk_description")}</DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="space-y-3">
          {advance ? (
            <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">{t("bulk_next_hint")}</p>
              <ul className="space-y-2 text-sm">
                {batches.map((batch, index) => (
                  <li key={index} className="flex items-center justify-between gap-3">
                    <span>
                      {
                        ORDER_STATUS_CONFIG[activeOrders.find((order) => batch.orderIds.includes(order.id))!.statusCode]
                          ?.label
                      }{" "}
                      → {ORDER_STATUS_CONFIG[batch.status]?.label}
                    </span>
                    <strong>{batch.orderIds.length}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <label className="block space-y-1 text-sm">
              <span>{t("bulk_target")}</span>
              <select
                aria-label={t("bulk_target")}
                className="w-full rounded-md border bg-background p-2"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as OrderStatus)
                  setWarnings([])
                  setCheckedStock(false)
                  setAcknowledged(false)
                  setError(null)
                }}
              >
                {KANBAN_COLUMNS.map((value) => (
                  <option key={value} value={value}>
                    {ORDER_STATUS_CONFIG[value].label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {branches.map((branchId) => (
            <CourierField
              key={branchId}
              branchId={branchId}
              branchName={
                branches.length > 1
                  ? dispatchOrders.find((order) => order.branchId === branchId)?.branchName || branchId.slice(0, 8)
                  : undefined
              }
              value={couriersByBranch[branchId] ?? ""}
              onChange={(value) => setCouriersByBranch((current) => ({ ...current, [branchId]: value }))}
            />
          ))}
          {needsCourier && <p className="text-sm text-amber-700">{t("bulk_need_courier")}</p>}
          {warnings.length > 0 && (
            <div className="space-y-2 rounded-md border border-amber-300 p-3">
              <p className="text-sm font-medium">{t("stock_warning_title")}</p>
              <ul className="text-sm">
                {warnings.map((item, i) => (
                  <li key={i}>
                    {item.name}: {t("stock_warning_line", { requested: item.requested, available: item.available })}
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                {t("bulk_stock_acknowledge")}
              </label>
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {result && (
          <div role="alert" className="space-y-2 rounded-md border border-amber-300 p-3 text-sm">
            <p>{t("bulk_result", { success: result.successCount, failed: result.failureCount })}</p>
            <ul>
              {result.results
                .filter((r) => !r.succeeded)
                .map((r) => (
                  <li key={r.orderId}>
                    #{orders.find((order) => order.id === r.orderId)?.externalOrderId ?? r.orderId.slice(0, 8)}:{" "}
                    {r.message}
                  </li>
                ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={
              busy || networkUncertain || needsCourier || !batches.length || (warnings.length > 0 && !acknowledged)
            }
            onClick={() => void submit()}
          >
            {busy ? t("bulk_processing") : result ? t("bulk_retry") : t("bulk_apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
