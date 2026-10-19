import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  ClipboardCheck,
  PackageCheck,
  PackageX,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react"
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
      disabled: false,
      onClick: () => navigate("/business/inventory/purchase-orders"),
    },
    {
      name: t("transfers"),
      label: t("transfers_desc"),
      icon: ArrowRightLeft,
      disabled: false,
      onClick: () => navigate("/business/inventory/transfers"),
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
      <InventoryInbox onNavigate={navigate} />
      {inventoryLinks.map((item) => (
        <ItemCard key={item.name} item={item} />
      ))}
    </HubPageLayout>
  )
}

/** Bandeja de pendientes de la sucursal elegida. */
function InventoryInbox({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useTranslation("business-inventory")
  const { branches, branch, branchId, selectBranch } = useInventoryBranch()
  const { data: inbox } = useInventoryInbox(branchId)

  if (branches.length === 0) return null
  const pending =
    (inbox?.belowMinCount ?? 0) +
    (inbox?.negativeCount ?? 0) +
    (inbox?.ordersToDispatch ?? 0) +
    (inbox?.transfersToReceive ?? 0) +
    (inbox?.differencesToResolve ?? 0)

  return (
    <Card className="rounded-xl border-border/70 bg-background/45 shadow-none md:col-span-2">
      <CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <BranchSelector
            options={branches.map((b) => ({ id: b.id, name: b.name }))}
            selectedId={branchId}
            onSelect={(id) => id && selectBranch(id)}
          />
          {branch?.isSupplier ? <Badge tone="primary">{t("supplier_branch")}</Badge> : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {pending === 0 ? (
            <p className="text-sm text-muted-foreground">{t("inbox_empty")}</p>
          ) : (
            <>
              {inbox?.belowMinCount ? (
                <button type="button" onClick={() => onNavigate("/business/inventory/stock?filter=below-min")}>
                  <Badge tone="warning">
                    <AlertTriangle className="size-3" />
                    {t("inbox_below_min", { count: inbox.belowMinCount })}
                  </Badge>
                </button>
              ) : null}
              {inbox?.negativeCount ? (
                <button type="button" onClick={() => onNavigate("/business/inventory/stock?filter=negative")}>
                  <Badge tone="danger">
                    <PackageX className="size-3" />
                    {t("inbox_negative", { count: inbox.negativeCount })}
                  </Badge>
                </button>
              ) : null}
              {inbox?.ordersToDispatch ? (
                <button type="button" onClick={() => onNavigate("/business/inventory/purchase-orders?tab=dispatch")}>
                  <Badge tone="info">
                    <ShoppingCart className="size-3" />
                    {t("inbox_orders_to_dispatch", { count: inbox.ordersToDispatch })}
                  </Badge>
                </button>
              ) : null}
              {inbox?.transfersToReceive ? (
                <button type="button" onClick={() => onNavigate("/business/inventory/transfers?tab=incoming")}>
                  <Badge tone="info">
                    <PackageCheck className="size-3" />
                    {t("inbox_transfers_to_receive", { count: inbox.transfersToReceive })}
                  </Badge>
                </button>
              ) : null}
              {inbox?.differencesToResolve ? (
                <button type="button" onClick={() => onNavigate("/business/inventory/transfers?tab=differences")}>
                  <Badge tone="warning">
                    <AlertTriangle className="size-3" />
                    {t("inbox_differences", { count: inbox.differencesToResolve })}
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
