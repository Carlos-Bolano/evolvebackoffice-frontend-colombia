import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/i18n/use-i18n"
import { useOrderWorkspaceKey, useWorkspaceState } from "../hooks/use-order-workspace"

import {
  DEFAULT_ORDER_VIEW,
  savedSchema,
  type SavedView,
  type OrderViewPreferences,
} from "../hooks/use-order-view-preferences"

export function OrderSavedViews({
  value,
  onChange,
}: {
  value: OrderViewPreferences
  onChange: (value: OrderViewPreferences) => void
}) {
  const { t } = useTranslation("business-orders")
  const [saved, setSaved] = useWorkspaceState(
    useOrderWorkspaceKey("order-saved-views"),
    [] as SavedView[],
    localStorage,
    (v): v is SavedView[] => savedSchema.safeParse(v).success
  )
  const [name, setName] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const activeId = saved.some((v) => v.id === selectedId && JSON.stringify(v.view) === JSON.stringify(value))
    ? selectedId
    : ""
  const preset = (quickView: OrderViewPreferences["quickView"]) => {
    setSelectedId("")
    onChange({
      ...DEFAULT_ORDER_VIEW,
      viewMode: value.viewMode,
      quickView,
      paymentFilter: quickView === "pending" ? "pending" : "",
      syncAlertFilter: quickView === "sync_error" ? "error" : "",
    })
  }
  return (
    <section aria-label={t("saved_views")} className="space-y-2">
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
      <details>
        <summary className="min-h-11 cursor-pointer text-sm">
          {t("saved_views")}
          {saved.length ? ` (${saved.length})` : ""}
        </summary>
        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <label className="min-w-0 flex-1 text-sm">
            {t("saved_view_name")}
            <Input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={!name.trim() || saved.length >= 10}
            onClick={() => {
              const id = crypto.randomUUID()
              setSaved((old) => [...old, { id, name: name.trim(), view: value }])
              setName("")
              setSelectedId(id)
            }}
          >
            {t("saved_view_save")}
          </Button>
          {!!saved.length && (
            <>
              <label className="min-w-0 flex-1 text-sm">
                {t("saved_view_apply")}
                <select
                  className="h-11 w-full rounded-md border bg-background px-2"
                  aria-label={t("saved_view_apply")}
                  value={activeId}
                  onChange={(e) => {
                    setSelectedId(e.target.value)
                    const view = saved.find((v) => v.id === e.target.value)
                    if (view) onChange(view.view)
                  }}
                >
                  <option value="">{t("saved_view_choose")}</option>
                  {saved.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={!activeId}
                onClick={() => {
                  setSaved((old) => old.filter((v) => v.id !== activeId))
                  setSelectedId("")
                }}
              >
                {t("saved_view_delete")}
              </Button>
            </>
          )}
          <p className="w-full text-xs text-muted-foreground">{t("saved_view_privacy")}</p>
        </div>
      </details>
    </section>
  )
}
