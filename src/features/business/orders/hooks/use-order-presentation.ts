import { useTranslation } from "@/i18n/use-i18n"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { collectionKey, PAYMENT_LABEL_KEYS, STATUS_LABEL_KEYS } from "../utils/order-presentation"

export function useOrderPresentation() {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  return {
    collectionLabel: (order: Parameters<typeof collectionKey>[0] & { total: number }) =>
      t(collectionKey(order), { amount: formatCurrency(order.total) }),
    paymentLabel: (method: string | null | undefined) =>
      method ? (PAYMENT_LABEL_KEYS[method.toUpperCase()] ? t(PAYMENT_LABEL_KEYS[method.toUpperCase()]) : method) : "—",
    statusLabel: (status: string) => (STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status),
  }
}
