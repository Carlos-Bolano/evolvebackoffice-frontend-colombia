import { getBranchWhatsAppChannel } from "../services/whatsapp.service"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/i18n/use-i18n"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { notify } from "@/hooks/use-notify"
import { useBranches } from "@/features/business/branches/hooks/use-branches"
import { useCanManageDeliveries, useDeliveryAction, useDeliveryOperations } from "../hooks/use-delivery-operations"
import { BranchWhatsAppCard } from "../components/branch-whatsapp-card"
import { OrdersSubnav } from "../components/orders-subnav"
import { getApiErrorMessage } from "../utils/order-helpers"

export function DeliveryOperationsPage() {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const navigate = useNavigate()
  const canManage = useCanManageDeliveries()
  const { data: branches } = useBranches(1, 100)
  const [branchId, setBranch] = useState(() => {
    try {
      const saved = localStorage.getItem("business.orders.branchId")
      return saved && saved !== "__ALL__" ? saved : ""
    } catch {
      return ""
    }
  })
  const { data: whatsappChannel } = useQuery({
    queryKey: ["branch-whatsapp", branchId],
    queryFn: () => getBranchWhatsAppChannel(branchId),
    enabled: !!branchId && canManage,
    retry: false,
  })
  const { data, isError } = useDeliveryOperations(branchId || null)
  const action = useDeliveryAction()
  const [courier, setCourier] = useState("")
  const [base, setBase] = useState("0")
  const [returned, setReturned] = useState<Record<string, string>>({})
  const [openingDraft, setOpeningDraft] = useState<Record<string, string>>({})
  // Cluvi se gestiona en su asistente (Sucursal → Cluvi); aquí solo se avisa si algo requiere atención.
  const cluviIssues = (data?.webhooks ?? [])
    .filter(
      (w) =>
        w.quiet || w.storeActive === false || data?.unlinkedProducts.some((p) => p.integrationId === w.integrationId)
    )
    .map((w) => ({ branchId: w.branchId, branchName: w.branchName }))
  const selectCourier = (id: string) => {
    setCourier(id)
    const suggested = data?.couriers.find((c) => c.id === id)?.suggestedOpeningCash
    if (suggested != null) setBase(String(suggested))
  }
  const run = (path: string, payload?: unknown, method?: "post" | "put") =>
    action.mutate(
      { path, payload, method },
      {
        onSuccess: () => notify.success(t("phase2_saved")),
        onError: (e) => notify.error(getApiErrorMessage(e, t("status_update_failed"))),
      }
    )
  if (!canManage) return <p role="alert">{t("phase2_manager_only")}</p>
  return (
    <div className="space-y-6">
      <OrdersSubnav />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => navigate("/business/orders/deliveries")}>
          {t("deliveries_title")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/business/people/users")}>
          {t("couriers_title")}
        </Button>
        <h1 className="text-xl font-semibold">{t("phase2_operations")}</h1>
      </div>
      <label className="block max-w-sm">
        {t("branch")}
        <select
          aria-label={t("branch")}
          className="mt-1 h-10 w-full rounded-md border bg-background px-3"
          value={branchId}
          onChange={(e) => {
            const nextBranch = e.target.value
            setBranch(nextBranch)
            try {
              localStorage.setItem("business.orders.branchId", nextBranch || "__ALL__")
            } catch {
              // Ignore storage error
            }
          }}
        >
          <option value="">{t("all_branches")}</option>
          {branches?.data.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {isError && <p role="alert">{t("status_update_failed")}</p>}
      <Card>
        <CardHeader>
          <CardTitle>{t("phase2_shifts")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              run("shifts", { courierId: courier, branchId, openingCash: Number(base) })
            }}
          >
            <label>
              {t("courier_select")}
              <select
                aria-label={t("courier_select")}
                className="mt-1 block h-10 rounded-md border bg-background px-3"
                value={courier}
                onChange={(e) => selectCourier(e.target.value)}
              >
                <option value="">{t("courier_select")}</option>
                {data?.couriers
                  .filter((c) => !c.onDuty)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t("phase2_opening_cash")}
              <Input
                aria-label={t("phase2_opening_cash")}
                type="number"
                min="0"
                step="0.01"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                required
              />
            </label>
            <Button disabled={!courier || !branchId || action.isPending} type="submit">
              {t("phase2_start_shift")}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">{t("phase2_cash_formula")}</p>
          <p className="rounded-xl bg-primary/5 p-3 text-sm">{t("shifts_auto_note")}</p>
          {data?.shifts.map((s) => (
            <div key={s.id} className="space-y-2 rounded-lg border p-3">
              <p className="font-semibold">
                {s.courierName} · {t(s.settledAt ? "phase2_settled" : "phase2_on_duty")}
              </p>
              <p className="text-sm">
                {t("phase2_opening_cash")}: {formatCurrency(s.openingCash)} · {t("phase2_expected")}:{" "}
                {formatCurrency(s.expectedCash)} · {t("phase2_tip")}: {formatCurrency(s.tipsTotal)}
              </p>
              <p className="text-sm">
                {s.deliveredCount} {t("settlement_delivered")} · {t("phase2_average")}:{" "}
                {s.averageDeliveryMinutes ?? "—"} min
              </p>
              {s.settledAt ? (
                <p>
                  {t("phase2_difference")}: {formatCurrency((s.returnedCash ?? 0) - s.expectedCash)}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {/* Base editable: los turnos automáticos usan la del último turno. */}
                  <Input
                    className="max-w-40"
                    aria-label={`${t("phase2_opening_cash")} ${s.courierName}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t("phase2_opening_cash")}
                    value={openingDraft[s.id] ?? ""}
                    onChange={(e) => setOpeningDraft({ ...openingDraft, [s.id]: e.target.value })}
                  />
                  <Button
                    variant="outline"
                    disabled={action.isPending || !openingDraft[s.id]}
                    onClick={() => {
                      run(`shifts/${s.id}/opening-cash`, { openingCash: Number(openingDraft[s.id]) }, "put")
                      setOpeningDraft({ ...openingDraft, [s.id]: "" })
                    }}
                  >
                    {t("shifts_update_opening")}
                  </Button>
                  <Input
                    className="max-w-48"
                    aria-label={`${t("phase2_returned_cash")} ${s.courierName}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t("phase2_returned_cash")}
                    value={returned[s.id] ?? ""}
                    onChange={(e) => setReturned({ ...returned, [s.id]: e.target.value })}
                  />
                  <Button
                    disabled={action.isPending || returned[s.id] == null || returned[s.id] === ""}
                    onClick={() => run(`shifts/${s.id}/settle`, { returnedCash: Number(returned[s.id]) })}
                  >
                    {t("phase2_settle")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      {branchId && (
        <details className="rounded-xl border p-3">
          <summary className="min-h-11 cursor-pointer font-medium">
            {t("wa_configuration")}
            <span className="ml-3 text-xs font-normal text-muted-foreground">
              {t(`wa_status_${whatsappChannel?.status ?? "Disconnected"}`)}
              {whatsappChannel?.enabled ? "" : ` / ${t("wa_notifications_paused")}`}
            </span>
          </summary>
          <div className="pt-3">
            <BranchWhatsAppCard key={branchId} branchId={branchId} />
          </div>
        </details>
      )}
      {cluviIssues.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <span>{t("cluvi_ops_moved_alert", { count: cluviIssues.length })}</span>
          <div className="flex flex-wrap gap-2">
            {cluviIssues.map((issue) => (
              <Button key={issue.branchId} asChild size="sm" variant="outline">
                <Link to={`/business/branches/${issue.branchId}/config?tab=cluvi`}>Cluvi · {issue.branchName}</Link>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
