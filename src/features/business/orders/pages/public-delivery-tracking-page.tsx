import { useCallback, useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/use-i18n"
import { getPublicTracking } from "../services/delivery-tracking.service"
import { useTrackingUpdates } from "../hooks/use-tracking-updates"
import { LiveTrackingMap } from "../components/live-tracking-map"

export function PublicDeliveryTrackingPage() {
  const { t } = useTranslation("business-orders")
  const [token, setToken] = useState(() => window.location.hash.slice(1))
  const [now, setNow] = useState(Date.now)
  const qc = useQueryClient()
  useEffect(() => {
    const change = () => setToken(window.location.hash.slice(1))
    window.addEventListener("hashchange", change)
    const timer = setInterval(() => setNow(Date.now()), 5_000)
    return () => {
      window.removeEventListener("hashchange", change)
      clearInterval(timer)
    }
  }, [])
  const key = ["public-delivery-tracking", token]
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getPublicTracking(token, signal),
    enabled: !!token && token.length <= 4096,
    refetchInterval: 10_000,
    retry: false,
    gcTime: 0,
  })
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["public-delivery-tracking", token] })
  }, [qc, token])
  const connection = useTrackingUpdates({ token: query.isError ? "" : token }, refresh)
  const data = query.isError ? null : query.data
  const live =
    data?.locationStatus === "live" &&
    data.position &&
    now - Date.parse(data.position.recordedAtUtc) < data.staleAfterSeconds * 1000 &&
    now < Date.parse(data.expiresAtUtc)
  const expired = data && now >= Date.parse(data.expiresAtUtc)
  return (
    <main className="mx-auto min-h-dvh max-w-2xl space-y-4 p-4 sm:p-6">
      <meta name="referrer" content="no-referrer" />
      <meta name="robots" content="noindex, nofollow" />
      <h1 className="text-2xl font-semibold">{t("tracking_public_title")}</h1>
      {query.isLoading && <p role="status">{t("loading")}</p>}
      {!token || token.length > 4096 || query.isError || expired ? (
        <section className="space-y-3 rounded-xl border p-4" role="alert">
          <p>
            {t(
              query.error?.message === "tracking_public_network_error"
                ? "tracking_public_network_error"
                : "tracking_unavailable"
            )}
          </p>
          {token && (
            <Button variant="outline" className="min-h-11" onClick={refresh}>
              {t("refresh")}
            </Button>
          )}
        </section>
      ) : (
        data && (
          <>
            <section className="space-y-2 rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("order_number")} #{data.reference}
              </p>
              <h2 className="text-xl font-semibold">{t(data.status.toLowerCase())}</h2>
              <p>{t(`tracking_location_${data.locationStatus === "live" && !live ? "stale" : data.locationStatus}`)}</p>
              <p className="text-xs text-muted-foreground">{t(`tracking_connection_${connection}`)}</p>
            </section>
            <LiveTrackingMap
              markers={
                live && data.position
                  ? [{ id: "courier", name: t("tracking_public_courier"), point: data.position }]
                  : []
              }
              selectedId="courier"
              destinations={data.destination ? [data.destination] : []}
              roadRoute={live ? data.roadRoute.route : null}
            />
            <p className="text-sm">
              {live && data.roadRoute.route
                ? t("tracking_route_summary", {
                    minutes: Math.max(1, Math.ceil(data.roadRoute.route.durationSeconds / 60)),
                    km: (data.roadRoute.route.distanceMeters / 1000).toFixed(1),
                  })
                : t(`tracking_route_${live ? data.roadRoute.status : "no_location"}`)}
            </p>
            {live && data.position && (
              <p className="text-xs text-muted-foreground">
                {t("tracking_last_published")}:{" "}
                <time dateTime={data.position.receivedAtUtc}>
                  {new Date(data.position.receivedAtUtc).toLocaleTimeString()}
                </time>
              </p>
            )}
            <p className="text-xs text-muted-foreground">{t("tracking_public_privacy")}</p>
          </>
        )
      )}
    </main>
  )
}
