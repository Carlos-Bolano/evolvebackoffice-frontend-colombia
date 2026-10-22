import { useOrderPresentation } from "../hooks/use-order-presentation"
import { shortOrderReference } from "../utils/order-presentation"
import type { CSSProperties } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { useTranslation } from "@/i18n/use-i18n"
import { KANBAN_COLUMNS, ORDER_STATUS_CONFIG } from "../types"
import type { OrderListItem, OrderStatus } from "../types/api"
import {
  AlertTriangle,
  Ban,
  Bike,
  Clock,
  Eye,
  MapPin,
  MoreHorizontal,
  Package,
  Phone,
  User,
  UserPlus,
} from "lucide-react"

const NEXT_STATUS_MAP: Partial<Record<string, { next: OrderStatus; labelKey: string }>> = {
  Pending: { next: "Confirmed", labelKey: "next_confirm" },
  Confirmed: { next: "Preparing", labelKey: "next_prepare" },
  Preparing: { next: "Ready", labelKey: "next_ready" },
  Ready: { next: "Shipped", labelKey: "next_dispatch" },
  Shipped: { next: "Delivered", labelKey: "next_deliver" },
}

interface OrdersKanbanProps {
  ordersByStatus: Record<string, OrderListItem[]>
  onDragEnd: (orderId: string, newStatus: OrderStatus) => void
  onViewDetail: (order: OrderListItem) => void
  onAssignCourier?: (order: OrderListItem) => void
  onRequestCancel?: (order: OrderListItem) => void
  /** En "todas las sucursales" cada tarjeta muestra su sucursal. */
  showBranch?: boolean
  selectedIds: ReadonlySet<string>
  onToggleSelection: (ids: string[]) => void
  disabled?: boolean
}

export function OrdersKanban({
  ordersByStatus,
  onDragEnd,
  onViewDetail,
  onAssignCourier,
  onRequestCancel,
  showBranch = false,
  selectedIds,
  onToggleSelection,
  disabled = false,
}: OrdersKanbanProps) {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const { collectionLabel, statusLabel } = useOrderPresentation()

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    // Soltar en la misma columna no cambia el estado (evita un PUT inválido).
    if (result.destination.droppableId === result.source.droppableId) return
    const newStatus = result.destination.droppableId as OrderStatus
    const orderId = result.draggableId
    onDragEnd(orderId, newStatus)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((status) => {
          const config = ORDER_STATUS_CONFIG[status]
          const orders = ordersByStatus[status] ?? []

          return (
            <div key={status} className="min-w-[270px] flex-1 sm:min-w-[300px]">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {status !== "Delivered" && orders.length > 0 && (
                        <input
                          type="checkbox"
                          aria-label={t("bulk_select_column", { status: statusLabel(status) })}
                          checked={orders.every((order) => selectedIds.has(order.id))}
                          ref={(node) => {
                            if (node)
                              node.indeterminate =
                                orders.some((order) => selectedIds.has(order.id)) &&
                                !orders.every((order) => selectedIds.has(order.id))
                          }}
                          disabled={disabled}
                          onChange={() => onToggleSelection(orders.map((order) => order.id))}
                          className="size-4 accent-primary"
                        />
                      )}
                      <CardTitle className="text-sm font-semibold">{statusLabel(status)}</CardTitle>
                    </div>
                    <Badge tone={config?.color}>{orders.length}</Badge>
                  </div>
                </CardHeader>
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <CardContent
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] space-y-2 transition-colors ${
                        snapshot.isDraggingOver ? "bg-primary/5" : ""
                      }`}
                    >
                      {orders.length === 0 && (
                        <p className="py-8 text-center text-xs text-muted-foreground">{t("no_orders")}</p>
                      )}
                      {orders.map((order, index) => {
                        const nextStep = NEXT_STATUS_MAP[order.statusCode]
                        const isOverdue =
                          Boolean(order.promisedDeliveryAt) &&
                          order.statusCode !== "Delivered" &&
                          new Date(order.promisedDeliveryAt!).getTime() < Date.now()
                        return (
                          <Draggable key={order.id} draggableId={order.id} index={index} isDragDisabled={disabled}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style as CSSProperties}
                                className={`rounded-lg border bg-card p-3 shadow-sm transition-shadow ${
                                  selectedIds.has(order.id) ? "border-primary ring-2 ring-primary/30" : ""
                                } ${snapshot.isDragging ? "shadow-md" : ""}`}
                              >
                                <div className="mb-2 flex items-start justify-between gap-1">
                                  {status !== "Delivered" && (
                                    <input
                                      type="checkbox"
                                      aria-label={t("bulk_select_order", {
                                        reference: order.externalOrderId ?? order.id.slice(0, 8),
                                      })}
                                      checked={selectedIds.has(order.id)}
                                      disabled={disabled}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={() => onToggleSelection([order.id])}
                                      className="size-4 shrink-0 accent-primary"
                                    />
                                  )}
                                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                                    #{shortOrderReference(order.externalOrderId, order.id)}
                                  </span>
                                  <span className="flex shrink-0 items-center gap-1">
                                    {showBranch && order.branchName && (
                                      <Badge tone="info" className="max-w-28 truncate text-[10px]">
                                        {order.branchName}
                                      </Badge>
                                    )}
                                    <Badge tone="neutral" className="text-[10px]">
                                      {order.platformCode}
                                    </Badge>
                                    <OrderQuickActionsMenu
                                      order={order}
                                      disabled={disabled}
                                      onChangeStatus={(newStatus) => onDragEnd(order.id, newStatus)}
                                      onAssignCourier={onAssignCourier}
                                      onRequestCancel={onRequestCancel}
                                    />
                                  </span>
                                </div>

                                {(order.customerName || order.customerPhone) && (
                                  <div className="mb-1.5 space-y-0.5 text-xs">
                                    {order.customerName && (
                                      <p className="flex items-center gap-1 truncate font-medium text-foreground">
                                        <User className="size-3 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{order.customerName}</span>
                                      </p>
                                    )}
                                    {order.customerPhone && (
                                      <p className="flex items-center gap-1 truncate text-muted-foreground">
                                        <Phone className="size-3 shrink-0" />
                                        <span className="truncate">{order.customerPhone}</span>
                                      </p>
                                    )}
                                  </div>
                                )}

                                {(order.itemsSummary || (order.itemsCount ?? 0) > 0) && (
                                  <p className="mb-1.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                    <Package className="size-3 shrink-0" />
                                    <span className="truncate">
                                      {order.itemsSummary ?? t("items_count", { count: order.itemsCount ?? 0 })}
                                    </span>
                                  </p>
                                )}

                                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
                                  <p className="text-sm font-semibold">{formatCurrency(order.total)}</p>
                                  <Badge
                                    tone={order.paymentConfirmed || order.isReconciled ? "success" : "warning"}
                                    className="text-[10px]"
                                  >
                                    {collectionLabel(order)}
                                  </Badge>
                                </div>

                                {(order.cancelledWhileDispatched ||
                                  order.deliveryFailureReason ||
                                  order.outboundSyncError ||
                                  isOverdue) && (
                                  <div className="mb-1.5 space-y-1 text-[11px]">
                                    {order.cancelledWhileDispatched && (
                                      <p className="flex items-center gap-1 font-semibold text-red-600">
                                        <AlertTriangle className="size-3 shrink-0" />
                                        {t("phase2_cancelled_on_way")}
                                      </p>
                                    )}
                                    {order.deliveryFailureReason && (
                                      <p className="truncate text-amber-600">
                                        {t("phase2_not_delivered")}: {order.deliveryFailureReason}
                                      </p>
                                    )}
                                    {order.outboundSyncError && (
                                      <p className="truncate text-red-600">{order.outboundSyncError}</p>
                                    )}
                                    {isOverdue && <p className="font-medium text-red-600">{t("phase2_late")}</p>}
                                  </div>
                                )}

                                {order.shippingStreet && (
                                  <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{order.shippingStreet}</span>
                                  </div>
                                )}

                                {order.courierName && (
                                  <div className="mb-1 flex items-center gap-1 text-xs text-primary">
                                    <Bike className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{order.courierName}</span>
                                  </div>
                                )}

                                <div className="mt-2 flex items-center justify-between gap-1 border-t border-border/50 pt-2">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {new Date(order.externalCreatedAt).toLocaleTimeString("es-CO", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {nextStep && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={disabled}
                                        className="h-6 px-2 text-[11px]"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onDragEnd(order.id, nextStep.next)
                                        }}
                                      >
                                        {t(nextStep.labelKey)}
                                      </Button>
                                    )}
                                    <Button
                                      aria-label={t("order_products")}
                                      title={t("order_products")}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onViewDetail(order)
                                      }}
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                    </CardContent>
                  )}
                </Droppable>
              </Card>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}

export function OrdersTableView({
  orders,
  onChangeStatus,
  onViewDetail,
  onAssignCourier,
  onRequestCancel,
  showBranch = false,
  selectedIds,
  onToggleSelection,
  disabled = false,
}: {
  orders: OrderListItem[]
  onChangeStatus: (orderId: string, newStatus: OrderStatus) => void
  onViewDetail: (order: OrderListItem) => void
  onAssignCourier?: (order: OrderListItem) => void
  onRequestCancel?: (order: OrderListItem) => void
  showBranch?: boolean
  selectedIds: ReadonlySet<string>
  onToggleSelection: (ids: string[]) => void
  disabled?: boolean
}) {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const { paymentLabel, statusLabel } = useOrderPresentation()

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border/60">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>{t("order_ref")}</TableHead>
            {showBranch && <TableHead>{t("branch")}</TableHead>}
            <TableHead>{t("customer")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("payment_method")}</TableHead>
            <TableHead>{t("settlement_courier")}</TableHead>
            <TableHead className="text-right">{t("total")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showBranch ? 9 : 8} className="py-8 text-center text-xs text-muted-foreground">
                {t("no_orders")}
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => {
              const config = ORDER_STATUS_CONFIG[order.statusCode]
              const nextStep = NEXT_STATUS_MAP[order.statusCode]
              return (
                <TableRow key={order.id}>
                  <TableCell>
                    {order.statusCode !== "Delivered" && (
                      <input
                        type="checkbox"
                        aria-label={t("bulk_select_order", {
                          reference: order.externalOrderId ?? order.id.slice(0, 8),
                        })}
                        checked={selectedIds.has(order.id)}
                        disabled={disabled}
                        onChange={() => onToggleSelection([order.id])}
                        className="size-4 accent-primary"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-xs">#{shortOrderReference(order.externalOrderId, order.id)}</p>
                    <p className="text-[11px] text-muted-foreground">{order.platformCode}</p>
                  </TableCell>
                  {showBranch && <TableCell className="text-xs">{order.branchName ?? "—"}</TableCell>}
                  <TableCell className="text-xs">
                    <p className="font-medium">{order.customerName ?? "—"}</p>
                    {order.shippingStreet && (
                      <p className="max-w-48 truncate text-[11px] text-muted-foreground">{order.shippingStreet}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone={config?.color ?? "neutral"}>{statusLabel(order.statusCode)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge tone={order.paymentConfirmed || order.isReconciled ? "success" : "warning"}>
                      {order.paymentConfirmed
                        ? t("phase2_paid")
                        : order.isReconciled
                          ? t("phase2_collected")
                          : paymentLabel(order.paymentMethod)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{order.courierName ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatCurrency(order.total)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {nextStep && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          className="min-h-11 px-3 text-xs sm:min-h-8"
                          onClick={() => onChangeStatus(order.id, nextStep.next)}
                        >
                          {t(nextStep.labelKey)}
                        </Button>
                      )}
                      <Button
                        aria-label={t("order_products")}
                        title={t("order_products")}
                        variant="ghost"
                        size="sm"
                        className="min-h-11 px-3 sm:min-h-8"
                        onClick={() => onViewDetail(order)}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                      <OrderQuickActionsMenu
                        order={order}
                        disabled={disabled}
                        onChangeStatus={(newStatus) => onChangeStatus(order.id, newStatus)}
                        onAssignCourier={onAssignCourier}
                        onRequestCancel={onRequestCancel}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function OrderQuickActionsMenu({
  order,
  disabled,
  onChangeStatus,
  onAssignCourier,
  onRequestCancel,
}: {
  order: OrderListItem
  disabled?: boolean
  onChangeStatus: (status: OrderStatus) => void
  onAssignCourier?: (order: OrderListItem) => void
  onRequestCancel?: (order: OrderListItem) => void
}) {
  const { t } = useTranslation("business-orders")
  const { statusLabel } = useOrderPresentation()
  const canCancel = !["Delivered", "Cancelled", "Refunded"].includes(order.statusCode)
  if (!canCancel) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={t("quick_actions")}
          className="size-11 p-0 sm:size-7"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("quick_actions")}</DropdownMenuLabel>
        {KANBAN_COLUMNS.filter((s) => s !== order.statusCode).map((targetStatus) => (
          <DropdownMenuItem
            key={targetStatus}
            onClick={(e) => {
              e.stopPropagation()
              onChangeStatus(targetStatus)
            }}
          >
            {statusLabel(targetStatus)}
          </DropdownMenuItem>
        ))}
        {onAssignCourier && order.shippingStreet && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onAssignCourier(order)
              }}
            >
              <UserPlus className="size-3.5" />
              {order.courierId ? t("courier_reassign") : t("courier_assign")}
            </DropdownMenuItem>
          </>
        )}
        {canCancel && onRequestCancel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation()
                onRequestCancel(order)
              }}
            >
              <Ban className="size-3.5" />
              {t("cancel")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
