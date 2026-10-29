import { shortOrderReference } from "../utils/order-presentation"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, Bell, BellRing, CheckCheck, Trash2, Volume2, VolumeX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { useTranslation } from "@/i18n/use-i18n"
import { useOrderNotificationsStore, type OrderNotificationItem } from "../hooks/use-new-order-notifications"

interface OrderNotificationsCenterProps {
  onSelectOrder?: (orderId: string) => void
}

export function OrderNotificationsCenter({ onSelectOrder }: OrderNotificationsCenterProps) {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const { notifications, muted, markAsRead, markAllAsRead, clearAll, toggleMute, testSound } =
    useOrderNotificationsStore()
  const unreadCount = notifications.filter((n) => !n.read).length

  const handleSelect = (item: OrderNotificationItem) => {
    markAsRead(item.id)
    setOpen(false)
    if (onSelectOrder) {
      onSelectOrder(item.orderId)
    } else {
      navigate("/business/orders")
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-1.5" aria-label={t("notifications_title")}>
          {unreadCount > 0 ? <BellRing className="size-4 text-primary" /> : <Bell className="size-4" />}
          {unreadCount > 0 && (
            <Badge tone="danger" className="px-1.5 py-0 text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 sm:w-96">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
            <p className="text-sm font-semibold">{t("notifications_title")}</p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                title={muted ? t("notifications_unmute") : t("notifications_mute")}
                aria-label={muted ? t("notifications_unmute") : t("notifications_mute")}
                onClick={toggleMute}
              >
                {muted ? <VolumeX className="size-3.5 text-amber-500" /> : <Volume2 className="size-3.5" />}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={testSound}>
                {t("notifications_test_sound")}
              </Button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{t("notifications_empty")}</p>
          ) : (
            <>
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {notifications.map((item) => {
                  const isAlert = item.kind === "sync_error" || item.kind === "cancelled_dispatched"
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors hover:bg-accent ${
                        item.read ? "border-border/50 bg-background/40 opacity-80" : "border-primary/30 bg-primary/5"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {isAlert ? (
                          <AlertTriangle className="size-4 text-amber-500" />
                        ) : (
                          <BellRing className="size-4 text-primary" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 text-xs">
                        <span className="flex items-center justify-between gap-2 font-semibold">
                          <span className="truncate">
                            #{shortOrderReference(item.externalOrderId, item.orderId)} ·{" "}
                            {item.customerName ?? t("customer")}
                          </span>
                          <span className="shrink-0 font-mono">{formatCurrency(item.total)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{t(`notifications_kind_${item.kind}`)}</span>
                          <span>
                            {new Date(item.createdAt).toLocaleTimeString("es-CO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={unreadCount === 0}
                  onClick={markAllAsRead}
                >
                  <CheckCheck className="mr-1 size-3.5" />
                  {t("notifications_mark_all_read")}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
                  <Trash2 className="mr-1 size-3.5" />
                  {t("notifications_clear")}
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
