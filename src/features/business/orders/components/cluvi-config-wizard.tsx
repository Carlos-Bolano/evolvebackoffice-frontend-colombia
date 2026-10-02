import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/i18n/use-i18n"
import { useNotify } from "@/hooks/use-notify"
import Spinner from "@/components/Spinner"
import {
  useBranchIntegrations,
  useCreateIntegration,
  useUpdateIntegration,
  useTestConnection,
  useSyncMenu,
} from "../hooks/use-orders"
import { CheckCircle, XCircle, ArrowRight, ArrowLeft } from "lucide-react"

interface CluviConfigWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
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

export function CluviConfigWizard({ open, onOpenChange, branchId }: CluviConfigWizardProps) {
  const { t } = useTranslation("business-orders")
  const notify = useNotify()

  const [stepOverride, setStepOverride] = useState<number | null>(null)
  const [baseUrl, setBaseUrl] = useState("https://api.cluviplatform.click")
  const [appId, setAppId] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [storeIdOverride, setStoreIdOverride] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const { data: integrations } = useBranchIntegrations(branchId)
  // Sin filtrar por isActive: una integración desactivada ya existe en el
  // backend (índice único sucursal+plataforma) y hay que editarla, no crear otra.
  const existingIntegration = integrations?.find((i) => i.platformCode === "CLUVI")

  const createMutation = useCreateIntegration()
  const updateMutation = useUpdateIntegration()
  const testMutation = useTestConnection()
  const syncMenuMutation = useSyncMenu()

  // Valores derivados en render (sin useEffect): si el usuario no los cambió,
  // siguen a la integración existente —incluso si carga después de abrir—.
  const step = stepOverride ?? (existingIntegration ? 1 : 0)
  const storeId = storeIdOverride ?? readStoreId(existingIntegration?.settingsJson)

  /** Al cerrar se limpian los overrides para que la próxima apertura arranque de cero. */
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStepOverride(null)
      setStoreIdOverride(null)
    }
    onOpenChange(next)
  }

  const steps = [t("config_step_credentials"), t("config_step_verify"), t("config_step_menu")]

  const handleTestConnection = () => {
    if (!branchId || !existingIntegration) return
    setTestResult(null)
    testMutation.mutate(
      { branchId, integrationId: existingIntegration.id },
      {
        onSuccess: (result) => setTestResult(result),
        onError: () => setTestResult({ success: false, message: t("connection_failed") }),
      }
    )
  }

  const handleSave = () => {
    if (!branchId) return
    const settingsJson = JSON.stringify({ storeId })

    const onSuccess = () => {
      notify.success(t("save_integration"))
      setStepOverride(1)
    }
    const onError = () => notify.error(t("connection_failed"))

    if (existingIntegration) {
      // Ya existe: se actualiza (crear otra viola el índice único y da 500).
      updateMutation.mutate(
        {
          branchId,
          integrationId: existingIntegration.id,
          dto: {
            isActive: true,
            baseUrl,
            setNewApiKey: true,
            apiKey: appId, // app_id se guarda en ApiKey
            setNewApiSecret: true,
            apiSecret: secretKey, // secret_key se guarda en ApiSecret
            setNewConsumerKey: false,
            setNewConsumerSecret: false,
            settingsJson,
          },
        },
        { onSuccess, onError }
      )
      return
    }

    createMutation.mutate(
      {
        branchId,
        dto: {
          platformCode: "CLUVI",
          isActive: true,
          baseUrl,
          apiKey: appId, // app_id se guarda en ApiKey
          apiSecret: secretKey, // secret_key se guarda en ApiSecret
          settingsJson,
        },
      },
      { onSuccess, onError }
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("config_title")}</DialogTitle>
          {existingIntegration && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Integración activa — Store ID:{" "}
              {existingIntegration.settingsJson ? JSON.parse(existingIntegration.settingsJson).storeId : "—"}
            </div>
          )}
        </DialogHeader>

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
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("app_id")}</Label>
              <Input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="6c938e23-ca09-4f05-a6de-114ac444cba9"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("secret_key")}</Label>
              <Input
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="23638c58-0905-4df7-9281-03193c0a2a13"
                type="password"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("store_id")}</Label>
              <Input
                value={storeId}
                onChange={(e) => setStoreIdOverride(e.target.value)}
                placeholder={t("store_id_placeholder")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t("close")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!appId || !secretKey || !storeId || createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && <Spinner className="mr-2 h-4 w-4" />}
                {t("save_integration")}
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Verify Connection */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("test_connection")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Store ID:{" "}
                      {existingIntegration?.settingsJson ? JSON.parse(existingIntegration.settingsJson).storeId : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{existingIntegration?.baseUrl}</p>
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

        {/* Step 2: Sync Menu */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("sync_menu")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("sync_menu_desc")}</p>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t("menu_preview")}</p>
                  <p className="text-sm text-muted-foreground">
                    Los artículos publicados de la sucursal se sincronizarán como productos del menú en Cluvi. Los
                    departamentos se convertirán en categorías.
                  </p>
                </div>
                <Button onClick={handleSyncMenu} disabled={syncMenuMutation.isPending} className="w-full">
                  {syncMenuMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                  {syncMenuMutation.isPending ? t("syncing") : t("confirm_sync")}
                </Button>
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
