import { shortOrderReference } from "../utils/order-presentation"
import { useCallback, useState } from "react"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { ChangePasswordDialog } from "@/features/auth/components/change-password-dialog"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { collectDelivery, getCourierMobile, recordDeliveryIncident } from "../services/delivery-operations.service"
import { DeliveryOrderCard } from "../components/delivery-order-card"
import { getApiErrorMessage } from "../utils/order-helpers"
import type { DeliveryOrder } from "../types/delivery"
import type { DeliveryProofInput } from "../types/enhancements"
import { DeliveryProofCapture } from "../components/delivery-proof-input"
import { DeliveryMap } from "../components/delivery-map"
import { CourierLocationSharing } from "../components/courier-location-sharing"

const CASH_DENOMINATIONS = [20_000, 50_000, 100_000] as const

export function CourierMobilePage() {
  const { session, logout } = useAuth()
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const qc = useQueryClient()
  const key = ["delivery-me", session?.tenantId, session?.user.id]
  const { data, error, isLoading, dataUpdatedAt } = useQuery({
    queryKey: key,
    queryFn: () => getCourierMobile(),
    enabled: !!session && !session.forcePasswordChange,
    retry: false,
    refetchInterval: 15_000,
  })
  const [selected, setSelected] = useState<DeliveryOrder | null>(null)
  const [cash, setCash] = useState("")
  const [proof, setProof] = useState<DeliveryProofInput | null>(null)
  const [proofValid, setProofValid] = useState(true)
  const [incidentOrder, setIncidentOrder] = useState<DeliveryOrder | null>(null)
  const [incidentReason, setIncidentReason] = useState("No contesta")

  const onProofChange = useCallback((value: DeliveryProofInput | null, valid: boolean) => {
    setProof(value)
    setProofValid(valid)
  }, [])
  const deliver = useMutation({
    mutationFn: () =>
      collectDelivery(selected!.id, selected!.paymentConfirmed || selected!.isReconciled ? null : Number(cash), proof),
    onSuccess: async () => {
      setSelected(null)
      await qc.invalidateQueries({ queryKey: key })
    },
  })
  const incidentMutation = useMutation({
    mutationFn: () => recordDeliveryIncident(incidentOrder!.id, incidentReason.trim() || "No contesta", false),
    onSuccess: async () => {
      setIncidentOrder(null)
      notify.success(t("mobile_incident_saved"))
      await qc.invalidateQueries({ queryKey: key })
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  if (session?.forcePasswordChange)
    return <ChangePasswordDialog open onPasswordChanged={() => void qc.invalidateQueries({ queryKey: key })} />
  if (!session || error)
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">{t("phase2_my_deliveries")}</h1>
        <p role="alert">{getApiErrorMessage(error, t("phase2_no_shift"))}</p>
        <Button variant="outline" onClick={logout}>
          {t("delivery_logout")}
        </Button>
      </main>
    )
  if (isLoading || !data) return <p className="p-6">{t("loading")}</p>
  return (
    <main className="mx-auto max-w-lg space-y-4 p-4">
      <Button variant="outline" onClick={logout}>
        {t("delivery_logout")}
      </Button>
      <h1 className="text-xl font-semibold">
        {data.courierName} · {t("phase2_my_deliveries")}
      </h1>
      <p>
        {t("phase2_expected")}: {formatCurrency(data.shift.expectedCash)}
      </p>
      <DeliveryMap orders={data.orders.filter((o) => o.status === "Shipped")} />
      <CourierLocationSharing
        key={data.shift.id}
        identity={`${session.tenantId}:${session.user.id}:${data.shift.id}`}
      />
      {data.orders.map((order) => (
        <DeliveryOrderCard
          key={order.id}
          order={order}
          now={dataUpdatedAt}
          showStatus
          courierName={data.courierName}
          notifyCustomer={false}
          actions={
            order.status === "Shipped" && !order.deliveryFailureReason ? (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIncidentReason(t("mobile_incident_preset_no_answer"))
                    setIncidentOrder(order)
                  }}
                >
                  {t("mobile_incident_btn")}
                </Button>
                <Button
                  onClick={() => {
                    setSelected(order)
                    setProof(null)
                    setProofValid(true)
                    setCash(order.cashTenderedAmount?.toString() ?? "")
                    deliver.reset()
                  }}
                >
                  {t("delivery_mark_delivered")}
                </Button>
              </div>
            ) : undefined
          }
        />
      ))}
      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="break-all">
              {t("delivery_mark_delivered")} · #{shortOrderReference(selected.reference, selected.id)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected.paymentConfirmed || selected.isReconciled ? (
              <p className="font-semibold text-emerald-600">
                {t(selected.paymentConfirmed ? "phase2_paid" : "phase2_collected")}
              </p>
            ) : (
              <div className="space-y-2">
                <label className="block">
                  {t("phase2_received_cash")}
                  <Input
                    aria-label={t("phase2_received_cash")}
                    type="number"
                    min={selected.total}
                    step="0.01"
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setCash(String(selected.total))}
                  >
                    {t("cash_exact")} ({formatCurrency(selected.total)})
                  </Button>
                  {CASH_DENOMINATIONS.map((denom) => (
                    <Button
                      key={denom}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setCash(String(Math.max(denom, selected.total)))}
                    >
                      ${denom.toLocaleString("es-CO")}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {!selected.paymentConfirmed && !selected.isReconciled && (
              <p>{t("phase2_change", { amount: formatCurrency(Math.max(0, Number(cash) - selected.total)) })}</p>
            )}
            {deliver.error && (
              <p role="alert" className="text-red-600">
                {getApiErrorMessage(deliver.error, t("status_update_failed"))}
              </p>
            )}
            <DeliveryProofCapture key={selected.id} onChange={onProofChange} />
            <div className="flex gap-2">
              <Button
                disabled={
                  deliver.isPending ||
                  !proofValid ||
                  (!selected.paymentConfirmed &&
                    !selected.isReconciled &&
                    (!cash || !Number.isFinite(Number(cash)) || Number(cash) < selected.total))
                }
                onClick={() => deliver.mutate()}
              >
                {t("phase2_confirm_delivery")}
              </Button>
              <Button variant="outline" onClick={() => setSelected(null)}>
                {t("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={incidentOrder !== null} onOpenChange={(open) => !open && setIncidentOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mobile_incident_title")}</DialogTitle>
            <DialogDescription>#{shortOrderReference(incidentOrder?.reference, incidentOrder?.id)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                t("mobile_incident_preset_no_answer"),
                t("mobile_incident_preset_wrong_address"),
                t("mobile_incident_preset_rejected"),
              ].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={incidentReason === preset ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setIncidentReason(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
            <Input
              value={incidentReason}
              onChange={(e) => setIncidentReason(e.target.value)}
              placeholder={t("mobile_incident_custom_placeholder")}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIncidentOrder(null)}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                disabled={!incidentReason.trim() || incidentMutation.isPending}
                onClick={() => incidentMutation.mutate()}
              >
                {t("mobile_incident_submit")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
