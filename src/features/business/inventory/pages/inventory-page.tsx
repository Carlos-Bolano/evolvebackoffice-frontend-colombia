import { AlertTriangle, Building2, ClipboardCheck, PackageX, ShoppingCart, Truck, Warehouse } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/i18n/use-i18n"
import { HubPageLayout } from "@/features/business/components/hub-page-layout"
import { ItemCard, type ItemCardLink } from "@/features/business/components/item-card"
import { BranchSelector } from "@/features/business/items/catalog/components/branch-selector"
import { useInventoryInbox } from "../hooks/use-inventory"
import { useInventoryBranch } from "../hooks/use-inventory-branch"

export function InventoryPage() {
  const { t } = useTranslation("business-inventory")
  const navigate = useNavigate()

  const inventoryLinks: ItemCardLink[] = [
    {
      name: t("stock_title"),
      label: t("stock_card_desc"),
      icon: Warehouse,
      disabled: false,
      onClick: () => navigate("/business/inventory/stock"),
    },
    {
      name: t("suppliers"),
      label: t("suppliers_desc"),
      icon: Truck,
      disabled: false,
      onClick: () => navigate("/business/inventory/suppliers"),
    },
    {
      name: t("purchase_orders"),
      label: t("purchase_orders_desc"),
      icon: ShoppingCart,
      disabled: true,
    },
    {
      name: t("physical_inventory"),
      label: t("physical_inventory_desc"),
      icon: ClipboardCheck,
      disabled: true,
    },
  ]

  return (
    <HubPageLayout
      badge={t("inventory")}
      title={t("stock_control")}
      description={t("stock_control_desc")}
      icon={Building2}
      iconClass={"-rotate-20 md:-top-10 md:-right-10 md:size-70 lg:-top-25 lg:-right-35 lg:size-100"}
    >
      <InventoryInbox onOpenStock={(filter) => navigate(`/business/inventory/stock?filter=${filter}`)} />
      {inventoryLinks.map((item) => (
        <ItemCard key={item.name} item={item} />
      ))}
    </HubPageLayout>
  )
}

/** Bandeja de pendientes de la sucursal elegida. */
function InventoryInbox({ onOpenStock }: { onOpenStock: (filter: "below-min" | "negative") => void }) {
  const { t } = useTranslation("business-inventory")
  const { branches, branch, branchId, selectBranch } = useInventoryBranch()
  const { data: inbox } = useInventoryInbox(branchId)

  if (branches.length === 0) return null
  const pending = (inbox?.belowMinCount ?? 0) + (inbox?.negativeCount ?? 0)

  return (
    <Card className="rounded-xl border-border/70 bg-background/45 shadow-none md:col-span-2">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <BranchSelector
            options={branches.map((b) => ({ id: b.id, name: b.name }))}
            selectedId={branchId}
            onSelect={(id) => id && selectBranch(id)}
          />
          {branch?.isSupplier ? <Badge tone="primary">{t("supplier_branch")}</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pending === 0 ? (
            <p className="text-sm text-muted-foreground">{t("inbox_empty")}</p>
          ) : (
            <>
              {inbox?.belowMinCount ? (
                <button type="button" onClick={() => onOpenStock("below-min")}>
                  <Badge tone="warning">
                    <AlertTriangle className="size-3" />
                    {t("inbox_below_min", { count: inbox.belowMinCount })}
                  </Badge>
                </button>
              ) : null}
              {inbox?.negativeCount ? (
                <button type="button" onClick={() => onOpenStock("negative")}>
                  <Badge tone="danger">
                    <PackageX className="size-3" />
                    {t("inbox_negative", { count: inbox.negativeCount })}
                  </Badge>
                </button>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
