import { IntegrationConfigDialog } from "./integration-config-dialog"

/** Entrada compatible que comparte el mismo flujo de conexi?n de pedidos. */
export function CluviConfigWizard(props: { open: boolean; onOpenChange: (open: boolean) => void; branchId: string }) {
  return <IntegrationConfigDialog {...props} platform="CLUVI" />
}
