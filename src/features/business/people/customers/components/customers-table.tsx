import { CreditCard, Pencil, UserCheck, UserX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTranslation } from "@/i18n/use-i18n"
import { identificationTypeLabel } from "../../persons/types"
import type { CustomerResponseDto } from "../types"

type CustomersTableProps = {
  customers: CustomerResponseDto[]
  onEdit: (customer: CustomerResponseDto) => void
  onToggleActive: (customer: CustomerResponseDto) => void
  onCredit: (customer: CustomerResponseDto) => void
}

export function CustomersTable({ customers, onEdit, onToggleActive, onCredit }: CustomersTableProps) {
  const { t } = useTranslation("business-customers")

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">{t("no_customers")}</p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">{t("first_name")}</TableHead>
            <TableHead className="hidden min-w-[140px] md:table-cell">{t("document_type")}</TableHead>
            <TableHead className="hidden min-w-[120px] md:table-cell">{t("document_number")}</TableHead>
            <TableHead className="hidden min-w-[130px] sm:table-cell">{t("phone")}</TableHead>
            <TableHead className="hidden min-w-[180px] lg:table-cell">{t("email")}</TableHead>
            <TableHead className="hidden min-w-[150px] lg:table-cell">{t("city")}</TableHead>
            <TableHead className="min-w-[90px]">{t("status")}</TableHead>
            <TableHead className="min-w-[90px] text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>
                <p className="font-medium text-foreground">
                  {[customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—"}
                </p>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {identificationTypeLabel(customer.identificationTypeId)}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {customer.identificationNumber ?? "—"}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {customer.phoneNumber ?? "—"}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {customer.emailAddress ?? "—"}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {[customer.city, customer.department].filter(Boolean).join(", ") || "—"}
              </TableCell>
              <TableCell>
                <Badge tone={customer.isActive ? "success" : "neutral"}>
                  {customer.isActive ? t("active") : t("inactive")}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onToggleActive(customer)}
                    aria-label={customer.isActive ? t("deactivate_customer_action") : t("activate_customer_action")}
                    title={customer.isActive ? t("deactivate_customer_action") : t("activate_customer_action")}
                  >
                    {customer.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onCredit(customer)}
                    aria-label={t("credit_action")}
                    title={t("credit_action")}
                  >
                    <CreditCard className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onEdit(customer)}
                    aria-label={t("edit_customer_action")}
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
