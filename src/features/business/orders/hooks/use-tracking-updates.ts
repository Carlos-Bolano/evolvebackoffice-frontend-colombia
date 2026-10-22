import { useEffect, useState } from "react"
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr"
import { appConfig } from "@/config/env"
import { getTrackingTicket } from "../services/delivery-tracking.service"

/** Notifications contain no GPS data; every update refetches an authorized snapshot. */
export function useTrackingUpdates(scope: { branchId?: string; token?: string }, onChange: () => void) {
  const [state, setState] = useState<"connecting" | "connected" | "fallback">("connecting")
  const { branchId, token } = scope
  useEffect(() => {
    if (!branchId && !token) return
    let disposed = false
    let retry: ReturnType<typeof setTimeout> | undefined
    const connection = new HubConnectionBuilder()
      .withUrl(`${appConfig.apiBaseUrl}/hubs/delivery-tracking`, { withCredentials: false })
      .configureLogging(LogLevel.None)
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .build()
    const subscribe = async () => {
      if (branchId) {
        const ticket = await getTrackingTicket(branchId)
        if (disposed) return
        await connection.invoke("WatchBranch", ticket.ticket)
      } else await connection.invoke("WatchPublic", token)
      if (!disposed) {
        setState("connected")
        onChange()
      }
    }
    const start = async () => {
      try {
        await connection.start()
        if (disposed) {
          await connection.stop()
          return
        }
        await subscribe()
      } catch {
        if (!disposed) {
          setState("fallback")
          await connection.stop().catch(() => undefined)
          clearTimeout(retry)
          if (!disposed) retry = setTimeout(() => void start(), 5_000)
        }
      }
    }
    connection.on("TrackingChanged", () => {
      if (!disposed) onChange()
    })
    connection.onreconnecting(() => {
      if (!disposed) setState("connecting")
    })
    connection.onreconnected(() => {
      void subscribe().catch(() => connection.stop())
    })
    connection.onclose(() => {
      if (!disposed) {
        setState("fallback")
        clearTimeout(retry)
        retry = setTimeout(() => void start(), 5_000)
      }
    })
    void start()
    return () => {
      disposed = true
      clearTimeout(retry)
      void connection.stop()
    }
  }, [branchId, token, onChange])
  return state
}
