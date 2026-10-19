import { useState } from "react"
import { Plus, Save, Search, Trash2 } from "lucide-react"

import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { getApiErrorMessage } from "@/utils/api-error"
import { useDeleteRecipe, useRecipe, useSaveRecipe } from "@/features/business/inventory/hooks/use-inventory"
import { useInventoryBranch } from "@/features/business/inventory/hooks/use-inventory-branch"
import type { RecipeDto } from "@/features/business/inventory/types"
import { formatMoney, formatQuantity, formatUnitCost, unitSymbol } from "@/features/business/inventory/utils/units"
import { useItems } from "../hooks/use-items"
import type { ItemResponseDto } from "../types"
import { BranchSelector } from "./branch-selector"

type ItemRecipeEditorProps = {
  item: ItemResponseDto
}

type DraftLine = {
  ingredientItemId: string
  name: string
  sku: string | null
  baseUnit: number
  quantity: string
}

type Draft = { yieldQuantity: string; notes: string; lines: DraftLine[] }

function toDraft(recipe: RecipeDto | null | undefined): Draft {
  if (!recipe) return { yieldQuantity: "1", notes: "", lines: [] }
  return {
    yieldQuantity: String(recipe.yieldQuantity),
    notes: recipe.notes ?? "",
    lines: recipe.lines.map((l) => ({
      ingredientItemId: l.ingredientItemId,
      name: l.ingredientName,
      sku: l.ingredientSku,
      baseUnit: l.baseUnit,
      quantity: String(l.quantity),
    })),
  }
}

/**
 * Receta (ficha técnica) del producto: ingredientes por tanda y cuánto rinde.
 * Plato de menú → se descuenta al vender. Semielaborado → se usa al producir.
 */
export function ItemRecipeEditor({ item }: ItemRecipeEditorProps) {
  const { t } = useTranslation("business-items-catalog")
  const { branches, branchId, selectBranch } = useInventoryBranch()
  const recipeQuery = useRecipe(item.id, branchId)
  const saveRecipe = useSaveRecipe(item.id)
  const deleteRecipe = useDeleteRecipe(item.id)

  const [draft, setDraft] = useState<Draft>(() => toDraft(null))
  const [loadedFrom, setLoadedFrom] = useState<RecipeDto | null | undefined>(undefined)
  const [search, setSearch] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Al llegar (o recargar) la receta del servidor se toma como borrador.
  if (recipeQuery.data !== undefined && recipeQuery.data !== loadedFrom) {
    setLoadedFrom(recipeQuery.data)
    setDraft(toDraft(recipeQuery.data))
  }

  const { data: searchResults } = useItems({ pageSize: 8, searchField: "all", searchValue: search.trim() || undefined })
  const candidates = search.trim()
    ? (searchResults?.data ?? []).filter(
        (i) =>
          i.id !== item.id && (i.trackInventory || i.hasRecipe) && !draft.lines.some((l) => l.ingredientItemId === i.id)
      )
    : []

  const recipe = recipeQuery.data ?? null
  const costByIngredient = new Map(recipe?.lines.map((l) => [l.ingredientItemId, l.unitCost]) ?? [])
  const yieldNumber = Number(draft.yieldQuantity)
  const linesValid = draft.lines.length > 0 && draft.lines.every((l) => Number(l.quantity) > 0)
  const canSave = yieldNumber > 0 && linesValid && !saveRecipe.isPending

  const addIngredient = (ingredient: ItemResponseDto) => {
    setDraft((d) => ({
      ...d,
      lines: [
        ...d.lines,
        {
          ingredientItemId: ingredient.id,
          name: ingredient.name ?? "",
          sku: ingredient.sku,
          baseUnit: ingredient.baseUnit,
          quantity: "",
        },
      ],
    }))
    setSearch("")
  }

  const updateLine = (id: string, quantity: string) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.ingredientItemId === id ? { ...l, quantity } : l)) }))

  const removeLine = (id: string) =>
    setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.ingredientItemId !== id) }))

  const handleSave = () => {
    if (!canSave) return
    saveRecipe.mutate(
      {
        yieldQuantity: yieldNumber,
        notes: draft.notes.trim() || null,
        lines: draft.lines.map((l) => ({ ingredientItemId: l.ingredientItemId, quantity: Number(l.quantity) })),
      },
      {
        onSuccess: () => notify.success(t("recipe_saved")),
        onError: (error) => notify.error(getApiErrorMessage(error, t("recipe_error"))),
      }
    )
  }

  const handleDelete = () =>
    deleteRecipe.mutate(undefined, {
      onSuccess: () => {
        setConfirmDelete(false)
        notify.success(t("recipe_deleted"))
      },
      onError: (error) => notify.error(getApiErrorMessage(error, t("recipe_error"))),
    })

  if (recipeQuery.isLoading) return <Skeleton className="h-48 w-full" />

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {item.trackInventory ? t("recipe_desc_produced") : t("recipe_desc_sold")}
      </p>

      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[200px_1fr]">
        <div className="space-y-2">
          <Label htmlFor="receta-rinde">{t("recipe_yield", { unit: unitSymbol(item.baseUnit) })}</Label>
          <Input
            id="receta-rinde"
            type="number"
            min={0}
            step="any"
            value={draft.yieldQuantity}
            onChange={(e) => setDraft((d) => ({ ...d, yieldQuantity: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">{t("recipe_yield_hint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="receta-notas">{t("recipe_notes")}</Label>
          <Textarea
            id="receta-notas"
            rows={3}
            maxLength={1000}
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="receta-buscar-ingrediente"
            placeholder={t("recipe_search_ingredient")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {candidates.length > 0 ? (
          <div className="divide-y rounded-lg border">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addIngredient(c)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50"
              >
                <span>
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{c.sku ?? ""}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {unitSymbol(c.baseUnit)}
                  <Plus className="size-4" />
                </span>
              </button>
            ))}
          </div>
        ) : search.trim() ? (
          <p className="text-xs text-muted-foreground">{t("recipe_no_candidates")}</p>
        ) : null}
      </div>

      {draft.lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("recipe_empty")}</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("recipe_ingredient")}</TableHead>
                <TableHead className="w-44">{t("recipe_quantity")}</TableHead>
                <TableHead className="text-right">{t("recipe_cost")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.lines.map((l) => {
                const unitCost = costByIngredient.get(l.ingredientItemId)
                const quantity = Number(l.quantity)
                return (
                  <TableRow key={l.ingredientItemId}>
                    <TableCell>
                      <p className="font-medium text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.sku ?? ""}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          aria-label={t("recipe_quantity")}
                          value={l.quantity}
                          onChange={(e) => updateLine(l.ingredientItemId, e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">{unitSymbol(l.baseUnit)}</span>
                      </div>
                      {quantity >= 1000 && l.baseUnit !== 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">= {formatQuantity(quantity, l.baseUnit)}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {unitCost != null && quantity > 0 ? formatMoney(unitCost * quantity) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("recipe_remove_ingredient")}
                        onClick={() => removeLine(l.ingredientItemId)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {recipe && branches.length > 0 ? (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{t("recipe_cost_in_branch")}</p>
            <BranchSelector
              options={branches.map((b) => ({ id: b.id, name: b.name }))}
              selectedId={branchId}
              onSelect={(id) => id && selectBranch(id)}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">
              {t("recipe_batch_cost")}:{" "}
              <span className="font-medium text-foreground">{formatMoney(recipe.batchCost ?? 0)}</span>
            </span>
            <span className="text-muted-foreground">
              {t("recipe_unit_cost", { unit: unitSymbol(item.baseUnit) })}:{" "}
              <span className="font-medium text-foreground">{formatUnitCost(recipe.unitCost ?? 0)}</span>
            </span>
          </div>
          {recipe.warnings.map((w) => (
            <Badge key={w} tone="warning">
              {w}
            </Badge>
          ))}
          <p className="text-xs text-muted-foreground">{t("recipe_cost_hint")}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {recipe ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteRecipe.isPending}
          >
            <Trash2 className="mr-2 size-4" />
            {t("recipe_delete")}
          </Button>
        ) : null}
        <Button id="btn-guardar-receta" type="button" onClick={handleSave} disabled={!canSave}>
          <Save className="mr-2 size-4" />
          {saveRecipe.isPending ? t("saving") : t("recipe_save")}
        </Button>
      </div>

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("recipe_delete_title")}
        description={t("recipe_delete_desc")}
        confirmLabel={t("recipe_delete")}
        tone="destructive"
        isPending={deleteRecipe.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
