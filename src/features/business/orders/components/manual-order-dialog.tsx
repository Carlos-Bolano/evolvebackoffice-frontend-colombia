import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { quoteDelivery } from "../services/delivery-enhancements.service"
import { DeliveryMap } from "./delivery-map"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getBranchItemByItemPublicId } from "@/features/business/items/catalog/services/branch-items.service"
import type { BranchItemResponseDto } from "@/features/business/items/catalog/types"
import { useManualOrderDraft, type OrderLine } from "../hooks/use-manual-order-draft"
import { OrderProductPicker } from "./order-product-picker"
import { OrderCustomerLookup } from "./order-customer-lookup"
import { useCreateManualOrder } from "../hooks/use-orders"
import { ORDER_ORIGIN_LABEL_KEY } from "../types"
import type { CreateManualOrderDto } from "../types/api"
import { notify } from "@/hooks/use-notify"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { useTranslation } from "@/i18n/use-i18n"

interface ManualOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sucursal seleccionada en la página de órdenes (obligatoria). */
  branchId: string | null
}

/** Orígenes manuales ofrecidos en el formulario (miembros del enum OrderOrigin). */
const MANUAL_ORIGINS = ["WhatsApp", "Facebook", "Call", "Others"] as const

function apiErrorMessage(error: unknown): string | null {
  const e = error as {
    response?: { data?: { message?: string; title?: string } }
  }
  return e?.response?.data?.message ?? e?.response?.data?.title ?? null
}

/**
 * Formulario de creación manual de órdenes (venta de caja o domicilio),
 * enlazado desde la cabecera de Órdenes. Usa los productos activos de la
 * sucursal seleccionada con su precio de sucursal (editable por línea).
 *
 * No envía `tax`: en Colombia el backend cobra el precio rotulado (IVA
 * incluido) y declara el IVA extraído; en otros países agrega la tasa
 * configurada del tenant.
 */
export function ManualOrderDialog({ open, onOpenChange, branchId }: ManualOrderDialogProps) {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const createOrder = useCreateManualOrder()
  const { draft, update, discard, recovered, dirty } = useManualOrderDraft(branchId)
  const {
    lines,
    paymentMethod,
    status,
    origin,
    notes,
    fulfillment,
    street,
    city,
    shippingCost,
    customerName,
    customerPhone,
    latitude,
    longitude,
    automaticShipping,
    customerId,
    personId,
  } = draft
  const setLines = (value: Parameters<typeof update<"lines">>[1]) => update("lines", value)
  const setPaymentMethod = (value: string) => update("paymentMethod", value)
  const setStatus = (value: string) => update("status", value)
  const setOrigin = (value: string) => update("origin", value)
  const setNotes = (value: string) => update("notes", value)
  const setFulfillment = (value: "pickup" | "delivery") => update("fulfillment", value)
  const setStreet = (value: string) => update("street", value)
  const setCity = (value: string) => update("city", value)
  const setShippingCost = (value: string) => update("shippingCost", value)
  const setCustomerName = (value: string) => {
    update("customerName", value)
    update("customerId", null)
    update("personId", null)
  }
  const setCustomerPhone = (value: string) => {
    update("customerPhone", value)
    update("customerId", null)
    update("personId", null)
  }
  const setLatitude = (value: string) => update("latitude", value)
  const setLongitude = (value: string) => update("longitude", value)
  const setAutomaticShipping = (value: boolean) => update("automaticShipping", value)
  const isDelivery = fulfillment === "delivery"
  const lineIds = lines
    .map((line) => line.itemPublicId)
    .sort()
    .join(",")
  const validation = useQuery({
    queryKey: ["order-draft-products", branchId, lineIds, open],
    queryFn: () =>
      Promise.all(
        lineIds
          .split(",")
          .filter(Boolean)
          .map((id) => getBranchItemByItemPublicId(branchId!, id))
      ),
    enabled: open && !!branchId && !!lineIds,
    retry: false,
    staleTime: 0,
  })
  const invalidProducts = !!lines.length && (validation.isError || validation.data?.some((item) => item.inactive))
  const changedPrices = validation.data?.some((item) =>
    lines.some((line) => line.itemPublicId === item.itemPublicId && line.basePrice !== item.price)
  )
  const pick = useCallback(
    (lat: number, lon: number) => {
      update("latitude", String(lat))
      update("longitude", String(lon))
    },
    [update]
  )
  const coordinatesValid =
    !!latitude &&
    !!longitude &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180
  const quote = useQuery({
    queryKey: ["delivery-quote", branchId, latitude, longitude],
    queryFn: ({ signal }) => quoteDelivery(branchId!, Number(latitude), Number(longitude), signal),
    enabled: open && isDelivery && !!branchId && automaticShipping && coordinatesValid,
    retry: false,
    staleTime: 0,
  })

  const addLine = (item: BranchItemResponseDto) => {
    const itemPublicId = item.itemPublicId
    setLines((current) => {
      const existing = current.find((l) => l.itemPublicId === itemPublicId)
      if (existing) {
        return current.map((l) => (l.itemPublicId === itemPublicId ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [
        ...current,
        {
          key: `${itemPublicId}-${Date.now()}`,
          itemPublicId,
          name: item.itemName ?? itemPublicId,
          sku: item.itemSku,
          basePrice: item.price,
          price: item.price,
          quantity: 1,
        },
      ]
    })
  }

  const updateLine = (key: string, patch: Partial<OrderLine>) => {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const removeLine = (key: string) => {
    setLines((current) => current.filter((l) => l.key !== key))
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
  const shipping = !isDelivery
    ? 0
    : automaticShipping
      ? (quote.data?.shippingCost ?? 0)
      : Number(shippingCost) > 0
        ? Number(shippingCost)
        : 0
  const total = subtotal + shipping

  const canSubmit =
    lines.length > 0 &&
    !!validation.data &&
    !validation.isFetching &&
    !invalidProducts &&
    !changedPrices &&
    lines.every((line) => validation.data.some((item) => item.itemPublicId === line.itemPublicId && !item.inactive)) &&
    lines.every((l) => l.quantity >= 1 && l.price >= 0) &&
    !createOrder.isPending &&
    (!isDelivery ||
      (!!street.trim() &&
        (!automaticShipping || (!!quote.data && !quote.isFetching && coordinatesValid)) &&
        ((!latitude && !longitude) || coordinatesValid))) &&
    (!customerPhone.trim() || !!customerName.trim())

  const handleSubmit = () => {
    if (!branchId || !canSubmit) return

    const payload: CreateManualOrderDto = {
      branchId,
      customerId,
      personId,
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      automaticShipping: isDelivery && automaticShipping,
      paymentMethod,
      status,
      origin: origin || null,
      notes: notes.trim() ? notes.trim() : null,
      shippingStreet: isDelivery && street.trim() ? street.trim() : null,
      shippingCity: isDelivery && city.trim() ? city.trim() : null,
      shippingState: null,
      shippingZipCode: null,
      shippingLatitude: isDelivery && latitude ? Number(latitude) : null,
      shippingLongitude: isDelivery && longitude ? Number(longitude) : null,
      shippingNotes: null,
      tax: null,
      discount: null,
      shippingCost: shipping > 0 ? shipping : null,
      items: lines.map((l) => ({
        itemPublicId: l.itemPublicId,
        quantity: l.quantity,
        unitPriceOverride: l.price !== l.basePrice ? l.price : null,
        tax: null,
        discount: null,
        modifiersJson: null,
        notes: null,
      })),
    }

    createOrder.mutate(payload, {
      onSuccess: () => {
        discard(draft)
        notify.success(t("order_created"))
        onOpenChange(false)
      },
      onError: (error) => {
        notify.error(apiErrorMessage(error) ?? t("order_create_error"))
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 p-4 pr-12">
          <DialogTitle>{t("create_order")}</DialogTitle>
          <DialogDescription>{t("manual_order_desc")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <fieldset className="flex flex-wrap gap-3 rounded-xl border p-3">
            <legend className="px-1 text-sm font-medium">{t("order_fulfillment")}</legend>
            {(["pickup", "delivery"] as const).map((value) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3">
                <input
                  type="radio"
                  className="size-4 shrink-0 appearance-auto accent-primary"
                  name="order-fulfillment"
                  value={value}
                  checked={fulfillment === value}
                  onChange={() => setFulfillment(value)}
                />
                {t(value === "pickup" ? "fulfillment_pickup" : "fulfillment_delivery")}
              </label>
            ))}
          </fieldset>

          {dirty && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <p>{t(recovered ? "order_draft_recovered" : "order_draft_saved")}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (window.confirm(t("order_draft_discard_confirm"))) discard()
                }}
              >
                {t("order_draft_discard")}
              </Button>
            </div>
          )}
          {branchId && <OrderProductPicker key={branchId} branchId={branchId} onAdd={addLine} />}
          {invalidProducts && <p role="alert">{t("order_draft_invalid_products")}</p>}
          {validation.isError && (
            <Button type="button" variant="outline" onClick={() => void validation.refetch()}>
              {t("refresh")}
            </Button>
          )}
          {changedPrices && (
            <div role="alert">
              <p>{t("order_draft_prices_changed")}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setLines((old) =>
                    old.map((line) => {
                      const item = validation.data?.find((i) => i.itemPublicId === line.itemPublicId)
                      return item
                        ? {
                            ...line,
                            name: item.itemName ?? line.name,
                            basePrice: item.price,
                            price: line.price === line.basePrice ? item.price : line.price,
                          }
                        : line
                    })
                  )
                }
              >
                {t("order_draft_update_prices")}
              </Button>
            </div>
          )}

          {/* Líneas de la orden */}
          {lines.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("items")}</TableHead>
                    <TableHead className="w-28">{t("unit_price")}</TableHead>
                    <TableHead className="w-24">{t("quantity")}</TableHead>
                    <TableHead className="w-32 text-right">{t("line_amount")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.key}>
                      <TableCell className="font-medium">
                        {line.name}
                        {line.sku ? <span className="ml-1 text-xs text-muted-foreground">({line.sku})</span> : null}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          className="h-8"
                          aria-label={`${t("unit_price")}: ${line.name}`}
                          value={line.price}
                          onChange={(e) =>
                            updateLine(line.key, {
                              price: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          step="1"
                          inputMode="numeric"
                          className="h-8"
                          aria-label={`${t("quantity")}: ${line.name}`}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.key, {
                              quantity: e.target.value === "" ? 1 : Math.max(1, Math.floor(Number(e.target.value))),
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(line.price * line.quantity)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          aria-label={t("remove_line")}
                          onClick={() => removeLine(line.key)}
                        >
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {/* Datos de la venta */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t("payment_method")}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{t("pay_cash")}</SelectItem>
                  <SelectItem value="CARD">{t("pay_card")}</SelectItem>
                  <SelectItem value="TRANSFER">{t("pay_transfer")}</SelectItem>
                  <SelectItem value="MIXED">{t("pay_mixed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("initial_status")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Confirmed">{t("confirmed")}</SelectItem>
                  <SelectItem value="Pending">{t("pending")}</SelectItem>
                  <SelectItem value="NeedsReview">{t("st_review")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Origen controlado (enum OrderOrigin) — para filtrar reportes junto
              con Cluvi/WooCommerce (que se marcan automáticamente). */}
            <div className="space-y-1.5">
              <Label>{t("origin")}</Label>
              <Select value={origin || "none"} onValueChange={(v) => setOrigin(v === "none" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("origin_none")}</SelectItem>
                  {MANUAL_ORIGINS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {t(ORDER_ORIGIN_LABEL_KEY[o])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <section aria-label={t("customer")} className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                {t("customer_name")}
                <Input
                  aria-label={t("customer_name")}
                  value={customerName}
                  maxLength={200}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </label>
              <label className="space-y-1">
                {t("phone")}
                <Input
                  aria-label={t("phone")}
                  value={customerPhone}
                  maxLength={30}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </label>
            </div>
            <OrderCustomerLookup
              phone={customerPhone}
              selectedId={customerId}
              onOccasional={() => {
                update("customerId", null)
                update("personId", null)
              }}
              onSelect={(customer) => {
                update("customerId", customer.id)
                update("personId", customer.personPublicId)
                update("customerName", [customer.firstName, customer.lastName].filter(Boolean).join(" "))
                update("customerPhone", customer.phoneNumber ?? "")
                update("street", customer.address ?? "")
                update("city", customer.city ?? "")
              }}
            />
          </section>
          {isDelivery && (
            <section className="space-y-3 rounded-xl border p-3" aria-label={t("fulfillment_delivery")}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t("address")}</Label>
                  <Input
                    aria-label={t("address")}
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    maxLength={300}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-order-city">{t("shipping_city")}</Label>
                  <Input
                    id="manual-order-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={150}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-order-shipping">{t("shipping_cost")}</Label>
                  <Input
                    id="manual-order-shipping"
                    disabled={automaticShipping}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                  />
                </div>
              </div>
              <details className="rounded-lg border p-3">
                <summary className="min-h-11 cursor-pointer text-sm font-medium">{t("choose_location")}</summary>
                <DeliveryMap onPick={pick} />
                <p className="py-2 text-xs text-muted-foreground">{t("e_map_pick_hint")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    {t("e_zone_latitude")}
                    <Input
                      aria-label={t("e_zone_latitude")}
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                    />
                  </label>
                  <label>
                    {t("e_zone_longitude")}
                    <Input
                      aria-label={t("e_zone_longitude")}
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                    />
                  </label>
                </div>
              </details>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={automaticShipping}
                  onChange={(e) => setAutomaticShipping(e.target.checked)}
                />
                {t("e_automatic_shipping")}
              </label>
              {automaticShipping && (
                <>
                  {quote.isFetching && <p>{t("loading")}</p>}
                  {quote.error && <p role="alert">{apiErrorMessage(quote.error)}</p>}
                  {quote.data && coordinatesValid && (
                    <p>
                      {t("e_quoted_zone", {
                        zone: quote.data.zoneName,
                        amount: formatCurrency(quote.data.shippingCost),
                      })}
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="manual-order-notes">{t("notes")}</Label>
            <Textarea
              id="manual-order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={2}
            />
          </div>
        </div>
        <div className="shrink-0 border-t bg-background p-4">
          <div className="mb-3 flex items-center justify-between gap-3 font-semibold" aria-live="polite">
            <span>{t("total")}</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("close")}
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              <Plus className="mr-2 size-4" />
              {createOrder.isPending ? t("saving") : t("create_order")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
