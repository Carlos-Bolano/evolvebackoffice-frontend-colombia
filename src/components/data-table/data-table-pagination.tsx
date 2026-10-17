import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

import { generatePageNumbers } from "./generate-page-numbers"

// ─── DataTablePagination ─────────────────────────────────────────────────────

type DataTablePaginationProps = {
  currentPage: number
  totalPages: number
  totalCount: number
  selectedCount?: number
  onPageChange: (page: number) => void
  labels?: {
    previous?: string
    next?: string
    selected?: string
    paginationTotal?: (count: number) => string
  }
}

export function DataTablePagination({
  currentPage,
  totalPages,
  totalCount,
  selectedCount,
  onPageChange,
  labels,
}: DataTablePaginationProps) {
  return (
    <div className="flex w-full shrink-0 items-center justify-between">
      <p className="min-w-fit text-xs text-muted-foreground">
        {labels?.paginationTotal ? labels.paginationTotal(totalCount) : `${totalCount} items total`}
        {selectedCount != null && selectedCount > 0 && (
          <span className="ml-2 text-primary">
            · {selectedCount} {labels?.selected ?? "selected"}
          </span>
        )}
      </p>
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                text={labels?.previous ?? "Previous"}
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              />
            </PaginationItem>
            {generatePageNumbers(currentPage, totalPages).map((pageNum, i) =>
              pageNum === "..." ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={pageNum}>
                  <PaginationLink isActive={pageNum === currentPage} onClick={() => onPageChange(pageNum)}>
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                text={labels?.next ?? "Next"}
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
