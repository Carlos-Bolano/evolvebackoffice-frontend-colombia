import { useEffect, useState, type SetStateAction } from "react"
import { useAppStore } from "@/store/app-store"
import type { BranchWhatsAppChannel, UpdateBranchWhatsAppChannelDto } from "../services/whatsapp.service"

type Draft = UpdateBranchWhatsAppChannelDto

function signature(value: Draft) {
  return JSON.stringify([value.enabled, value.notifyExternalPlatformOrders, value.automaticEvents, value.templates])
}

function removeDraft(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* Storage may be disabled. */
  }
}

function recover(key: string): Draft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null")
    return value &&
      typeof value.enabled === "boolean" &&
      typeof value.notifyExternalPlatformOrders === "boolean" &&
      Array.isArray(value.automaticEvents) &&
      Array.isArray(value.templates) &&
      value.templates.every(
        (t: Record<string, unknown>) =>
          typeof t.eventCode === "string" && typeof t.templateText === "string" && typeof t.recipientType === "string"
      )
      ? value
      : null
  } catch {
    return null
  }
}

export function useWhatsAppDraft(
  branchId: string,
  channel: BranchWhatsAppChannel | undefined,
  defaults: Draft,
  leaveMessage: string
) {
  const session = useAppStore((s) => s.session)
  const key = `whatsapp-draft:${session?.tenantId}:${session?.user.id}:${branchId}`
  const [state, setState] = useState(() => ({ key, value: recover(key) }))
  if (state.key !== key) setState({ key, value: recover(key) })
  const baseline: Draft = channel
    ? {
        enabled: channel.enabled,
        automaticEvents: channel.automaticEvents,
        notifyExternalPlatformOrders: channel.notifyExternalPlatformOrders,
        templates: defaults.templates,
      }
    : defaults
  const draft = state.key === key ? (state.value ?? baseline) : baseline
  const isDirty = !!state.value && signature(draft) !== signature(baseline)
  const setDraft = (update: SetStateAction<Draft>) =>
    setState((previous) => ({
      key,
      value:
        typeof update === "function" ? update(previous.key === key ? (previous.value ?? baseline) : baseline) : update,
    }))
  const discard = () => {
    removeDraft(key)
    setState({ key, value: null })
  }
  const saved = (values: Draft) =>
    setState((previous) => {
      if (previous.key !== key || (previous.value && signature(previous.value) !== signature(values))) return previous
      removeDraft(key)
      return { key, value: null }
    })
  useEffect(() => {
    try {
      if (isDirty) sessionStorage.setItem(key, JSON.stringify(draft))
      else sessionStorage.removeItem(key)
    } catch {
      /* Navigation confirmation still protects edits when storage is unavailable. */
    }
  }, [draft, isDirty, key])
  useEffect(() => {
    if (!isDirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null
      if (!link || link.target === "_blank" || link.origin !== location.origin || link.pathname === location.pathname)
        return
      if (!window.confirm(leaveMessage)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", beforeUnload)
    document.addEventListener("click", navigate, true)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", navigate, true)
    }
  }, [isDirty, leaveMessage])
  return { draft, setDraft, isDirty, discard, saved }
}
