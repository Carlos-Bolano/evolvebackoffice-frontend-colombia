import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/i18n/use-i18n"
import { useNotify } from "@/hooks/use-notify"
import { appConfig } from "@/config/env"
import { useAppStore } from "@/store/app-store"
import Spinner from "@/components/Spinner"
import {
  useBranchIntegrations,
  useCreateIntegration,
  useTestConnection,
  useSyncMenu,
  useActivateStore,
} from "../hooks/use-orders"
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, Truck, Store, Link2, Copy, RefreshCw } from "lucide-react"

interface IntegrationConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
  platform: string
}

/** Lee el storeId guardado en SettingsJson de la integración ("" si no hay). */
function readStoreId(settingsJson: string | null | undefined): string {
  if (!settingsJson) return ""
  try {
    const parsed = JSON.parse(settingsJson) as { storeId?: unknown }
    return typeof parsed.storeId === "string" ? parsed.storeId : ""
  } catch {
    return ""
  }
}

export function IntegrationConfigDialog({ open, onOpenChange, branchId, platform }: IntegrationConfigDialogProps) {
  const { t } = useTranslation("business-orders")
  const notify = useNotify()

  const [stepOverride, setStepOverride] = useState<number | null>(null)
  const [baseUrlOverride, setBaseUrlOverride] = useState<string | null>(null)
  const [appId, setAppId] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [storeIdOverride, setStoreIdOverride] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  // Estado de la tienda en Cluvi: "on" | "off" | null (aún desconocido)
  const [storeStatus, setStoreStatus] = useState<string | null>(null)
  // URLs que Cluvi quedó usando tras "Setear URL" (respuesta del servidor).
  // Antes de activar se muestran las calculadas con la config actual.
  const [registeredUrls, setRegisteredUrls] = useState<{ newOrder: string | null; ping: string | null } | null>(null)
  // Evita repetir la verificación automática de estado en cada refetch.
  const statusCheckedRef = useRef(false)

  const { data: integrations } = useBranchIntegrations(branchId)
  const existingIntegration = integrations?.find((i) => i.platformCode === platform && i.isActive)

  const createMutation = useCreateIntegration()
  const testMutation = useTestConnection()
  const syncMenuMutation = useSyncMenu()
  const activateMutation = useActivateStore()

  const isCluvi = platform === "CLUVI"
  const platformName = isCluvi ? "Cluvi" : "WooCommerce"
  const defaultBaseUrl = isCluvi ? "https://api.cluviplatform.click" : ""

  // Valores derivados en render (sin useEffect): si el usuario no los cambió,
  // siguen a la integración existente —incluso si carga después de abrir—.
  const step = stepOverride ?? (existingIntegration ? 1 : 0)
  const baseUrl = baseUrlOverride ?? existingIntegration?.baseUrl ?? defaultBaseUrl
  const storeId = storeIdOverride ?? readStoreId(existingIntegration?.settingsJson)

  // URL del webhook que este backend expone para recibir pedidos (la misma
  // que activate-store registra en Cluvi) y su ping de salud.
  const tenantId = useAppStore((s) => s.session?.tenantId)
  const defaultWebhookUrl =
    tenantId && storeId
      ? `${appConfig.apiBaseUrl}/api/webhooks/cluvi/${tenantId}?storeId=${encodeURIComponent(storeId)}`
      : null
  const defaultPingUrl = `${appConfig.apiBaseUrl}/health`
  const webhookUrl = registeredUrls?.newOrder ?? defaultWebhookUrl
  const pingUrl = registeredUrls?.ping ?? defaultPingUrl

  /** Al cerrar se limpia todo para que la próxima apertura arranque de cero. */
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStepOverride(null)
      setBaseUrlOverride(null)
      setStoreIdOverride(null)
      setAppId("")
      setSecretKey("")
      setTestResult(null)
      setStoreStatus(null)
      setRegisteredUrls(null)
      statusCheckedRef.current = false
    }
    onOpenChange(next)
  }

  const steps = [t("config_step_credentials"), t("config_step_verify"), t("config_step_menu")]

  const handleTestConnection = () => {
    if (!branchId) return
    const integrationId = existingIntegration?.id
    if (!integrationId) return
    setTestResult(null)
    testMutation.mutate(
      { branchId, integrationId },
      {
        onSuccess: (result) => {
          setTestResult(result)
          setStoreStatus(result.storeStatus ?? null)
        },
        onError: () => setTestResult({ success: false, message: t("connection_failed") }),
      }
    )
  }

  const handleActivateStore = () => {
    if (!branchId || !existingIntegration) return
    activateMutation.mutate(
      { branchId, integrationId: existingIntegration.id },
      {
        onSuccess: (res) => {
          if (res.success) {
            setStoreStatus(res.storeStatus ?? "on")
            setRegisteredUrls({ newOrder: res.newOrderWebhookUrl, ping: res.pingWebhookUrl })
            notify.success(res.message ?? t("store_activated"))
          } else {
            notify.error(res.message ?? t("store_activation_failed"))
          }
        },
        onError: () => notify.error(t("store_activation_failed")),
      }
    )
  }

  // Al abrir el diálogo se verifica (una sola vez) el estado real de la tienda
  // en Cluvi vía Prueba de Conexión, para mostrar activa/inactiva sin clics.
  useEffect(() => {
    if (!open || !existingIntegration || statusCheckedRef.current) return
    statusCheckedRef.current = true
    handleTestConnection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingIntegration?.id])

  const copyText = async (value: string, successKey: string) => {
    try {
      await navigator.clipboard.writeText(value)
      notify.success(t(successKey))
    } catch {
      notify.error(t("copy_failed"))
    }
  }

  const handleSave = () => {
    if (!branchId) return
    const settingsJson = isCluvi ? JSON.stringify({ storeId }) : undefined

    createMutation.mutate(
      {
        branchId,
        dto: {
          platformCode: platform,
          isActive: true,
          baseUrl,
          apiKey: appId,
          apiSecret: secretKey,
          settingsJson,
        },
      },
      {
        onSuccess: () => {
          notify.success(t("save_integration"))
          // After create, the query will refetch and existingIntegration will update
          // Force step 1 after a short delay to allow query invalidation
          setTimeout(() => setStepOverride(1), 500)
        },
        onError: () => notify.error(t("connection_failed")),
      }
    )
  }

  const handleSyncMenu = () => {
    if (!branchId || !existingIntegration) return
    syncMenuMutation.mutate(
      { branchId, integrationId: existingIntegration.id },
      {
        onSuccess: (res) => {
          if (res.success) {
            notify.success(res.message ?? t("sync_success"))
            handleOpenChange(false)
          } else {
            notify.error(res.message ?? t("sync_failed"))
          }
        },
        onError: () => notify.error(t("sync_failed")),
      }
    )
  }

  const PlatformIcon = isCluvi ? Truck : Store

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformIcon className="h-5 w-5" />
            {t("config_title")} — {platformName}
          </DialogTitle>
          {existingIntegration && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              {t("integration_active")}
            </div>
          )}
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 w-12 ${i < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <Separator />

        {/* Step 0: Credentials */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("select_branch")}</Label>
              <Input value={branchId} disabled className="bg-muted text-xs" />
            </div>
            <div className="space-y-2">
              <Label>{t("base_url")}</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrlOverride(e.target.value)}
                placeholder={defaultBaseUrl}
              />
            </div>
            <div className="space-y-2">
              <Label>{isCluvi ? t("app_id") : "Consumer Key"}</Label>
              <Input value={appId} onChange={(e) => setAppId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isCluvi ? t("secret_key") : "Consumer Secret"}</Label>
              <Input value={secretKey} onChange={(e) => setSecretKey(e.target.value)} type="password" />
            </div>
            {isCluvi && (
              <div className="space-y-2">
                <Label>{t("store_id")}</Label>
                <Input value={storeId} onChange={(e) => setStoreIdOverride(e.target.value)} placeholder="34511" />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t("close")}
              </Button>
              <Button onClick={handleSave} disabled={!appId || !secretKey || createMutation.isPending}>
                {createMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                {t("save_integration")}
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Verify */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("test_connection")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{existingIntegration?.baseUrl}</p>
                    {isCluvi && (
                      <p className="text-xs text-muted-foreground">
                        Store ID:{" "}
                        {existingIntegration?.settingsJson ? JSON.parse(existingIntegration.settingsJson).storeId : "—"}
                      </p>
                    )}
                  </div>
                  <Button onClick={handleTestConnection} disabled={testMutation.isPending || !existingIntegration}>
                    {testMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                    {testMutation.isPending ? t("testing_connection") : t("test_connection")}
                  </Button>
                </div>
                {testResult && (
                  <div
                    className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                      testResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {testResult.message}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* URL de pedidos (webhook) + estado de la tienda */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4" />
                  {t("webhook_url_title")}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t("webhook_url_desc")}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Estado de la tienda: activa / inactiva / sin verificar */}
                {storeStatus === "on" ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    {t("store_active")}
                  </div>
                ) : storeStatus !== null ? (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    <XCircle className="h-4 w-4 shrink-0" />
                    {t("store_inactive")}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {testMutation.isPending && <Spinner className="h-4 w-4" />}
                      {testMutation.isPending ? t("checking_store") : t("store_status_unknown")}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleTestConnection}
                      disabled={testMutation.isPending || !existingIntegration}
                    >
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                      {t("check_status")}
                    </Button>
                  </div>
                )}

                {/* Webhook de nuevas órdenes */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("new_order_url")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={webhookUrl ?? ""}
                      placeholder={t("webhook_url_placeholder")}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={!webhookUrl}
                      onClick={() => webhookUrl && copyText(webhookUrl, "webhook_copied")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Ping / health check */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("ping_url")}</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={pingUrl} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyText(pingUrl, "ping_copied")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleActivateStore}
                  disabled={activateMutation.isPending || !existingIntegration}
                  className="w-full"
                >
                  {activateMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                  {activateMutation.isPending ? t("setting_url") : t("set_webhook_url")}
                </Button>
                <p className="text-[11px] leading-4 text-muted-foreground">{t("webhook_url_hint")}</p>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStepOverride(0)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("config_step_credentials")}
              </Button>
              <Button onClick={() => setStepOverride(2)}>
                {t("config_step_menu")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Sync Menu (Cluvi only) */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{isCluvi ? t("sync_menu") : "Sincronización"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCluvi ? (
                  <>
                    <p className="text-sm text-muted-foreground">{t("sync_menu_desc")}</p>
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground">
                        Los artículos publicados de la sucursal se sincronizarán como productos del menú en Cluvi.
                      </p>
                    </div>
                    <Button onClick={handleSyncMenu} disabled={syncMenuMutation.isPending} className="w-full">
                      {syncMenuMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                      {syncMenuMutation.isPending ? t("syncing") : t("confirm_sync")}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      La integración con WooCommerce está configurada. Las órdenes se sincronizarán automáticamente.
                    </p>
                    <Button onClick={() => handleOpenChange(false)} className="w-full">
                      {t("close")}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStepOverride(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("config_step_verify")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
