import * as React from "react"
import { AsYouType, getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/max"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { analyzePhone } from "@/lib/phone"
import { useTenantCountry } from "@/hooks/use-tenant-country"
import { useTranslation } from "@/i18n/use-i18n"
import { useAppStore } from "@/store/app-store"

/** Emoji de bandera a partir del ISO-2 (indicadores regionales). */
function flag(country: string) {
  return country.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

interface PhoneInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "defaultValue" | "type"> {
  value: string | null | undefined
  /** Recibe E.164 ("+573001234567") cuando el número es interpretable; si no, el texto tal cual. */
  onChange: (value: string) => void
  /** País inicial; por defecto el país del negocio. */
  defaultCountry?: CountryCode
  /** Muestra debajo si el número es válido, fijo o inválido. */
  showFeedback?: boolean
}

/**
 * Campo de teléfono con selector de país (indicativo) y validación con
 * libphonenumber. Guarda siempre en formato internacional E.164 para que
 * WhatsApp llegue al número correcto aunque el cliente sea de otro país.
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountry,
  showFeedback = true,
  className,
  disabled,
  ...inputProps
}: PhoneInputProps) {
  const { t } = useTranslation()
  const locale = useAppStore((s) => s.locale)
  const tenantCountry = useTenantCountry()
  const fallbackCountry = defaultCountry ?? tenantCountry

  // País elegido o deducido del número; null = sigue al país del negocio
  // (que puede terminar de cargar después del primer render).
  const [countryChoice, setCountry] = React.useState<CountryCode | null>(
    () => analyzePhone(value, fallbackCountry).country
  )
  const country = countryChoice ?? fallbackCountry
  const [text, setText] = React.useState(() => displayText(value, country))
  // Último valor conocido (emitido por nosotros o recibido del padre).
  const [syncedValue, setSyncedValue] = React.useState(value ?? "")

  // Cambio externo (p. ej. al elegir un cliente existente): se ajusta el
  // estado durante el render, sin efecto.
  if ((value ?? "") !== syncedValue) {
    const nextCountry = analyzePhone(value, fallbackCountry).country
    setSyncedValue(value ?? "")
    setCountry(nextCountry)
    setText(displayText(value, nextCountry ?? fallbackCountry))
  }

  const countries = React.useMemo(() => {
    let names: Intl.DisplayNames | null = null
    try {
      names = new Intl.DisplayNames([locale], { type: "region" })
    } catch {
      names = null
    }
    return getCountries()
      .map((code) => ({ code, name: names?.of(code) ?? code, callingCode: getCountryCallingCode(code) }))
      .sort((a, b) => (a.code === fallbackCountry ? -1 : b.code === fallbackCountry ? 1 : a.name.localeCompare(b.name)))
  }, [locale, fallbackCountry])

  const emit = (nextText: string, nextCountry: CountryCode) => {
    const parsed = analyzePhone(nextText, nextCountry)
    const next = !nextText.trim() ? "" : (parsed.e164 ?? nextText.trim())
    setSyncedValue(next)
    onChange(next)
  }

  const handleText = (raw: string) => {
    // Si pegan un número con "+", el país se deduce del indicativo.
    const parsed = analyzePhone(raw, country)
    if (raw.trim().startsWith("+") && parsed.valid && parsed.country) {
      setCountry(parsed.country)
      setText(new AsYouType(parsed.country).input(parsed.nationalNumber ?? ""))
      emit(raw, parsed.country)
      return
    }
    setText(raw)
    emit(raw, country)
  }

  const handleCountry = (next: CountryCode) => {
    setCountry(next)
    emit(text, next)
  }

  const analysis = analyzePhone(text, country)
  const hasText = Boolean(text.trim())
  const isLandline = analysis.valid && analysis.type === "FIXED_LINE"

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex h-11 w-full items-stretch overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 dark:bg-secondary",
          hasText && !analysis.valid && "border-destructive/60",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <select
          aria-label={t("phone_country")}
          value={country}
          disabled={disabled}
          onChange={(e) => handleCountry(e.target.value as CountryCode)}
          className="max-w-28 shrink-0 border-r border-border/70 bg-transparent pr-1 pl-3 text-sm outline-none"
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {flag(c.code)} +{c.callingCode} {c.name}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          data-slot="input"
          disabled={disabled}
          value={text}
          aria-invalid={hasText && !analysis.valid}
          onChange={(e) => handleText(e.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/90"
          {...inputProps}
        />
      </div>
      {showFeedback && hasText && (
        <p
          className={cn(
            "flex items-center gap-1 text-xs",
            !analysis.valid ? "text-destructive" : isLandline ? "text-amber-600" : "text-emerald-600"
          )}
        >
          {!analysis.valid ? (
            <>
              <XCircle className="size-3.5" />
              {t("phone_invalid", { country: countries.find((c) => c.code === country)?.name ?? country })}
            </>
          ) : isLandline ? (
            <>
              <AlertTriangle className="size-3.5" />
              {t("phone_landline_warning")}
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3.5" />
              {analysis.e164}
            </>
          )}
        </p>
      )}
    </div>
  )
}

/** Texto a mostrar en el campo: número nacional formateado del país detectado. */
function displayText(value: string | null | undefined, country: CountryCode) {
  const parsed = analyzePhone(value, country)
  if (parsed.valid && parsed.nationalNumber && parsed.country === country) {
    return new AsYouType(country).input(parsed.nationalNumber)
  }
  return value ?? ""
}
