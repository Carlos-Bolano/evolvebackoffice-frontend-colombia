import { useOrderPresentation } from "../hooks/use-order-presentation"
import { shortOrderReference } from "../utils/order-presentation"
import { useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { DragDropContext, Droppable, Draggable, type BeforeCapture, type DropResult } from "@hello-pangea/dnd"
import { NEXT_ORDER_STEP } from "../utils/order-status"
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
  GripVertical,
  MapPin,
  MoreHorizontal,
  Package,
  Phone,
  User,
  UserPlus,
} from "lucide-react"

interface OrdersKanbanProps {
  columns?: readonly (OrderStatus | "Refunded")[]
  readOnly?: boolean
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

/**
 * Tablero Kanban de órdenes con columnas por estado, soporte de arrastrar y soltar (DnD),
 * selección múltiple para acciones por lote y columna opcional de órdenes canceladas.
 */
export function OrdersKanban({
  columns = KANBAN_COLUMNS,
  readOnly = false,
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
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const allOrders = Object.values(ordersByStatus).flat()
  const draggedOrders = draggingId
    ? allOrders.filter((order) =>
        selectedIds.has(draggingId) && selectedIds.size > 1 ? selectedIds.has(order.id) : order.id === draggingId
      )
    : []
  const canDropInto = (status: string) =>
    !draggedOrders.length || draggedOrders.every((order) => NEXT_ORDER_STEP[order.statusCode]?.next === status)

  // Teclado: la librería solo mueve entre columnas si la tarjeta (y, si la columna
  // destino tiene pedidos, alguno de ellos) queda totalmente visible en el viewport, pero
  // el scroll vertical lo hace el contenedor del layout y no puede desplazarlo.
  const columnsRef = useRef<HTMLDivElement>(null)
  const findCard = (draggableId: string) =>
    document.querySelector<HTMLElement>(`[data-rfd-draggable-id="${CSS.escape(draggableId)}"]`)

  // Al enfocar el asa con teclado se centra la tarjeta en ambos ejes, para que las columnas
  // vecinas queden completas. Debe ocurrir ANTES de levantar: el scroll horizontal del
  // contenedor de columnas (que la librería rastrea) llega como evento asíncrono y, si se
  // produce durante la captura, descuadra la posición y anuncia "cannot be dropped".
  const centerForKeyboard = (handle: HTMLElement, draggableId: string) => {
    if (!handle.matches(":focus-visible")) return
    const card = findCard(draggableId)
    const columns = columnsRef.current
    if (!card || !columns) return
    // Vertical: el contenedor del layout. "nearest" en horizontal para no mover otros ancestros.
    card.scrollIntoView({ block: "center", inline: "nearest" })
    // Horizontal: solo el contenedor de columnas.
    const cardBox = card.getBoundingClientRect()
    const columnsBox = columns.getBoundingClientRect()
    columns.scrollLeft += cardBox.left + cardBox.width / 2 - (columnsBox.left + columnsBox.width / 2)
  }

  // Respaldo al levantar: solo el scroll vertical del contenedor del layout (la librería no
  // lo rastrea, así que es seguro durante la captura). scrollIntoView no sirve aquí porque
  // también desplazaría el contenedor de columnas.
  const handleBeforeCapture = (before: BeforeCapture) => {
    if (before.mode !== "SNAP") return
    const card = findCard(before.draggableId)
    let scroller = card?.parentElement ?? null
    while (scroller && (scroller === columnsRef.current || !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)))
      scroller = scroller.parentElement
    if (!card || !scroller) return
    const cardBox = card.getBoundingClientRect()
    const scrollerBox = scroller.getBoundingClientRect()
    scroller.scrollTop += cardBox.top + cardBox.height / 2 - (scrollerBox.top + scrollerBox.height / 2)
  }

  /** Gestiona el evento de finalización del arrastre de una tarjeta en el tablero. */
  const handleDragEnd = (result: DropResult) => {
    setDraggingId(null)
    if (readOnly || disabled) return
    if (!result.destination) return
    // Soltar en la misma columna no cambia el estado (evita un PUT inválido).
    if (result.destination.droppableId === result.source.droppableId) return
    const newStatus = result.destination.droppableId as OrderStatus
    if (!canDropInto(newStatus)) return
    const orderId = result.draggableId
    onDragEnd(orderId, newStatus)
  }

  return (
    <DragDropContext
      onBeforeCapture={handleBeforeCapture}
      onDragStart={(start) => setDraggingId(start.draggableId)}
      onDragEnd={handleDragEnd}
    >
      {draggingId && (
        <p role="status" className="mb-3 rounded-xl border bg-primary/5 p-3 text-sm">
          {t(
            draggedOrders.some((order) => order.statusCode !== draggedOrders[0]?.statusCode)
              ? "drag_mixed_hint"
              : "drag_valid_hint"
          )}
        </p>
      )}
      {!readOnly && !draggingId && <p className="mb-2 text-xs text-muted-foreground">{t("drag_handle_hint")}</p>}
      <div ref={columnsRef} className="flex items-stretch gap-4 overflow-x-auto overscroll-x-contain pb-4">
        {columns.map((status) => {
          const config = ORDER_STATUS_CONFIG[status]
          const orders = ordersByStatus[status] ?? []

          return (
            <div key={status} className="min-w-[270px] flex-1 sm:min-w-[300px]">
              <Card
                className={`flex h-full flex-col transition-colors ${draggingId && canDropInto(status) ? "border-primary ring-2 ring-primary/20" : ""}`}
              >
                <CardHeader className="shrink-0 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {!readOnly && status !== "Delivered" && status !== "Cancelled" && orders.length > 0 && (
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
                <Droppable
                  droppableId={status}
                  isDropDisabled={
                    readOnly || disabled || (status !== draggedOrders[0]?.statusCode && !canDropInto(status))
                  }
                >
                  {(provided, snapshot) => (
                    <CardContent
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      data-drag-over={snapshot.isDraggingOver ? "true" : undefined}
                      role="region"
                      aria-label={t("kanban_column", { status: statusLabel(status) })}
                      className={`min-h-[320px] flex-1 space-y-2 transition-colors ${
                        snapshot.isDraggingOver ? "bg-primary/5" : ""
                      }`}
                    >
                      {orders.length === 0 && (
                        <p className="py-8 text-center text-xs text-muted-foreground">{t("no_orders")}</p>
                      )}
                      {orders.map((order, index) => {
                        const nextStep = NEXT_ORDER_STEP[order.statusCode]
                        const isOverdue =
                          Boolean(order.promisedDeliveryAt) &&
                          order.statusCode !== "Delivered" &&
                          new Date(order.promisedDeliveryAt!).getTime() < Date.now()
                        return (
                          <Draggable
                            key={order.id}
                            draggableId={order.id}
                            index={index}
                            isDragDisabled={readOnly || disabled || !nextStep}
                            disableInteractiveElementBlocking
                          >
                            {(provided, snapshot) => {
                              const card = (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  data-order-dragging={snapshot.isDragging ? "true" : undefined}
                                  style={provided.draggableProps.style as CSSProperties}
                                  className={`rounded-lg border bg-card p-3 shadow-sm transition-shadow ${
                                    selectedIds.has(order.id) ? "border-primary ring-2 ring-primary/30" : ""
                                  } ${snapshot.isDragging ? "shadow-2xl ring-2 ring-primary" : ""}`}
                                >
                                  <div className="mb-2 flex items-center gap-2">
                                    {!readOnly && status !== "Delivered" && status !== "Cancelled" && (
                                      <input
                                        type="checkbox"
                                        aria-label={t("bulk_select_order", {
                                          reference: order.externalOrderId ?? order.id.slice(0, 8),
                                        })}
                                        checked={selectedIds.has(order.id)}
                                        disabled={disabled}
                                        onChange={() => onToggleSelection([order.id])}
                                        className="size-4 shrink-0 accent-primary"
                                      />
                                    )}
                                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                                      #{shortOrderReference(order.externalOrderId, order.id)}
                                    </span>
                                    {!readOnly && nextStep && (
                                      <button
                                        type="button"
                                        {...provided.dragHandleProps}
                                        onFocus={(e) => centerForKeyboard(e.currentTarget, order.id)}
                                        aria-label={t("drag_order", {
                                          reference: order.externalOrderId ?? order.id.slice(0, 8),
                                        })}
                                        title={t("drag_handle_hint")}
                                        className="inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing sm:size-8"
                                      >
                                        <GripVertical className="size-4" />
                                      </button>
                                    )}
                                    <OrderQuickActionsMenu
                                      order={order}
                                      disabled={disabled}
                                      onChangeStatus={(newStatus) => onDragEnd(order.id, newStatus)}
                                      onAssignCourier={onAssignCourier}
                                      onRequestCancel={onRequestCancel}
                                    />
                                  </div>
                                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                    {showBranch && order.branchName && (
                                      <Badge tone="info" className="max-w-full truncate text-[10px]">
                                        {order.branchName}
                                      </Badge>
                                    )}
                                    <Badge tone="neutral" className="text-[10px]">
                                      {order.platformCode}
                                    </Badge>
                                    {snapshot.isDragging && draggedOrders.length > 1 && (
                                      <Badge tone="primary">
                                        {t("drag_selected_count", { count: draggedOrders.length })}
                                      </Badge>
                                    )}
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

                                  {order.statusCode === "Cancelled" && (
                                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                      {order.cancellationType && (
                                        <Badge
                                          tone={order.cancellationType === "Waste" ? "warning" : "info"}
                                          className="px-1.5 py-0 text-[10px]"
                                        >
                                          {order.cancellationType === "Waste"
                                            ? t("cancellation_type_waste")
                                            : t("cancellation_type_restocked")}
                                        </Badge>
                                      )}
                                      {order.wasteCost != null && order.wasteCost > 0 && (
                                        <span className="font-mono text-[10px] font-medium text-destructive">
                                          -${order.wasteCost.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  )}

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
                              )
                              return snapshot.isDragging ? createPortal(card, document.body) : card
                            }}
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
        {(NEXT_ORDER_STEP[order.statusCode] ? [NEXT_ORDER_STEP[order.statusCode]!.next] : []).map((targetStatus) => (
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
