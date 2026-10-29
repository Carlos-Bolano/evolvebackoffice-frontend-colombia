import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCourierLocation } from "../use-courier-location"
import {
  publishTrackingLocation,
  startTrackingSession,
  stopTrackingSession,
} from "../../services/delivery-tracking.service"
import type { TrackingSession } from "../../types/tracking"

vi.mock("../../services/delivery-tracking.service", () => ({
  publishTrackingLocation: vi.fn(),
  startTrackingSession: vi.fn(),
  stopTrackingSession: vi.fn(),
}))
const session: TrackingSession = {
  shiftId: "shift",
  sessionId: "session",
  sharing: true,
  startedAtUtc: new Date().toISOString(),
  lastReceivedAtUtc: null,
  minIntervalSeconds: 5,
  staleAfterSeconds: 60,
}
let onPosition: PositionCallback
let onError: PositionErrorCallback
const clearWatch = vi.fn()
const position = (timestamp = Date.now(), accuracy = 10) =>
  ({
    timestamp,
    coords: {
      latitude: 4.61,
      longitude: -74.08,
      accuracy,
      heading: null,
      speed: null,
      altitude: null,
      altitudeAccuracy: null,
    },
  }) as GeolocationPosition

describe("GPS lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("isSecureContext", true)
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: vi.fn((success: PositionCallback, failure: PositionErrorCallback) => {
          onPosition = success
          onError = failure
          return 42
        }),
        clearWatch,
        getCurrentPosition: vi.fn(),
      },
    })
    vi.mocked(startTrackingSession).mockResolvedValue(session)
    vi.mocked(stopTrackingSession).mockResolvedValue(undefined)
    vi.mocked(publishTrackingLocation).mockImplementation(async (point) => ({
      accepted: true,
      position: { ...point, receivedAtUtc: new Date().toISOString() },
    }))
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("does not capture without an explicit start and ignores callbacks after pause", async () => {
    const { result } = renderHook(() => useCourierLocation("courier:shift", vi.fn()))
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled()
    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      onPosition(position())
    })
    expect(publishTrackingLocation).toHaveBeenCalledTimes(1)
    await act(async () => {
      await result.current.stop()
    })
    await act(async () => {
      onPosition(position())
    })
    expect(publishTrackingLocation).toHaveBeenCalledTimes(1)
    expect(clearWatch).toHaveBeenCalledWith(42)
    expect(stopTrackingSession).toHaveBeenCalledWith("session")
  })
  it("stops a session whose start response arrives after unmount", async () => {
    let resolve!: (value: TrackingSession) => void
    vi.mocked(startTrackingSession).mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    const { result, unmount } = renderHook(() => useCourierLocation("courier:shift", vi.fn()))
    let pending!: Promise<void>
    act(() => {
      pending = result.current.start()
    })
    unmount()
    await act(async () => {
      resolve(session)
      await pending
    })
    expect(stopTrackingSession).toHaveBeenCalledWith("session")
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled()
  })
  it("rejects an old fix and non-finite accuracy without publishing", async () => {
    const { result } = renderHook(() => useCourierLocation("courier:shift", vi.fn()))
    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      onPosition(position(Date.now() - 60_000))
    })
    expect(result.current.state.message).toBe("tracking_gps_waiting_hint")
    await act(async () => {
      onPosition(position(Date.now(), Number.NaN))
    })
    expect(result.current.state.message).toBe("tracking_gps_low_accuracy")
    expect(publishTrackingLocation).not.toHaveBeenCalled()
  })
  it("clears local capture and revokes server consent on permission denial", async () => {
    const { result } = renderHook(() => useCourierLocation("courier:shift", vi.fn()))
    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      onError({ code: 1 } as GeolocationPositionError)
    })
    expect(result.current.capturing).toBe(false)
    expect(result.current.state.message).toBe("tracking_gps_denied_hint")
    expect(clearWatch).toHaveBeenCalledWith(42)
    expect(stopTrackingSession).toHaveBeenCalledWith("session")
  })
  it("keeps pause pending when offline and allows explicit retry", async () => {
    const { result } = renderHook(() => useCourierLocation("courier:shift", vi.fn()))
    await act(async () => {
      await result.current.start()
    })
    vi.mocked(stopTrackingSession).mockRejectedValueOnce(new Error("offline"))
    await act(async () => {
      await result.current.stop()
    })
    expect(result.current.capturing).toBe(false)
    expect(result.current.state.phase).toBe("pause_pending")
    await act(async () => {
      await result.current.stop()
    })
    expect(result.current.state.phase).toBe("idle")
  })
})
