export interface GpsPoint {
  latitude: number
  longitude: number
  accuracyMeters: number
  headingDegrees: number | null
  speedMetersPerSecond: number | null
  recordedAtUtc: string
  receivedAtUtc: string
}
export interface GeoCoordinate {
  latitude: number
  longitude: number
}
export type LocationStatus = "live" | "stale" | "waiting" | "paused" | "finished"
export interface TrackingSession {
  shiftId: string
  sessionId: string | null
  sharing: boolean
  startedAtUtc: string | null
  lastReceivedAtUtc: string | null
  minIntervalSeconds: number
  staleAfterSeconds: number
}
export interface CourierTrackingSnapshot {
  shiftId: string
  courierId: string
  courierName: string
  sharing: boolean
  locationStatus: LocationStatus
  position: GpsPoint | null
  activeDeliveries: number
}
export interface BranchTrackingSnapshot {
  branchId: string
  checkedAtUtc: string
  staleAfterSeconds: number
  couriers: CourierTrackingSnapshot[]
}
export interface RoadRoute {
  distanceMeters: number
  durationSeconds: number
  geometry: GeoCoordinate[]
  calculatedAtUtc: string
  source: string
}
export interface RoadRouteResult {
  status: string
  route: RoadRoute | null
}
export interface CourierTrackingDetail {
  courier: CourierTrackingSnapshot
  trail: GpsPoint[]
  destinations: { orderId: string; reference: string; position: GeoCoordinate }[]
  roadRoute: RoadRouteResult
}
export interface PublicDeliveryTracking {
  reference: string
  status: string
  locationStatus: LocationStatus
  position: GpsPoint | null
  destination: GeoCoordinate | null
  roadRoute: RoadRouteResult
  otherStops: boolean
  checkedAtUtc: string
  staleAfterSeconds: number
  expiresAtUtc: string
}
export interface TrackingLink {
  path: string
  url: string | null
  expiresAtUtc: string
}
export interface PublishLocation {
  sessionId: string
  latitude: number
  longitude: number
  accuracyMeters: number
  recordedAtUtc: string
  headingDegrees: number | null
  speedMetersPerSecond: number | null
}
