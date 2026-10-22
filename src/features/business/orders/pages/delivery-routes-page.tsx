import { shortOrderReference } from "../utils/order-presentation"
import { useOrderPresentation } from "../hooks/use-order-presentation"
import { useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Calculator, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { notify } from "@/hooks/use-notify"
import { useBranches } from "@/features/business/branches/hooks/use-branches"
import { useTranslation } from "@/i18n/use-i18n"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { useDeliveryBoard } from "../hooks/use-couriers"
import { useCanManageDeliveries, useDeliveryOperations } from "../hooks/use-delivery-operations"
import { useDeliveryUpdates } from "../hooks/use-delivery-updates"
import {
  createDeliveryRun,
  deleteDeliveryZone,
  getDeliveryRuns,
  getDeliveryZones,
  quoteDelivery,
  saveDeliveryZone,
} from "../services/delivery-enhancements.service"
import { DeliveryMap } from "../components/delivery-map"
import { DeliveryOrderCard } from "../components/delivery-order-card"
import { OrdersSubnav } from "../components/orders-subnav"
import { getApiErrorMessage } from "../utils/order-helpers"
import type { DeliveryQuote, DeliveryZone } from "../types/enhancements"

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
            <details className="rounded-xl border p-3" open>
              <summary className="min-h-11 cursor-pointer font-semibold">{t("zone_configuration")}</summary>
              <DeliveryZones key={branchId} branchId={branchId} />
            </details>
          )}
        </>
      )}
    </main>
  )
}

function DeliveryZones({ branchId }: { branchId: string }) {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const qc = useQueryClient()
  const { data: zones = [], error } = useQuery({
    queryKey: ["delivery-zones", branchId],
    queryFn: () => getDeliveryZones(branchId),
  })
  const blank = {
    name: "",
    latitude: "4.61",
    longitude: "-74.08",
    radiusMeters: "2000",
    shippingCost: "",
    priority: "0",
  }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<DeliveryZone | null>(null)
  const [deleting, setDeleting] = useState<DeliveryZone | null>(null)
  const [quoteLat, setQuoteLat] = useState("4.61")
  const [quoteLon, setQuoteLon] = useState("-74.08")
  const [quoteResult, setQuoteResult] = useState<DeliveryQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const pick = useCallback((lat: number, lon: number) => {
    setForm((f) => ({ ...f, latitude: String(lat), longitude: String(lon) }))
    setQuoteLat(String(lat))
    setQuoteLon(String(lon))
  }, [])

  const previewZone = useMemo(
    () => ({
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radiusMeters: Number(form.radiusMeters),
      name: form.name || undefined,
    }),
    [form.latitude, form.longitude, form.radiusMeters, form.name]
  )

  const save = useMutation({
    mutationFn: (zone: { data: Omit<DeliveryZone, "id">; id?: string }) => saveDeliveryZone(zone.data, zone.id),
    onSuccess: async () => {
      setEditing(null)
      setForm(blank)
      setQuoteResult(null)
      setQuoteError(null)
      await qc.invalidateQueries({ queryKey: ["delivery-zones"] })
    },
  })

  const removeZone = useMutation({
    mutationFn: (id: string) => deleteDeliveryZone(id),
    onSuccess: async () => {
      setDeleting(null)
      setQuoteResult(null)
      setQuoteError(null)
      notify.success(t("zone_deleted_ok"))
      await qc.invalidateQueries({ queryKey: ["delivery-zones"] })
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const simulateQuote = useMutation({
    mutationFn: () => quoteDelivery(branchId, Number(quoteLat), Number(quoteLon)),
    onSuccess: (res) => {
      setQuoteResult(res)
      setQuoteError(null)
    },
    onError: (err) => {
      setQuoteResult(null)
      setQuoteError(getApiErrorMessage(err, t("quote_no_coverage")))
    },
  })

  const fields = ["name", "latitude", "longitude", "radiusMeters", "shippingCost", "priority"] as const
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("zone_configuration")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("e_zone_help")}</p>
        <DeliveryMap zones={zones} previewZone={previewZone} onPick={pick} />
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate({
              id: editing?.id,
              data: {
                branchId,
                name: form.name,
                latitude: Number(form.latitude),
                longitude: Number(form.longitude),
                radiusMeters: Number(form.radiusMeters),
                shippingCost: Number(form.shippingCost),
                priority: Number(form.priority),
                isActive: editing?.isActive ?? true,
              },
            })
          }}
        >
          {fields.map((field) => (
            <label key={field} className="space-y-1">
              {t(`e_zone_${field}`)}
              <Input
                required
                aria-label={t(`e_zone_${field}`)}
                type={field === "name" ? "text" : "number"}
                step={field === "priority" ? "1" : "any"}
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                maxLength={field === "name" ? 100 : undefined}
              />
            </label>
          ))}
          <Button type="submit" disabled={save.isPending}>
            {t(editing ? "save" : "e_add_zone")}
          </Button>
          {editing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(null)
                setForm(blank)
              }}
            >
              {t("cancel")}
            </Button>
          )}
        </form>
        {(save.error || error) && (
          <p role="alert">{getApiErrorMessage(save.error ?? error, t("status_update_failed"))}</p>
        )}

        {/* Simulador de cotización */}
        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Calculator className="size-4 text-primary" />
                {t("quote_simulator_title")}
              </p>
              <p className="text-xs text-muted-foreground">{t("quote_simulator_desc")}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setQuoteLat(form.latitude)
                setQuoteLon(form.longitude)
              }}
            >
              {t("quote_use_form_coords")}
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="number"
              step="any"
              value={quoteLat}
              onChange={(e) => setQuoteLat(e.target.value)}
              placeholder={t("e_zone_latitude")}
              className="w-36"
            />
            <Input
              type="number"
              step="any"
              value={quoteLon}
              onChange={(e) => setQuoteLon(e.target.value)}
              placeholder={t("e_zone_longitude")}
              className="w-36"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={simulateQuote.isPending}
              onClick={() => simulateQuote.mutate()}
            >
              {t("quote_simulate_btn")}
            </Button>
            {quoteResult && (
              <span className="text-xs font-semibold text-emerald-600">
                {t("e_quoted_zone", { zone: quoteResult.zoneName, amount: formatCurrency(quoteResult.shippingCost) })}
              </span>
            )}
            {quoteError && <span className="text-xs font-medium text-amber-600">{quoteError}</span>}
          </div>
        </div>

        {zones.map((z) => (
          <div key={z.id} className="flex flex-wrap items-center gap-3 rounded border p-3">
            <span className="flex-1">
              {z.name} · {formatCurrency(z.shippingCost)} · {z.radiusMeters}m · {t(z.isActive ? "active" : "inactive")}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                setEditing(z)
                setForm({
                  name: z.name,
                  latitude: String(z.latitude),
                  longitude: String(z.longitude),
                  radiusMeters: String(z.radiusMeters),
                  shippingCost: String(z.shippingCost),
                  priority: String(z.priority),
                })
              }}
            >
              {t("e_edit_zone")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={save.isPending}
              onClick={() => save.mutate({ id: z.id, data: { ...z, isActive: !z.isActive } })}
            >
              {t(z.isActive ? "e_disable_zone" : "e_enable_zone")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={removeZone.isPending}
              onClick={() => setDeleting(z)}
            >
              <Trash2 className="mr-1 size-3.5" />
              {t("zone_delete")}
            </Button>
          </div>
        ))}

        <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("zone_delete_confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleting ? t("zone_delete_confirm_desc", { name: deleting.name }) : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={removeZone.isPending}
                onClick={() => deleting && removeZone.mutate(deleting.id)}
              >
                {t("zone_delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
