import { useState } from "react"
import { Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Branch } from "@/features/business/branches/types"
import { useTranslation } from "@/i18n/use-i18n"
import { InventoryPagination } from "../../components/inventory-pagination"
import { useMargins } from "../../hooks/use-sales"
import { INVENTORY_PAGE_SIZE } from "../../services/inventory.service"
import { formatMoney, formatUnitCost, unitSymbol } from "../../utils/units"

/** Margen actual de cada producto de la sucursal: precio sin impuestos − costo. */
export function MarginsTable({ branch }: { branch: Branch }) {
  const { t } = useTranslation("business-inventory")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const { data, isLoading } = useMargins({ branchId: branch.id, search, pageNumber: page })
  const rows = data?.items ?? []
  const totalPages = Math.ceil((data?.totalCount ?? 0) / INVENTORY_PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="margenes-buscar"
            placeholder={t("search_products")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("margins_hint")}</p>
      <p className="text-xs text-muted-foreground">{t("margins_where_to_edit")}</p>
      {branch.isSupplier ? <p className="text-xs text-muted-foreground">{t("margins_supplier_hint")}</p> : null}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("margins_empty")}</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="text-right">{t("margins_price")}</TableHead>
                <TableHead className="text-right">{t("margins_net_price")}</TableHead>
                <TableHead className="text-right">{t("cost")}</TableHead>
                <TableHead className="text-right">{t("margins_margin")}</TableHead>
                {branch.isSupplier ? <TableHead className="text-right">{t("margins_transfer_price")}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.branchItemId}>
                  <TableCell>
                    <p className="font-medium text-foreground">{m.itemName}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone="neutral">
                        {m.kind === "recipe" ? t("margins_kind_recipe") : t("margins_kind_stock")}
                      </Badge>
                      {!m.sellsHere ? <Badge tone="neutral">{t("margins_not_sold_here")}</Badge> : null}
                      {m.sellHereOverride === true && !m.productIsSellable ? (
                        <Badge tone="info">{t("margins_sold_only_here")}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {m.sellsHere || m.transferPrice !== null ? formatMoney(m.price) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.sellsHere ? formatMoney(m.netPrice) : "—"}
                    {m.sellsHere && m.taxRate > 0 ? (
                      <p className="text-xs">{t("margins_tax", { rate: Math.round(m.taxRate * 1000) / 10 })}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.cost === null ? "—" : `${formatUnitCost(m.cost)} / ${unitSymbol(m.baseUnit)}`}
                  </TableCell>
                  <TableCell className="text-right">
                    <MarginValue sold={m.sellsHere} margin={m.margin} percent={m.marginPercent} />
                  </TableCell>
                  {branch.isSupplier ? (
                    <TableCell className="text-right">
                      {m.transferPrice === null ? (
                        "—"
                      ) : (
                        <>
                          <p className="text-foreground">
                            {formatUnitCost(m.transferPrice)} / {unitSymbol(m.baseUnit)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.transferAtCost ? t("margins_transfer_at_cost") : t("margins_transfer_sale_price")}
                          </p>
                        </>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <InventoryPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

function MarginValue({ sold, margin, percent }: { sold: boolean; margin: number | null; percent: number | null }) {
  if (!sold || margin === null) return <span className="text-muted-foreground">—</span>
  return (
    <>
      <p className={margin < 0 ? "font-medium text-destructive" : "font-medium text-foreground"}>
        {formatMoney(margin)}
      </p>
      {percent !== null ? (
        <p className={percent < 0 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{percent} %</p>
      ) : null}
    </>
  )
}
