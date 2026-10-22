import { useEffect, useRef, useState } from "react"
import {
  publishTrackingLocation,
  startTrackingSession,
  stopTrackingSession,
} from "../services/delivery-tracking.service"
import type { PublishLocation, TrackingSession } from "../types/tracking"

export type GpsPhase =
  | "idle"
  | "starting"
  | "waiting"
  | "sharing"
  | "error"
  | "denied"
  | "offline"
  | "stopping"
  | "pause_pending"
type GpsState = { phase: GpsPhase; message?: string; lastPublishedAt?: string; accuracy?: number }
const status = (error: unknown) => (error as { response?: { status?: number } })?.response?.status

export function useCourierLocation(identity: string, onSessionStarted: (session: TrackingSession) => void) {
  const [state, setState] = useState<GpsState>({ phase: "idle" })
  const [capturing, setCapturing] = useState(false)
  const runtime = useRef({
    epoch: 0,
    watch: null as number | null,
    session: "",
    pendingStop: "",
    sending: false,
    latest: null as PublishLocation | null,
    lastAttempt: 0,
    timer: undefined as ReturnType<typeof setInterval> | undefined,
  })
  const onStarted = useRef(onSessionStarted)
  useEffect(() => {
    onStarted.current = onSessionStarted
  }, [onSessionStarted])
  const clearLocal = () => {
    const r = runtime.current
    if (r.watch !== null) navigator.geolocation?.clearWatch(r.watch)
    r.watch = null
    clearInterval(r.timer)
    r.timer = undefined
    r.latest = null
  }
  useEffect(() => {
    const r = runtime.current
    return () => {
      r.epoch++
      if (r.watch !== null) navigator.geolocation?.clearWatch(r.watch)
      clearInterval(r.timer)
      const session = r.session || r.pendingStop
      r.session = ""
      if (session) void stopTrackingSession(session).catch(() => undefined)
    }
  }, [identity])

  const stop = async () => {
    const r = runtime.current
    r.epoch++
    clearLocal()
    setCapturing(false)
    const session = r.session || r.pendingStop
    r.session = ""
    if (!session) {
      setState({ phase: "idle" })
      return
    }
    r.pendingStop = session
    setState((old) => ({ ...old, phase: "stopping" }))
    try {
      await stopTrackingSession(session)
      r.pendingStop = ""
      setState({ phase: "idle" })
    } catch (error) {
      if ([401, 403, 404].includes(status(error) ?? 0)) {
        r.pendingStop = ""
        setState({ phase: "idle" })
      } else setState((old) => ({ ...old, phase: "pause_pending", message: "tracking_pause_pending" }))
    }
  }

  const start = async () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setState({ phase: "error", message: "tracking_gps_unavailable" })
      return
    }
    const r = runtime.current
    if (r.pendingStop) {
      await stop()
      return
    }
    if (r.session) return
    const epoch = ++r.epoch
    setState({ phase: "starting" })
    try {
      const session = await startTrackingSession()
      if (epoch !== r.epoch) {
        if (session.sessionId) void stopTrackingSession(session.sessionId).catch(() => undefined)
        return
      }
      if (!session.sessionId) throw new Error("Missing tracking session")
      r.session = session.sessionId
      setCapturing(true)
      r.lastAttempt = 0
      onStarted.current(session)
      setState({ phase: "waiting" })
      const send = async () => {
        if (epoch !== r.epoch || r.sending || !r.latest || !r.session || Date.now() - r.lastAttempt < 5_000) return
        if (Date.now() - Date.parse(r.latest.recordedAtUtc) > 30_000) return
        const point = r.latest
        r.lastAttempt = Date.now()
        r.sending = true
        try {
          const result = await publishTrackingLocation(point)
          if (epoch === r.epoch)
            setState({
              phase: "sharing",
              lastPublishedAt: result.position.receivedAtUtc,
              accuracy: result.position.accuracyMeters,
            })
        } catch (error) {
          if (epoch !== r.epoch) return
          if ([401, 403, 404].includes(status(error) ?? 0)) {
            clearLocal()
            r.session = ""
            r.epoch++
            setCapturing(false)
            setState({ phase: "error", message: "tracking_session_ended" })
          } else setState((old) => ({ ...old, phase: "offline", message: "tracking_gps_network_error" }))
        } finally {
          r.sending = false
        }
      }
      const success = (position: GeolocationPosition) => {
        if (epoch !== r.epoch) return
        const c = position.coords
        if (
          !Number.isFinite(position.timestamp) ||
          position.timestamp < Date.parse(session.startedAtUtc ?? "") - 1000 ||
          Date.now() - position.timestamp > 30_000
        ) {
          setState((old) => ({ ...old, phase: "waiting", message: "tracking_gps_waiting_hint" }))
          return
        }
        if (
          !Number.isFinite(c.latitude) ||
          !Number.isFinite(c.longitude) ||
          !Number.isFinite(c.accuracy) ||
          c.accuracy > 1000
        ) {
          setState((old) => ({ ...old, phase: "error", message: "tracking_gps_low_accuracy" }))
          return
        }
        r.latest = {
          sessionId: r.session,
          latitude: c.latitude,
          longitude: c.longitude,
          accuracyMeters: Math.max(1, c.accuracy),
          recordedAtUtc: new Date(position.timestamp).toISOString(),
          headingDegrees: c.heading !== null && Number.isFinite(c.heading) ? c.heading : null,
          speedMetersPerSecond: c.speed !== null && Number.isFinite(c.speed) ? c.speed : null,
        }
        void send()
      }
      const failure = (error: GeolocationPositionError) => {
        if (epoch !== r.epoch) return
        if (error.code === 1) {
          clearLocal()
          const id = r.session
          r.session = ""
          r.epoch++
          setCapturing(false)
          if (id)
            void stopTrackingSession(id).catch(() => {
              r.pendingStop = id
            })
          setState({ phase: "denied", message: "tracking_gps_denied_hint" })
        } else setState((old) => ({ ...old, phase: "error", message: "tracking_gps_waiting_hint" }))
      }
      const settings = { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
      r.watch = navigator.geolocation.watchPosition(success, failure, settings)
      let heartbeat = 0
      r.timer = setInterval(() => {
        void send()
        if (++heartbeat % 3 === 0) navigator.geolocation.getCurrentPosition(success, failure, settings)
      }, 5_000)
    } catch {
      if (epoch === r.epoch) {
        clearLocal()
        const id = r.session
        r.session = ""
        if (id)
          void stopTrackingSession(id).catch(() => {
            r.pendingStop = id
          })
        setCapturing(false)
        setState({ phase: "error", message: "tracking_gps_start_failed" })
      }
    }
  }
  return { state, start, stop, capturing }
}
