import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/use-i18n"

import { DEFAULT_ORDER_VIEW, type OrderViewPreferences } from "../hooks/use-order-view-preferences"

export function OrderQuickFilters({
  value,
  onChange,
}: {
  value: OrderViewPreferences
  onChange: (value: OrderViewPreferences) => void
}) {
  const { t } = useTranslation("business-orders")
  const preset = (quickView: OrderViewPreferences["quickView"]) => {
    onChange({
      ...DEFAULT_ORDER_VIEW,
      quickView,
      paymentFilter: quickView === "pending" ? "pending" : "",
      syncAlertFilter: quickView === "sync_error" ? "error" : "",
    })
  }
  return (
    <section aria-label={t("order_quick_filters")}>
      <div className="flex gap-2 overflow-x-auto pb-1 [&>button]:shrink-0">
        {(["", "ready_unassigned", "pending", "sync_error"] as const).map((p) => (
          <Button
            type="button"
            key={p}
            variant={value.quickView === p ? "secondary" : "outline"}
            size="sm"
            className="min-h-11"
            aria-pressed={value.quickView === p}
            onClick={() => preset(p)}
          >
            {t(`view_${p || "all"}`)}
          </Button>
        ))}
      </div>
    </section>
  )
}
