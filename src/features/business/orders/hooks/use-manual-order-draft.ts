import { useEffect, useRef, useState, type SetStateAction } from "react"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { useOrderWorkspaceKey } from "./use-order-workspace"

export interface OrderLine {
  key: string
  itemPublicId: string
  name: string
  sku: string | null
  basePrice: number
  price: number
  quantity: number
}

export const EMPTY_ORDER_DRAFT = {
  lines: [] as OrderLine[],
  paymentMethod: "CASH",
  status: "Confirmed",
  origin: "",
  notes: "",
  fulfillment: "pickup" as "pickup" | "delivery",
  street: "",
  city: "",
  shippingCost: "",
  customerName: "",
  customerPhone: "",
  customerId: null as string | null,
  personId: null as string | null,
  latitude: "",
  longitude: "",
  automaticShipping: false,
}
export type ManualOrderDraft = typeof EMPTY_ORDER_DRAFT

function recover(key: string): ManualOrderDraft | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) ?? "null")
    const d = stored?.value
    if (
      stored?.version !== 1 ||
      !d ||
      !Array.isArray(d.lines) ||
      d.lines.length > 100 ||
      !d.lines.every(
        (l: OrderLine) =>
          l &&
          typeof l.itemPublicId === "string" &&
          typeof l.key === "string" &&
          typeof l.name === "string" &&
          Number.isFinite(l.price) &&
          Number.isFinite(l.basePrice) &&
          Number.isInteger(l.quantity) &&
          l.quantity >= 1
      ) ||
      !["pickup", "delivery"].includes(d.fulfillment) ||
      typeof d.automaticShipping !== "boolean" ||
      !Object.entries(EMPTY_ORDER_DRAFT).every(([k, v]) => typeof v !== "string" || typeof d[k] === "string") ||
      ![d.customerId, d.personId].every((id) => id === null || typeof id === "string")
    )
      return null
    return d
  } catch {
    return null
  }
}

export function useManualOrderDraft(branchId: string | null) {
  const { t } = useTranslation("business-orders")
  const key = useOrderWorkspaceKey("order-draft", branchId ?? "none")
  const [state, setState] = useState(() => {
    const value = recover(key)
    return { key, value: value ?? EMPTY_ORDER_DRAFT, recovered: !!value }
  })
  if (state.key !== key) {
    const value = recover(key)
    setState({ key, value: value ?? EMPTY_ORDER_DRAFT, recovered: !!value })
  }
  const draft = state.key === key ? state.value : EMPTY_ORDER_DRAFT
  const failed = useRef(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(EMPTY_ORDER_DRAFT)
  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify({ version: 1, value: draft }))
      else sessionStorage.removeItem(key)
    } catch {
      if (!failed.current) {
        notify.error(t("order_draft_storage_error"))
        failed.current = true
      }
    }
  }, [draft, dirty, key, t])
  const update = <K extends keyof ManualOrderDraft>(field: K, value: SetStateAction<ManualOrderDraft[K]>) =>
    setState((previous) => {
      const current = previous.key === key ? previous.value : EMPTY_ORDER_DRAFT
      return {
        ...previous,
        key,
        value: {
          ...current,
          [field]:
            typeof value === "function"
              ? (value as (v: ManualOrderDraft[K]) => ManualOrderDraft[K])(current[field])
              : value,
        },
      }
    })
  const discard = (expected?: ManualOrderDraft) => {
    setState((previous) => {
      if (previous.key !== key || (expected && JSON.stringify(previous.value) !== JSON.stringify(expected)))
        return previous
      try {
        sessionStorage.removeItem(key)
      } catch {
        /* Memory state still clears. */
      }
      return { key, value: EMPTY_ORDER_DRAFT, recovered: false }
    })
  }
  return { draft, update, discard, recovered: state.key === key && state.recovered, dirty }
}
