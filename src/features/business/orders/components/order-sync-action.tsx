import { Button } from "@/components/ui/button"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { useRetryOrderSync } from "../hooks/use-orders"
import { getApiErrorMessage } from "../utils/order-helpers"

/** Reenvía solo el estado; no repite el despacho, la venta ni el inventario. */
export function OrderSyncAction({ orderId }: { orderId: string }) {
  const { t } = useTranslation("business-orders")
  const retry = useRetryOrderSync()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={retry.isPending}
      onClick={() =>
        retry.mutate(orderId, {
          onSuccess: (result) =>
            result.success
              ? notify.success(t("sync_retry_ok"))
              : notify.error(result.message ?? t("sync_retry_failed")),
          onError: (error) => notify.error(getApiErrorMessage(error, t("sync_retry_failed"))),
        })
      }
    >
      {t(retry.isPending ? "sync_retry_pending" : "sync_retry")}
    </Button>
  )
}
