import { useState } from "react"
import { Undo2 } from "lucide-react"

import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { getApiErrorMessage } from "@/utils/api-error"
import { InventoryPagination } from "../../components/inventory-pagination"
import { useMovements, useVoidAdjustment } from "../../hooks/use-inventory"
import { INVENTORY_PAGE_SIZE } from "../../services/inventory.service"
import type { InventoryMovementDto, MovementType } from "../../types"
import { formatMoney, formatQuantity } from "../../utils/units"

const MOVEMENT_TONES: Record<MovementType, BadgeTone> = {
  PurchaseReceipt: "success",
  TransferIn: "success",
  TransferReturn: "info",
  ProductionOutput: "success",
  TransferOut: "info",
  TransferLoss: "danger",
  ProductionConsumption: "purple",
  SaleConsumption: "primary",
  Waste: "danger",
  CountAdjustment: "warning",
  Reversal: "neutral",
}

type MovementsTableProps = {
  branchId: string
  itemId?: string
}

/** Historial de movimientos (kardex) de la sucursal, opcionalmente de un producto. */
export function MovementsTable({ branchId, itemId }: MovementsTableProps) {
  const { t, i18n } = useTranslation("business-inventory")
  const [page, setPage] = useState(1)
  const [toVoid, setToVoid] = useState<InventoryMovementDto | null>(null)
  const { data, isLoading } = useMovements({ branchId, itemId, pageNumber: page })
  const voidAdjustment = useVoidAdjustment()

  const [prevFilter, setPrevFilter] = useState(`${branchId}|${itemId ?? ""}`)
  const filter = `${branchId}|${itemId ?? ""}`
  if (filter !== prevFilter) {
    setPrevFilter(filter)
    setPage(1)
  }

  const movements = data?.items ?? []
  const totalPages = Math.ceil((data?.totalCount ?? 0) / INVENTORY_PAGE_SIZE)
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "short" })

  const canVoid = (m: InventoryMovementDto) =>
    m.documentType === "StockAdjustment" && m.type !== "Reversal" && !m.isReversed

  const handleVoid = () => {
    if (!toVoid) return
    voidAdjustment.mutate(toVoid.documentId, {
      onSuccess: (doc) => {
        notify.success(t("void_done", { number: doc.number }))
        setToVoid(null)
      },
      onError: (error) => notify.error(getApiErrorMessage(error, t("save_error"))),
    })
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (movements.length === 0)
    return <p className="py-12 text-center text-sm text-muted-foreground">{t("no_movements")}</p>

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("product")}</TableHead>
              <TableHead>{t("movement")}</TableHead>
              <TableHead className="text-right">{t("quantity")}</TableHead>
              <TableHead className="text-right">{t("balance")}</TableHead>
              <TableHead className="text-right">{t("cost")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("user")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {dateFormat.format(new Date(m.occurredAt))}
                </TableCell>
                <TableCell className="font-medium text-foreground">{m.itemName}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge tone={MOVEMENT_TONES[m.type]}>{t(`movement_${m.type}`)}</Badge>
                    <p className="text-xs text-muted-foreground">
                      {[m.documentNumber, m.reason ? t(`reason_${m.reason}`) : null, m.notes]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </TableCell>
                <TableCell
                  className={
                    m.quantity < 0
                      ? "text-right font-medium text-destructive"
                      : "text-right font-medium text-emerald-500"
                  }
                >
                  {m.quantity > 0 ? "+" : ""}
                  {formatQuantity(m.quantity, m.baseUnit)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatQuantity(m.balanceAfter, m.baseUnit)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{formatMoney(m.totalCost)}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{m.createdBy ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {canVoid(m) ? (
                    <Button variant="ghost" size="sm" onClick={() => setToVoid(m)}>
                      <Undo2 className="size-4" />
                      {t("void")}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t("movements_count", { count: data?.totalCount ?? 0 })}</p>
        <InventoryPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <ConfirmActionDialog
        open={toVoid !== null}
        onOpenChange={(open) => {
          if (!open) setToVoid(null)
        }}
        title={t("void_title", { number: toVoid?.documentNumber ?? "" })}
        description={t("void_desc")}
        confirmLabel={t("void")}
        tone="destructive"
        isPending={voidAdjustment.isPending}
        onConfirm={handleVoid}
      />
    </div>
  )
}
