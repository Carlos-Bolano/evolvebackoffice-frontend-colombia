import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { create } from "zustand"
import { BellRing } from "lucide-react"

import { fetchNewOrders } from "../services/orders.service"
import { invalidateOrderViews } from "./use-order-updates"
import type { NewOrderNotice } from "../types/api"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { playOrderChime } from "@/utils/order-chime"

const ORDERS_ROUTE = "/business/orders"
const RETRY_DELAY_MS = 8_000
const SESSION_NOTIFICATIONS_KEY = "business.orders.notifications"
const LOCAL_MUTED_KEY = "business.orders.notifications.muted"
const MAX_NOTIFICATIONS = 50

export type OrderNotificationKind = "new_order" | "sync_error" | "cancelled_dispatched"

export interface OrderNotificationItem {
  id: string
  orderId: string
  externalOrderId: string | null
  customerName: string | null
  total: number
  status: string
  createdAt: string
  read: boolean
  kind: OrderNotificationKind
}

function loadSessionNotifications(): OrderNotificationItem[] {
  try {
    const raw = sessionStorage.getItem(SESSION_NOTIFICATIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as OrderNotificationItem[]) : []
  } catch {
    return []
  }
}

function saveSessionNotifications(items: OrderNotificationItem[]) {
  try {
    sessionStorage.setItem(SESSION_NOTIFICATIONS_KEY, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)))
  } catch {
    // Ignore storage quota errors
  }
}

function loadMutedPreference(): boolean {
  try {
    return localStorage.getItem(LOCAL_MUTED_KEY) === "true"
  } catch {
    return false
  }
}

interface OrderNotificationsState {
  notifications: OrderNotificationItem[]
  muted: boolean
  addNotifications: (items: Omit<OrderNotificationItem, "id" | "read">[]) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  toggleMute: () => void
  testSound: () => void
}

export const useOrderNotificationsStore = create<OrderNotificationsState>((set) => ({
  notifications: loadSessionNotifications(),
  muted: loadMutedPreference(),
  addNotifications: (items) =>
    set((state) => {
      const existingKeys = new Set(state.notifications.map((n) => `${n.kind}:${n.orderId}:${n.status}`))
      const fresh: OrderNotificationItem[] = []
      for (const item of items) {
        const key = `${item.kind}:${item.orderId}:${item.status}`
        if (existingKeys.has(key)) continue
        existingKeys.add(key)
        fresh.push({
          ...item,
          id: `${item.kind}-${item.orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          read: false,
        })
      }
      if (fresh.length === 0) return state
      const next = [...fresh, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
      saveSessionNotifications(next)
      return { notifications: next }
    }),
  markAsRead: (id) =>
    set((state) => {
      const next = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
      saveSessionNotifications(next)
      return { notifications: next }
    }),
  markAllAsRead: () =>
    set((state) => {
      const next = state.notifications.map((n) => ({ ...n, read: true }))
      saveSessionNotifications(next)
      return { notifications: next }
    }),
  clearAll: () =>
    set(() => {
      saveSessionNotifications([])
      return { notifications: [] }
    }),
  toggleMute: () =>
    set((state) => {
      const nextMuted = !state.muted
      try {
        localStorage.setItem(LOCAL_MUTED_KEY, String(nextMuted))
      } catch {
        // Ignore storage errors
      }
      return { muted: nextMuted }
    }),
  testSound: () => {
    playOrderChime()
  },
}))

function prettyPlatform(code: string): string {
  const upper = code.toUpperCase()
  if (upper === "CLUVI") return "Cluvi"
  if (upper === "WOOCOMMERCE") return "WooCommerce"
  if (upper === "MANUAL" || upper === "POSCO") return "Manual"
  return code
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * Escucha en tiempo real la llegada de órdenes nuevas (Cluvi, WooCommerce o
 * manuales) mediante long-poll contra `GET /api/orders/updates` y mantiene
 * el centro de notificaciones de la sesión.
 */
export function useNewOrderNotifications(enabled: boolean) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation("business-orders")
  const store = useOrderNotificationsStore()

  // Establecer en refs para no reiniciar el loop por cambios de identidad.
  const navigateRef = useRef(navigate)
  const tRef = useRef(t)
  useEffect(() => {
    navigateRef.current = navigate
    tRef.current = t
  }, [navigate, t])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const controller = new AbortController()
    let cursor = new Date().toISOString()

    // Permiso de escritorio: una sola petición mientras sea "default".
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => undefined)
    }

    const handleOrders = (orders: NewOrderNotice[]) => {
      const platforms = [...new Set(orders.map((o) => prettyPlatform(o.platformCode)))].join(", ")
      const tt = tRef.current

      useOrderNotificationsStore.getState().addNotifications(
        orders.map((o) => ({
          orderId: o.id,
          externalOrderId: o.externalOrderId,
          customerName: o.customerName,
          total: o.total,
          status: o.status,
          createdAt: o.createdAt || new Date().toISOString(),
          kind: "new_order" as const,
        }))
      )

      if (!useOrderNotificationsStore.getState().muted) {
        playOrderChime()
      }
      void invalidateOrderViews(queryClient)

      // Toast visual dentro de la página: clic → secciones de órdenes.
      notify.custom(
        (toastItem) => (
          <button
            type="button"
            onClick={() => {
              notify.dismiss(toastItem.id)
              navigateRef.current(ORDERS_ROUTE)
            }}
            className="group flex w-full max-w-sm items-start gap-3 rounded-2xl border border-primary/30 bg-background px-4 py-3 text-left shadow-lg transition-colors hover:bg-accent"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <BellRing className="size-4 text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                {tt("new_order_toast", { count: orders.length, platform: platforms })}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{tt("new_order_open_orders")}</span>
            </span>
          </button>
        ),
        { duration: 10_000 }
      )

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const desktop = new Notification(tt("new_order_desktop_title"), {
            body: tt("new_order_desktop_body", { platform: platforms }),
            tag: "new-order",
          })
          desktop.onclick = () => {
            window.focus()
            desktop.close()
            navigateRef.current(ORDERS_ROUTE)
          }
        } catch {
          // Algunos navegadores exigen una acción de usuario previa: el toast
          // y el sonido siguen siendo la vía principal.
        }
      }
    }

    const loop = async () => {
      while (!cancelled) {
        try {
          const result = await fetchNewOrders(cursor, controller.signal)
          if (cancelled) return
          cursor = result.nowUtc
          if (result.data.length > 0) handleOrders(result.data)
        } catch {
          if (cancelled || controller.signal.aborted) return
          // Error de red, 401 por sesión vencida, etc. → backoff y reintento.
          await sleep(RETRY_DELAY_MS)
        }
      }
    }

    void loop()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, queryClient])

  const unreadCount = store.notifications.filter((n) => !n.read).length
  return {
    ...store,
    unreadCount,
  }
}
