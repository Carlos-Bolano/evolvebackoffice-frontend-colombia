import { useOrderPresentation } from "../hooks/use-order-presentation"
import { shortOrderReference } from "../utils/order-presentation"
import { NEXT_ORDER_STEP } from "../utils/order-status"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/i18n/use-i18n"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { ORDER_STATUS_CONFIG, ORDER_ORIGIN_LABEL_KEY } from "../types"
import type { OrderListItem, OrderStatus } from "../types/api"
import { ArrowRight, Ban, Clock, Copy, CreditCard, MapPin, Phone, SquarePen, Tag, User } from "lucide-react"
import { notify } from "@/hooks/use-notify"
import { useOrderDetail } from "../hooks/use-orders"
import { OrderWhatsAppDialog } from "./order-whatsapp-dialog"
import { OrderTimeline } from "./order-timeline"
import { OrderTrackingLink } from "./order-tracking-link"
import { OrderSyncAction } from "./order-sync-action"

interface OrderDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: OrderListItem | null
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
  const { formatCurrency, formatDateTime } = useLocaleFormat()
  const { collectionLabel, paymentLabel, statusLabel } = useOrderPresentation()
  const { data: detail, isLoading, isError, refetch } = useOrderDetail(open ? (order?.id ?? "") : "")
  if (!order) return null
  const current = { ...order, ...detail }
  const nextStep = NEXT_ORDER_STEP[current.statusCode]
  const canCancel = !["Delivered", "Cancelled", "Refunded"].includes(current.statusCode)
  const contact = {
    id: current.id,
    branchId: current.branchId,
    reference: shortOrderReference(current.externalOrderId, current.id),
    status: current.statusCode,
    customerName: detail?.personName ?? current.customerName ?? null,
    customerPhone: current.customerPhone ?? null,
    shippingStreet: current.shippingStreet,
    shippingCity: current.shippingCity,
    total: current.total,
    paymentConfirmed: current.paymentConfirmed,
    isReconciled: current.isReconciled,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[min(96vw,960px)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-16 sm:px-6 sm:pr-16">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="min-w-0 break-words">
              {t("order_number")} #{contact.reference}
            </DialogTitle>
            <Badge tone={ORDER_STATUS_CONFIG[current.statusCode]?.color}>{statusLabel(current.statusCode)}</Badge>
          </div>
          <DialogDescription>{t("order_detail_description")}</DialogDescription>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-8 w-fit justify-start gap-2 px-0 text-xs"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(current.externalOrderId || current.id)
                notify.success(t("reference_copied"))
              } catch {
                notify.error(t("reference_copy_failed"))
              }
            }}
          >
            <Copy className="size-3.5" />
            {t("copy_full_reference")}
          </Button>
        </DialogHeader>

        <div
          role="region"
          aria-label={t("order_detail_content")}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6"
        >
          {isLoading && <p role="status">{t("loading")}</p>}
          {isError && (
            <div role="alert" className="space-y-2 rounded-xl border border-destructive/40 p-3">
              <p>{t("order_detail_failed")}</p>
              <Button variant="outline" onClick={() => void refetch()}>
                {t("refresh")}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("total")}</p>
              <p className="text-3xl font-bold tabular-nums">{formatCurrency(current.total)}</p>
            </div>
            <Badge
              tone={canCancel && !current.paymentConfirmed && !current.isReconciled ? "warning" : "neutral"}
              className="max-w-full whitespace-normal"
            >
              {collectionLabel(current)}
            </Badge>
          </div>

          <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-5">
              <section className="space-y-3 rounded-2xl border p-4">
                <p className="flex items-start gap-2 font-semibold">
                  <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="break-words">{contact.customerName ?? "—"}</span>
                </p>
                {current.customerPhone && (
                  <a href={"tel:" + current.customerPhone} className="flex min-h-8 items-center gap-2 text-sm">
                    <Phone className="size-4 text-muted-foreground" />
                    {current.customerPhone}
                  </a>
                )}
                {detail && (
                  <div className="flex flex-wrap gap-2">
                    <OrderWhatsAppDialog order={contact} />
                    <OrderWhatsAppDialog order={contact} courierPhone={detail.courierPhone} recipient="courier" />
                  </div>
                )}
                {detail?.notes && <p className="text-sm break-words whitespace-pre-wrap">{detail.notes}</p>}
                {detail?.shippingNotes && (
                  <p className="text-sm break-words whitespace-pre-wrap">{detail.shippingNotes}</p>
                )}
              </section>

              {detail && (
                <section className="min-w-0 space-y-2 rounded-2xl border p-4">
                  <h3 className="text-sm font-semibold">{t("order_products")}</h3>
                  <div className="divide-y">
                    {detail.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                        <span className="min-w-0 break-words">
                          <span className="font-semibold">{item.quantity} × </span>
                          {item.name}
                        </span>
                        <span className="shrink-0 font-mono tabular-nums">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="min-w-0 space-y-5">
              <section className="space-y-4 rounded-2xl border p-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t("address")}</p>
                    <p className="font-medium break-words">
                      {[current.shippingStreet, current.shippingCity].filter(Boolean).join(", ") ||
                        t("fulfillment_pickup")}
                    </p>
                    {detail?.courierName && (
                      <p className="mt-1 text-xs">
                        {t("courier")}: {detail.courierName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t("payment_method")}</p>
                    <p className="font-medium">{paymentLabel(current.paymentMethod)}</p>
                  </div>
                </div>
                {current.origin && (
                  <div className="flex items-start gap-3">
                    <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("origin")}</p>
                      <p className="font-medium">
                        {ORDER_ORIGIN_LABEL_KEY[current.origin]
                          ? t(ORDER_ORIGIN_LABEL_KEY[current.origin])
                          : current.origin}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t("created_at")}</p>
                    <p className="font-medium">{formatDateTime(current.externalCreatedAt || current.createdAt)}</p>
                  </div>
                </div>
              </section>
              <section className="space-y-3 rounded-2xl border p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t("detail_subtotal")}</span>
                  <span className="tabular-nums">{formatCurrency(current.subTotal)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t("detail_shipping")}</span>
                  <span className="tabular-nums">{formatCurrency(current.shippingCost)}</span>
                </div>
                {!!current.tipAmount && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t("phase2_tip")}</span>
                    <span className="tabular-nums">{formatCurrency(current.tipAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t("detail_discount")}</span>
                  <span className="tabular-nums">
                    {current.discount > 0 ? "− " + formatCurrency(current.discount) : formatCurrency(0)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between gap-3 font-semibold">
                  <span>{t("total")}</span>
                  <span className="tabular-nums">{formatCurrency(current.total)}</span>
                </div>
              </section>
            </aside>
          </div>

          {detail && (detail.needsOutboundSync || detail.outboundSyncError) && detail.platformCode !== "POSCO" && (
            <div className="space-y-2 rounded-xl border border-amber-400/40 p-3">
              <p role="alert" className="text-sm text-amber-600">
                {detail.outboundSyncError ?? t("phase2_sync_pending")}
              </p>
              <OrderSyncAction orderId={detail.id} />
            </div>
          )}
          {detail?.shippingStreet && <OrderTrackingLink key={detail.id} order={contact} />}
          {open && <OrderTimeline key={order.id} orderId={order.id} />}
        </div>

        {(onEdit || onAdvanceStatus || onRequestCancel) && (
          <div
            role="group"
            aria-label={t("order_detail_actions")}
            className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-card px-5 py-3 sm:px-6"
          >
            {canCancel && onRequestCancel && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 text-destructive hover:text-destructive"
                disabled={isLoading || isError}
                onClick={() => {
                  onOpenChange(false)
                  onRequestCancel(current)
                }}
              >
                <Ban className="mr-1.5 size-4" />
                {t("cancel")}
              </Button>
            )}
            {onEdit && !["Cancelled", "Refunded"].includes(current.statusCode) && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={isLoading || isError}
                onClick={onEdit}
              >
                <SquarePen className="mr-1.5 size-4" />
                {t("edit_order")}
              </Button>
            )}
            {nextStep && onAdvanceStatus && (
              <Button
                type="button"
                className="ml-auto min-h-11 gap-2"
                disabled={isLoading || isError}
                onClick={() => {
                  onOpenChange(false)
                  onAdvanceStatus(current, nextStep.next)
                }}
              >
                {t(nextStep.labelKey).replace(/\s*→\s*$/, "")}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
