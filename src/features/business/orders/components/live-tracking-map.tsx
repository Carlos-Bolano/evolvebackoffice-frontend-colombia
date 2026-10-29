import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/use-i18n"
import type { GeoCoordinate, GpsPoint, RoadRoute } from "../types/tracking"

export interface TrackingMarker {
  id: string
  name: string
  point: GpsPoint
  stale?: boolean
}
const noPoints: GeoCoordinate[] = []
const valid = (p: GeoCoordinate) =>
  Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 &&
  Math.abs(p.longitude) <= 180

export function LiveTrackingMap({
  markers,
  trail = noPoints,
  destinations = noPoints,
  roadRoute = null,
  selectedId,
}: {
  markers: TrackingMarker[]
  trail?: GeoCoordinate[]
  destinations?: GeoCoordinate[]
  roadRoute?: RoadRoute | null
  selectedId?: string
}) {
  const { t } = useTranslation("business-orders")
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layers = useRef(new Map<string, { marker: L.Marker; accuracy: L.Circle; frame?: number }>())
  const trails = useRef<L.Polyline | null>(null)
  const roads = useRef<L.Polyline | null>(null)
  const destinationLayer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)
  const fittedWithCourier = useRef(false)
  const interacted = useRef(false)
  const [follow, setFollow] = useState(false)
  const [tileError, setTileError] = useState(false)

  useEffect(() => {
    if (!container.current) return
    const map = L.map(container.current, { scrollWheelZoom: false }).setView([4.61, -74.08], 12)
    mapRef.current = map
    const markInteraction = () => {
      interacted.current = true
    }
    const node = container.current
    node.addEventListener("pointerdown", markInteraction)
    node.addEventListener("keydown", markInteraction)
    const tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      referrerPolicy: "strict-origin-when-cross-origin",
      attribution:
        import.meta.env.VITE_MAP_TILE_ATTRIBUTION ||
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    tiles.on("tileerror", () => setTileError(true))
    map.on("dragstart", () => setFollow(false))
    map.on("zoomend", () => {
      if (container.current) container.current.dataset.mapZoom = String(map.getZoom())
    })
    trails.current = L.polyline([], { color: "#7c3aed", weight: 3, dashArray: "5, 7" }).addTo(map)
    roads.current = L.polyline([], { color: "#0284c7", weight: 5, opacity: 0.7 }).addTo(map)
    destinationLayer.current = L.layerGroup().addTo(map)
    const resize = new ResizeObserver(() => map.invalidateSize())
    resize.observe(container.current)
    const currentLayers = layers.current
    return () => {
      resize.disconnect()
      currentLayers.forEach((entry) => {
        if (entry.frame) cancelAnimationFrame(entry.frame)
      })
      currentLayers.clear()
      map.remove()
      node.removeEventListener("pointerdown", markInteraction)
      node.removeEventListener("keydown", markInteraction)
      mapRef.current = null
      fitted.current = false
      fittedWithCourier.current = false
      interacted.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const ids = new Set(markers.filter((m) => valid(m.point)).map((m) => m.id))
    for (const [id, entry] of layers.current)
      if (!ids.has(id)) {
        if (entry.frame) cancelAnimationFrame(entry.frame)
        map.removeLayer(entry.marker)
        map.removeLayer(entry.accuracy)
        layers.current.delete(id)
      }
    const bounds = L.latLngBounds([])
    for (const item of markers.filter((m) => valid(m.point))) {
      const to = L.latLng(item.point.latitude, item.point.longitude)
      bounds.extend(to)
      let entry = layers.current.get(item.id)
      if (!entry) {
        const icon = L.divIcon({
          className: "tracking-courier-icon",
          html: '<span aria-hidden="true" style="display:block;font-size:28px;font-weight:900;text-align:center;line-height:32px;text-shadow:0 1px 3px white">▲</span>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
        entry = {
          marker: L.marker(to, { icon, keyboard: true }).addTo(map),
          accuracy: L.circle(to, {
            radius: item.point.accuracyMeters,
            weight: 1,
            opacity: 0.3,
            fillOpacity: 0.06,
          }).addTo(map),
        }
        layers.current.set(item.id, entry)
      }
      const label = document.createElement("span")
      label.textContent = item.name
      entry.marker.unbindTooltip().bindTooltip(label)
      const element = entry.marker.getElement()
      if (element) {
        element.dataset.trackingMarker = item.id
        element.dataset.latitude = String(item.point.latitude)
        element.dataset.longitude = String(item.point.longitude)
        element.setAttribute("aria-label", item.name)
        element.style.color = item.stale ? "#78716c" : "#059669"
        const arrow = element.firstElementChild as HTMLElement | null
        if (arrow) arrow.style.transform = `rotate(${item.point.headingDegrees ?? 0}deg)`
      }
      entry.accuracy.setLatLng(to).setRadius(Math.max(1, item.point.accuracyMeters))
      if (entry.frame) cancelAnimationFrame(entry.frame)
      const from = entry.marker.getLatLng()
      const target = entry.marker
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || from.equals(to)) target.setLatLng(to)
      else {
        const started = performance.now()
        const animate = (now: number) => {
          const progress = Math.min(1, (now - started) / 700)
          target.setLatLng([from.lat + (to.lat - from.lat) * progress, from.lng + (to.lng - from.lng) * progress])
          if (progress < 1) entry!.frame = requestAnimationFrame(animate)
        }
        entry.frame = requestAnimationFrame(animate)
      }
    }
    const asLatLng = (p: GeoCoordinate): L.LatLngTuple => [p.latitude, p.longitude]
    trails.current?.setLatLngs(trail.filter(valid).map(asLatLng))
    roads.current?.setLatLngs((roadRoute?.geometry ?? []).filter(valid).map(asLatLng))
    destinationLayer.current?.clearLayers()
    for (const [index, point] of destinations.filter(valid).entries()) {
      L.circleMarker(asLatLng(point), { color: "#0284c7", radius: 7, fillOpacity: 0.8 })
        .bindTooltip(String(index + 1), { permanent: true, direction: "top" })
        .addTo(destinationLayer.current!)
      bounds.extend(asLatLng(point))
    }
    const firstCourier = !fittedWithCourier.current && markers.some((m) => valid(m.point))
    if ((!fitted.current || (firstCourier && !interacted.current)) && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 15, animate: false })
      fitted.current = true
    }
    if (firstCourier) fittedWithCourier.current = true
    const followed = markers.find((m) => m.id === selectedId) ?? markers[0]
    if (follow && followed && valid(followed.point)) map.panTo(asLatLng(followed.point), { animate: false })
  }, [markers, trail, destinations, roadRoute, selectedId, follow])

  return (
    <section className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("tracking_map_legend")}</p>
        <Button
          type="button"
          variant={follow ? "default" : "outline"}
          className="min-h-11"
          disabled={!markers.length}
          aria-pressed={follow}
          onClick={() => setFollow(!follow)}
        >
          {t(follow ? "tracking_following" : "tracking_follow")}
        </Button>
      </div>
      <div
        ref={container}
        role="region"
        aria-label={t("tracking_live_map")}
        className="relative z-0 h-80 w-full min-w-0 rounded-xl border sm:h-96"
      />
      {tileError && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
          {t("tracking_tiles_error")}
        </p>
      )}
    </section>
  )
}
