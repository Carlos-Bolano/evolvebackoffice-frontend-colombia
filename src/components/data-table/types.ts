import type React from "react"

import type { EmptyStateProps } from "@/components/share/empty-state"

// ─── Column Configuration ────────────────────────────────────────────────────

export type ColumnBreakpoint = "always" | "sm" | "md" | "lg"

export interface ColumnDef<T> {
  key: string
  header: string
  minWidth?: string
  responsive?: ColumnBreakpoint
  align?: "left" | "right"
  /**
   * Ancla la columna al borde derecho del scroll horizontal (típicamente la
   * columna de acciones). En móvil la tabla puede scrollear pero las acciones
   * permanecen visibles.
   */
  stickyRight?: boolean
  render: (row: T) => React.ReactNode
  skeletonWidth?: number
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
}

// ─── DataTable Props ─────────────────────────────────────────────────────────

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading: boolean
  page: number
  totalPages: number
  totalCount: number
  onPageChange: (page: number) => void
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder: string
  }
  emptyState?: EmptyStateProps
  rowClassName?: (row: T) => string | undefined
  toolbar?: React.ReactNode
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  skeletonRows?: number
  labels?: {
    previous?: string
    next?: string
    selected?: string
    paginationTotal?: (count: number) => string
    noResults?: (search: string) => string
  }
}
