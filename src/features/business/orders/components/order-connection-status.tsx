import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/use-i18n"
import type { OrderConnection } from "../hooks/use-order-updates"

export function OrderConnectionStatus({ connection }: { connection: OrderConnection }) {
  const { t } = useTranslation("business-orders")
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const seconds = connection.lastSuccess ? Math.max(0, Math.floor((now - connection.lastSuccess) / 1000)) : null
  const state = connection.state === "connected" && (seconds ?? 0) > 45 ? "reconnecting" : connection.state
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span
        className={`size-2 rounded-full ${state === "connected" ? "bg-emerald-500" : state === "offline" ? "bg-red-500" : "bg-amber-500"}`}
        aria-hidden="true"
      />
      <span role="status">{t(`connection_${state}`)}</span>
      {seconds !== null && <span>{t("connection_last_success", { seconds })}</span>}
      {(state === "reconnecting" || state === "offline") && (
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={connection.retry}>
          {t("connection_retry")}
        </Button>
      )}
    </div>
  )
}
