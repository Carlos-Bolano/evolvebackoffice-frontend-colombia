import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Plus, Truck } from "lucide-react"

import { BackLink } from "@/components/ui/back-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BranchSelector } from "@/features/business/items/catalog/components/branch-selector"
import { useTranslation } from "@/i18n/use-i18n"
import { InventoryPagination } from "../../components/inventory-pagination"
import { useInventoryBranch } from "../../hooks/use-inventory-branch"
import { useTransfers } from "../../hooks/use-purchasing"
import { INVENTORY_PAGE_SIZE } from "../../services/inventory.service"
import { formatDateTime, TRANSFER_STATUS_TONE } from "../../utils/status"
import { formatMoney } from "../../utils/units"
import { NewTransferDialog } from "../components/new-transfer-dialog"
import { TransferDetailDialog } from "../components/transfer-detail-dialog"

type Tab = "incoming" | "outgoing" | "differences"

/** Envíos entre sucursales: lo que me llega, lo que mandé y las diferencias por resolver. */
export function TransfersPage() {
  const { t } = useTranslation("business-inventory")
  const { branches, branch, branchId, selectBranch, isLoading: branchesLoading } = useInventoryBranch()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => (searchParams.get("tab") as Tab | null) ?? "incoming")
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [transferId, setTransferId] = useState<string | null>(null)

  const { data, isLoading } = useTransfers({
    branchId,
    direction: tab === "incoming" ? "incoming" : "outgoing",
    status: tab === "differences" ? "differences" : undefined,
    pageNumber: page,
  })
  const rows = data?.items ?? []
  const totalPages = Math.ceil((data?.totalCount ?? 0) / INVENTORY_PAGE_SIZE)

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-6 p-4 sm:p-6 lg:p-8">
        <BackLink to="/business/inventory">{t("inventory")}</BackLink>
        <div className="relative flex flex-col gap-2">
          <Badge className="max-w-fit" tone="primary">
            {t("inventory")}
          </Badge>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{t("transfers")}</h1>
          <p className="max-w-4xl text-sm leading-5 text-muted-foreground">{t("transfers_page_desc")}</p>
          <Truck
            color="#58626b"
            className="absolute -top-10 -right-20 -z-10 size-50 shrink-0 animate-float opacity-5 md:-top-10 md:-right-10 md:size-70 lg:-top-20 lg:-right-30 lg:size-100"
          />
        </div>

        {branchesLoading ? (
          <Skeleton className="h-10 w-80" />
        ) : branches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("no_branches")}</p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <BranchSelector
                options={branches.map((b) => ({ id: b.id, name: b.name }))}
                selectedId={branchId}
                onSelect={(id) => {
                  if (!id) return
                  selectBranch(id)
                  setPage(1)
                }}
              />
              {branch?.isSupplier ? <Badge tone="primary">{t("supplier_branch")}</Badge> : null}
            </div>
            {branch?.isSupplier ? (
              <Button id="btn-nuevo-envio" type="button" onClick={() => setCreating(true)}>
                <Plus className="mr-2 size-4" />
                {t("transfer_new_title")}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t("transfer_only_suppliers")}</p>
            )}
          </div>
        )}

        {branch ? (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as Tab)
              setPage(1)
            }}
          >
            <TabsList>
              <TabsTrigger value="incoming">{t("transfers_tab_incoming")}</TabsTrigger>
              <TabsTrigger value="outgoing">{t("transfers_tab_outgoing")}</TabsTrigger>
              <TabsTrigger value="differences">{t("transfers_tab_differences")}</TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : rows.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t("transfers_empty")}</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("document")}</TableHead>
                        <TableHead>{tab === "incoming" ? t("transfer_from") : t("transfer_to")}</TableHead>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead className="text-right">{t("order_products")}</TableHead>
                        <TableHead className="text-right">{t("value")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((tr) => (
                        <TableRow key={tr.id} className="cursor-pointer" onClick={() => setTransferId(tr.id)}>
                          <TableCell>
                            <p className="font-medium text-foreground">{tr.number}</p>
                            {tr.purchaseOrderNumber ? (
                              <p className="text-xs text-muted-foreground">{tr.purchaseOrderNumber}</p>
                            ) : null}
                          </TableCell>
                          <TableCell>{tab === "incoming" ? tr.fromBranchName : tr.toBranchName}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDateTime(tr.dispatchedAt)}</TableCell>
                          <TableCell className="text-right">{tr.lineCount}</TableCell>
                          <TableCell className="text-right">{formatMoney(tr.totalCost)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge tone={TRANSFER_STATUS_TONE[tr.status]}>{t(`transfer_status_${tr.status}`)}</Badge>
                              {tr.pendingDifferences > 0 ? (
                                <Badge tone="warning">
                                  {t("transfer_pending_differences", { count: tr.pendingDifferences })}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <InventoryPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </Tabs>
        ) : null}

        {branch && creating ? (
          <NewTransferDialog
            branch={branch}
            branches={branches}
            onOpenChange={setCreating}
            onCreated={(transfer) => {
              setCreating(false)
              setTransferId(transfer.id)
            }}
          />
        ) : null}
        {branchId && transferId ? (
          <TransferDetailDialog
            transferId={transferId}
            branchId={branchId}
            onOpenChange={(open) => !open && setTransferId(null)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
