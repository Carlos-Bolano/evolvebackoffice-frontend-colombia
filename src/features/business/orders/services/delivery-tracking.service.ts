import { api } from "@/config/axios-client"
import { appConfig } from "@/config/env"
import type {
  BranchTrackingSnapshot,
  CourierTrackingDetail,
  GpsPoint,
  PublicDeliveryTracking,
  PublishLocation,
  TrackingLink,
  TrackingSession,
} from "../types/tracking"

const root = "/api/delivery-tracking"
const config = { timeout: 10_000 }
export const getTrackingSession = async () => (await api.get<TrackingSession>(`${root}/me/session`, config)).data
export const startTrackingSession = async () => (await api.post<TrackingSession>(`${root}/me/session`, {}, config)).data
export const stopTrackingSession = async (id: string) => {
  await api.delete(`${root}/me/session/${id}`, config)
}
export const publishTrackingLocation = async (point: PublishLocation) =>
  (await api.post<{ accepted: boolean; position: GpsPoint }>(`${root}/me/positions`, point, config)).data
export const getBranchTracking = async (id: string) =>
  (await api.get<BranchTrackingSnapshot>(`${root}/branches/${id}`, config)).data
export const getCourierTracking = async (id: string) =>
  (await api.get<CourierTrackingDetail>(`${root}/shifts/${id}`, config)).data
export const getTrackingTicket = async (id: string) =>
  (await api.post<{ ticket: string; expiresAtUtc: string }>(`${root}/branches/${id}/ticket`, {}, config)).data
export const getTrackingLink = async (id: string): Promise<TrackingLink | null> => {
  const response = await api.get<TrackingLink>(`${root}/orders/${id}/link`, config)
  return response.status === 204 ? null : response.data
}
export const createTrackingLink = async (id: string, renew = false) =>
  (await api.post<TrackingLink>(`${root}/orders/${id}/link`, { renew }, config)).data
export const revokeTrackingLink = async (id: string) => {
  await api.delete(`${root}/orders/${id}/link`, config)
}

/** A public capability never inherits an administrator's auth or tenant headers. */
export async function getPublicTracking(token: string, signal?: AbortSignal): Promise<PublicDeliveryTracking> {
  const response = await fetch(`${appConfig.apiBaseUrl}/api/public/delivery-tracking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
  }).catch(() => {
    throw new Error("tracking_public_network_error")
  })
  if (!response.ok) throw new Error(response.status === 404 ? "tracking_unavailable" : "tracking_public_network_error")
  return response.json() as Promise<PublicDeliveryTracking>
}
