import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { getItems } from "@/features/business/items/catalog/services/items.service"
import { getActivePaymentMethods } from "@/features/business/payment-methods/services/payment-methods.service"
import { useDeliveryAction, useDeliveryOperations } from "../hooks/use-delivery-operations"
import type { UnlinkedProduct, WebhookHealth } from "../types/operations"
import { getApiErrorMessage } from "../utils/order-helpers"

/**
 * Operación diaria de Cluvi para una sucursal: recepción de pedidos (webhook),
 * pausar/reanudar la tienda, vincular productos y mapear medios de pago.
 * Vive dentro del asistente de Cluvi para no repartir la configuración.
 */
export function CluviOperationsPanel({ branchId, integrationId }: { branchId: string; integrationId?: string }) {
  const { t } = useTranslation("business-orders")
  const { data, isLoading } = useDeliveryOperations(branchId)
  const action = useDeliveryAction()
  const run = (path: string, payload?: unknown, method?: "post" | "put") =>
    action.mutate(
      { path, payload, method },
      {
        onSuccess: () => notify.success(t("phase2_saved")),
        onError: (e) => notify.error(getApiErrorMessage(e, t("status_update_failed"))),
      }
    )

  const belongs = (id: string) => !integrationId || id === integrationId
  const webhooks = (data?.webhooks ?? []).filter((w) => belongs(w.integrationId))
  const products = (data?.unlinkedProducts ?? []).filter((p) => belongs(p.integrationId))

  if (isLoading) return null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("phase2_cluvi_health")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {webhooks.length === 0 && <p className="text-sm text-muted-foreground">{t("cluvi_ops_inactive")}</p>}
          {webhooks.map((w) => (
            <div key={w.integrationId} className="space-y-3">
              <p className="font-semibold">
                {t(
                  w.storeActive == null
                    ? "phase2_unknown"
                    : w.storeActive
                      ? "phase2_store_active"
                      : "phase2_store_paused"
                )}
              </p>
              <p className="text-sm">
                {t("phase2_last_webhook")}:{" "}
                {w.lastReceivedAt ? new Date(w.lastReceivedAt).toLocaleString() : t("phase2_never")}
              </p>
              {w.quiet && (
                <p role="alert" className="text-sm text-amber-600">
                  {t("phase2_webhook_quiet")}
                </p>
              )}
              <Button
                disabled={action.isPending}
                variant="outline"
                onClick={() =>
                  run(`integrations/${w.integrationId}/availability`, { active: w.storeActive !== true }, "put")
                }
              >
                {t(w.storeActive ? "phase2_pause_store" : "phase2_resume_store")}
              </Button>
              <PaymentMapping
                health={w}
                pending={action.isPending}
                onSave={(mappings) => run(`integrations/${w.integrationId}/payments`, { mappings }, "put")}
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("phase2_unlinked")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {products.length === 0 && <p className="text-sm text-muted-foreground">{t("phase2_all_linked")}</p>}
          {products.map((p) => (
            <ProductLink
              key={`${p.integrationId}/${p.externalItemId}`}
              product={p}
              pending={action.isPending}
              onLink={(itemId) =>
                run(
                  "products/link",
                  { integrationId: p.integrationId, externalItemId: p.externalItemId, itemId },
                  "put"
                )
              }
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ProductLink({
  product,
  pending,
  onLink,
}: {
  product: UnlinkedProduct
  pending: boolean
  onLink: (id: string) => void
}) {
  const { t } = useTranslation("business-orders")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState("")
  const { data } = useQuery({
    queryKey: ["items", "delivery-link", search],
    queryFn: () => getItems({ pageSize: 100, searchField: "name", searchValue: search }),
  })
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p>
        {product.name} · {product.externalItemId} · {product.ordersCount} {t("orders")}
      </p>
      <Input
        aria-label={`${t("phase2_search_item")} ${product.name}`}
        placeholder={t("phase2_search_item")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="flex gap-2">
        <select
          aria-label={`${t("phase2_link_item")} ${product.name}`}
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">{t("phase2_link_item")}</option>
          {data?.data.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} · {i.sku}
            </option>
          ))}
        </select>
        <Button disabled={!selected || pending} onClick={() => onLink(selected)}>
          {t("phase2_link")}
        </Button>
      </div>
    </div>
  )
}

function PaymentMapping({
  health,
  pending,
  onSave,
}: {
  health: WebhookHealth
  pending: boolean
  onSave: (m: Record<string, string>) => void
}) {
  const { t } = useTranslation("business-orders")
  const { data } = useQuery({ queryKey: ["payment-methods", "active"], queryFn: getActivePaymentMethods })
  const [raw, setRaw] = useState("cash")
  const [code, setCode] = useState("")
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{t("phase2_payment_mapping")}</p>
      {Object.entries(health.paymentMethodMappings).map(([source, target]) => (
        <p className="text-sm" key={source}>
          {source} → {target}
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-40"
          aria-label={t("phase2_external_payment")}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <select
          className="h-10 rounded-md border bg-background px-3"
          aria-label={t("phase2_local_payment")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        >
          <option value="">{t("phase2_local_payment")}</option>
          {data?.map((m) => (
            <option key={m.code} value={m.code}>
              {m.name}
            </option>
          ))}
        </select>
        <Button
          disabled={!raw.trim() || !code || pending}
          onClick={() => onSave({ ...health.paymentMethodMappings, [raw.trim().toLowerCase()]: code })}
        >
          {t("save")}
        </Button>
      </div>
    </div>
  )
}
