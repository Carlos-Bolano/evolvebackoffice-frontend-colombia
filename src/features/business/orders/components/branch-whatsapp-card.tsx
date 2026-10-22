import { WhatsAppSetupAssistant } from "./whatsapp-setup-assistant"
import { useWhatsAppDraft } from "../hooks/use-whatsapp-draft"
import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MessageCircle, QrCode, RefreshCw, Unplug } from "lucide-react"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import {
  connectBranchWhatsAppChannel,
  disconnectBranchWhatsAppChannel,
  getBranchWhatsAppChannel,
  getBranchWhatsAppQr,
  updateBranchWhatsAppChannel,
  WHATSAPP_EVENTS,
  WHATSAPP_VARIABLES,
  type WhatsAppChannelStatus,
  type WhatsAppEventCode,
  type WhatsAppRecipientType,
  type WhatsAppTemplateConfig,
} from "../services/whatsapp.service"
import { getApiErrorMessage } from "../utils/order-helpers"

const STATUS_TONE: Record<WhatsAppChannelStatus, BadgeTone> = {
  Disconnected: "neutral",
  Provisioning: "info",
  WaitingForQr: "warning",
  Connecting: "info",
  Connected: "success",
  Error: "danger",
}

const DEFAULT_TEMPLATES: Record<WhatsAppEventCode, { recipientType: WhatsAppRecipientType; text: string }> = {
  OrderConfirmed: {
    recipientType: "Customer",
    text: "Hola {{customerName}}, tu pedido #{{orderNumber}} en {{branchName}} fue confirmado por {{total}}.",
  },
  OrderReady: {
    recipientType: "Customer",
    text: "Hola {{customerName}}, tu pedido #{{orderNumber}} ya está listo en {{branchName}}.",
  },
  OrderShipped: {
    recipientType: "Customer",
    text: "Hola {{customerName}}, tu pedido #{{orderNumber}} va en camino con {{courierName}}.",
  },
  OrderDelivered: {
    recipientType: "Customer",
    text: "Hola {{customerName}}, tu pedido #{{orderNumber}} fue entregado. ¡Gracias por tu compra!",
  },
  OrderCancelled: {
    recipientType: "Customer",
    text: "Hola {{customerName}}, tu pedido #{{orderNumber}} fue cancelado.",
  },
  CourierAssigned: {
    recipientType: "Courier",
    text: "Hola {{courierName}}, tienes asignado el pedido #{{orderNumber}} de {{customerName}} ({{total}}).",
  },
  CourierReassigned: {
    recipientType: "Courier",
    text: "Hola {{courierName}}, se te reasignó el pedido #{{orderNumber}} de {{customerName}} ({{total}}).",
  },
}

function buildInitialTemplates(existing: WhatsAppTemplateConfig[] | undefined): WhatsAppTemplateConfig[] {
  return WHATSAPP_EVENTS.map((eventCode) => {
    const found = existing?.find((tpl) => tpl.eventCode === eventCode)
    if (found) return found
    const def = DEFAULT_TEMPLATES[eventCode]
    return {
      eventCode,
      recipientType: def.recipientType,
      templateText: def.text,
      isActive: true,
    }
  })
}

export function BranchWhatsAppCard({ branchId }: { branchId: string }) {
  const { t } = useTranslation("business-orders")
  const qc = useQueryClient()
  const queryKey = ["branch-whatsapp", branchId]

  const { data: channel, isLoading } = useQuery({
    queryKey,
    queryFn: () => getBranchWhatsAppChannel(branchId),
    enabled: Boolean(branchId),
    retry: false,
    refetchInterval: 6000,
  })

  useEffect(() => {
    if (location.hash === "#whatsapp" && !isLoading)
      document.getElementById("whatsapp")?.scrollIntoView({ block: "start" })
  }, [branchId, isLoading])

  const { draft, setDraft, isDirty, discard, saved } = useWhatsAppDraft(
    branchId,
    channel,
    {
      enabled: channel?.enabled ?? false,
      notifyExternalPlatformOrders: channel?.notifyExternalPlatformOrders ?? false,
      automaticEvents: channel?.automaticEvents ?? [],
      templates: buildInitialTemplates(channel?.templates),
    },
    t("wa_leave_unsaved")
  )
  const { enabled, notifyExternalPlatformOrders: notifyExternal, automaticEvents: autoEvents, templates } = draft
  const [activeTemplateEvent, setActiveTemplateEvent] = useState<WhatsAppEventCode>("OrderConfirmed")

  const setEnabled = (value: boolean) => setDraft((prev) => ({ ...prev, enabled: value }))
  const setNotifyExternal = (value: boolean) => setDraft((prev) => ({ ...prev, notifyExternalPlatformOrders: value }))

  const shouldPollQr =
    channel?.status === "WaitingForQr" || channel?.status === "Provisioning" || channel?.status === "Connecting"

  const { data: qrData, refetch: refetchQr } = useQuery({
    queryKey: ["branch-whatsapp-qr", branchId],
    queryFn: () => getBranchWhatsAppQr(branchId),
    enabled: Boolean(branchId) && shouldPollQr,
    refetchInterval: shouldPollQr ? 6_000 : false,
    retry: false,
  })

  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!qrData?.expiresAtUtc) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [qrData?.expiresAtUtc])

  const qrRemainingSeconds = qrData?.expiresAtUtc
    ? Math.max(0, Math.ceil((new Date(qrData.expiresAtUtc).getTime() - nowMs) / 1000))
    : null

  const saveMutation = useMutation({
    mutationFn: (values: typeof draft) => updateBranchWhatsAppChannel(branchId, values),
    onSuccess: (updated, values) => {
      qc.setQueryData(queryKey, updated)
      saved(values)
      notify.success(t("wa_config_saved"))
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const connectMutation = useMutation({
    mutationFn: () => connectBranchWhatsAppChannel(branchId),
    onSuccess: (updated) => {
      qc.setQueryData(queryKey, updated)
      void refetchQr()
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectBranchWhatsAppChannel(branchId),
    onSuccess: (updated) => {
      qc.setQueryData(queryKey, updated)
      qc.setQueryData(["branch-whatsapp-qr", branchId], null)
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const toggleEvent = (code: WhatsAppEventCode) => {
    setDraft((prev) => ({
      ...prev,
      automaticEvents: prev.automaticEvents.includes(code)
        ? prev.automaticEvents.filter((c) => c !== code)
        : [...prev.automaticEvents, code],
    }))
  }

  const currentTemplate = templates.find((tpl) => tpl.eventCode === activeTemplateEvent) ?? templates[0]

  const updateCurrentTemplateText = (text: string) => {
    setDraft((prev) => ({
      ...prev,
      templates: prev.templates.map((tpl) =>
        tpl.eventCode === activeTemplateEvent ? { ...tpl, templateText: text } : tpl
      ),
    }))
  }

  const insertVariable = (variable: string) => {
    if (!currentTemplate) return
    updateCurrentTemplateText(`${currentTemplate.templateText} ${variable}`.trim())
  }

  const status: WhatsAppChannelStatus = channel?.status ?? "Disconnected"
  const qrSrc = qrData?.qrCodeBase64
    ? qrData.qrCodeBase64.startsWith("data:")
      ? qrData.qrCodeBase64
      : `data:image/png;base64,${qrData.qrCodeBase64}`
    : null

  return (
    <Card id="whatsapp" className="scroll-mt-20 border-border/80 bg-card/70 shadow-none">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-emerald-600" />
            <CardTitle className="text-base">{t("wa_card_title")}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {channel?.maskedPhone && (
              <span className="font-mono text-xs text-muted-foreground">{channel.maskedPhone}</span>
            )}
            <Badge tone={STATUS_TONE[status]}>{t(`wa_status_${status}`)}</Badge>
          </div>
        </div>
        <CardDescription>{t("wa_card_desc")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        {!isLoading && (
          <WhatsAppSetupAssistant
            key={`${branchId}:${channel?.sessionGeneration ?? 0}`}
            branchId={branchId}
            channel={channel}
            onConnect={() => connectMutation.mutate()}
            connecting={connectMutation.isPending}
            onEnableChannel={() =>
              document.getElementById("whatsapp-channel-settings")?.scrollIntoView({ block: "center" })
            }
            onAutomations={() => document.getElementById("whatsapp-automations")?.scrollIntoView({ block: "center" })}
          />
        )}
        {isDirty && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          >
            <p>{t("wa_unsaved_draft")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm(t("wa_discard_confirm"))) discard()
              }}
            >
              {t("wa_discard_draft")}
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : (
          <>
            {channel?.lastErrorMessage && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {channel.lastErrorMessage}
              </p>
            )}

            {/* Conexión / QR */}
            <div className="flex flex-wrap items-center gap-2">
              {status !== "Connected" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={connectMutation.isPending}
                  onClick={() => connectMutation.mutate()}
                >
                  <QrCode className="mr-1.5 size-4" />
                  {t("wa_connect_btn")}
                </Button>
              )}
              {shouldPollQr && (
                <Button type="button" size="sm" variant="ghost" onClick={() => void refetchQr()}>
                  <RefreshCw className="mr-1.5 size-3.5" />
                  {t("wa_refresh_qr_btn")}
                </Button>
              )}
              {status !== "Disconnected" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disconnectMutation.isPending}
                  onClick={() => disconnectMutation.mutate()}
                >
                  <Unplug className="mr-1.5 size-4" />
                  {t("wa_disconnect_btn")}
                </Button>
              )}
            </div>

            {qrData && (qrSrc || qrData.pairingCode) && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-4 text-center sm:flex-row sm:text-left">
                {qrSrc && <img src={qrSrc} alt="WhatsApp QR" className="size-40 rounded-lg border bg-white p-2" />}
                <div className="space-y-1 text-xs">
                  {qrData.pairingCode && (
                    <p>
                      <span className="text-muted-foreground">{t("wa_pairing_code")}: </span>
                      <span className="font-mono font-semibold">{qrData.pairingCode}</span>
                    </p>
                  )}
                  {qrRemainingSeconds !== null && (
                    <p className={qrRemainingSeconds > 0 ? "text-muted-foreground" : "font-semibold text-amber-600"}>
                      {qrRemainingSeconds > 0
                        ? t("wa_qr_expires_in", { seconds: qrRemainingSeconds })
                        : t("wa_qr_expired")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Switches de habilitación */}
            <div
              id="whatsapp-channel-settings"
              className="scroll-mt-20 space-y-3 rounded-xl border border-border/60 p-3"
            >
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>{t("wa_enabled_label")}</span>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>{t("wa_notify_external_label")}</span>
                <Switch checked={notifyExternal} onCheckedChange={setNotifyExternal} />
              </label>
            </div>

            {/* Eventos automáticos */}
            <div id="whatsapp-automations" className="scroll-mt-20 space-y-2">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t("wa_auto_events_title")}
              </p>
              <div className="flex flex-wrap gap-2">
                {WHATSAPP_EVENTS.map((code) => {
                  const checked = autoEvents.includes(code)
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleEvent(code)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t(`wa_event_${code}`)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Plantillas */}
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t("wa_templates_title")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WHATSAPP_EVENTS.map((code) => (
                  <Button
                    key={code}
                    type="button"
                    size="sm"
                    variant={activeTemplateEvent === code ? "default" : "outline"}
                    className="min-h-11 text-xs sm:min-h-8"
                    onClick={() => setActiveTemplateEvent(code)}
                  >
                    {t(`wa_event_${code}`)}
                  </Button>
                ))}
              </div>
              {currentTemplate && (
                <div className="space-y-2 pt-1">
                  <Textarea
                    rows={3}
                    value={currentTemplate.templateText}
                    onChange={(e) => updateCurrentTemplateText(e.target.value)}
                    aria-label={t("wa_templates_title")}
                  />
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">{t("wa_variables_hint")}</span>
                    {WHATSAPP_VARIABLES.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(variable)}
                        className="rounded border bg-muted/50 px-2 py-0.5 font-mono text-[11px] hover:bg-accent"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(draft)}
              >
                {t("wa_save_config")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
