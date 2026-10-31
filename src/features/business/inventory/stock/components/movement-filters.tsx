import { useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/i18n/use-i18n"
import { useMovementAuthors } from "../../hooks/use-inventory"
import { MOVEMENT_DOCUMENT_TYPES, MOVEMENT_REASONS, MOVEMENT_TYPES } from "../../types"
import {
  ALL,
  EMPTY_MOVEMENT_FILTERS,
  MORE_KEYS,
  hasMovementFilters,
  isSet,
  type MovementFilterForm,
} from "./movement-filter-form"

type MovementFiltersPanelProps = {
  branchId: string
  value: MovementFilterForm
  onChange: (value: MovementFilterForm) => void
}

/** Filtros del historial por todas las propiedades del movimiento. */
export function MovementFiltersPanel({ branchId, value, onChange }: MovementFiltersPanelProps) {
  const { t } = useTranslation("business-inventory")
  const moreCount = MORE_KEYS.filter((k) => isSet(value, k)).length
  const [showMore, setShowMore] = useState(moreCount > 0)
  const authors = useMovementAuthors(branchId)

  const set = (key: keyof MovementFilterForm) => (next: string) => onChange({ ...value, [key]: next })

  const select = (key: keyof MovementFilterForm, label: string, allLabel: string, options: [string, string][]) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value[key]} onValueChange={set(key)}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const field = (key: keyof MovementFilterForm, label: string, type = "text", placeholder?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`movimientos-${key}`}>{label}</Label>
      <Input
        id={`movimientos-${key}`}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        min={type === "number" ? 0 : undefined}
        placeholder={placeholder}
        value={value[key]}
        onChange={(e) => set(key)(e.target.value)}
      />
    </div>
  )

  const range = (min: keyof MovementFilterForm, max: keyof MovementFilterForm, label: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={`movimientos-${min}`}
          type="number"
          inputMode="decimal"
          min={0}
          aria-label={`${label} ${t("filter_from")}`}
          placeholder={t("filter_min")}
          value={value[min]}
          onChange={(e) => set(min)(e.target.value)}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          id={`movimientos-${max}`}
          type="number"
          inputMode="decimal"
          min={0}
          aria-label={`${label} ${t("filter_to")}`}
          placeholder={t("filter_max")}
          value={value[max]}
          onChange={(e) => set(max)(e.target.value)}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-3 rounded-xl border border-border/70 p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1.5 xl:col-span-2">
          <Label htmlFor="movimientos-search">{t("product")}</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="movimientos-search"
              type="search"
              placeholder={t("search_products")}
              value={value.search}
              onChange={(e) => set("search")(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        {select(
          "type",
          t("movement"),
          t("filter_all_movements"),
          MOVEMENT_TYPES.map((m) => [m, t(`movement_${m}`)])
        )}
        {field("from", t("filter_from"), "date")}
        {field("to", t("filter_to"), "date")}
      </div>

      {showMore ? (
        <div className="grid gap-3 border-t border-border/70 pt-3 md:grid-cols-2 xl:grid-cols-4">
          {select("direction", t("filter_direction"), t("filter_all_directions"), [
            ["in", t("filter_direction_in")],
            ["out", t("filter_direction_out")],
          ])}
          {select(
            "documentType",
            t("document"),
            t("filter_all_documents"),
            MOVEMENT_DOCUMENT_TYPES.map((d) => [d, t(`document_type_${d}`)])
          )}
          {field("documentNumber", t("filter_document_number"), "text", t("filter_document_number_placeholder"))}
          {select(
            "reason",
            t("filter_reason"),
            t("filter_all_reasons"),
            MOVEMENT_REASONS.map((r) => [r, t(`reason_${r}`)])
          )}
          {select(
            "createdBy",
            t("user"),
            t("filter_all_users"),
            (authors.data ?? []).map((name) => [name, name])
          )}
          {field("notes", t("filter_notes"), "text", t("filter_notes_placeholder"))}
          {select("reversed", t("filter_reversed"), t("filter_all_states"), [
            ["no", t("filter_reversed_no")],
            ["yes", t("filter_reversed_yes")],
          ])}
          {range("minQuantity", "maxQuantity", t("quantity"))}
          {range("minUnitCost", "maxUnitCost", t("filter_unit_cost"))}
          {range("minTotalCost", "maxTotalCost", t("filter_total_cost"))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          id="btn-mas-filtros-movimientos"
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowMore((s) => !s)}
        >
          <SlidersHorizontal className="size-4" />
          {showMore ? t("filter_less") : t("filter_more")}
          {moreCount > 0 ? <Badge tone="primary">{moreCount}</Badge> : null}
        </Button>
        {hasMovementFilters(value) ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(EMPTY_MOVEMENT_FILTERS)}>
            <X className="size-4" />
            {t("filter_clear")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
