import { useOrderPresentation } from "../hooks/use-order-presentation"
import { shortOrderReference } from "../utils/order-presentation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/i18n/use-i18n"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { ORDER_STATUS_CONFIG, ORDER_ORIGIN_LABEL_KEY } from "../types"
import type { OrderListItem, OrderStatus } from "../types/api"
import { ArrowRight, Ban, Clock, Copy, CreditCard, FileText, MapPin, Phone, SquarePen, Tag, User } from "lucide-react"
import { notify } from "@/hooks/use-notify"
import { useOrderDetail } from "../hooks/use-orders"
import { OrderWhatsAppDialog } from "./order-whatsapp-dialog"
import { OrderTimeline } from "./order-timeline"
import { OrderTrackingLink } from "./order-tracking-link"
import { OrderSyncAction } from "./order-sync-action"

const NEXT_STATUS_MAP: Partial<Record<string, { next: OrderStatus; labelKey: string }>> = {
  Pending: { next: "Confirmed", labelKey: "next_confirm" },
  Confirmed: { next: "Preparing", labelKey: "next_prepare" },
  Preparing: { next: "Ready", labelKey: "next_ready" },
  Ready: { next: "Shipped", labelKey: "next_dispatch" },
  Shipped: { next: "Delivered", labelKey: "next_deliver" },
}

interface OrderDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: OrderListItem | null
  /** Abre el formulario de edición de detalles (notas/dirección/envío). */
  onEdit?: () => void
  onAdvanceStatus?: (order: OrderListItem, nextStatus: OrderStatus) => void
  onRequestCancel?: (order: OrderListItem) => void
}

export function OrderDetailDialog({
  open,
  onOpenChange,
  order,
  onEdit,
  onAdvanceStatus,
  onRequestCancel,
}: OrderDetailDialogProps) {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const { collectionLabel, paymentLabel, statusLabel } = useOrderPresentation()
  const { data: detail, isLoading, isError, refetch } = useOrderDetail(open ? (order?.id ?? "") : "")

  if (!order) return null

  const current = { ...order, ...detail }
  const statusConfig = ORDER_STATUS_CONFIG[current.statusCode]
  const nextStep = NEXT_STATUS_MAP[current.statusCode]
  const canCancel =
    current.statusCode !== "Delivered" && current.statusCode !== "Cancelled" && current.statusCode !== "Refunded"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {t("order_number")} #{shortOrderReference(current.externalOrderId, current.id)}
            </DialogTitle>
            <Badge tone={statusConfig?.color}>{statusLabel(current.statusCode)}</Badge>
          </div>
        </DialogHeader>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 justify-start text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(current.externalOrderId || current.id)
              notify.success(t("reference_copied"))
            } catch {
              notify.error(t("reference_copy_failed"))
            }
          }}
        >
          <Copy className="mr-2 size-4" />
          {t("copy_full_reference")}
        </Button>

        <div className="space-y-4">
          {isLoading && <p role="status">{t("loading")}</p>}
          {isError && (
            <div role="alert" className="space-y-2">
              <p>{t("order_detail_failed")}</p>
              <Button variant="outline" onClick={() => refetch()}>
                {t("refresh")}
              </Button>
            </div>
          )}
          {detail?.shippingStreet && (
            <OrderTrackingLink
              key={detail.id}
              order={{
                id: detail.id,
                branchId: detail.branchId,
                reference: shortOrderReference(detail.externalOrderId, detail.id),
                status: detail.statusCode,
                customerName: detail.personName ?? detail.customerName,
                customerPhone: detail.customerPhone ?? null,
              }}
            />
          )}
          {detail && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <User className="size-4" />
                {detail.personName ?? detail.customerName ?? "—"}
              </p>
              {detail.customerPhone && (
                <a href={`tel:${detail.customerPhone}`} className="flex items-center gap-2 text-sm">
                  <Phone className="size-4" />
                  {detail.customerPhone}
                </a>
              )}
              {detail.courierName && (
                <p className="text-sm">
                  {t("courier")}: {detail.courierName}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <OrderWhatsAppDialog
                  order={{
                    id: detail.id,
                    branchId: detail.branchId,
                    reference: shortOrderReference(detail.externalOrderId, detail.id),
                    status: detail.statusCode,
                    customerName: detail.personName ?? detail.customerName,
                    customerPhone: detail.customerPhone ?? null,
                    shippingStreet: detail.shippingStreet,
                    shippingCity: detail.shippingCity,
                    total: detail.total,
                    paymentConfirmed: detail.paymentConfirmed,
                    isReconciled: detail.isReconciled,
                  }}
                />
                <OrderWhatsAppDialog
                  order={{
                    id: detail.id,
                    branchId: detail.branchId,
                    reference: shortOrderReference(detail.externalOrderId, detail.id),
                    status: detail.statusCode,
                    customerName: detail.personName ?? detail.customerName,
                    customerPhone: detail.customerPhone ?? null,
                    shippingStreet: detail.shippingStreet,
                    shippingCity: detail.shippingCity,
                    total: detail.total,
                    paymentConfirmed: detail.paymentConfirmed,
                    isReconciled: detail.isReconciled,
                  }}
                  courierPhone={detail.courierPhone}
                  recipient="courier"
                />
              </div>
              {(detail.needsOutboundSync || detail.outboundSyncError) && detail.platformCode !== "POSCO" && (
                <div className="space-y-2">
                  <p role="alert" className="text-sm text-amber-600">
                    {detail.outboundSyncError ?? t("phase2_sync_pending")}
                  </p>
                  <OrderSyncAction orderId={detail.id} />
                </div>
              )}
              {detail.notes && <p className="text-sm whitespace-pre-wrap">{detail.notes}</p>}
              {detail.shippingNotes && <p className="text-sm whitespace-pre-wrap">{detail.shippingNotes}</p>}
            </div>
          )}
          {detail && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t("order_products")}</p>
              {detail.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3 border-b py-2 text-sm">
                  <span>
                    {item.quantity} × {item.name}
                  </span>
                  <span className="shrink-0 font-mono">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
          {/* Total */}
          <div className="rounded-lg bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground">{t("total")}</p>
            <p className="text-3xl font-bold">{formatCurrency(current.total)}</p>
            <p className="mt-2 font-semibold">{collectionLabel(current)}</p>
          </div>

          {/* Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("payment_method")}:</span>
              <span className="font-medium">{paymentLabel(current.paymentMethod)}</span>
            </div>

            {current.origin ? (
              <div className="flex items-center gap-3 text-sm">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t("origin")}:</span>
                <span className="font-medium">
                  {ORDER_ORIGIN_LABEL_KEY[current.origin] ? t(ORDER_ORIGIN_LABEL_KEY[current.origin]) : current.origin}
                </span>
              </div>
            ) : null}

            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("address")}:</span>
              <span className="font-medium">{current.shippingStreet ?? "—"}</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("created_at")}:</span>
              <span className="font-medium">{new Date(current.externalCreatedAt).toLocaleString("es-CO")}</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("status")}:</span>
              <span className="font-medium">{statusLabel(current.statusCode)}</span>
            </div>
          </div>

          <Separator />

          {/* Breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(current.subTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Envío</span>
              <span>{formatCurrency(current.shippingCost)}</span>
            </div>
            {!!current.tipAmount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("phase2_tip")}</span>
                <span>{formatCurrency(current.tipAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span>{current.discount > 0 ? `− ${formatCurrency(current.discount)}` : formatCurrency(0)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>{t("total")}</span>
              <span>{formatCurrency(current.total)}</span>
            </div>
          </div>

          {/* Editar detalles (notas, dirección, costo de envío) */}
          {onEdit && !["Cancelled", "Refunded"].includes(current.statusCode) ? (
            <Button type="button" variant="outline" className="w-full" onClick={onEdit}>
              <SquarePen className="mr-2 size-4" />
              {t("edit_order")}
            </Button>
          ) : null}

          {/* Sticky footer con transición rápida y cancelación */}
          {(nextStep || canCancel) && (onAdvanceStatus || onRequestCancel) && (
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-background pt-3">
              {canCancel && onRequestCancel && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    onOpenChange(false)
                    onRequestCancel(order)
                  }}
                >
                  <Ban className="mr-1.5 size-3.5" />
                  {t("cancel")}
                </Button>
              )}
              {nextStep && onAdvanceStatus && (
                <Button
                  type="button"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    onOpenChange(false)
                    onAdvanceStatus(order, nextStep.next)
                  }}
                >
                  {t(nextStep.labelKey)}
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              )}
            </div>
          )}
          {open && <OrderTimeline key={order.id} orderId={order.id} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
