import { useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, RefreshCw, RotateCcw, Send } from "lucide-react"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import {
  getOrderWhatsAppMessages,
  previewOrderWhatsAppNotification,
  resendOrderWhatsAppMessage,
  retryOrderWhatsAppMessage,
  sendOrderWhatsAppNotification,
  updateOrderWhatsAppContactPermission,
  WHATSAPP_EVENTS,
  type OrderWhatsAppPreview,
  type WhatsAppEventCode,
  type WhatsAppMessageStatus,
  type WhatsAppRecipientType,
} from "../services/whatsapp.service"
import type { DeliveryOrder } from "../types/delivery"
import { getApiErrorMessage } from "../utils/order-helpers"

export type ContactOrder = Pick<DeliveryOrder, "reference" | "status" | "customerName" | "customerPhone"> &
  Partial<
    Pick<
      DeliveryOrder,
      "id" | "branchId" | "total" | "shippingStreet" | "shippingCity" | "paymentConfirmed" | "isReconciled"
    >
  >

const MESSAGE_STATUS_TONE: Record<WhatsAppMessageStatus, BadgeTone> = {
  Queued: "info",
  Sending: "info",
  Accepted: "primary",
  Delivered: "success",
  Read: "success",
  Failed: "danger",
  Suppressed: "warning",
  UnknownOutcome: "warning",
}

function defaultTemplateForStatus(status: string, recipient: "customer" | "courier"): WhatsAppEventCode {
  if (recipient === "courier") return "CourierAssigned"
  switch (status) {
    case "Confirmed":
      return "OrderConfirmed"
    case "Ready":
      return "OrderReady"
    case "Shipped":
      return "OrderShipped"
    case "Delivered":
      return "OrderDelivered"
    case "Cancelled":
    case "Refunded":
      return "OrderCancelled"
    default:
      return "OrderConfirmed"
  }
}

export function OrderWhatsAppDialog({
  order,
  courierPhone,
  recipient = "customer",
}: {
  order: ContactOrder
  courierPhone?: string | null
  recipient?: "customer" | "courier"
}) {
  const { t } = useTranslation("business-orders")
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const orderId = order.id ?? ""
  const recipientType: WhatsAppRecipientType = recipient === "courier" ? "Courier" : "Customer"
  const [templateCode, setTemplateCode] = useState<WhatsAppEventCode>(() =>
    defaultTemplateForStatus(order.status, recipient)
  )
  const [reviewed, setReviewed] = useState(false)
  const [permissionAllowed, setPermissionAllowed] = useState(false)
  const [preview, setPreview] = useState<OrderWhatsAppPreview | null>(null)
  const [sendRequest, setSendRequest] = useState<{ version: string; key: string } | null>(null)
  const [resendingMessageId, setResendingMessageId] = useState<string | null>(null)
  const [ackDuplicate, setAckDuplicate] = useState(false)
  const [resendReason, setResendReason] = useState("")

  const messagesKey = ["order-whatsapp-messages", orderId]
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: messagesKey,
    queryFn: () => getOrderWhatsAppMessages(orderId, 1, 10),
    enabled: open && Boolean(orderId),
    retry: false,
  })

  const permissionMutation = useMutation({
    mutationFn: (allowed: boolean) =>
      updateOrderWhatsAppContactPermission(orderId, {
        recipientType,
        allowed,
        source: "BackofficeManual",
      }),
    onSuccess: (res) => {
      setPermissionAllowed(res.allowed)
      previewMutation.mutate(templateCode)
      notify.success(t("phase2_saved"))
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const previewMutation = useMutation({
    mutationFn: (code: WhatsAppEventCode) =>
      previewOrderWhatsAppNotification(orderId, {
        recipientType,
        templateCode: code,
      }),
    onSuccess: (res) => {
      setPreview(res)
      setPermissionAllowed(res.contactPermissionAllowed)
      setSendRequest((previous) =>
        previous?.version === res.previewVersion ? previous : { version: res.previewVersion, key: crypto.randomUUID() }
      )
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const sendMutation = useMutation({
    mutationFn: () =>
      sendOrderWhatsAppNotification(
        orderId,
        {
          recipientType,
          templateCode,
          previewVersion: preview?.previewVersion ?? "v1",
        },
        sendRequest?.key
      ),
    onSuccess: () => {
      setPreview(null)
      setSendRequest(null)
      notify.success(t("wa_sent_ok"))
      void qc.invalidateQueries({ queryKey: messagesKey })
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const retryMutation = useMutation({
    mutationFn: (messageId: string) => retryOrderWhatsAppMessage(orderId, messageId),
    onSuccess: () => {
      notify.success(t("wa_sent_ok"))
      void qc.invalidateQueries({ queryKey: messagesKey })
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const resendMutation = useMutation({
    mutationFn: (messageId: string) =>
      resendOrderWhatsAppMessage(orderId, messageId, {
        acknowledgeDuplicateRisk: ackDuplicate,
        reason: resendReason.trim() || "Manual operator resend",
      }),
    onSuccess: () => {
      setResendingMessageId(null)
      setAckDuplicate(false)
      setResendReason("")
      notify.success(t("wa_sent_ok"))
      void qc.invalidateQueries({ queryKey: messagesKey })
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  if (recipient === "courier" && (!courierPhone || !["Ready", "Shipped", "Cancelled"].includes(order.status)))
    return null

  if (!orderId) return null

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setTemplateCode(defaultTemplateForStatus(order.status, recipient))
          setPreview(null)
          setReviewed(false)
          setOpen(true)
          previewMutation.mutate(defaultTemplateForStatus(order.status, recipient))
        }}
      >
        {t(recipient === "courier" ? "e_notify_courier" : "e_notify_customer")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t(recipient === "courier" ? "e_notify_courier" : "e_notify_customer")}</DialogTitle>
            <DialogDescription>{t("wa_api_description")}</DialogDescription>
          </DialogHeader>

          {orderId && (
            <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              {previewMutation.isPending && <p role="status">{t("loading")}</p>}
              {previewMutation.isError && (
                <p role="alert">{getApiErrorMessage(previewMutation.error, t("status_update_failed"))}</p>
              )}
              {preview && !preview.eligible && order.branchId && (
                <Button asChild variant="outline">
                  <Link to={`/business/branches/${order.branchId}/config#whatsapp`}>{t("wa_configure_channel")}</Link>
                </Button>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{t("wa_permission_label")}</span>
                <Switch
                  checked={permissionAllowed}
                  aria-label={t("wa_permission_label")}
                  disabled={permissionMutation.isPending || previewMutation.isPending || sendMutation.isPending}
                  onCheckedChange={(checked) => {
                    setPermissionAllowed(checked)
                    setReviewed(false)
                    setPreview(null)
                    permissionMutation.mutate(checked)
                  }}
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-44 flex-1 text-xs font-medium">
                  {t("wa_template_label")}
                  <select
                    aria-label={t("wa_template_label")}
                    disabled={previewMutation.isPending || permissionMutation.isPending || sendMutation.isPending}
                    value={templateCode}
                    onChange={(e) => {
                      setReviewed(false)
                      setTemplateCode(e.target.value as WhatsAppEventCode)
                      setPreview(null)
                      setSendRequest(null)
                    }}
                    className="mt-1 block h-9 w-full rounded-md border bg-background px-2.5 text-xs"
                  >
                    {WHATSAPP_EVENTS.map((code) => (
                      <option key={code} value={code}>
                        {t(`wa_event_${code}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={previewMutation.isPending}
                  onClick={() => previewMutation.mutate(templateCode, { onSuccess: () => setReviewed(true) })}
                >
                  <Eye className="mr-1.5 size-3.5" />
                  {t("wa_preview_btn")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    sendMutation.isPending ||
                    previewMutation.isPending ||
                    permissionMutation.isPending ||
                    !preview?.eligible ||
                    !sendRequest ||
                    !reviewed
                  }
                  onClick={() => sendMutation.mutate()}
                >
                  <Send className="mr-1.5 size-3.5" />
                  {t("wa_send_api_btn")}
                </Button>
              </div>

              {preview && (
                <div className="space-y-1.5 rounded-lg border bg-background p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {preview.recipientName ?? "—"} ({preview.maskedPhone ?? "—"})
                    </span>
                    <Badge tone={preview.eligible ? "success" : "warning"}>
                      {t(`wa_status_${preview.channelStatus}`)}
                    </Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{preview.renderedText}</p>
                  {!preview.eligible && preview.ineligibleReason && (
                    <p className="font-medium text-amber-600">
                      {t("wa_ineligible_reason", { reason: preview.ineligibleReason })}
                    </p>
                  )}
                </div>
              )}

              {/* Historial de mensajes por Evolution API */}
              <div className="space-y-2 border-t border-border/60 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{t("wa_history_title")}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={t("refresh")}
                    onClick={() => void refetchHistory()}
                  >
                    <RefreshCw className="size-3" />
                  </Button>
                </div>
                {!historyData?.data.length ? (
                  <p className="text-xs text-muted-foreground">{t("wa_history_empty")}</p>
                ) : (
                  <div className="max-h-40 space-y-1.5 overflow-y-auto">
                    {historyData.data.map((msg) => (
                      <div key={msg.id} className="space-y-1 rounded-lg border bg-background p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{t(`wa_event_${msg.templateCode}`)}</span>
                          <Badge tone={MESSAGE_STATUS_TONE[msg.status]}>{t(`wa_msg_status_${msg.status}`)}</Badge>
                        </div>
                        <p className="line-clamp-2 text-muted-foreground">{msg.renderedText}</p>
                        {msg.lastErrorMessage && <p className="text-[11px] text-red-600">{msg.lastErrorMessage}</p>}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {msg.canRetry && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-h-11 px-3 text-xs sm:min-h-8"
                              disabled={retryMutation.isPending}
                              onClick={() => retryMutation.mutate(msg.id)}
                            >
                              <RotateCcw className="mr-1 size-3" />
                              {t("wa_retry_btn")}
                            </Button>
                          )}
                          {msg.canResendUnknownOutcome && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-h-11 px-3 text-xs sm:min-h-8"
                              onClick={() => setResendingMessageId(msg.id)}
                            >
                              {t("wa_resend_btn")}
                            </Button>
                          )}
                        </div>
                        {resendingMessageId === msg.id && (
                          <div className="mt-2 space-y-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-950">
                            <label className="flex items-start gap-2 text-[11px]">
                              <input
                                type="checkbox"
                                checked={ackDuplicate}
                                onChange={(e) => setAckDuplicate(e.target.checked)}
                                className="mt-0.5"
                              />
                              <span>{t("wa_resend_confirm_check")}</span>
                            </label>
                            <Input
                              value={resendReason}
                              onChange={(e) => setResendReason(e.target.value)}
                              placeholder={t("wa_resend_reason_placeholder")}
                              className="min-h-11 text-xs sm:min-h-8"
                            />
                            <div className="flex gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                className="min-h-11 text-xs sm:min-h-8"
                                disabled={!ackDuplicate || resendMutation.isPending}
                                onClick={() => resendMutation.mutate(msg.id)}
                              >
                                {t("wa_resend_submit")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="min-h-11 text-xs sm:min-h-8"
                                onClick={() => setResendingMessageId(null)}
                              >
                                {t("cancel")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
