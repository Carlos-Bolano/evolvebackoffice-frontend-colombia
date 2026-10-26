import { useCallback, useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useBranches } from "@/features/business/branches/hooks/use-branches"
import { useTranslation } from "@/i18n/use-i18n"
import { Copy, MessageCircle, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { notify } from "@/hooks/use-notify"
import { useDeliveryOperations } from "../hooks/use-delivery-operations"
import { OrdersSubnav } from "../components/orders-subnav"
import { LiveTrackingMap } from "../components/live-tracking-map"
import { getBranchTracking, getCourierTracking } from "../services/delivery-tracking.service"
import { useTrackingUpdates } from "../hooks/use-tracking-updates"

export function DeliveryTrackingPage() {
  const { t } = useTranslation("business-orders")
  const { session } = useAuth()
  const qc = useQueryClient()
  const { data: branches } = useBranches(1, 100)
  const [selectedBranch, setSelectedBranch] = useState(() => localStorage.getItem("business.orders.branchId") ?? "")
  const branchId = branches?.data.some((b) => b.id === selectedBranch) ? selectedBranch : (branches?.data[0]?.id ?? "")
  const identity = `${session?.tenantId}:${session?.user.id}`
  const [selectedShift, setSelectedShift] = useState("")
  const board = useQuery({
    queryKey: ["delivery-tracking", identity, branchId],
    queryFn: () => getBranchTracking(branchId),
    enabled: !!branchId,
    refetchInterval: 15_000,
    retry: false,
  })
  const couriers = board.isError ? [] : (board.data?.couriers ?? [])
  const shiftId = couriers.some((c) => c.shiftId === selectedShift) ? selectedShift : (couriers[0]?.shiftId ?? "")
  const detail = useQuery({
    queryKey: ["courier-tracking", identity, branchId, shiftId],
    queryFn: () => getCourierTracking(shiftId),
    enabled: !!branchId && !!shiftId,
    refetchInterval: 15_000,
    retry: false,
  })
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["delivery-tracking", identity] })
    void qc.invalidateQueries({ queryKey: ["courier-tracking", identity] })
  }, [qc, identity])
  const connection = useTrackingUpdates({ branchId }, refresh)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(timer)
  }, [])
  const markers = couriers.flatMap((c) =>
    c.position
      ? [
          {
            id: c.shiftId,
            name: c.courierName,
            point: c.position,
            stale:
              c.locationStatus !== "live" ||
              now - Date.parse(c.position.recordedAtUtc) > (board.data?.staleAfterSeconds ?? 60) * 1000,
          },
        ]
      : []
  )
  // Domiciliarios activos sin turno: el turno se abre solo cuando inician sesión.
  const { data: operations } = useDeliveryOperations(branchId || null)
  const withoutShift = (operations?.couriers ?? []).filter((c) => !c.onDuty)
  // En turno (p. ej. abierto al asignarle un pedido) pero sin poder rastrearse:
  // aún no entra a la app o no ha cambiado su contraseña temporal.
  const trackedShifts = new Set(couriers.map((c) => c.shiftId))
  const notInApp = (operations?.shifts ?? []).filter(
    (s) => !s.settledAt && s.branchId === branchId && !trackedShifts.has(s.id)
  )
  const courierUrl = `${window.location.origin}/delivery`
  const shareText = t("tracking_access_share", { url: courierUrl })
  const copyAccessLink = async () => {
    try {
      await navigator.clipboard.writeText(courierUrl)
      notify.success(t("tracking_access_copied"))
    } catch {
      notify.error(t("status_update_failed"))
    }
  }
  const selected = detail.isError ? null : detail.data
  const route =
    selected?.courier.locationStatus === "live" &&
    selected.courier.position &&
    now - Date.parse(selected.courier.position.recordedAtUtc) < (board.data?.staleAfterSeconds ?? 60) * 1000
      ? selected.roadRoute
      : null
  return (
    <main className="min-w-0 space-y-4">
      <OrdersSubnav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("tracking_title")}</h1>
        <Button variant="outline" onClick={refresh}>
          {t("refresh")}
        </Button>
      </div>
      <label className="block max-w-md space-y-1">
        {t("branch")}
        <select
          className="h-11 w-full rounded-lg border bg-background px-3"
          aria-label={t("branch")}
          value={branchId}
          onChange={(e) => {
            setSelectedBranch(e.target.value)
            setSelectedShift("")
            localStorage.setItem("business.orders.branchId", e.target.value)
          }}
        >
          {!branches?.data.length && <option value="">{t("select_branch")}</option>}
          {branches?.data.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <p role="status" className="text-sm text-muted-foreground">
        {t(`tracking_connection_${connection}`)}
      </p>
      {board.isError && <p role="alert">{t("tracking_internal_error")}</p>}
      <LiveTrackingMap
        key={branchId}
        markers={markers}
        selectedId={shiftId}
        trail={selected?.trail ?? []}
        destinations={selected?.destinations.map((d) => d.position) ?? []}
        roadRoute={route?.route}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {couriers.map((c) => {
          const point = markers.find((m) => m.id === c.shiftId)
          // "paused" sin ninguna posición = nunca empezó a compartir (no es una pausa).
          const state = point?.stale
            ? "stale"
            : c.locationStatus === "paused" && !c.position
              ? "not_started"
              : c.locationStatus
          return (
            <button
              key={c.shiftId}
              type="button"
              aria-pressed={shiftId === c.shiftId}
              className={`min-h-11 space-y-1 rounded-xl border p-3 text-left ${shiftId === c.shiftId ? "border-primary bg-primary/5" : ""}`}
              onClick={() => setSelectedShift(c.shiftId)}
            >
              <span className="block font-semibold">{c.courierName}</span>
              <span className="block text-sm">
                {t(`tracking_location_${state}`)} · {t("tracking_active_deliveries", { count: c.activeDeliveries })}
              </span>
              {c.position && (
                <span className="block text-xs text-muted-foreground">
                  {t("tracking_last_published")}: {new Date(c.position.receivedAtUtc).toLocaleTimeString()} ·{" "}
                  {t("tracking_accuracy", { meters: Math.round(c.position.accuracyMeters) })}
                </span>
              )}
              {state !== "live" && state !== "finished" && (
                <span className="block text-xs font-medium text-amber-700">{t(`tracking_hint_${state}`)}</span>
              )}
            </button>
          )
        })}
      </div>
      {!board.isLoading && !board.isError && !couriers.length && !notInApp.length && <p>{t("tracking_no_couriers")}</p>}
      {notInApp.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-medium">{t("tracking_not_in_app_title")}</p>
          <p>
            {notInApp.map((s) => s.courierName).join(" · ")} — {t("tracking_not_in_app_hint")}
          </p>
        </div>
      )}
      {withoutShift.length > 0 && (
        <div className="space-y-2 rounded-xl border border-dashed p-3 text-sm">
          <p className="font-medium">{t("tracking_without_shift_title")}</p>
          <p className="text-muted-foreground">
            {withoutShift.map((c) => c.name).join(" · ")} — {t("tracking_without_shift_hint")}
          </p>
        </div>
      )}
      <div className="space-y-2 rounded-xl border bg-card/60 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <Smartphone className="size-4 text-primary" />
          {t("tracking_access_title")}
        </p>
        <p className="text-muted-foreground">{t("tracking_access_desc")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-muted px-2 py-1 text-xs">{courierUrl}</code>
          <Button size="sm" variant="outline" onClick={() => void copyAccessLink()}>
            <Copy className="mr-1.5 size-3.5" />
            {t("tracking_access_copy")}
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-1.5 size-3.5" />
              {t("tracking_access_whatsapp")}
            </a>
          </Button>
        </div>
      </div>
      {detail.isError && <p role="alert">{t("tracking_internal_error")}</p>}
      {selected && (
        <p className="text-sm">
          {route?.route
            ? t("tracking_route_summary", {
                minutes: Math.max(1, Math.ceil(route.route.durationSeconds / 60)),
                km: (route.route.distanceMeters / 1000).toFixed(1),
              })
            : t(`tracking_route_${route?.status ?? "no_location"}`)}
        </p>
      )}
    </main>
  )
}
