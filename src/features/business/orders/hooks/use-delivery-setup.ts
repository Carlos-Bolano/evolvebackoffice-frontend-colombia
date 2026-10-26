import { useQuery } from "@tanstack/react-query"

import { getBranchById } from "@/features/business/branches/services/branches.service"
import { useBranchIntegrations } from "@/features/business/branches/hooks/use-branch-integrations"
import { useTenantPlatformModules } from "@/features/business/branches/hooks/use-branch-modules"
import { getDeliveryZones } from "../services/delivery-enhancements.service"
import { getBranchWhatsAppChannel } from "../services/whatsapp.service"
import { useDeliveryOperations } from "./use-delivery-operations"

export type DeliverySetupStepKey = "location" | "zones" | "couriers" | "whatsapp" | "cluvi" | "woocommerce"

export interface DeliverySetupStep {
  key: DeliverySetupStepKey
  done: boolean
  /** Los pasos opcionales no bloquean el "listo para operar". */
  optional: boolean
  /** Ruta interna para resolverlo (o ancla "#..." dentro de la página de configuración). */
  to: string
}

/**
 * Estado de configuración de domicilios de una sucursal. Reúne en un solo
 * lugar lo que antes había que descubrir por separado: ubicación, zonas,
 * domiciliarios con acceso, WhatsApp e integraciones con licencia.
 */
export function useDeliverySetup(branchId: string | null) {
  const enabled = Boolean(branchId)
  const branch = useQuery({
    queryKey: ["branches", "detail", branchId],
    queryFn: () => getBranchById(branchId!),
    enabled,
  })
  const zones = useQuery({
    queryKey: ["delivery-zones", branchId],
    queryFn: () => getDeliveryZones(branchId!),
    enabled,
  })
  const operations = useDeliveryOperations(branchId)
  const whatsapp = useQuery({
    queryKey: ["branch-whatsapp", branchId],
    queryFn: () => getBranchWhatsAppChannel(branchId!),
    enabled,
    retry: false,
  })
  const { data: integrations = [], isLoading: integrationsLoading } = useBranchIntegrations(branchId)
  const { hasCluvi, hasWooCommerce, isLoading: modulesLoading } = useTenantPlatformModules()

  const integrationActive = (code: string) => integrations.some((i) => i.platformCode === code && i.isActive)
  const configUrl = `/business/branches/${branchId}/config`

  const steps: DeliverySetupStep[] = [
    {
      key: "location",
      done: branch.data?.latitude != null && branch.data?.longitude != null,
      optional: false,
      to: "#location",
    },
    { key: "zones", done: (zones.data ?? []).some((z) => z.isActive), optional: false, to: "#zones" },
    {
      key: "couriers",
      done: (operations.data?.couriers.length ?? 0) > 0,
      optional: false,
      to: "/business/people/users",
    },
    {
      key: "whatsapp",
      done: whatsapp.data?.status === "Connected",
      optional: true,
      to: `${configUrl}#whatsapp`,
    },
  ]
  if (hasCluvi)
    steps.push({ key: "cluvi", done: integrationActive("CLUVI"), optional: true, to: `${configUrl}?tab=cluvi` })
  if (hasWooCommerce)
    steps.push({
      key: "woocommerce",
      done: integrationActive("WOOCOMMERCE"),
      optional: true,
      to: `${configUrl}?tab=woocommerce`,
    })

  const isLoading =
    enabled && (branch.isLoading || zones.isLoading || operations.isLoading || integrationsLoading || modulesLoading)
  const required = steps.filter((s) => !s.optional)

  return {
    branch: branch.data ?? null,
    zones: zones.data ?? [],
    steps,
    isLoading,
    completed: steps.filter((s) => s.done).length,
    readyToOperate: required.every((s) => s.done),
  }
}
