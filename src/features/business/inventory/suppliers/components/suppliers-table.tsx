import { Pencil, Truck, UserCheck, UserX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTranslation } from "@/i18n/use-i18n"
import { identificationTypeLabel } from "../../../people/persons/types"
import type { SupplierResponseDto } from "../types"

type SuppliersTableProps = {
  suppliers: SupplierResponseDto[]
  onEdit: (supplier: SupplierResponseDto) => void
  onToggleActive: (supplier: SupplierResponseDto) => void
}

export function SuppliersTable({ suppliers, onEdit, onToggleActive }: SuppliersTableProps) {
  const { t } = useTranslation("business-suppliers")

  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">{t("no_suppliers")}</p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">{t("company")}</TableHead>
            <TableHead className="hidden min-w-[140px] md:table-cell">{t("document_type")}</TableHead>
            <TableHead className="hidden min-w-[120px] md:table-cell">{t("document_number")}</TableHead>
            <TableHead className="hidden min-w-[130px] sm:table-cell">{t("phone")}</TableHead>
            <TableHead className="hidden min-w-[180px] lg:table-cell">{t("email")}</TableHead>
            <TableHead className="hidden min-w-[130px] lg:table-cell">{t("code")}</TableHead>
            <TableHead className="min-w-[90px]">{t("status")}</TableHead>
            <TableHead className="min-w-[90px] text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Truck className="size-4 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{supplier.company || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[supplier.firstName, supplier.lastName].filter(Boolean).join(" ") || "—"}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {identificationTypeLabel(supplier.identificationTypeId)}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {supplier.identificationNumber ?? "—"}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {supplier.phoneNumber ?? "—"}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {supplier.emailAddress ?? "—"}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">{supplier.code ?? "—"}</TableCell>
              <TableCell>
                <Badge tone={supplier.inactive ? "neutral" : "success"}>
                  {supplier.inactive ? t("inactive") : t("active")}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onToggleActive(supplier)}
                    aria-label={supplier.inactive ? t("activate_supplier_action") : t("deactivate_supplier_action")}
                    title={supplier.inactive ? t("activate_supplier_action") : t("deactivate_supplier_action")}
                  >
                    {supplier.inactive ? <UserCheck className="size-4" /> : <UserX className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onEdit(supplier)}
                    aria-label={t("edit_supplier_action")}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
