import { useState } from "react"
import { useQueries } from "@tanstack/react-query"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/i18n/use-i18n"
import { useLocaleFormat } from "@/hooks/use-locale-format"
import { useBranchItems } from "@/features/business/items/catalog/hooks/use-branch-items"
import { getBranchItemByItemPublicId } from "@/features/business/items/catalog/services/branch-items.service"
import type { BranchItemResponseDto } from "@/features/business/items/catalog/types"
import { useDebouncedValue, useOrderWorkspaceKey, useWorkspaceState } from "../hooks/use-order-workspace"

const validIds = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 20 &&
  value.every((id) => typeof id === "string" && /^[\da-f-]{36}$/i.test(id))

export function OrderProductPicker({
  branchId,
  onAdd,
}: {
  branchId: string
  onAdd: (item: BranchItemResponseDto) => void
}) {
  const { t } = useTranslation("business-orders")
  const { formatCurrency } = useLocaleFormat()
  const [searchState, setSearchState] = useState({ text: "", page: 1 })
  const search = useDebouncedValue(searchState.text.trim())
  const [favorites, setFavorites] = useWorkspaceState(
    useOrderWorkspaceKey("order-favorites", branchId),
    [] as string[],
    localStorage,
    validIds
  )
  const [recent, setRecent] = useWorkspaceState(
    useOrderWorkspaceKey("order-recent", branchId),
    [] as string[],
    localStorage,
    validIds
  )
  const [group, setGroup] = useState<"catalog" | "favorites" | "recent">("catalog")
  const products = useBranchItems(branchId, { pageNumber: searchState.page, pageSize: 20, search })
  const ids = group === "favorites" ? favorites : group === "recent" ? recent : []
  const shortcuts = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["branch-item-shortcut", branchId, id],
      queryFn: () => getBranchItemByItemPublicId(branchId, id),
      staleTime: 0,
      retry: false,
    })),
  })
  const items = (
    group === "catalog" ? (products.data?.data ?? []) : shortcuts.flatMap((q) => (q.data ? [q.data] : []))
  ).filter((item) => !item.inactive)
  const add = (item: BranchItemResponseDto) => {
    onAdd(item)
    setRecent((old) => [item.itemPublicId, ...old.filter((id) => id !== item.itemPublicId)].slice(0, 12))
  }
  const toggleFavorite = (id: string) =>
    setFavorites((old) => (old.includes(id) ? old.filter((x) => x !== id) : [id, ...old].slice(0, 20)))
  const loading = group === "catalog" ? products.isFetching : shortcuts.some((q) => q.isFetching)
  const failed = group === "catalog" ? products.isError : shortcuts.some((q) => q.isError)
  return (
    <section className="space-y-2">
      <Label htmlFor="order-product-search">{t("product_search")}</Label>
      <Input
        id="order-product-search"
        value={searchState.text}
        maxLength={120}
        placeholder={t("product_search_hint")}
        onChange={(e) => {
          setSearchState({ text: e.target.value, page: 1 })
          setGroup("catalog")
        }}
      />
      <div className="flex flex-wrap gap-2">
        {(["catalog", "favorites", "recent"] as const).map((value) => (
          <Button
            type="button"
            key={value}
            variant={group === value ? "default" : "outline"}
            size="sm"
            className="min-h-11"
            aria-pressed={group === value}
            onClick={() => setGroup(value)}
          >
            {t(`products_${value}`)}
          </Button>
        ))}
      </div>
      <Label htmlFor="manual-order-item">{t("items")}</Label>
      <Select
        value=""
        onValueChange={(id) => {
          const item = items.find((i) => i.itemPublicId === id)
          if (item) add(item)
        }}
      >
        <SelectTrigger id="manual-order-item" className="w-full">
          <SelectValue placeholder={t("select_item_placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.itemPublicId} value={item.itemPublicId}>
              {item.itemName}
              {item.itemSku ? ` (${item.itemSku})` : ""} — {formatCurrency(item.price)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loading && (
        <p role="status" className="text-xs">
          {t("loading")}
        </p>
      )}
      {failed && (
        <div role="alert" className="text-sm">
          <p>{t("product_search_error")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (group === "catalog") void products.refetch()
              else shortcuts.forEach((q) => void q.refetch())
            }}
          >
            {t("refresh")}
          </Button>
        </div>
      )}
      {!loading && !failed && !items.length && (
        <p className="text-sm text-muted-foreground">{t("product_no_matches")}</p>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer text-sm">{t("manage_favorites")}</summary>
        <div className="grid gap-1 sm:grid-cols-2">
          {items.map((item) => (
            <Button
              key={item.itemPublicId}
              type="button"
              variant="ghost"
              className="min-h-11 justify-start truncate"
              aria-pressed={favorites.includes(item.itemPublicId)}
              onClick={() => toggleFavorite(item.itemPublicId)}
            >
              <Star
                className={
                  favorites.includes(item.itemPublicId) ? "mr-2 size-4 shrink-0 fill-current" : "mr-2 size-4 shrink-0"
                }
              />
              <span className="truncate">{item.itemName}</span>
            </Button>
          ))}
        </div>
      </details>
      {group === "catalog" && (products.data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={searchState.page <= 1 || loading}
            onClick={() => setSearchState((s) => ({ ...s, page: s.page - 1 }))}
          >
            {t("previous")}
          </Button>
          <span className="text-xs">
            {searchState.page} / {products.data?.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={searchState.page >= (products.data?.totalPages ?? 1) || loading}
            onClick={() => setSearchState((s) => ({ ...s, page: s.page + 1 }))}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </section>
  )
}
