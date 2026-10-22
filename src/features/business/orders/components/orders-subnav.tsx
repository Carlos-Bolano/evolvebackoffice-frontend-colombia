import { NavLink } from "react-router-dom"
import { Bike, KanbanSquare, Lock, MapPinned, Timer } from "lucide-react"

import { useTranslation } from "@/i18n/use-i18n"
import { useCanManageDeliveries } from "../hooks/use-delivery-operations"
import { OrderNotificationsCenter } from "./order-notifications-center"

interface OrdersSubnavProps {
  onSelectOrder?: (orderId: string) => void
}

export function OrdersSubnav({ onSelectOrder }: OrdersSubnavProps) {
  const { t } = useTranslation("business-orders")
  const canManage = useCanManageDeliveries()

  const items = [
    { to: "/business/orders", label: t("subnav_board"), icon: KanbanSquare, end: true, show: true },
    { to: "/business/orders/deliveries", label: t("subnav_deliveries"), icon: Bike, end: false, show: true },
    { to: "/business/orders/routes", label: t("subnav_routes"), icon: MapPinned, end: false, show: true },
    { to: "/business/orders/tracking", label: t("tracking_title"), icon: MapPinned, end: false, show: canManage },
    { to: "/business/orders/operations", label: t("subnav_operations"), icon: Timer, end: false, show: canManage },
    { to: "/business/orders/closing", label: t("subnav_closing"), icon: Lock, end: false, show: true },
  ].filter((item) => item.show)

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card/70 p-1.5">
      <nav aria-label={t("orders")} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:flex-wrap">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-8 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`
              }
            >
              <Icon className="size-3.5" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
      <OrderNotificationsCenter onSelectOrder={onSelectOrder} />
    </div>
  )
}
