import { useState } from "react"
import { Plus, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useItems } from "@/features/business/items/catalog/hooks/use-items"
import type { ItemResponseDto } from "@/features/business/items/catalog/types"
import { useTranslation } from "@/i18n/use-i18n"
import { BASE_UNIT_KEY, unitSymbol, type QuantityUnitValue } from "../utils/units"
import { QuantityUnitInput } from "./quantity-unit-input"

export type ProductLine = {
  itemId: string
  name: string
  sku: string | null
  baseUnit: number
  quantity: QuantityUnitValue
  /** Solo entradas de proveedor: precio por la unidad elegida (presentación o unidad base). */
  unitCost?: string
}

type ProductLinesEditorProps = {
  lines: ProductLine[]
  onChange: (lines: ProductLine[]) => void
  /** Muestra la columna de precio (entradas de proveedor). */
  withPrice?: boolean
}

/** Buscar productos que manejan inventario y escribir cuánto, en bultos/cajas o unidad base. */
export function ProductLinesEditor({ lines, onChange, withPrice = false }: ProductLinesEditorProps) {
  const { t } = useTranslation("business-inventory")
  const [search, setSearch] = useState("")
  const { data } = useItems({ pageSize: 8, searchField: "all", searchValue: search.trim() || undefined })
  const candidates = search.trim()
    ? (data?.data ?? []).filter((i) => i.trackInventory && !lines.some((l) => l.itemId === i.id))
    : []

  const add = (item: ItemResponseDto) => {
    onChange([
      ...lines,
      {
        itemId: item.id,
        name: item.name ?? "",
        sku: item.sku,
        baseUnit: item.baseUnit,
        quantity: { amount: "", unitKey: BASE_UNIT_KEY },
        unitCost: withPrice ? "" : undefined,
      },
    ])
    setSearch("")
  }

  const update = (itemId: string, patch: Partial<ProductLine>) =>
    onChange(lines.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l)))

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="lineas-buscar-producto"
            placeholder={t("lines_search")}
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
                onClick={() => add(c)}
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
          <p className="text-xs text-muted-foreground">{t("lines_no_results")}</p>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t("lines_empty")}</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="min-w-64">{t("quantity")}</TableHead>
                {withPrice ? <TableHead className="w-40">{t("price_per_unit_chosen")}</TableHead> : null}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.itemId}>
                  <TableCell>
                    <p className="font-medium text-foreground">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.sku ?? ""}</p>
                  </TableCell>
                  <TableCell>
                    <QuantityUnitInput
                      id={`linea-cantidad-${l.itemId}`}
                      itemId={l.itemId}
                      baseUnit={l.baseUnit}
                      value={l.quantity}
                      onChange={(quantity) => update(l.itemId, { quantity })}
                    />
                  </TableCell>
                  {withPrice ? (
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        aria-label={t("price_per_unit_chosen")}
                        value={l.unitCost ?? ""}
                        onChange={(e) => update(l.itemId, { unitCost: e.target.value })}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("lines_remove")}
                      onClick={() => onChange(lines.filter((x) => x.itemId !== l.itemId))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
