import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { useTranslation } from "@/i18n/use-i18n"

type InventoryPaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

/** Paginación de las tablas de inventario (mismo patrón del catálogo de artículos). */
export function InventoryPagination({ page, totalPages, onPageChange }: InventoryPaginationProps) {
  const { t } = useTranslation("business-inventory")
  if (totalPages <= 1) return null

  return (
    <Pagination className="w-fit">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text={t("previous")}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          />
        </PaginationItem>
        {pageNumbers(page, totalPages).map((pageNum, i) =>
          pageNum === "..." ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={pageNum}>
              <PaginationLink isActive={pageNum === page} onClick={() => onPageChange(pageNum)}>
                {pageNum}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            text={t("next")}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

function pageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "...")[] = [1]
  if (current > 3) pages.push("...")
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push("...")
  pages.push(total)
  return pages
}
