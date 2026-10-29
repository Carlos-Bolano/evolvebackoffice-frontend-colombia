import { useOrderUpdates } from "./use-order-updates"

/** Vistas de domicilios: refresco en vivo + aviso sonoro cuando un pedido queda Listo. */
export function useDeliveryUpdates(branchId: string | null) {
  return useOrderUpdates(branchId, { chimeOnReady: true })
}
