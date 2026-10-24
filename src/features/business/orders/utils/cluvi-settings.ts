function readSettings(settingsJson?: string | null): Record<string, unknown> {
  if (!settingsJson) return {}
  try {
    const value: unknown = JSON.parse(settingsJson)
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function readCluviStoreId(settingsJson?: string | null): string {
  const storeId = readSettings(settingsJson).storeId
  return typeof storeId === "string" || typeof storeId === "number" ? String(storeId) : ""
}

/** Cambiar credenciales o tienda no borra el token del webhook ni los medios de pago. */
export function withCluviStoreId(settingsJson: string | null | undefined, storeId: string): string {
  return JSON.stringify({ ...readSettings(settingsJson), storeId: storeId.trim() })
}

export function cluviWebhookUrl(
  baseUrl: string,
  tenantId: string | null | undefined,
  settingsJson?: string | null
): string | null {
  const settings = readSettings(settingsJson)
  const storeId = readCluviStoreId(settingsJson)
  if (!tenantId || !storeId || typeof settings.webhookToken !== "string" || !settings.webhookToken) return null
  return `${baseUrl.replace(/\/$/, "")}/api/webhooks/cluvi/${encodeURIComponent(tenantId)}/${encodeURIComponent(settings.webhookToken)}?storeId=${encodeURIComponent(storeId)}`
}
