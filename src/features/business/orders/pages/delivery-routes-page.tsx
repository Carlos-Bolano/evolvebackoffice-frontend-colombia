import { shortOrderReference } from "../utils/order-presentation"
import { useOrderPresentation } from "../hooks/use-order-presentation"
import { useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBranches } from "@/features/business/branches/hooks/use-branches"
import { useTranslation } from "@/i18n/use-i18n"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { useDeliveryBoard } from "../hooks/use-couriers"
import { useCanManageDeliveries, useDeliveryOperations } from "../hooks/use-delivery-operations"
import { useDeliveryUpdates } from "../hooks/use-delivery-updates"
import { createDeliveryRun, getDeliveryRuns } from "../services/delivery-enhancements.service"
import { DeliveryMap } from "../components/delivery-map"
import { DeliveryOrderCard } from "../components/delivery-order-card"
import { OrdersSubnav } from "../components/orders-subnav"
import { getApiErrorMessage } from "../utils/order-helpers"

export function DeliveryRoutesPage() {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const { statusLabel } = useOrderPresentation()
  const canManage = useCanManageDeliveries()
  const qc = useQueryClient()
  const { data: branches } = useBranches(1, 100)
  const [branchId, setBranchId] = useState(() => {
    try {
      const saved = localStorage.getItem("business.orders.branchId")
      return saved && saved !== "__ALL__" ? saved : ""
    } catch {
      return ""
    }
  })
  const [shiftId, setShiftId] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const { data: board, error: boardError } = useDeliveryBoard(branchId || null, null)
  const { data: ops } = useDeliveryOperations(branchId || null)
  useDeliveryUpdates(branchId || null)
  const { data: runs = [], error: runsError } = useQuery({
    queryKey: ["delivery-runs", branchId],
    queryFn: () => getDeliveryRuns(branchId),
    enabled: !!branchId,
    refetchInterval: 15000,
  })
  const pending = useMemo(
    () =>
      [...(board?.unassigned ?? []), ...(board?.couriers.flatMap((c) => c.orders) ?? [])].filter(
        (o) => (o.status === "Ready" || o.status === "Shipped") && o.branchId === branchId
      ),
    [board, branchId]
  )
  const selectedOrders = selected.map((id) => pending.find((o) => o.id === id)).filter((o) => !!o)
  const latestRuns = new Map<string, string>()
  for (const entry of runs)
    for (const stop of entry.stops) if (!latestRuns.has(stop.orderId)) latestRuns.set(stop.orderId, entry.id)
  const run = useMutation({
    mutationFn: () => createDeliveryRun(shiftId, selected),
    onSuccess: async () => {
      setSelected([])
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["delivery-runs"] }),
        qc.invalidateQueries({ queryKey: ["orders", "deliveries"] }),
        qc.invalidateQueries({ queryKey: ["delivery-operations"] }),
      ])
    },
  })
  const handleToggleOrderStop = useCallback(
    (orderId: string) => {
      if (run.isPending) return
      setSelected((ids) =>
        ids.includes(orderId) ? ids.filter((id) => id !== orderId) : ids.length < 20 ? [...ids, orderId] : ids
      )
    },
    [run.isPending]
  )
  function move(index: number, offset: number) {
    setSelected((ids) => {
      const next = [...ids]
      ;[next[index], next[index + offset]] = [next[index + offset], next[index]]
      return next
    })
  }
  return (
    <main className="space-y-5 p-4 sm:p-6">
      <OrdersSubnav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("e_routes")}</h1>
        <Button asChild variant="outline">
          <Link to="/business/orders/deliveries">{t("deliveries_title")}</Link>
        </Button>
      </div>
      <label className="block max-w-md space-y-1">
        {t("branch")}
        <select
          aria-label={t("branch")}
          className="w-full rounded border bg-background p-2"
          disabled={run.isPending}
          value={branchId}
          onChange={(e) => {
            const nextBranch = e.target.value
            setBranchId(nextBranch)
            try {
              localStorage.setItem("business.orders.branchId", nextBranch || "__ALL__")
            } catch {
              // Ignore storage error
            }
            setSelected([])
            setShiftId("")
            run.reset()
          }}
        >
          <option value="">{t("select_branch")}</option>
          {branches?.data.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {!branchId ? (
        <p>{t("select_branch")}</p>
      ) : (
        <>
          {(boardError || runsError) && (
            <p role="alert">{getApiErrorMessage(boardError ?? runsError, t("status_update_failed"))}</p>
          )}
          <DeliveryMap
            orders={selectedOrders.length ? selectedOrders : pending}
            onToggleOrderStop={handleToggleOrderStop}
          />
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("e_create_run")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{t("e_run_help")}</p>
                <label className="block">
                  {t("e_active_shift")}
                  <select
                    aria-label={t("e_active_shift")}
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="w-full rounded border bg-background p-2"
                  >
                    <option value="">{t("e_choose_shift")}</option>
                    {ops?.shifts
                      .filter((s) => !s.settledAt && s.branchId === branchId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.courierName}
                        </option>
                      ))}
                  </select>
                </label>
                {canManage && (
                  <Link className="text-sm underline" to="/business/orders/operations">
                    {t("phase2_start_shift")}
                  </Link>
                )}
                {pending
                  .filter((o) => o.status === "Ready")
                  .map((o) => (
                    <label key={o.id} className="flex items-start gap-2 rounded border p-2">
                      <input
                        aria-label={`#${o.reference}`}
                        type="checkbox"
                        disabled={run.isPending || (!selected.includes(o.id) && selected.length >= 20)}
                        checked={selected.includes(o.id)}
                        onChange={(e) =>
                          setSelected((ids) => (e.target.checked ? [...ids, o.id] : ids.filter((id) => id !== o.id)))
                        }
                      />
                      <span>
                        #{shortOrderReference(o.reference, o.id)} · {o.shippingStreet} · {formatCurrency(o.total)}
                      </span>
                    </label>
                  ))}
                {selected.map((id, index) => (
                  <div key={id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {index + 1}. #{pending.find((o) => o.id === id)?.reference ?? id}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={t("e_move_up", { position: index + 1 })}
                      disabled={index === 0 || run.isPending}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={t("e_move_down", { position: index + 1 })}
                      disabled={index === selected.length - 1 || run.isPending}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </Button>
                  </div>
                ))}
                {run.error && <p role="alert">{getApiErrorMessage(run.error, t("status_update_failed"))}</p>}
                <Button disabled={!shiftId || !selected.length || run.isPending} onClick={() => run.mutate()}>
                  {t("e_dispatch_run", { count: selected.length })}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("e_runs_history")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!runs.length && <p>{t("e_no_runs")}</p>}
                {runs.map((r) => (
                  <section key={r.id} className="space-y-2 rounded border p-3">
                    <h3 className="font-semibold">
                      {r.courierName} · {new Date(r.createdAt).toLocaleString()}
                    </h3>
                    <ol className="list-inside list-decimal">
                      {r.stops.map((s) => (
                        <li key={s.orderId}>
                          {shortOrderReference(s.reference, s.orderId)} · {statusLabel(s.status)}
                        </li>
                      ))}
                    </ol>
                    {r.stops.map((s) => {
                      const order = pending.find((o) => o.id === s.orderId)
                      const owner = board?.couriers.find((c) => c.orders.some((o) => o.id === s.orderId))
                      return (
                        order &&
                        latestRuns.get(s.orderId) === r.id && (
                          <DeliveryOrderCard
                            key={s.orderId}
                            order={order}
                            now={Date.now()}
                            courierName={owner?.name ?? r.courierName}
                            courierPhone={owner?.phone ?? null}
                            showStatus
                          />
                        )
                      )
                    })}
                  </section>
                ))}
              </CardContent>
            </Card>
          </div>
          {canManage && (
            <p className="text-sm text-muted-foreground">
              {t("routes_zones_moved")}{" "}
              <Link className="font-medium text-primary underline" to="/business/orders/setup#zones">
                {t("subnav_setup")}
              </Link>
            </p>
          )}
        </>
      )}
    </main>
  )
}
