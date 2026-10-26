import { useQuery } from "@tanstack/react-query"
import type { CountryCode } from "libphonenumber-js/max"

import { getTenantSettings } from "@/features/business/onboarding/services/onboarding.service"
import { toCountryCode } from "@/lib/phone"

/**
 * País del negocio (ISO-2) para interpretar teléfonos sin indicativo.
 * Comparte caché con `useTenantSettings`; si no se puede leer, usa Colombia.
 */
export function useTenantCountry(): CountryCode {
  const { data } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: () => getTenantSettings(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
  return toCountryCode(data?.countryCode)
}
