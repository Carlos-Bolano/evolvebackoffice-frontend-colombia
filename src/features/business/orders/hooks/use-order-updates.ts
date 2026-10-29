import { useEffect, useRef, useState } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { api } from "@/config/axios-client"
import { playOrderChime } from "@/utils/order-chime"

/** Queries que muestran órdenes: se refrescan cuando llega o cambia una. */
export function invalidateOrderViews(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["orders"] }),
    qc.invalidateQueries({ queryKey: ["order-closing-preview"] }),
    qc.invalidateQueries({ queryKey: ["delivery-operations"] }),
    qc.invalidateQueries({ queryKey: ["delivery-runs"] }),
    qc.invalidateQueries({ queryKey: ["dashboard"] }),
    qc.invalidateQueries({ queryKey: ["order-timeline"] }),
  ])
}

/**
 * Long-poll de `GET /api/orders/updates?includeChanges=true`: cualquier orden
 * nueva o con cambios (webhook de Cluvi, otro usuario, domiciliario) refresca
 * las vistas abiertas. Con `chimeOnReady` suena cuando un pedido queda Listo.
 */
export interface OrderConnection {
  state: "connecting" | "connected" | "reconnecting" | "offline"
  lastSuccess: number | null
  retry: () => void
}

export function useOrderUpdates(branchId: string | null, { chimeOnReady = false }: { chimeOnReady?: boolean } = {}) {
  const qc = useQueryClient()
  const ready = useRef(new Set<string>())
  const [attempt, setAttempt] = useState(0)
  const [connection, setConnection] = useState<Omit<OrderConnection, "retry">>({
    state: navigator.onLine ? "connecting" : "offline",
    lastSuccess: null,
  })
  useEffect(() => {
    const controller = new AbortController()
    let cursor: string | undefined
    let recovering = true
    const offline = () => setConnection((s) => ({ ...s, state: "offline" }))
    const online = () => {
      setConnection((s) => ({ ...s, state: "reconnecting" }))
      setAttempt((n) => n + 1)
    }
    window.addEventListener("offline", offline)
    window.addEventListener("online", online)
    const loop = async () => {
      while (!controller.signal.aborted) {
        try {
          const result = await api.get<{
            data: { id: string; status: string; branchId: string | null }[]
            nowUtc: string
          }>("/api/orders/updates", {
            params: { sinceUtc: cursor, waitSeconds: 25, includeChanges: true },
            signal: controller.signal,
          })
          if (controller.signal.aborted) return
          cursor = result.data.nowUtc
          let sound = false
          for (const order of result.data.data) {
            if (branchId && order.branchId !== branchId) continue
            if (order.status === "Ready" && !ready.current.has(order.id)) {
              ready.current.add(order.id)
              sound = true
            } else if (order.status !== "Ready") ready.current.delete(order.id)
          }
          if (sound && chimeOnReady) playOrderChime()
          if (result.data.data.length || recovering) await invalidateOrderViews(qc)
          if (controller.signal.aborted) return
          recovering = false
          setConnection({ state: navigator.onLine ? "connected" : "offline", lastSuccess: Date.now() })
        } catch {
          if (controller.signal.aborted) return
          recovering = true
          setConnection((s) => ({ ...s, state: navigator.onLine ? "reconnecting" : "offline" }))
          await new Promise<void>((resolve) => {
            const finish = () => {
              window.clearTimeout(timer)
              controller.signal.removeEventListener("abort", finish)
              resolve()
            }
            const timer = window.setTimeout(finish, 8000)
            controller.signal.addEventListener("abort", finish, { once: true })
          })
        }
      }
    }
    void loop()
    return () => {
      controller.abort()
      window.removeEventListener("online", online)
      window.removeEventListener("offline", offline)
    }
  }, [qc, branchId, chimeOnReady, attempt])
  return {
    ...connection,
    retry: () => {
      setConnection((s) => ({ ...s, state: navigator.onLine ? "reconnecting" : "offline" }))
      setAttempt((n) => n + 1)
    },
  }
}
