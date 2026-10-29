import { useMemo, useState } from "react"
import { Bike, Sparkles, UserPlus } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/i18n/use-i18n"
import { useDeliveryOperations, useCanManageDeliveries } from "../hooks/use-delivery-operations"

const NONE = "__NONE__"

type CourierPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sucursal del pedido: se listan sus domiciliarios + los que atienden todas. */
  branchId: string | null
  title: string
  description?: string
  confirmLabel: string
  /** Domiciliario preseleccionado (el ya asignado). */
  defaultCourierId?: string | null
  /** Permite elegir "Sin domiciliario" (quitar la asignación). */
  allowNone?: boolean
  isPending?: boolean
  onConfirm: (courierId: string | null) => void
}

/**
 * Selector de domiciliario para asignar un pedido o enviarlo (En camino).
 * Solo se monta mientras está abierto: cada apertura arranca con el
 * domiciliario por defecto sin sincronizar estado en un efecto.
 */
export function CourierPickerDialog(props: CourierPickerDialogProps) {
  return props.open ? <CourierPickerDialogInner key={props.defaultCourierId ?? "none"} {...props} /> : null
}

function CourierPickerDialogInner({
  open,
  onOpenChange,
  branchId,
  title,
  description,
  confirmLabel,
  defaultCourierId,
  allowNone = false,
  isPending = false,
  onConfirm,
}: CourierPickerDialogProps) {
  const { t } = useTranslation("business-orders")
  const navigate = useNavigate()
  const { data, isLoading } = useDeliveryOperations(branchId)
  const canManage = useCanManageDeliveries()
  const couriers = useMemo(() => data?.couriers ?? [], [data?.couriers])

  const suggestedCourier = useMemo(() => {
    if (couriers.length === 0) return null
    const onDuty = couriers.filter((c) => c.onDuty)
    const pool = onDuty.length > 0 ? onDuty : couriers
    return [...pool].sort((a, b) => a.load - b.load)[0] ?? null
  }, [couriers])

  const [value, setValue] = useState<string>(defaultCourierId ?? (allowNone ? NONE : ""))
  const effectiveValue = value || (!allowNone && suggestedCourier ? suggestedCourier.id : "")

  const handleConfirm = () => {
    if (!effectiveValue) return
    onConfirm(effectiveValue === NONE ? null : effectiveValue)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bike className="size-5 text-primary" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : couriers.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed border-border/70 p-4 text-center">
            <p className="text-sm text-muted-foreground">{t("courier_none_available")}</p>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => navigate("/business/orders/couriers")}>
                <UserPlus className="mr-2 size-4" />
                {t("couriers_manage")}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {suggestedCourier && (
              <button
                type="button"
                onClick={() => setValue(suggestedCourier.id)}
                className="flex w-full items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-left text-xs transition-colors hover:bg-primary/10"
              >
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  {suggestedCourier.name} ({suggestedCourier.load} {t("phase2_load")})
                </span>
                <Badge tone="primary" className="text-[10px]">
                  {t("courier_suggested")}
                </Badge>
              </button>
            )}
            <Select value={effectiveValue} onValueChange={setValue}>
              <SelectTrigger>
                <SelectValue placeholder={t("courier_select")} />
              </SelectTrigger>
              <SelectContent>
                {allowNone && <SelectItem value={NONE}>{t("courier_unassigned")}</SelectItem>}
                {couriers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {` · ${c.load}`}
                    {c.onDuty ? ` (${t("phase2_on_duty")})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!effectiveValue || isPending || couriers.length === 0}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
