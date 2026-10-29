import { useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { Bike, MessageCircle, Plug } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useBranches } from "@/features/business/branches/hooks/use-branches"
import { useTenantPlatformModules } from "@/features/business/branches/hooks/use-branch-modules"
import { useTenantCountry } from "@/hooks/use-tenant-country"
import { useTranslation } from "@/i18n/use-i18n"
import { BranchLocationPicker } from "../components/branch-location-picker"
import { DeliverySetupChecklist } from "../components/delivery-setup-checklist"
import { DeliveryZonesEditor } from "../components/delivery-zones-editor"
import { OrdersSubnav } from "../components/orders-subnav"
import { useCanManageDeliveries } from "../hooks/use-delivery-operations"
import { useDeliverySetup } from "../hooks/use-delivery-setup"

const BRANCH_STORAGE_KEY = "business.orders.branchId"

/**
 * Configuración de domicilios de una sucursal en un solo lugar: lista de
 * pasos con su estado, ubicación de la tienda, zonas sobre el mapa y accesos
 * a domiciliarios, WhatsApp e integraciones.
 */
export function DeliverySetupPage() {
  const { t } = useTranslation("business-orders")
  const canManage = useCanManageDeliveries()
  const country = useTenantCountry()
  const { hasCluvi, hasWooCommerce } = useTenantPlatformModules()
  const { data: branches } = useBranches(1, 100)
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem(BRANCH_STORAGE_KEY) ?? ""
    } catch {
      return ""
    }
  })
  const branchId = branches?.data.some((b) => b.id === selected) ? selected : (branches?.data[0]?.id ?? "")
  const setup = useDeliverySetup(branchId || null)
  // Objeto estable: el mapa se reconstruye cuando cambia su referencia.
  const storeLatitude = setup.branch?.latitude ?? null
  const storeLongitude = setup.branch?.longitude ?? null
  const store = useMemo(
    () =>
      storeLatitude != null && storeLongitude != null ? { latitude: storeLatitude, longitude: storeLongitude } : null,
    [storeLatitude, storeLongitude]
  )

  const goToAnchor = (anchor: string) =>
    document.querySelector(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" })

  // Deep-link (#location / #zones) desde Rutas o el aviso de Domicilios.
  const { hash } = useLocation()
  const ready = Boolean(setup.branch) && !setup.isLoading
  useEffect(() => {
    if (ready && hash) document.querySelector(hash)?.scrollIntoView({ block: "start" })
  }, [ready, hash])

  if (!canManage) return <p role="alert">{t("phase2_manager_only")}</p>

  return (
    <main className="min-w-0 space-y-5">
      <OrdersSubnav />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("setup_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("setup_subtitle")}</p>
        </div>
        <label className="block w-full max-w-xs space-y-1 text-sm">
          {t("branch")}
          <select
            className="h-11 w-full rounded-lg border bg-background px-3"
            aria-label={t("branch")}
            value={branchId}
            onChange={(e) => {
              setSelected(e.target.value)
              try {
                localStorage.setItem(BRANCH_STORAGE_KEY, e.target.value)
              } catch {
                // almacenamiento no disponible
              }
            }}
          >
            {!branches?.data.length && <option value="">{t("select_branch")}</option>}
            {branches?.data.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!branchId ? (
        <p>{t("select_branch")}</p>
      ) : setup.isLoading || !setup.branch ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
            <DeliverySetupChecklist steps={setup.steps} completed={setup.completed} onNavigateAnchor={goToAnchor} />
            {setup.readyToOperate && (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                {t("setup_ready")}
              </p>
            )}
          </div>
          <div className="min-w-0 space-y-5">
            <BranchLocationPicker key={branchId} branch={setup.branch} countryCode={country} />
            <DeliveryZonesEditor key={`zones-${branchId}`} branchId={branchId} zones={setup.zones} store={store} />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bike className="size-5 text-primary" />
                  {t("setup_couriers_title")}
                </CardTitle>
                <CardDescription>{t("setup_couriers_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to="/business/people/users">{t("setup_manage_couriers")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/business/orders/tracking">{t("tracking_title")}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="size-5 text-primary" />
                  {t("wa_configuration")}
                </CardTitle>
                <CardDescription>{t("setup_whatsapp_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link to={`/business/branches/${branchId}/config#whatsapp`}>{t("wa_configure_channel")}</Link>
                </Button>
              </CardContent>
            </Card>

            {(hasCluvi || hasWooCommerce) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plug className="size-5 text-primary" />
                    {t("setup_integrations_title")}
                  </CardTitle>
                  <CardDescription>{t("setup_integrations_desc")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {hasCluvi && (
                    <Button asChild variant="outline">
                      <Link to={`/business/branches/${branchId}/config?tab=cluvi`}>Cluvi</Link>
                    </Button>
                  )}
                  {hasWooCommerce && (
                    <Button asChild variant="outline">
                      <Link to={`/business/branches/${branchId}/config?tab=woocommerce`}>WooCommerce</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
