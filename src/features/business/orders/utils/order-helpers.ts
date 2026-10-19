/** Mensaje de error del backend (`{ message }` o `{ error }`) o un genérico. */
export function getApiErrorMessage(error: unknown, fallback = "Error"): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: { message?: string; error?: string } } }).response
    return response?.data?.message ?? response?.data?.error ?? fallback
  }
  return fallback
}

/** Enlace de Google Maps a la dirección (coordenadas si existen, si no el texto). */
export function mapsUrl(order: {
  shippingLatitude: number | null
  shippingLongitude: number | null
  shippingStreet: string | null
  shippingCity: string | null
}): string | null {
  if (order.shippingLatitude != null && order.shippingLongitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${order.shippingLatitude},${order.shippingLongitude}`
  }
  const address = [order.shippingStreet, order.shippingCity].filter(Boolean).join(", ")
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null
}

/** Minutos transcurridos desde `iso` hasta `now` (null si no hay fecha). */
export function minutesSince(iso: string | null, now: number): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
}

/**
 * Tiempo transcurrido legible: minutos hasta 1 h, horas y minutos hasta 1 día
 * y días después (un pedido olvidado no se muestra como "hace 16958 min").
 */
export function elapsedLabelParts(
  minutes: number
):
  | { key: "elapsed_minutes"; count: number }
  | { key: "elapsed_hours"; hours: number; minutes: number }
  | { key: "elapsed_days"; count: number } {
  if (minutes < 60) return { key: "elapsed_minutes", count: minutes }
  if (minutes < 24 * 60) return { key: "elapsed_hours", hours: Math.floor(minutes / 60), minutes: minutes % 60 }
  return { key: "elapsed_days", count: Math.floor(minutes / (24 * 60)) }
}
