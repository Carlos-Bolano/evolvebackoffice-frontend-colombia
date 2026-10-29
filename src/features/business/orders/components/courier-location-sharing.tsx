import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/use-i18n"
import { getTrackingSession } from "../services/delivery-tracking.service"
import { useCourierLocation } from "../hooks/use-courier-location"
import type { TrackingSession } from "../types/tracking"

export function CourierLocationSharing({ identity }: { identity: string }) {
  const { t } = useTranslation("business-orders")
  const qc = useQueryClient()
  const key = ["courier-tracking-session", identity]
  const session = useQuery({ queryKey: key, queryFn: getTrackingSession, refetchInterval: 15_000, retry: false })
  const started = useCallback(
    (value: TrackingSession) => qc.setQueryData(["courier-tracking-session", identity], value),
    [qc, identity]
  )
  const { state, start, stop, capturing } = useCourierLocation(identity, started)
  return (
    <section aria-label={t("tracking_gps_title")} className="space-y-3 rounded-xl border p-3">
      <h2 className="font-semibold">{t("tracking_gps_title")}</h2>
      <p className="text-sm text-muted-foreground">{t("tracking_gps_help")}</p>
      <p role="status" className="text-sm">
        {t(`tracking_gps_${state.phase}`)}
      </p>
      {state.message && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
          {t(state.message)}
        </p>
      )}
      {!capturing && session.data?.sharing && state.phase === "idle" && (
        <p className="text-sm">{t("tracking_existing_session")}</p>
      )}
      {state.lastPublishedAt && (
        <p className="text-xs">
          {t("tracking_last_published")}:{" "}
          <time dateTime={state.lastPublishedAt}>{new Date(state.lastPublishedAt).toLocaleTimeString()}</time> ·{" "}
          {t("tracking_accuracy", { meters: Math.round(state.accuracy ?? 0) })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {capturing || state.phase === "pause_pending" ? (
          <Button
            className="min-h-11"
            variant="outline"
            disabled={state.phase === "stopping"}
            onClick={() => void stop().finally(() => qc.invalidateQueries({ queryKey: key }))}
          >
            {t(state.phase === "pause_pending" ? "tracking_retry_pause" : "tracking_pause")}
          </Button>
        ) : (
          <Button className="min-h-11" disabled={state.phase === "starting"} onClick={() => void start()}>
            {t("tracking_start")}
          </Button>
        )}
      </div>
    </section>
  )
}
