import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/i18n/use-i18n"
import { useDebouncedValue } from "../hooks/use-order-workspace"
import { getOrders } from "../services/orders.service"
import {
  getOrderWhatsAppMessages,
  verifyBranchWhatsAppConnection,
  type BranchWhatsAppChannel,
} from "../services/whatsapp.service"
import type { OrderListItem } from "../types/api"
import { shortOrderReference } from "../utils/order-presentation"
import { OrderWhatsAppDialog } from "./order-whatsapp-dialog"

export function WhatsAppSetupAssistant({
  branchId,
  channel,
  onConnect,
  canConnect,
  connecting,
  onAutomations,
  onEnableChannel,
}: {
  branchId: string
  channel: BranchWhatsAppChannel | undefined
  onConnect: () => void
  canConnect: boolean
  connecting: boolean
  onEnableChannel: () => void
  onAutomations: () => void
}) {
  const { t } = useTranslation("business-orders")
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState("")
  const debounced = useDebouncedValue(search.trim())
  const [test, setTest] = useState<{ order: OrderListItem; since: number } | null>(null)
  const verification = useMutation({ mutationFn: () => verifyBranchWhatsAppConnection(branchId) })
  const orders = useQuery({
    queryKey: ["whatsapp-setup-orders", branchId, debounced],
    queryFn: () => getOrders(1, 10, { branchId, search: debounced || undefined }),
    enabled: step === 2,
    retry: false,
  })
  const messages = useQuery({
    queryKey: ["whatsapp-setup-test", branchId, channel?.sessionGeneration, test?.order.id, test?.since],
    queryFn: () => getOrderWhatsAppMessages(test!.order.id, 1, 10),
    enabled: !!test && step >= 2,
    refetchInterval: test && step >= 2 ? 3000 : false,
    retry: false,
  })
  const tested =
    messages.data?.data.some(
      (m) =>
        !m.isAutomatic &&
        new Date(m.createdAtUtc).getTime() >= (test?.since ?? Infinity) &&
        ["Accepted", "Delivered", "Read"].includes(m.status)
    ) ?? false
  const connected = channel?.status === "Connected"
  const verified = verification.data?.connected === true && connected
  const steps = ["wa_setup_link", "wa_setup_verify", "wa_setup_test", "wa_setup_automations"]
  return (
    <section aria-label={t("wa_setup_title")} className="space-y-3 rounded-xl border p-3">
      <h3 className="font-medium">{t("wa_setup_title")}</h3>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((label, index) => (
          <li key={label}>
            <Button
              type="button"
              variant={step === index ? "default" : "outline"}
              className="h-auto min-h-11 w-full text-left whitespace-normal"
              aria-current={step === index ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              {index + 1}. {t(label)}
            </Button>
          </li>
        ))}
      </ol>
      {step === 0 && (
        <>
          <p className="text-sm">{t("wa_setup_link_hint")}</p>
          <Button type="button" variant="outline" onClick={onEnableChannel}>
            {t("wa_setup_enable_channel")}
          </Button>
          <Button type="button" variant="outline" disabled={!canConnect || connecting || connected} onClick={onConnect}>
            {t("wa_setup_link")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStep(1)}>
            {t("next")}
          </Button>
        </>
      )}
      {step === 1 && (
        <>
          <p className="text-sm">{t("wa_setup_verify_hint")}</p>
          <Button
            type="button"
            variant="outline"
            disabled={!channel || verification.isPending}
            onClick={() => verification.mutate()}
          >
            {t("wa_setup_verify")}
          </Button>
          {verification.isError && <p role="alert">{t("wa_setup_verify_error")}</p>}
          {verification.data && <p role="status">{t(verified ? "wa_setup_verified" : "wa_setup_not_connected")}</p>}
          <Button type="button" variant="ghost" disabled={!verified} onClick={() => setStep(2)}>
            {t("next")}
          </Button>
        </>
      )}
      {step === 2 && (
        <>
          <p className="text-sm">{t("wa_setup_test_hint")}</p>
          {!connected && <p role="alert">{t("wa_setup_not_connected")}</p>}
          {!channel?.enabled && (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p>{t("wa_setup_manual_enable_hint")}</p>
              <Button type="button" variant="outline" onClick={onEnableChannel}>
                {t("wa_setup_enable_channel")}
              </Button>
            </div>
          )}
          <label className="block text-sm">
            {t("wa_setup_find_order")}
            <Input value={search} maxLength={120} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {orders.isFetching && <p role="status">{t("loading")}</p>}
          {orders.isError && (
            <div role="alert">
              <p>{t("timeline_error")}</p>
              <Button type="button" variant="outline" onClick={() => void orders.refetch()}>
                {t("refresh")}
              </Button>
            </div>
          )}
          <label className="block text-sm">
            {t("wa_setup_order")}
            <select
              className="h-11 w-full rounded-md border bg-background px-2"
              aria-label={t("wa_setup_order")}
              value={test?.order.id ?? ""}
              onChange={(e) => {
                const order = orders.data?.data.find((o) => o.id === e.target.value)
                setTest(order ? { order, since: Date.now() } : null)
              }}
            >
              <option value="">{t("saved_view_choose")}</option>
              {test && !orders.data?.data.some((o) => o.id === test.order.id) && (
                <option value={test.order.id}>{shortOrderReference(test.order.externalOrderId, test.order.id)}</option>
              )}
              {orders.data?.data
                .filter((o) => o.customerPhone)
                .map((order) => (
                  <option key={order.id} value={order.id}>
                    #{shortOrderReference(order.externalOrderId, order.id)} · {order.customerName}
                  </option>
                ))}
            </select>
          </label>
          {test && (
            <OrderWhatsAppDialog
              key={test.order.id}
              order={{
                ...test.order,
                reference: test.order.externalOrderId || test.order.id,
                status: test.order.statusCode,
                customerName: test.order.customerName ?? null,
                customerPhone: test.order.customerPhone ?? null,
              }}
            />
          )}
          {test && (
            <p role="status" className="text-sm">
              {t(tested ? "wa_setup_test_accepted" : "wa_setup_test_waiting")}
            </p>
          )}
          {messages.isError && <p role="alert">{t("wa_setup_test_check_error")}</p>}
          <Button type="button" variant="ghost" disabled={!tested} onClick={() => setStep(3)}>
            {t("next")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStep(3)}>
            {t("wa_setup_skip_test")}
          </Button>
        </>
      )}
      {step === 3 && (
        <>
          <p className="text-sm">{t("wa_setup_auto_hint")}</p>
          {!tested && <p className="text-sm text-amber-600">{t("wa_setup_test_not_done")}</p>}
          <Button type="button" variant="outline" onClick={onAutomations}>
            {t("wa_setup_configure")}
          </Button>
        </>
      )}
    </section>
  )
}
