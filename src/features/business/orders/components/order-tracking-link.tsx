import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { createTrackingLink, getTrackingLink, revokeTrackingLink } from "../services/delivery-tracking.service"
import { getApiErrorMessage } from "../utils/order-helpers"
import { OrderWhatsAppDialog, type ContactOrder } from "./order-whatsapp-dialog"

export function OrderTrackingLink({ order }: { order: ContactOrder & { id: string } }) {
  const { t } = useTranslation("business-orders")
  const qc = useQueryClient()
  const key = ["order-tracking-link", order.id]
  const query = useQuery({ queryKey: key, queryFn: () => getTrackingLink(order.id), retry: false })
  const [confirmation, setConfirmation] = useState<"renew" | "revoke" | null>(null)
  const mutation = useMutation({
    mutationFn: async (action: "create" | "renew" | "revoke") => {
      if (action === "revoke") {
        await revokeTrackingLink(order.id)
        return null
      }
      return createTrackingLink(order.id, action === "renew")
    },
    onSuccess: (link) => {
      qc.setQueryData(key, link)
      setConfirmation(null)
      notify.success(t("tracking_link_saved"))
    },
    onError: (error) => notify.error(getApiErrorMessage(error, t("tracking_link_error"))),
  })
  const link = query.isError ? null : query.data
  const url = link ? (link.url ?? new URL(link.path, window.location.origin).href) : ""
  const terminal = ["Delivered", "Cancelled", "Refunded"].includes(order.status)
  return (
    <section aria-label={t("tracking_link_title")} className="space-y-3 rounded-xl border p-3">
      <h3 className="text-sm font-semibold">{t("tracking_link_title")}</h3>
      <p className="text-xs text-muted-foreground">{t("tracking_link_help")}</p>
      {query.isError && (
        <div role="alert" className="space-y-2">
          <p>{t("tracking_link_error")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("refresh")}
          </Button>
        </div>
      )}
      {link && (
        <>
          <Input aria-label={t("tracking_link_url")} readOnly value={url} className="text-xs" />
          <p className="text-xs">
            {t("tracking_link_expires")}: {new Date(link.expiresAtUtc).toLocaleString()}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url)
                  notify.success(t("tracking_link_copied"))
                } catch {
                  notify.error(t("tracking_copy_failed"))
                }
              }}
            >
              {t("tracking_copy_link")}
            </Button>
            {!terminal && (
              <OrderWhatsAppDialog
                key={url}
                order={order}
                initialTemplate="DeliveryTracking"
                triggerLabel={t("tracking_send_evolution")}
              />
            )}
            {!terminal && (
              <Button
                className="min-h-11"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setConfirmation("renew")}
              >
                {t("tracking_renew_link")}
              </Button>
            )}
            <Button
              className="min-h-11"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setConfirmation("revoke")}
            >
              {t("tracking_revoke_link")}
            </Button>
          </div>
        </>
      )}
      {!link && !query.isLoading && !query.isError && !terminal && (
        <Button className="min-h-11" disabled={mutation.isPending} onClick={() => mutation.mutate("create")}>
          {t("tracking_create_link")}
        </Button>
      )}
      {confirmation && (
        <div role="group" aria-label={t("tracking_link_confirmation")} className="space-y-2 rounded-lg bg-muted p-3">
          <p className="text-sm">
            {t(confirmation === "renew" ? "tracking_renew_confirm" : "tracking_revoke_confirm")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={mutation.isPending} onClick={() => mutation.mutate(confirmation)}>
              {t("tracking_confirm")}
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setConfirmation(null)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
