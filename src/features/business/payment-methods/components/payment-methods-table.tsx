import { Pencil, UserCheck, UserX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTranslation } from "@/i18n/use-i18n"
import type { PaymentMethodCategory, PaymentMethodResponseDto } from "../types"

type PaymentMethodsTableProps = {
  methods: PaymentMethodResponseDto[]
  onEdit: (method: PaymentMethodResponseDto) => void
  onToggleActive: (method: PaymentMethodResponseDto) => void
}

export function PaymentMethodsTable({ methods, onEdit, onToggleActive }: PaymentMethodsTableProps) {
  const { t } = useTranslation("business-payment-methods")

  if (methods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">{t("no_methods")}</p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">{t("name")}</TableHead>
            <TableHead className="hidden min-w-[140px] md:table-cell">{t("code")}</TableHead>
            <TableHead className="min-w-[130px]">{t("category")}</TableHead>
            <TableHead className="hidden min-w-[220px] lg:table-cell">{t("rules")}</TableHead>
            <TableHead className="min-w-[90px]">{t("status")}</TableHead>
            <TableHead className="min-w-[90px] text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {methods.map((method) => (
            <TableRow key={method.id}>
              <TableCell>
                <p className="font-medium text-foreground">{method.name}</p>
                {method.isCountryDefault && (
                  <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                    {t("country_default")}
                  </span>
                )}
              </TableCell>
              <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                {method.code}
              </TableCell>
              <TableCell>
                <Badge tone={categoryTone(method.category)}>{categoryLabel(method.category, t)}</Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex flex-wrap gap-1">
                  {method.isCash && <FlagChip label={t("flag_cash")} />}
                  {method.requiresReference && <FlagChip label={t("flag_reference")} />}
                  {method.requiresAuthCode && <FlagChip label={t("flag_auth")} />}
                  {!method.allowsOffline && <FlagChip label={t("flag_offline")} muted />}
                </div>
              </TableCell>
              <TableCell>
                <Badge tone={method.isActive ? "success" : "neutral"}>
                  {method.isActive ? t("active") : t("inactive")}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onToggleActive(method)}
                    aria-label={method.isActive ? t("deactivate_action") : t("activate_action")}
                    title={method.isActive ? t("deactivate_action") : t("activate_action")}
                  >
                    {method.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onEdit(method)}
                    aria-label={t("edit_action")}
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

function FlagChip({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={
        muted
          ? "rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
          : "rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
      }
    >
      {label}
    </span>
  )
}

function categoryTone(category: PaymentMethodCategory): "primary" | "success" | "warning" | "info" | "neutral" {
  switch (category) {
    case "Cash":
      return "success"
    case "Transfer":
      return "info"
    case "CardDebit":
    case "CardCredit":
      return "primary"
    case "Wallet":
      return "warning"
    case "Online":
      return "info"
    case "Credit":
      return "warning"
    case "Voucher":
    default:
      return "neutral"
  }
}

function categoryLabel(category: PaymentMethodCategory, t: ReturnType<typeof useTranslation>["t"]): string {
  const map: Record<PaymentMethodCategory, string> = {
    Cash: t("cat_cash"),
    Transfer: t("cat_transfer"),
    CardDebit: t("cat_card_debit"),
    CardCredit: t("cat_card_credit"),
    Wallet: t("cat_wallet"),
    Voucher: t("cat_voucher"),
    Online: t("cat_online"),
    Credit: t("cat_credit"),
  }
  return map[category] ?? category
}
