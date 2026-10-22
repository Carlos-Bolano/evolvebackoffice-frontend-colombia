import { useEffect, useState, type SetStateAction } from "react"
import { useAppStore } from "@/store/app-store"

export function useOrderWorkspaceKey(area: string, branchId = "all") {
  const session = useAppStore((s) => s.session)
  return `${area}:${session?.tenantId ?? "none"}:${session?.user.id ?? "none"}:${branchId}`
}

export function readStored<T>(storage: Storage, key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? "null")
    return valid(value) ? value : fallback
  } catch {
    return fallback
  }
}

/** A key change immediately selects a separate workspace, before effects run. */
export function useWorkspaceState<T>(key: string, initial: T, storage: Storage, valid: (value: unknown) => value is T) {
  const [state, setState] = useState(() => ({ key, value: readStored(storage, key, initial, valid) }))
  if (state.key !== key) setState({ key, value: readStored(storage, key, initial, valid) })
  const value = state.key === key ? state.value : initial
  const update = (next: SetStateAction<T>) =>
    setState((previous) => ({
      key,
      value: typeof next === "function" ? (next as (v: T) => T)(previous.key === key ? previous.value : initial) : next,
    }))
  useEffect(() => {
    try {
      storage.setItem(key, JSON.stringify(value))
    } catch {
      // Preferences remain usable in memory when storage is unavailable.
    }
  }, [key, storage, value])
  return [value, update] as const
}

export function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}
