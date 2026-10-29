import { useCallback, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Crosshair, MapPin, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { setBranchLocation } from "@/features/business/branches/services/branches.service"
import type { Branch } from "@/features/business/branches/types"
import { DeliveryMap, type MapPoint } from "./delivery-map"
import { getApiErrorMessage } from "../utils/order-helpers"

interface GeocodeResult {
  lat: string
  lon: string
  display_name: string
}

/**
 * Busca una dirección con Nominatim (OpenStreetMap). Solo se llama al pulsar
 * "Buscar" para respetar su política de uso (máx. 1 consulta por segundo).
 */
async function geocode(query: string, countryCode?: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ format: "json", limit: "5", q: query })
  if (countryCode) params.set("countrycodes", countryCode.toLowerCase())
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new Error(`geocode ${response.status}`)
  return (await response.json()) as GeocodeResult[]
}

interface Props {
  branch: Branch
  countryCode?: string
}

/** Ubicar la sucursal en el mapa: buscar su dirección, usar el GPS o pulsar el mapa. */
export function BranchLocationPicker({ branch, countryCode }: Props) {
  const { t } = useTranslation("business-orders")
  const qc = useQueryClient()
  const saved = useMemo<MapPoint | null>(
    () =>
      branch.latitude != null && branch.longitude != null
        ? { latitude: branch.latitude, longitude: branch.longitude }
        : null,
    [branch.latitude, branch.longitude]
  )
  const [draft, setDraft] = useState<MapPoint | null>(null)
  const [query, setQuery] = useState(branch.address ?? "")
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const point = draft ?? saved

  const pick = useCallback((latitude: number, longitude: number) => setDraft({ latitude, longitude }), [])

  const save = useMutation({
    mutationFn: (p: MapPoint) => setBranchLocation(branch.id, p.latitude, p.longitude),
    onSuccess: async () => {
      setDraft(null)
      notify.success(t("location_saved"))
      await qc.invalidateQueries({ queryKey: ["branches"] })
    },
    onError: (err) => notify.error(getApiErrorMessage(err, t("status_update_failed"))),
  })

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const found = await geocode(query.trim(), countryCode)
      setResults(found)
      if (found.length === 0) notify.error(t("location_not_found"))
      else pick(Number(found[0].lat), Number(found[0].lon))
    } catch {
      notify.error(t("location_search_failed"))
    } finally {
      setSearching(false)
    }
  }

  const locateWithGps = () => {
    if (!navigator.geolocation) return notify.error(t("location_gps_unavailable"))
    navigator.geolocation.getCurrentPosition(
      (pos) => pick(Number(pos.coords.latitude.toFixed(6)), Number(pos.coords.longitude.toFixed(6))),
      () => notify.error(t("location_gps_unavailable")),
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }

  return (
    <Card id="location" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-5 text-primary" />
          {t("location_title")}
        </CardTitle>
        <CardDescription>{t("location_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void search()
          }}
        >
          <Input
            aria-label={t("location_search_placeholder")}
            placeholder={t("location_search_placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-56 flex-1"
          />
          <Button type="submit" variant="outline" disabled={searching || !query.trim()}>
            <Search className="mr-1.5 size-4" />
            {t("location_search")}
          </Button>
          <Button type="button" variant="outline" onClick={locateWithGps}>
            <Crosshair className="mr-1.5 size-4" />
            {t("location_use_gps")}
          </Button>
        </form>
        {results.length > 1 && (
          <ul className="space-y-1 text-xs">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-1 text-left hover:bg-accent"
                  onClick={() => pick(Number(r.lat), Number(r.lon))}
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <DeliveryMap store={point} onPick={pick} pickHint={t("location_pick_hint")} />
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!draft || save.isPending} onClick={() => draft && save.mutate(draft)}>
            {t("location_save")}
          </Button>
          {draft && (
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t("cancel")}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {point ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : t("location_not_set")}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
