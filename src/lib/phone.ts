import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max"

export const DEFAULT_PHONE_COUNTRY: CountryCode = "CO"

export interface PhoneAnalysis {
  /** E.164 con "+" (p. ej. "+573001234567") o null si no se pudo interpretar. */
  e164: string | null
  /** El número existe según el plan de numeración del país. */
  valid: boolean
  country: CountryCode | null
  /** Número nacional sin indicativo (útil para búsquedas por sufijo). */
  nationalNumber: string | null
  /** MOBILE, FIXED_LINE, FIXED_LINE_OR_MOBILE, ... (undefined si no se sabe). */
  type: string | undefined
}

/** Acepta un ISO-2 válido o cae al país por defecto. */
export function toCountryCode(value: string | null | undefined): CountryCode {
  const code = (value ?? "").trim().toUpperCase()
  try {
    if (code.length === 2) {
      getCountryCallingCode(code as CountryCode)
      return code as CountryCode
    }
  } catch {
    // país no soportado → por defecto
  }
  return DEFAULT_PHONE_COUNTRY
}

/**
 * Interpreta un teléfono: con "+"/"00" como internacional; si no, en el país
 * por defecto del negocio. Si eso falla, prueba si los dígitos ya traen el
 * indicativo (p. ej. "573001234567"). Misma regla que el backend.
 */
export function analyzePhone(raw: string | null | undefined, defaultCountry: CountryCode): PhoneAnalysis {
  const empty: PhoneAnalysis = { e164: null, valid: false, country: null, nationalNumber: null, type: undefined }
  const text = (raw ?? "").trim()
  if (!text) return empty

  const international = text.startsWith("+") || text.replace(/\D/g, "").startsWith("00")
  const digits = text.replace(/\D/g, "").replace(/^00/, "")
  const candidates = international
    ? [parsePhoneNumberFromString(`+${digits}`)]
    : [parsePhoneNumberFromString(text, defaultCountry), parsePhoneNumberFromString(`+${digits}`)]

  const parsed = candidates.find((p) => p?.isValid()) ?? candidates[0]
  if (!parsed) return empty
  return {
    e164: parsed.number,
    valid: parsed.isValid(),
    country: parsed.country ?? null,
    nationalNumber: parsed.nationalNumber,
    type: parsed.getType(),
  }
}

/** Valor a guardar: E.164 si es válido; si no, el texto tal cual (el formulario lo marcará). */
export function normalizePhoneForSave(raw: string | null | undefined, defaultCountry: CountryCode): string {
  const result = analyzePhone(raw, defaultCountry)
  return result.valid && result.e164 ? result.e164 : (raw ?? "").trim()
}

/** Indica si un teléfono opcional es aceptable (vacío o válido). */
export function isOptionalPhoneValid(raw: string | null | undefined, defaultCountry: CountryCode): boolean {
  return !(raw ?? "").trim() || analyzePhone(raw, defaultCountry).valid
}

/**
 * Regla para formularios: el teléfono es opcional, pero si se escribe debe ser
 * válido. `PhoneInput` ya entrega E.164 para números de otros países; los
 * registros antiguos sin indicativo se interpretan como colombianos.
 */
export function isFormPhoneValid(value: string | null | undefined): boolean {
  return isOptionalPhoneValid(value, DEFAULT_PHONE_COUNTRY)
}
