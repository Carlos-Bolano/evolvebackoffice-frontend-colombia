import { useCallback, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Calculator, Sparkles, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { notify } from "@/hooks/use-notify"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { useTranslation } from "@/i18n/use-i18n"
import { deleteDeliveryZone, quoteDelivery, saveDeliveryZone } from "../services/delivery-enhancements.service"
import type { DeliveryQuote, DeliveryZone } from "../types/enhancements"
import { getApiErrorMessage } from "../utils/order-helpers"
import { DeliveryMap, type MapPoint } from "./delivery-map"

/** Anillos sugeridos (km). A igual prioridad gana el radio menor, así cada anillo cobra su tarifa. */
const SUGGESTED_RINGS_KM = [2, 4, 6] as const
const MIN_RADIUS_KM = 0.5
const MAX_RADIUS_KM = 15

interface ZoneForm {
  name: string
  center: MapPoint | null
  radiusKm: number
  shippingCost: string
  priority: string
}

const emptyForm = (center: MapPoint | null): ZoneForm => ({
  name: "",
  center,
  radiusKm: 2,
  shippingCost: "",
  priority: "0",
})

interface Props {
  branchId: string
  zones: DeliveryZone[]
  /** Ubicación de la sucursal; centro por defecto de las zonas nuevas. */
  store: MapPoint | null
}

/**
 * Zonas de domicilio sobre el mapa: el centro sale de la ubicación de la
 * sucursal, el radio se ajusta en km y se ve el círculo en vivo. Incluye
 * zonas sugeridas en un clic y un modo para probar la tarifa de un punto.
 */
export function DeliveryZonesEditor({ branchId, zones, store }: Props) {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const qc = useQueryClient()

  const [form, setForm] = useState<ZoneForm>(() => emptyForm(store))
  const [editing, setEditing] = useState<DeliveryZone | null>(null)
  const [deleting, setDeleting] = useState<DeliveryZone | null>(null)
  const [testMode, setTestMode] = useState(false)
  const [probe, setProbe] = useState<MapPoint | null>(null)
  const [quote, setQuote] = useState<{ result: DeliveryQuote | null; error: string | null } | null>(null)
  const [suggestedPrices, setSuggestedPrices] = useState<string[]>(SUGGESTED_RINGS_KM.map(() => ""))

  const center = form.center ?? store
  const previewZone = useMemo(
    () =>
      center && !testMode
        ? {
            latitude: center.latitude,
            longitude: center.longitude,
            radiusMeters: form.radiusKm * 1000,
            name: form.name,
          }
        : null,
    [center, form.radiusKm, form.name, testMode]
  )

  const invalidate = () => qc.invalidateQueries({ queryKey: ["delivery-zones"] })

  const save = useMutation({
    mutationFn: (zone: { data: Omit<DeliveryZone, "id">; id?: string }) => saveDeliveryZone(zone.data, zone.id),
    onSuccess: async () => {
      setEditing(null)
      setForm(emptyForm(store))
      await invalidate()
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const createSuggested = useMutation({
    mutationFn: async () => {
      if (!store) return
      // Secuencial: el backend valida cada zona y así un error no deja zonas a medias sin aviso.
      for (const [index, km] of SUGGESTED_RINGS_KM.entries()) {
        const from = index === 0 ? 0 : SUGGESTED_RINGS_KM[index - 1]
        await saveDeliveryZone({
          branchId,
          name: t("zones_suggested_name", { from, to: km }),
          latitude: store.latitude,
          longitude: store.longitude,
          radiusMeters: km * 1000,
          shippingCost: Number(suggestedPrices[index]),
          priority: 0,
          isActive: true,
        })
      }
    },
    onSuccess: async () => {
      notify.success(t("zones_suggested_created"))
      await invalidate()
    },
    onError: async (err) => {
      notify.error(getApiErrorMessage(err, t("status_update_failed")))
      await invalidate()
    },
  })

  const removeZone = useMutation({
    mutationFn: (id: string) => deleteDeliveryZone(id),
    onSuccess: async () => {
      setDeleting(null)
      // La cotización mostrada podía referirse a la zona borrada.
      setQuote(null)
      setProbe(null)
      notify.success(t("zone_deleted_ok"))
      await invalidate()
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const pick = useCallback(
    (latitude: number, longitude: number) => {
      if (testMode) {
        setProbe({ latitude, longitude })
        quoteDelivery(branchId, latitude, longitude)
          .then((result) => setQuote({ result, error: null }))
          .catch((err: unknown) => setQuote({ result: null, error: getApiErrorMessage(err, t("quote_no_coverage")) }))
        return
      }
      setForm((f) => ({ ...f, center: { latitude, longitude } }))
    },
    [testMode, branchId, t]
  )

  const submit = () => {
    if (!center) return
    save.mutate({
      id: editing?.id,
      data: {
        branchId,
        name: form.name.trim(),
        latitude: center.latitude,
        longitude: center.longitude,
        radiusMeters: Math.round(form.radiusKm * 1000),
        shippingCost: Number(form.shippingCost),
        priority: Number(form.priority) || 0,
        isActive: editing?.isActive ?? true,
      },
    })
  }

  const canSubmit = Boolean(center) && form.name.trim() !== "" && form.shippingCost !== "" && !save.isPending
  const suggestedValid = suggestedPrices.every((p) => p !== "" && Number(p) >= 0)

  return (
    <Card id="zones" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>{t("zone_configuration")}</CardTitle>
        <CardDescription>{t("zones_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!store && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("zones_need_location")}</p>}

        {zones.length === 0 && store && (
          <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" />
              {t("zones_suggested_title")}
            </p>
            <p className="text-xs text-muted-foreground">{t("zones_suggested_desc")}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {SUGGESTED_RINGS_KM.map((km, index) => (
                <label key={km} className="space-y-1 text-sm">
                  {t("zones_suggested_name", { from: index === 0 ? 0 : SUGGESTED_RINGS_KM[index - 1], to: km })}
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    placeholder={t("e_zone_shippingCost")}
                    value={suggestedPrices[index]}
                    onChange={(e) =>
                      setSuggestedPrices((prices) => prices.map((p, i) => (i === index ? e.target.value : p)))
                    }
                  />
                </label>
              ))}
            </div>
            <Button disabled={!suggestedValid || createSuggested.isPending} onClick={() => createSuggested.mutate()}>
              {t("zones_suggested_create")}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Switch id="zone-test-mode" checked={testMode} onCheckedChange={setTestMode} />
          <label htmlFor="zone-test-mode" className="flex items-center gap-1.5">
            <Calculator className="size-4 text-primary" />
            {t("zones_test_mode")}
          </label>
          {testMode && quote?.result && (
            <span className="font-semibold text-emerald-600">
              {t("e_quoted_zone", { zone: quote.result.zoneName, amount: formatCurrency(quote.result.shippingCost) })}
            </span>
          )}
          {testMode && quote?.error && <span className="font-medium text-amber-600">{quote.error}</span>}
        </div>

        <DeliveryMap
          zones={zones}
          previewZone={previewZone}
          store={store}
          probe={testMode ? probe : null}
          onPick={pick}
          pickHint={t(testMode ? "zones_test_hint" : "zones_pick_hint")}
        />

        {!testMode && (
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSubmit) submit()
            }}
          >
            <label className="space-y-1 text-sm">
              {t("e_zone_name")}
              <Input
                required
                maxLength={100}
                placeholder={t("zones_name_placeholder")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm lg:col-span-2">
              {t("zones_radius_km", { km: form.radiusKm.toFixed(1) })}
              <input
                type="range"
                min={MIN_RADIUS_KM}
                max={MAX_RADIUS_KM}
                step={0.5}
                value={form.radiusKm}
                aria-valuetext={`${form.radiusKm} km`}
                onChange={(e) => setForm((f) => ({ ...f, radiusKm: Number(e.target.value) }))}
                className="h-11 w-full accent-primary"
              />
            </label>
            <label className="space-y-1 text-sm">
              {t("e_zone_shippingCost")}
              <Input
                required
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={form.shippingCost}
                onChange={(e) => setForm((f) => ({ ...f, shippingCost: e.target.value }))}
              />
            </label>
            <details className="text-sm sm:col-span-2 lg:col-span-4">
              <summary className="cursor-pointer text-muted-foreground">{t("zones_advanced")}</summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  {t("e_zone_priority")}
                  <Input
                    type="number"
                    step="1"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  />
                </label>
                <p className="text-xs text-muted-foreground sm:col-span-2">{t("e_zone_help")}</p>
              </div>
            </details>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={!canSubmit}>
                {t(editing ? "save" : "e_add_zone")}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null)
                    setForm(emptyForm(store))
                  }}
                >
                  {t("cancel")}
                </Button>
              )}
              {!center && <span className="self-center text-xs text-amber-700">{t("zones_pick_center")}</span>}
            </div>
          </form>
        )}

        <div className="space-y-2">
          {zones.map((z) => (
            <div key={z.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{z.name}</span> · {formatCurrency(z.shippingCost)} ·{" "}
                {(z.radiusMeters / 1000).toFixed(1)} km · {t(z.isActive ? "active" : "inactive")}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  setTestMode(false)
                  setEditing(z)
                  setForm({
                    name: z.name,
                    center: { latitude: z.latitude, longitude: z.longitude },
                    radiusKm: Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, z.radiusMeters / 1000)),
                    shippingCost: String(z.shippingCost),
                    priority: String(z.priority),
                  })
                }}
              >
                {t("e_edit_zone")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={save.isPending}
                onClick={() => save.mutate({ id: z.id, data: { ...z, isActive: !z.isActive } })}
              >
                {t(z.isActive ? "e_disable_zone" : "e_enable_zone")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={removeZone.isPending}
                onClick={() => setDeleting(z)}
              >
                <Trash2 className="mr-1 size-3.5" />
                {t("zone_delete")}
              </Button>
            </div>
          ))}
        </div>

        <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("zone_delete_confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleting ? t("zone_delete_confirm_desc", { name: deleting.name }) : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={removeZone.isPending}
                onClick={() => deleting && removeZone.mutate(deleting.id)}
              >
                {t("zone_delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
