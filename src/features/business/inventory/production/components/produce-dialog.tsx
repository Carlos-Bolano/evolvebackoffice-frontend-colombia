import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, CalendarClock, ChefHat } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { Branch } from "@/features/business/branches/types"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { getApiErrorMessage } from "@/utils/api-error"
import {
  useCompleteProduction,
  useCreateProduction,
  useProducibleItems,
  useProductionPreview,
} from "../../hooks/use-production"
import type { ProductionOrderDto } from "../../types/production"
import { formatMoney, formatQuantity, formatUnitCost, unitSymbol } from "../../utils/units"

type ProduceDialogProps = {
  branch: Branch
  /** "plan" solo deja la producción planeada (no mueve inventario). */
  mode: "produce" | "plan"
  /** Registrar una producción que estaba planeada. */
  fromPlan?: ProductionOrderDto
  onOpenChange: (open: boolean) => void
  onDone: (order: ProductionOrderDto) => void
}

/** Producto → ¿cuánto vas a hacer? → vista previa de ingredientes → ¿cuánto salió? → Registrar. */
export function ProduceDialog({ branch, mode, fromPlan, onOpenChange, onDone }: ProduceDialogProps) {
  const { t } = useTranslation("business-inventory")
  const navigate = useNavigate()
  const { data: products = [], isLoading: productsLoading } = useProducibleItems(fromPlan ? null : branch.id)
  const create = useCreateProduction()
  const complete = useCompleteProduction()

  const [itemId, setItemId] = useState<string | null>(fromPlan?.itemId ?? null)
  const [planned, setPlanned] = useState(fromPlan ? String(fromPlan.plannedQuantity) : "")
  const [produced, setProduced] = useState(fromPlan ? String(fromPlan.plannedQuantity) : "")
  const [adjust, setAdjust] = useState(false)
  const [actuals, setActuals] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState(fromPlan?.notes ?? "")

  const plannedQty = Number(planned) || 0
  const { data: preview, isFetching } = useProductionPreview(branch.id, itemId, plannedQty)
  const product = products.find((p) => p.itemId === itemId)
  const baseUnit = fromPlan?.baseUnit ?? product?.baseUnit ?? 0
  const itemName = fromPlan?.itemName ?? product?.itemName ?? ""
  const isPlan = mode === "plan"
  const pending = create.isPending || complete.isPending

  // Con "Ajustar lo gastado" se descuenta lo escrito; si no, lo que dice la receta.
  const actualFor = (id: string, required: number) =>
    adjust && actuals[id] !== undefined ? Number(actuals[id]) : required
  const shortages = (preview?.ingredients ?? []).filter((i) => actualFor(i.itemId, i.required) > Math.max(0, i.onHand))
  const producedQty = Number(produced) || 0
  const realCost = (preview?.ingredients ?? []).reduce(
    (sum, i) => sum + actualFor(i.itemId, i.required) * i.unitCost,
    0
  )
  const canSubmit =
    Boolean(itemId) &&
    plannedQty > 0 &&
    !pending &&
    (isPlan || (producedQty > 0 && shortages.length === 0 && !!preview))

  const chooseProduct = (id: string) => {
    setItemId(id)
    const p = products.find((x) => x.itemId === id)
    if (p) {
      setPlanned(String(p.yieldQuantity))
      setProduced(String(p.yieldQuantity))
    }
    setActuals({})
  }

  const ingredientsPayload = () =>
    adjust
      ? (preview?.ingredients ?? []).map((i) => ({ itemId: i.itemId, quantity: actualFor(i.itemId, i.required) }))
      : null

  const fail = (error: unknown) => notify.error(getApiErrorMessage(error, t("save_error")))

  const submit = () => {
    if (!canSubmit || !itemId) return
    if (fromPlan) {
      complete.mutate(
        {
          id: fromPlan.id,
          producedQuantity: producedQty,
          ingredients: ingredientsPayload(),
          notes: notes.trim() || null,
        },
        {
          onSuccess: (order) => {
            notify.success(t("production_done", { number: order.number }))
            onDone(order)
          },
          onError: fail,
        }
      )
      return
    }
    create.mutate(
      {
        branchId: branch.id,
        itemId,
        plannedQuantity: plannedQty,
        producedQuantity: isPlan ? null : producedQty,
        ingredients: isPlan ? null : ingredientsPayload(),
        notes: notes.trim() || null,
        complete: !isPlan,
      },
      {
        onSuccess: (order) => {
          notify.success(
            isPlan ? t("production_planned", { number: order.number }) : t("production_done", { number: order.number })
          )
          onDone(order)
        },
        onError: fail,
      }
    )
  }

  const Icon = isPlan ? CalendarClock : ChefHat
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div>
              <DialogTitle>
                {fromPlan
                  ? t("production_complete_title", { number: fromPlan.number })
                  : isPlan
                    ? t("production_plan_title")
                    : t("production_new_title")}
              </DialogTitle>
              <DialogDescription>
                {isPlan ? t("production_plan_desc") : t("production_new_desc", { branch: branch.name })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="produccion-producto">{t("production_product")}</Label>
              {fromPlan ? (
                <Input id="produccion-producto" value={fromPlan.itemName} disabled />
              ) : productsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={itemId ?? ""} onValueChange={chooseProduct}>
                  <SelectTrigger id="produccion-producto">
                    <SelectValue placeholder={t("production_product_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.itemId} value={p.itemId}>
                        {p.itemName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!fromPlan && !productsLoading && products.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("production_no_products")}</p>
              ) : null}
              {product ? (
                <p className="text-xs text-muted-foreground">
                  {t("production_batch_hint", { quantity: formatQuantity(product.yieldQuantity, product.baseUnit) })}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="produccion-planeado">{t("production_planned_qty")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="produccion-planeado"
                  type="number"
                  min={0}
                  step="any"
                  value={planned}
                  disabled={Boolean(fromPlan)}
                  onChange={(e) => {
                    setPlanned(e.target.value)
                    setProduced(e.target.value)
                  }}
                />
                <span className="text-xs text-muted-foreground">{unitSymbol(baseUnit)}</span>
              </div>
            </div>
          </div>

          {itemId && plannedQty > 0 ? (
            !preview ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className={isFetching ? "space-y-2 opacity-70" : "space-y-2"}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{t("production_ingredients")}</p>
                  {!isPlan ? (
                    <div className="flex items-center gap-2">
                      <Switch id="produccion-ajustar" checked={adjust} onCheckedChange={setAdjust} />
                      <Label htmlFor="produccion-ajustar">{t("production_adjust")}</Label>
                    </div>
                  ) : null}
                </div>
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[560px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("production_ingredient")}</TableHead>
                        <TableHead className="text-right">{t("production_recipe_says")}</TableHead>
                        {adjust && !isPlan ? <TableHead className="w-36">{t("production_used")}</TableHead> : null}
                        <TableHead className="text-right">{t("on_hand")}</TableHead>
                        <TableHead className="text-right">{t("cost")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.ingredients.map((i) => {
                        const short = actualFor(i.itemId, i.required) > Math.max(0, i.onHand)
                        return (
                          <TableRow key={i.itemId}>
                            <TableCell>
                              <p className="font-medium text-foreground">{i.itemName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatUnitCost(i.unitCost)} / {unitSymbol(i.baseUnit)}
                              </p>
                            </TableCell>
                            <TableCell className="text-right">{formatQuantity(i.required, i.baseUnit)}</TableCell>
                            {adjust && !isPlan ? (
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    aria-label={t("production_used")}
                                    value={actuals[i.itemId] ?? String(i.required)}
                                    onChange={(e) => setActuals((a) => ({ ...a, [i.itemId]: e.target.value }))}
                                  />
                                  <span className="text-xs text-muted-foreground">{unitSymbol(i.baseUnit)}</span>
                                </div>
                              </TableCell>
                            ) : null}
                            <TableCell className={short ? "text-right font-medium text-destructive" : "text-right"}>
                              {formatQuantity(i.onHand, i.baseUnit)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatMoney(actualFor(i.itemId, i.required) * i.unitCost)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          ) : null}

          {!isPlan && shortages.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-destructive/30 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="size-4" />
                {t("production_blocked")}
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {shortages.map((i) => (
                  <li key={i.itemId}>
                    {t("production_missing", {
                      name: i.itemName,
                      quantity: formatQuantity(actualFor(i.itemId, i.required) - Math.max(0, i.onHand), i.baseUnit),
                    })}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t("production_fix_hint")}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/business/inventory/purchase-orders?tab=receipts")}
                >
                  {t("production_fix_receipt")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => navigate("/business/inventory/stock")}>
                  {t("production_fix_count")}
                </Button>
              </div>
            </div>
          ) : null}

          {!isPlan && itemId ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="produccion-salio">{t("production_produced_qty")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="produccion-salio"
                    type="number"
                    min={0}
                    step="any"
                    value={produced}
                    onChange={(e) => setProduced(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">{unitSymbol(baseUnit)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t("production_produced_hint")}</p>
              </div>
              <div className="space-y-1 rounded-xl border border-border/70 p-3 text-sm">
                <p className="flex justify-between gap-2 text-muted-foreground">
                  {t("production_total_cost")}
                  <span className="font-medium text-foreground">{formatMoney(realCost)}</span>
                </p>
                <p className="flex justify-between gap-2 text-muted-foreground">
                  {t("production_unit_cost", { name: itemName })}
                  <span className="font-medium text-foreground">
                    {producedQty > 0 ? `${formatUnitCost(realCost / producedQty)} / ${unitSymbol(baseUnit)}` : "—"}
                  </span>
                </p>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="produccion-nota">{t("notes")}</Label>
            <Textarea
              id="produccion-nota"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button id="btn-registrar-produccion" type="button" onClick={submit} disabled={!canSubmit}>
            {pending ? t("saving") : isPlan ? t("production_save_plan") : t("production_register")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
