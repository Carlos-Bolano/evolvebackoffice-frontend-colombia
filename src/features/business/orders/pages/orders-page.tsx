import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "@/i18n/use-i18n"
import { useNotify } from "@/hooks/use-notify"
import Spinner from "@/components/Spinner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Truck,
  X,
} from "lucide-react"
import { useQueries } from "@tanstack/react-query"
import { useBranches } from "@/features/business/branches/hooks/use-branches"
import {
  branchModulesKeys,
  useBranchModules,
  useTenantPlatformModules,
} from "@/features/business/branches/hooks/use-branch-modules"
import { getBranchModules } from "@/features/business/branches/services/branch-modules.service"
import { BranchSelector } from "@/features/business/items/catalog/components/branch-selector"
import { useBranchIntegrations } from "@/features/business/branches/hooks/use-branch-integrations"
import { useAssignCourier, useCouriers } from "../hooks/use-couriers"
import { useOrderNotificationsStore } from "../hooks/use-new-order-notifications"
import { useCancelOrder, useOrders, useUpdateOrderStatus } from "../hooks/use-orders"
import { useOrderUpdates } from "../hooks/use-order-updates"
import { OrdersKanban } from "../components/orders-kanban"
import { OrderConnectionStatus } from "../components/order-connection-status"
import { OrdersSubnav } from "../components/orders-subnav"
import { BulkOrderStatusDialog } from "../components/bulk-order-status-dialog"
import { MAX_BULK_ORDERS, isDeliveryOrder } from "../utils/bulk-status"
import { NEXT_ORDER_STEP } from "../utils/order-status"
import { OrderDetailDialog } from "../components/order-detail-dialog"
import { OrderQuickFilters } from "../components/order-quick-filters"
import { useOrderViewPreferences, type OrderViewPreferences } from "../hooks/use-order-view-preferences"
import { useOrderWorkspaceKey, useWorkspaceState } from "../hooks/use-order-workspace"
import { ManualOrderDialog } from "../components/manual-order-dialog"
import { EditOrderDialog } from "../components/edit-order-dialog"
import { CourierPickerDialog } from "../components/courier-picker-dialog"
import { HISTORY_KANBAN_COLUMNS, KANBAN_COLUMNS, ORDER_STATUS_CONFIG } from "../types"
import { checkOrderStock } from "../services/orders.service"
import type { OrderCancellationType, OrderFilters, OrderListItem, OrderStatus, OrderStockItem } from "../types/api"

type DatePreset = "all" | "today" | "yesterday" | "last7"

/** Clave de localStorage para recordar la sucursal consultada en Órdenes. */
const ORDERS_BRANCH_STORAGE_KEY = "business.orders.branchId"

function computeDateRange(preset: DatePreset): { from?: string; to?: string } {
  if (preset === "all") return {}
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  if (preset === "today") {
    const day = fmt(todayStart)
    return { from: day, to: day }
  }
  if (preset === "yesterday") {
    const y = new Date(todayStart)
    y.setDate(y.getDate() - 1)
    const day = fmt(y)
    return { from: day, to: day }
  }
  const start = new Date(todayStart)
  start.setDate(start.getDate() - 6)
  return { from: fmt(start), to: fmt(todayStart) }
}

export function OrdersPage() {
  const { t } = useTranslation("business-orders")
  const navigate = useNavigate()
  const notify = useNotify()
  const [selectedOrder, setSelectedOrder] = useState<OrderListItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOrderOpen, setCreateOrderOpen] = useState(false)
  const [createOrderBranchId, setCreateOrderBranchId] = useState<string | null>(null)
  const [editOrderOpen, setEditOrderOpen] = useState(false)
  const [view, setView] = useOrderViewPreferences()
  const {
    platformFilter,
    orderScope,
    datePreset,
    fulfillmentFilter,
    courierFilter,
    paymentFilter,
    syncAlertFilter,
    quickView,
  } = view
  const updateView = <K extends keyof OrderViewPreferences>(key: K, value: OrderViewPreferences[K]) =>
    setView((old) => ({ ...old, [key]: value }))
  const setPlatformFilter = (v: OrderViewPreferences["platformFilter"]) => updateView("platformFilter", v)
  const setOrderScope = (v: OrderViewPreferences["orderScope"]) => updateView("orderScope", v)
  const setDatePreset = (v: OrderViewPreferences["datePreset"]) => updateView("datePreset", v)
  const setFulfillmentFilter = (v: string) =>
    updateView("fulfillmentFilter", v as OrderViewPreferences["fulfillmentFilter"])
  const setCourierFilter = (v: string) =>
    setView((old) => ({
      ...old,
      courierFilter: v,
      quickView: v && old.quickView === "ready_unassigned" ? "" : old.quickView,
    }))
  const setPaymentFilter = (v: string) => updateView("paymentFilter", v as OrderViewPreferences["paymentFilter"])
  const setSyncAlertFilter = (v: string) => updateView("syncAlertFilter", v as OrderViewPreferences["syncAlertFilter"])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchInput, setSearchInput] = useWorkspaceState(
    useOrderWorkspaceKey("order-search"),
    "",
    sessionStorage,
    (v): v is string => typeof v === "string" && v.length <= 120
  )
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput)
  const [selection, setSelection] = useState<{ scope: string; ids: string[] }>({ scope: "", ids: [] })
  const [bulkRequest, setBulkRequest] = useState<{
    orders: OrderListItem[]
    status?: OrderStatus
    advance?: boolean
  } | null>(null)
  const [pendingMove, setPendingMove] = useState<{ orderId: string; status: OrderStatus } | null>(null)
  const [checkingMove, setCheckingMove] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  // Sucursal consultada: selección visible con persistencia local.
  const ALL_BRANCHES = "__ALL__"
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(() =>
    localStorage.getItem(ORDERS_BRANCH_STORAGE_KEY)
  )
  const showAllBranches = selectedBranchId === ALL_BRANCHES
  const { data: branchesData } = useBranches(1, 50)
  const branches = branchesData?.data ?? []

  // Módulos de cada sucursal (misma query key que useBranchModules → caché compartida)
  const moduleQueries = useQueries({
    queries: branches.map((b) => ({
      queryKey: branchModulesKeys.list(b.id),
      queryFn: () => getBranchModules(b.id),
      staleTime: 60_000,
    })),
  })
  // Solo sucursales con el módulo ORDERS activo se muestran en el selector
  const branchesWithOrdersModule = branches.filter(
    (_, i) => moduleQueries[i]?.data?.some((m) => m.moduleCode === "ORDERS" && m.isEnabled) ?? false
  )

  const branchId = showAllBranches
    ? ""
    : selectedBranchId && branchesWithOrdersModule.some((b) => b.id === selectedBranchId)
      ? selectedBranchId
      : (branchesWithOrdersModule[0]?.id ?? "")

  useEffect(() => {
    if (branchId) localStorage.setItem(ORDERS_BRANCH_STORAGE_KEY, branchId)
  }, [branchId])

  const handleBranchChange = (id: string | null) => {
    const value = id ?? ALL_BRANCHES
    localStorage.setItem(ORDERS_BRANCH_STORAGE_KEY, value)
    setSelectedBranchId(value)
    setCourierFilter("")
    setSelection({ scope: "", ids: [] })
  }

  const { data: branchModules } = useBranchModules(branchId)
  const hasOrdersModule = showAllBranches
    ? branchesWithOrdersModule.length > 0
    : branchModules?.some((m) => m.moduleCode === "ORDERS" && m.isEnabled)

  const { data: integrations } = useBranchIntegrations(branchId)
  const { data: couriersData, isSuccess: couriersLoaded } = useCouriers(branchId || null)
  const couriers = couriersData?.data ?? []
  const courierOutsideList = Boolean(courierFilter) && !couriers.some((courier) => courier.id === courierFilter)

  // Cluvi y WooCommerce son independientes: la configuración de cada una solo
  // se expone si su propio módulo está habilitado para el tenant.
  const { hasCluvi: hasCluviModule, hasWooCommerce: hasWooCommerceModule } = useTenantPlatformModules()

  /** Estado de una integración en la sucursal seleccionada. */
  const integrationState = (platform: string): "active" | "configured" | "none" => {
    if (!branchId) return "none"
    const row = integrations?.find((i) => i.platformCode === platform)
    if (!row) return "none"
    return row.isActive ? "active" : "configured"
  }

  // Sin useMemo manual: el React Compiler memoiza y TanStack Query hashea la key en profundidad.
  const apiFilters = ((): OrderFilters | undefined => {
    const dateRange = computeDateRange(datePreset)
    const next: OrderFilters = {}
    if (branchId) next.branchId = branchId
    if (dateRange.from) next.from = dateRange.from
    if (dateRange.to) next.to = dateRange.to
    if (debouncedSearch) next.search = debouncedSearch
    if (fulfillmentFilter) next.fulfillmentType = fulfillmentFilter
    if (courierFilter) next.courierId = courierFilter
    if (quickView === "ready_unassigned") {
      next.status = "Ready"
      next.courierId = "00000000-0000-0000-0000-000000000000"
    }
    if (paymentFilter) next.paymentState = paymentFilter
    if (syncAlertFilter) next.syncAlert = syncAlertFilter
    return Object.keys(next).length > 0 ? next : undefined
  })()

  const { data: ordersData, isLoading, refetch } = useOrders(1, 100, apiFilters, !!branchId || showAllBranches)
  // Pedidos nuevos o actualizados (webhook de Cluvi, otro usuario) aparecen sin recargar.
  const connection = useOrderUpdates(branchId)
  const updateStatusMutation = useUpdateOrderStatus()
  const cancelOrderMutation = useCancelOrder()
  const assignCourierMutation = useAssignCourier()

  const allOrders = useMemo(
    () =>
      (ordersData?.data ?? []).map((order) =>
        pendingMove?.orderId === order.id ? { ...order, statusCode: pendingMove.status } : order
      ),
    [ordersData, pendingMove]
  )

  // Registrar alertas operativas (error de sync o cancelado en camino) en el centro de notificaciones
  useEffect(() => {
    const alerts = allOrders.flatMap((o) => {
      const list: Parameters<ReturnType<typeof useOrderNotificationsStore.getState>["addNotifications"]>[0] = []
      if (o.outboundSyncError) {
        list.push({
          orderId: o.id,
          externalOrderId: o.externalOrderId,
          customerName: o.customerName ?? null,
          total: o.total,
          status: o.statusCode,
          createdAt: o.externalCreatedAt || o.createdAt,
          kind: "sync_error",
        })
      }
      if (o.cancelledWhileDispatched) {
        list.push({
          orderId: o.id,
          externalOrderId: o.externalOrderId,
          customerName: o.customerName ?? null,
          total: o.total,
          status: o.statusCode,
          createdAt: o.externalCreatedAt || o.createdAt,
          kind: "cancelled_dispatched",
        })
      }
      return list
    })
    if (alerts.length > 0) {
      useOrderNotificationsStore.getState().addNotifications(alerts)
    }
  }, [allOrders])

  const isHistorical = (order: OrderListItem) => ["Delivered", "Cancelled", "Refunded"].includes(order.statusCode)
  const scopeOrders = useMemo(
    () => allOrders.filter((order) => (orderScope === "history") === isHistorical(order)),
    [allOrders, orderScope]
  )
  const filteredOrders = useMemo(
    () =>
      platformFilter === "all" ? scopeOrders : scopeOrders.filter((order) => order.platformCode === platformFilter),
    [scopeOrders, platformFilter]
  )
  const historyCount = allOrders.filter(isHistorical).length

  const hasActiveFilters =
    Boolean(quickView) ||
    Boolean(searchInput.trim()) ||
    datePreset !== "all" ||
    Boolean(fulfillmentFilter) ||
    Boolean(courierFilter) ||
    Boolean(paymentFilter) ||
    Boolean(syncAlertFilter)

  const clearFilters = () => {
    updateView("quickView", "")
    setSearchInput("")
    setDebouncedSearch("")
    setDatePreset("all")
    setFulfillmentFilter("")
    setCourierFilter("")
    setPaymentFilter("")
    setSyncAlertFilter("")
  }

  const selectionScope = `${branchId}:${showAllBranches}:${platformFilter}:${orderScope}`
  const selectableOrders = filteredOrders.filter(
    (order) => order.statusCode !== "Delivered" && KANBAN_COLUMNS.some((status) => status === order.statusCode)
  )
  const visibleIds = new Set(selectableOrders.map((order) => order.id))
  const selectedIds = new Set(
    selection.scope === selectionScope ? selection.ids.filter((id) => visibleIds.has(id)) : []
  )
  const toggleSelection = (ids: string[]) => {
    const next = new Set(selectedIds)
    if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id))
    else {
      ids.forEach((id) => {
        if (next.size < MAX_BULK_ORDERS) next.add(id)
      })
      if (ids.some((id) => !next.has(id))) notify.error(t("bulk_limit", { count: MAX_BULK_ORDERS }))
    }
    setSelection({ scope: selectionScope, ids: [...next] })
  }
  const selectedOrders = selectableOrders.filter((order) => selectedIds.has(order.id))

  const kanbanColumns = orderScope === "history" ? HISTORY_KANBAN_COLUMNS : KANBAN_COLUMNS
  const ordersByStatus = kanbanColumns.reduce(
    (acc, status) => {
      acc[status] = filteredOrders.filter((o) => o.statusCode === status)
      return acc
    },
    {} as Record<string, OrderListItem[]>
  )

  const platformCounts = useMemo(
    () => ({
      all: scopeOrders.length,
      CLUVI: scopeOrders.filter((o) => o.platformCode === "CLUVI").length,
      WOOCOMMERCE: scopeOrders.filter((o) => o.platformCode === "WOOCOMMERCE").length,
      POSCO: scopeOrders.filter((o) => o.platformCode === "POSCO").length,
    }),
    [scopeOrders]
  )

  const [stockWarning, setStockWarning] = useState<OrderStockItem[] | null>(null)
  // Pedido a domicilio soltado en "En camino": se pide el domiciliario antes de enviarlo.
  const [dispatchOrder, setDispatchOrder] = useState<OrderListItem | null>(null)
  const [assigningCourierOrder, setAssigningCourierOrder] = useState<OrderListItem | null>(null)
  const [cancellingOrder, setCancellingOrder] = useState<OrderListItem | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancellationType, setCancellationType] = useState<OrderCancellationType>("Restocked")
  const pendingConfirmRef = useRef<{ orderId: string; status: OrderStatus } | null>(null)

  const applyStatus = (orderId: string, newStatus: OrderStatus, courierId?: string | null) => {
    setPendingMove({ orderId, status: newStatus })
    updateStatusMutation.mutate(
      { id: orderId, status: newStatus, courierId },
      {
        onSettled: () => setPendingMove(null),
        onSuccess: () => {
          setDispatchOrder(null)
          notify.success(t("status") + " → " + (ORDER_STATUS_CONFIG[newStatus]?.label ?? newStatus))
        },
        onError: (error: unknown) => {
          const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
          notify.error(message || t("status_update_failed"))
        },
      }
    )
  }

  /**
   * Al pasar la orden a "Confirmado" se consulta el inventario de la sucursal.
   * Si falta stock se muestra la advertencia y el usuario decide: nunca se
   * bloquea la orden, solo se avisa antes de enviar el cambio.
   */
  const handleDragEnd = async (orderId: string, newStatus: OrderStatus) => {
    if (bulkRequest || checkingMove || updateStatusMutation.isPending) return
    if (selectedIds.has(orderId) && selectedOrders.length > 1) {
      setBulkRequest({ orders: selectedOrders, status: newStatus })
      return
    }
    // Un pedido a domicilio no sale sin domiciliario: se elige (o confirma) al enviarlo.
    if (newStatus === "Shipped") {
      const order = allOrders.find((o) => o.id === orderId)
      if (order && isDeliveryOrder(order) && !order.courierId) {
        setDispatchOrder(order)
        return
      }
    }
    if (newStatus === "Confirmed") {
      setCheckingMove(true)
      try {
        const check = await checkOrderStock(orderId)
        if (check.hasShortage) {
          pendingConfirmRef.current = { orderId, status: newStatus }
          setStockWarning(check.items.filter((item) => !item.sufficient))
          return
        }
      } catch {
        // Sin verificación no se bloquea el movimiento.
      } finally {
        setCheckingMove(false)
      }
    }
    applyStatus(orderId, newStatus)
  }

  const handleConfirmDespiteShortage = () => {
    const pending = pendingConfirmRef.current
    pendingConfirmRef.current = null
    setStockWarning(null)
    if (pending) applyStatus(pending.orderId, pending.status)
  }

  const handleViewDetail = (order: OrderListItem) => {
    setSelectedOrder(order)
    setDetailOpen(true)
  }

  const handleRequestCancel = (order: OrderListItem) => {
    setCancelReason("")
    setCancellationType("Restocked")
    setCancellingOrder(order)
  }

  const handleConfirmCancelOrder = () => {
    if (!cancellingOrder) return
    cancelOrderMutation.mutate(
      {
        id: cancellingOrder.id,
        reason: cancelReason.trim() || null,
        cancellationType,
      },
      {
        onSuccess: () => {
          setCancellingOrder(null)
          notify.success(t("order_cancelled_ok"))
        },
        onError: (error: unknown) => {
          const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
          notify.error(message || t("status_update_failed"))
        },
      }
    )
  }

  /** Navega a la pestaña de integración de la sucursal en Sucursales. */
  const goToIntegration = (tab: "cluvi" | "woocommerce") => {
    if (!branchId) return
    navigate(`/business/branches/${branchId}/config?tab=${tab}`)
  }

  return (
    <div className="space-y-3 sm:space-y-5">
      <OrdersSubnav
        onSelectOrder={(orderId) => {
          const found = allOrders.find((o) => o.id === orderId)
          if (found) handleViewDetail(found)
        }}
      />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("orders")}</h1>
            <p className="hidden text-muted-foreground sm:block">{t("orders_desc")}</p>
          </div>
          <Button
            className="min-h-11 shrink-0"
            onClick={() => {
              setCreateOrderBranchId(branchId || null)
              setCreateOrderOpen(true)
            }}
            disabled={!branchesWithOrdersModule.length}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("create_order")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
          <span className="hidden text-sm text-muted-foreground md:inline">{t("viewing_branch")}</span>
          <BranchSelector
            label={t("viewing_branch")}
            options={[
              { id: null, name: t("all_branches") },
              ...branchesWithOrdersModule.map((b) => ({ id: b.id as string | null, name: b.name })),
            ]}
            selectedId={showAllBranches ? null : branchId || null}
            onSelect={handleBranchChange}
          />
          <Button className="hidden sm:inline-flex" variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("refresh")}
          </Button>
          <Button
            className="hidden sm:inline-flex"
            variant="outline"
            size="sm"
            onClick={() => navigate("/business/orders/deliveries")}
          >
            <Bike className="mr-2 h-4 w-4" />
            {t("deliveries_entry")}
          </Button>
          <Button
            className="hidden sm:inline-flex"
            variant="outline"
            size="sm"
            onClick={() => navigate("/business/orders/closing")}
          >
            <Lock className="mr-2 h-4 w-4" />
            {t("closing_entry")}
          </Button>
          {hasCluviModule && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => goToIntegration("cluvi")}
              disabled={!hasOrdersModule || showAllBranches}
              title={integrationTitle(integrationState("CLUVI"), t)}
            >
              <Truck className="mr-2 h-4 w-4" />
              Cluvi
              {!showAllBranches && <StatusDot state={integrationState("CLUVI")} />}
            </Button>
          )}
          {hasWooCommerceModule && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => goToIntegration("woocommerce")}
              disabled={!hasOrdersModule || showAllBranches}
              title={integrationTitle(integrationState("WOOCOMMERCE"), t)}
            >
              <Store className="mr-2 h-4 w-4" />
              WooCommerce
              {!showAllBranches && <StatusDot state={integrationState("WOOCOMMERCE")} />}
            </Button>
          )}
        </div>
      </div>

      {/* Warning if ORDERS module not active */}
      {!hasOrdersModule && branchesData && moduleQueries.every((q) => q.isSuccess) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">{t("orders_module_warning_title")}</p>
              <p className="text-xs text-amber-700">{t("orders_module_warning_desc")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <OrderConnectionStatus connection={connection} />
      <OrderQuickFilters
        value={view}
        onChange={(next) => {
          setView(next)
          setSearchInput("")
          setDebouncedSearch("")
          setSelection({ scope: "", ids: [] })
        }}
      />

      {courierOutsideList && couriersLoaded && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <p>{t("saved_courier_unavailable_hint")}</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setCourierFilter("")}>
            {t("clear_courier_filter")}
          </Button>
        </div>
      )}

      {/* Búsqueda y filtros del tablero Kanban. */}
      <div className="space-y-2.5 rounded-2xl border border-border/70 bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("search_orders_placeholder")}
              aria-label={t("search_orders_placeholder")}
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:hidden"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          {t("filters_toggle")}
          {hasActiveFilters ? " *" : ""}
        </Button>
        <div className={`${filtersOpen ? "flex" : "hidden"} flex-wrap items-center gap-2 sm:flex`}>
          <div className="flex flex-wrap items-center gap-1 rounded-xl border bg-background p-1">
            {(
              [
                ["all", "date_all"],
                ["today", "date_today"],
                ["yesterday", "date_yesterday"],
                ["last7", "date_last_7_days"],
              ] as const
            ).map(([preset, labelKey]) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  datePreset === preset
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          <select
            aria-label={t("fulfillment_all")}
            value={fulfillmentFilter}
            onChange={(e) => setFulfillmentFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2.5 text-xs"
          >
            <option value="">{t("fulfillment_all")}</option>
            <option value="delivery">{t("fulfillment_delivery")}</option>
            <option value="pickup">{t("fulfillment_pickup")}</option>
          </select>

          <select
            aria-label={t("couriers_all")}
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2.5 text-xs"
          >
            <option value="">{t("couriers_all")}</option>
            {courierOutsideList && <option value={courierFilter}>{t("saved_courier_unavailable")}</option>}
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label={t("payment_all")}
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2.5 text-xs"
          >
            <option value="">{t("payment_all")}</option>
            <option value="paid">{t("payment_paid")}</option>
            <option value="reconciled">{t("payment_reconciled")}</option>
            <option value="pending">{t("payment_pending")}</option>
          </select>

          <select
            aria-label={t("sync_all")}
            value={syncAlertFilter}
            onChange={(e) => setSyncAlertFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2.5 text-xs"
          >
            <option value="">{t("sync_all")}</option>
            <option value="error">{t("sync_error")}</option>
            <option value="pending">{t("sync_pending")}</option>
          </select>

          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
              <X className="mr-1 size-3.5" />
              {t("clear_filters")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("order_scope")}>
        <Button
          variant={orderScope === "active" ? "default" : "outline"}
          aria-pressed={orderScope === "active"}
          onClick={() => setOrderScope("active")}
        >
          {t("active_orders")} ({allOrders.length - historyCount})
        </Button>
        <Button
          variant={orderScope === "history" ? "default" : "outline"}
          aria-pressed={orderScope === "history"}
          onClick={() => setOrderScope("history")}
        >
          {t("order_history")} ({historyCount})
        </Button>
      </div>
      {/* Platform Filter Tabs */}
      <Tabs
        value={platformFilter}
        onValueChange={(v) => {
          setPlatformFilter(v as OrderViewPreferences["platformFilter"])
          setSelection({ scope: "", ids: [] })
        }}
      >
        <TabsList className="max-w-full flex-wrap gap-1">
          <TabsTrigger value="all" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            {t("platform_all")}
            <Badge tone="neutral" className="ml-1 text-[10px]">
              {platformCounts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="POSCO" className="gap-1.5">
            {t("platform_local")}
            <Badge tone="neutral" className="ml-1 text-[10px]">
              {platformCounts.POSCO}
            </Badge>
          </TabsTrigger>
          {(hasCluviModule || platformCounts.CLUVI > 0 || platformFilter === "CLUVI") && (
            <TabsTrigger value="CLUVI" className="gap-1.5">
              Cluvi
              <Badge tone="neutral" className="ml-1 text-[10px]">
                {platformCounts.CLUVI}
              </Badge>
            </TabsTrigger>
          )}
          {(hasWooCommerceModule || platformCounts.WOOCOMMERCE > 0 || platformFilter === "WOOCOMMERCE") && (
            <TabsTrigger value="WOOCOMMERCE" className="gap-1.5">
              WooCommerce
              <Badge tone="neutral" className="ml-1 text-[10px]">
                {platformCounts.WOOCOMMERCE}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {selectableOrders.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 ${selectedOrders.length ? "sticky top-20 z-20 border-primary/40 shadow-lg" : ""}`}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={!!bulkRequest || checkingMove || updateStatusMutation.isPending}
            onClick={() => toggleSelection(selectableOrders.map((order) => order.id))}
          >
            {t("bulk_select_visible")}
          </Button>
          <span className="text-sm" aria-live="polite">
            {t("bulk_selected", { count: selectedOrders.length })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedOrders.length === 0 || !!bulkRequest || checkingMove || updateStatusMutation.isPending}
            onClick={() => setBulkRequest({ orders: selectedOrders })}
          >
            {t("bulk_move")}
          </Button>
          {selectedOrders.length > 0 && (
            <Button
              size="sm"
              className="min-h-11 gap-2"
              disabled={
                !!bulkRequest ||
                checkingMove ||
                updateStatusMutation.isPending ||
                selectedOrders.some((order) => !NEXT_ORDER_STEP[order.statusCode])
              }
              onClick={() => setBulkRequest({ orders: selectedOrders, advance: true })}
            >
              {t("bulk_next")}
              <ArrowRight className="size-4" />
            </Button>
          )}
          {selectedOrders.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={!!bulkRequest}
              onClick={() => setSelection({ scope: selectionScope, ids: [] })}
            >
              {t("bulk_clear")}
            </Button>
          )}
        </div>
      )}

      {/* Tablero Kanban para pedidos activos e historial. */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <OrdersKanban
          columns={kanbanColumns}
          readOnly={orderScope === "history"}
          ordersByStatus={ordersByStatus}
          onDragEnd={handleDragEnd}
          onViewDetail={handleViewDetail}
          onAssignCourier={(order) => setAssigningCourierOrder(order)}
          onRequestCancel={handleRequestCancel}
          showBranch={showAllBranches}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          disabled={!!bulkRequest || checkingMove || updateStatusMutation.isPending}
        />
      )}

      {bulkRequest && (
        <BulkOrderStatusDialog
          orders={bulkRequest.orders}
          initialStatus={bulkRequest.status}
          advance={bulkRequest.advance}
          onClose={() => setBulkRequest(null)}
          onResults={(result) => {
            const successes = new Set(result.results.filter((r) => r.succeeded).map((r) => r.orderId))
            setSelection((previous) => ({ ...previous, ids: previous.ids.filter((id) => !successes.has(id)) }))
            if (result.failureCount === 0) notify.success(t("bulk_success", { count: result.successCount }))
            else notify.error(t("bulk_result", { success: result.successCount, failed: result.failureCount }))
          }}
        />
      )}

      <OrderDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        order={selectedOrder}
        onEdit={() => setEditOrderOpen(true)}
        onAdvanceStatus={(order, nextStatus) => void handleDragEnd(order.id, nextStatus)}
        onRequestCancel={handleRequestCancel}
      />
      <EditOrderDialog open={editOrderOpen} onOpenChange={setEditOrderOpen} orderId={selectedOrder?.id ?? null} />

      {/* Advertencia de inventario insuficiente antes de confirmar la orden */}
      <AlertDialog
        open={stockWarning !== null}
        onOpenChange={(open) => {
          if (!open) {
            pendingConfirmRef.current = null
            setStockWarning(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("stock_warning_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("stock_warning_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {(stockWarning ?? []).map((item, index) => (
              <li
                key={item.itemId ?? index}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              >
                <span className="min-w-0 truncate font-medium">{item.name}</span>
                <span className="shrink-0 font-mono tabular-nums">
                  {t("stock_warning_line", { requested: item.requested, available: item.available })}
                </span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("stock_warning_cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDespiteShortage}>{t("stock_warning_confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancelación de orden con disposición Restocked vs Waste */}
      <AlertDialog open={cancellingOrder !== null} onOpenChange={(open) => !open && setCancellingOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancel_order_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {cancellingOrder
                ? t("cancel_order_desc", {
                    reference: cancellingOrder.externalOrderId?.slice(0, 8) ?? cancellingOrder.id.slice(0, 8),
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t("cancel_disposition_label")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCancellationType("Restocked")}
                  className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    cancellationType === "Restocked"
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="block font-semibold">{t("cancel_restocked")}</span>
                  <span className="mt-0.5 block text-[11px] opacity-80">{t("cancel_restocked_desc")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCancellationType("Waste")}
                  className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    cancellationType === "Waste"
                      ? "border-amber-500 bg-amber-500/10 font-medium text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="block font-semibold">{t("cancel_waste")}</span>
                  <span className="mt-0.5 block text-[11px] opacity-80">{t("cancel_waste_desc")}</span>
                </button>
              </div>
            </div>
            <Input
              placeholder={t("cancel_reason_placeholder")}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelOrderMutation.isPending}
              onClick={handleConfirmCancelOrder}
            >
              {t("confirm_cancel_order")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Domiciliario al pasar un pedido a domicilio a "En camino" */}
      <CourierPickerDialog
        open={dispatchOrder !== null}
        onOpenChange={(open) => !open && setDispatchOrder(null)}
        branchId={dispatchOrder?.branchId ?? null}
        title={t("delivery_dispatch_title")}
        description={t("delivery_dispatch_desc")}
        confirmLabel={t("delivery_dispatch")}
        defaultCourierId={dispatchOrder?.courierId ?? null}
        isPending={updateStatusMutation.isPending}
        onConfirm={(courierId) => dispatchOrder && applyStatus(dispatchOrder.id, "Shipped", courierId)}
      />

      {/* Asignar domiciliario desde el menú rápido de tarjeta */}
      <CourierPickerDialog
        open={assigningCourierOrder !== null}
        onOpenChange={(open) => !open && setAssigningCourierOrder(null)}
        branchId={assigningCourierOrder?.branchId ?? null}
        title={t("courier_assign_title")}
        confirmLabel={t("courier_assign")}
        defaultCourierId={assigningCourierOrder?.courierId ?? null}
        allowNone={assigningCourierOrder?.statusCode === "Ready"}
        isPending={assignCourierMutation.isPending}
        onConfirm={(courierId) => {
          if (!assigningCourierOrder) return
          assignCourierMutation.mutate(
            { orderId: assigningCourierOrder.id, courierId },
            {
              onSuccess: () => {
                setAssigningCourierOrder(null)
                notify.success(courierId ? t("courier_assigned") : t("courier_unassigned_ok"))
              },
              onError: (err) => {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                notify.error(msg || t("status_update_failed"))
              },
            }
          )
        }}
      />

      {/* Creación manual de órdenes (venta de caja / domicilio) */}
      <Dialog open={createOrderOpen && !createOrderBranchId} onOpenChange={setCreateOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("create_order")}</DialogTitle>
            <DialogDescription>{t("create_order_branch_hint")}</DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm">
            <span>{t("viewing_branch")}</span>
            <select
              className="h-11 w-full rounded-md border bg-background px-3"
              value=""
              onChange={(event) => setCreateOrderBranchId(event.target.value)}
            >
              <option value="" disabled>
                {t("select_branch")}
              </option>
              {branchesWithOrdersModule.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </DialogContent>
      </Dialog>
      <ManualOrderDialog
        open={createOrderOpen && Boolean(createOrderBranchId)}
        onOpenChange={setCreateOrderOpen}
        branchId={createOrderBranchId}
      />
    </div>
  )
}

type IntegrationState = "active" | "configured" | "none"

function StatusDot({ state }: { state: IntegrationState }) {
  return (
    <span
      aria-hidden
      className={`ml-1.5 inline-block size-2.5 shrink-0 rounded-full ${
        state === "active" ? "bg-emerald-500" : state === "configured" ? "bg-amber-500" : "bg-red-500"
      }`}
    />
  )
}

function integrationTitle(state: IntegrationState, t: ReturnType<typeof useTranslation>["t"]): string {
  return state === "active" ? t("active") : state === "configured" ? t("int_configured") : t("int_none")
}
