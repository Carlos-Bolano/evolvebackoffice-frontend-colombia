import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/config/axios-client"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/use-i18n"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { useOrderPresentation } from "../hooks/use-order-presentation"

interface TimelineEvent {
  id: string
  atUtc: string
  kind: string
  code: string
  actor: string | null
  source: string
  previousStatus: string | null
  status: string | null
  amount: number | null
  paymentMethod: string | null
  detail: string | null
}

export function OrderTimeline({ orderId }: { orderId: string }) {
  const { t } = useTranslation("business-orders")
  const { formatCurrency, formatDateTime } = useLocaleFormat()
  const { statusLabel, paymentLabel } = useOrderPresentation()
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ["order-timeline", orderId, page],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: TimelineEvent[]; totalCount: number }>(`/api/orders/${orderId}/timeline`, {
          params: { pageNumber: page, pageSize: 20 },
          signal,
        })
      ).data,
    refetchInterval: 15_000,
    retry: false,
  })
  const knownCodes = [
    "OrderCreated",
    "OrderUpdated",
    "OrderCancelled",
    "OrderReconciled",
    "OrderUnreconciled",
    "OrderPaymentsChanged",
    "OrderClosed",
    "EntityUpdated",
    "EntityDeleted",
    "PaymentRecorded",
    "DeliveryIncident",
    "SyncError",
    "IncidentResolved",
  ]
  return (
    <section aria-label={t("timeline_title")} className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{t("timeline_title")}</h3>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setPage(1)
            void query.refetch()
          }}
        >
          {t("refresh")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("timeline_available")}</p>
      {query.isLoading && <p role="status">{t("loading")}</p>}
      {query.isError && (
        <div role="alert">
          <p>{t("timeline_error")}</p>
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            {t("refresh")}
          </Button>
        </div>
      )}
      {query.data && !query.data.data.length && <p>{t("timeline_empty")}</p>}
      <ol className="space-y-3 border-l pl-4">
        {query.data?.data.map((event) => (
          <li key={event.id} className="space-y-1 text-sm break-words">
            <p className="font-medium">
              {event.kind === "whatsapp"
                ? `${t("timeline_whatsapp")} · ${t(`wa_msg_status_${event.code}`)}`
                : knownCodes.includes(event.code)
                  ? t(`timeline_${event.code}`)
                  : t("timeline_change")}
            </p>
            {event.status && (
              <p>
                {event.previousStatus ? `${statusLabel(event.previousStatus)} → ` : ""}
                {statusLabel(event.status)}
              </p>
            )}
            {event.amount !== null && (
              <p>
                {formatCurrency(event.amount)} · {paymentLabel(event.paymentMethod)}
              </p>
            )}
            {event.detail && <p>{event.detail}</p>}
            <p className="text-xs text-muted-foreground">
              <time dateTime={event.atUtc}>{formatDateTime(event.atUtc)}</time> ·{" "}
              {event.actor || t("timeline_unknown_actor")}
            </p>
            {event.source === "snapshot" && <p className="text-xs text-amber-600">{t("timeline_snapshot")}</p>}
          </li>
        ))}
      </ol>
      {(query.data?.totalCount ?? 0) > 20 && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("previous")}
          </Button>
          <span className="text-xs">
            {page} / {Math.ceil((query.data?.totalCount ?? 0) / 20)}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page * 20 >= (query.data?.totalCount ?? 0) || query.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </section>
  )
}
