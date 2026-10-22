import { useQuery } from "@tanstack/react-query"
import { api } from "@/config/axios-client"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/use-i18n"
import type { CustomerResponseDto } from "@/features/business/people/customers/types"
import { useDebouncedValue, useOrderWorkspaceKey } from "../hooks/use-order-workspace"

export function OrderCustomerLookup({
  phone,
  selectedId,
  onSelect,
  onOccasional,
}: {
  phone: string
  selectedId: string | null
  onSelect: (customer: CustomerResponseDto) => void
  onOccasional: () => void
}) {
  const { t } = useTranslation("business-orders")
  const workspace = useOrderWorkspaceKey("order-customer")
  const digits = useDebouncedValue(phone.replace(/\D/g, ""))
  const query = useQuery({
    queryKey: ["order-customer-lookup", workspace, digits],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: CustomerResponseDto[]; totalCount: number }>("/api/customers/lookup-by-phone", {
          params: { phone: digits },
          signal,
        })
      ).data,
    enabled: digits.length >= 6 && !selectedId,
    retry: false,
  })
  return (
    <div className="space-y-1 text-sm">
      <p className="text-xs text-muted-foreground">{t(selectedId ? "customer_linked" : "customer_phone_hint")}</p>
      {query.isFetching && !selectedId && <p role="status">{t("loading")}</p>}
      {query.isError && !selectedId && (
        <div role="alert">
          <p>{t("customer_lookup_error")}</p>
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            {t("refresh")}
          </Button>
        </div>
      )}
      {!selectedId &&
        digits === phone.replace(/\D/g, "") &&
        query.data?.data
          .filter((c) => c.isActive)
          .map((c) => (
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-11 w-full justify-start text-left whitespace-normal"
              key={c.id}
              onClick={() => onSelect(c)}
            >
              {c.firstName} {c.lastName} · {c.phoneNumber} · {c.address || c.city}
            </Button>
          ))}
      {!selectedId && !query.isFetching && query.data && !query.data.data.some((c) => c.isActive) && (
        <p>{t("customer_no_matches")}</p>
      )}
      {(selectedId || (query.data?.data.length ?? 0) > 0) && (
        <Button type="button" variant="ghost" className="min-h-11" onClick={onOccasional}>
          {t("customer_occasional")}
        </Button>
      )}
      {!selectedId && (query.data?.totalCount ?? 0) > 10 && <p>{t("customer_refine_phone")}</p>}
    </div>
  )
}
