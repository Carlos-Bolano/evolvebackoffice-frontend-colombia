import { useOrderPresentation } from "../hooks/use-order-presentation"
import { shortOrderReference } from "../utils/order-presentation"
import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, CheckCheck, History, Lock, Search, Undo2, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { notify } from "@/hooks/use-notify"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { useTranslation } from "@/i18n/use-i18n"
import { getActivePaymentMethods } from "@/features/business/payment-methods/services/payment-methods.service"
import { useReconcileOrderPayments } from "../hooks/use-order-closings"
import { reconcileOrderPayments } from "../services/order-closings.service"
import { ORDER_STATUS_CONFIG } from "../types"
import type { OrderClosingOrderRow, ReconcilePaymentLine } from "../types/closing"
import { getApiErrorMessage } from "../utils/order-helpers"
import { ReconcilePaymentsDialog } from "./reconcile-payments-dialog"

/**
 * Órdenes finalizadas del periodo con su conciliación. Solo las que aún no
 * entraron a un cierre (`editable`) se pueden conciliar; las cerradas son de
 * solo lectura.
 */
export function ClosingOrdersTable({ orders }: { orders: OrderClosingOrderRow[] }) {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const { paymentLabel, statusLabel } = useOrderPresentation()
  const qc = useQueryClient()
  const anyEditable = orders.some((o) => o.editable)
  const { data: methods } = useQuery({
    queryKey: ["payment-methods", "active", "for-reconcile"],
    queryFn: getActivePaymentMethods,
    enabled: anyEditable,
  })
  const reconcileMutation = useReconcileOrderPayments()
  const [editing, setEditing] = useState<OrderClosingOrderRow | null>(null)
  const [search, setSearch] = useState("")
  const [methodFilter, setMethodFilter] = useState("__ALL__")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkPending, setBulkPending] = useState(false)

  /** Resuelve el código del catálogo para un método declarado por el pedido. */
  const resolveCatalogMethodCode = (order: OrderClosingOrderRow): string | null => {
    if (!methods || methods.length === 0) return null
    const raw = (order.reconcilePaymentMethodCode ?? order.declaredPaymentMethod ?? "").trim()
    if (!raw) return null
    const upper = raw.toUpperCase()
    const exact = methods.find((m) => m.code.toUpperCase() === upper || m.name.toUpperCase() === upper)
    if (exact && !exact.requiresReference) return exact.code
    if (upper === "CASH" || upper === "EFECTIVO" || upper === "EFFECTIVO") {
      const cashMethod = methods.find(
        (m) => m.code.toUpperCase().includes("EFECT") || m.name.toUpperCase().includes("EFECT")
      )
      if (cashMethod && !cashMethod.requiresReference) return cashMethod.code
    }
    return null
  }

  const declaredMethods = useMemo(() => {
    const set = new Set<string>()
    for (const o of orders) {
      if (o.declaredPaymentMethod) set.add(o.declaredPaymentMethod)
    }
    return [...set]
  }, [orders])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      if (methodFilter !== "__ALL__" && (o.declaredPaymentMethod ?? "") !== methodFilter) {
        return false
      }
      if (!q) return true
      return (
        o.reference.toLowerCase().includes(q) ||
        (o.customerName ?? "").toLowerCase().includes(q) ||
        (o.declaredPaymentMethod ?? "").toLowerCase().includes(q)
      )
    })
  }, [orders, search, methodFilter])

  const quickReconcilableOrders = filteredOrders.filter(
    (o) => o.editable && !o.reconciled && o.status === "Delivered" && resolveCatalogMethodCode(o) !== null
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleBulkReconcile = async () => {
    const targets = quickReconcilableOrders.filter((o) => selectedIds.includes(o.id))
    if (targets.length === 0) return
    setBulkPending(true)
    try {
      let ok = 0
      for (const order of targets) {
        const code = resolveCatalogMethodCode(order)
        if (!code) continue
        await reconcileOrderPayments(order.id, [{ paymentMethodCode: code, amount: order.total }])
        ok++
      }
      setSelectedIds([])
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["order-closing-preview"] }),
        qc.invalidateQueries({ queryKey: ["order-closings"] }),
        qc.invalidateQueries({ queryKey: ["orders"] }),
      ])
      notify.success(t("bulk_reconciled_ok", { count: ok }))
    } catch (error) {
      notify.error(getApiErrorMessage(error))
    } finally {
      setBulkPending(false)
    }
  }

  /** Concilia con varios medios (lista vacía = deshacer la conciliación). */
  const savePayments = (order: OrderClosingOrderRow, payments: ReconcilePaymentLine[]) => {
    reconcileMutation.mutate(
      { orderId: order.id, payments },
      {
        onSuccess: () => {
          setEditing(null)
          notify.success(payments.length > 0 ? t("reconciled_ok") : t("unreconciled_ok"))
        },
        onError: (error) => notify.error(getApiErrorMessage(error)),
      }
    )
  }

  /** Resumen de los pagos de la orden: "Efectivo 50.000 (cambio 5.000) + Tarjeta 20.000". */
  const paymentsSummary = (order: OrderClosingOrderRow) =>
    (order.payments ?? [])
      .map((p) => {
        const base = `${paymentLabel(p.paymentMethodName ?? p.paymentMethodCode)} ${formatCurrency(p.amount)}`
        return p.changeAmount > 0
          ? `${base} (${t("reconcile_change").toLowerCase()} ${formatCurrency(p.changeAmount)})`
          : base
      })
      .join(" + ")

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-60">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("closing_search_placeholder")}
              aria-label={t("closing_search_placeholder")}
              className="h-8 pl-8 text-xs"
            />
          </div>
          {declaredMethods.length > 0 && (
            <select
              aria-label={t("breakdown_method")}
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="h-8 rounded-md border bg-background px-2.5 text-xs"
            >
              <option value="__ALL__">{t("closing_method_all")}</option>
              {declaredMethods.map((m) => (
                <option key={m} value={m}>
                  {paymentLabel(m)}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedIds.length > 0 && (
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={bulkPending || reconcileMutation.isPending}
            onClick={() => void handleBulkReconcile()}
          >
            <CheckCheck className="mr-1.5 size-3.5" />
            {t("bulk_reconcile_selected", { count: selectedIds.length })}
          </Button>
        )}
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-border/60">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              {anyEditable && <TableHead className="w-8" />}
              <TableHead>{t("order_ref")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("order_customer")}</TableHead>
              <TableHead>{t("breakdown_status")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("breakdown_method")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("settlement_courier")}</TableHead>
              <TableHead className="text-right">{t("order_total")}</TableHead>
              <TableHead>{t("reconciled_state")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((o) => {
              const status = ORDER_STATUS_CONFIG[o.status]
              const quickCode =
                o.editable && !o.reconciled && o.status === "Delivered" ? resolveCatalogMethodCode(o) : null
              return (
                <TableRow key={o.id}>
                  {anyEditable && (
                    <TableCell>
                      {quickCode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(o.id)}
                          onChange={() => toggleSelect(o.id)}
                          aria-label={`#${shortOrderReference(o.reference, o.id)}`}
                          className="size-4 accent-primary"
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <p className="font-mono text-xs">{shortOrderReference(o.reference, o.id)}</p>
                    {o.carriedOver && (
                      <Badge tone="orange" className="mt-1 gap-1 text-[10px]">
                        <History className="size-3" />
                        {t("closing_carried_short")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{o.customerName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge tone={status?.color ?? "neutral"}>{statusLabel(o.status)}</Badge>
                    <p className="mt-1 text-[11px] text-muted-foreground">{o.origin}</p>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {paymentLabel(o.declaredPaymentMethod)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{o.courierName ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatCurrency(o.total)}</TableCell>
                  <TableCell>
                    {o.status === "Cancelled" || o.status === "Refunded" ? (
                      <Badge tone="neutral">{t("cancelled")}</Badge>
                    ) : o.reconciled ? (
                      <div className="flex items-center gap-1.5">
                        <Badge tone="success">
                          {t("state_reconciled")} · {o.reconcilePaymentMethodCode}
                        </Badge>
                        {o.editable && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title={t("reconcile_edit")}
                              aria-label={t("reconcile_edit")}
                              onClick={() => setEditing(o)}
                            >
                              <Wallet className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title={t("unreconcile_action")}
                              aria-label={t("unreconcile_action")}
                              onClick={() => savePayments(o, [])}
                              disabled={reconcileMutation.isPending}
                            >
                              <Undo2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    ) : o.editable ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {quickCode && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={reconcileMutation.isPending}
                            onClick={() => savePayments(o, [{ paymentMethodCode: quickCode, amount: o.total }])}
                          >
                            <Check className="mr-1 size-3.5 text-emerald-600" />
                            {t("quick_confirm_payment")}
                          </Button>
                        )}
                        <Button size="sm" className="h-8" onClick={() => setEditing(o)}>
                          <Wallet className="mr-1.5 size-3.5" />
                          {t("reconcile_action")}
                        </Button>
                      </div>
                    ) : (
                      <Badge tone="warning" className="gap-1">
                        <Lock className="size-3" />
                        {t("state_pending")}
                      </Badge>
                    )}
                    {o.reconciled && (o.payments?.length ?? 0) > 0 && (
                      <p className="mt-1 max-w-72 text-[11px] leading-4 text-muted-foreground">{paymentsSummary(o)}</p>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <ReconcilePaymentsDialog
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          order={editing}
          methods={methods ?? []}
          isPending={reconcileMutation.isPending}
          onSubmit={(payments) => editing && savePayments(editing, payments)}
        />
      </div>
    </div>
  )
}
