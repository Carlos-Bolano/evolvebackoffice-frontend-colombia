import { useState } from "react"
import { CreditCard, Plus, RotateCcw, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import {
  useAllPaymentMethods,
  useCreatePaymentMethod,
  useRestoreCountryDefaults,
  useSetActivePaymentMethod,
  useUpdatePaymentMethod,
} from "../hooks/use-payment-methods"
import { PaymentMethodsTable } from "../components/payment-methods-table"
import { PaymentMethodFormDialog } from "../components/payment-method-form-dialog"
import { PendingAuthorizationsSection } from "../components/pending-authorizations-section"
import type { PaymentMethodResponseDto } from "../types"

export function PaymentMethodsPage() {
  const { t } = useTranslation("business-payment-methods")
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodResponseDto | null>(null)

  const { data: methods, isLoading } = useAllPaymentMethods()
  const createMutation = useCreatePaymentMethod()
  const updateMutation = useUpdatePaymentMethod()
  const toggleMutation = useSetActivePaymentMethod()
  const restoreMutation = useRestoreCountryDefaults()

  const list = methods ?? []
  const filtered = search
    ? list.filter((m) => {
        const term = search.toLowerCase()
        return m.name.toLowerCase().includes(term) || m.code.toLowerCase().includes(term)
      })
    : list

  const handleCreate = (values: Parameters<typeof createMutation.mutate>[0]) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        setFormOpen(false)
        notify.success(t("method_created"))
      },
      onError: (error) => notify.error(getErrorMessage(error)),
    })
  }

  const handleEdit = (values: Parameters<typeof updateMutation.mutate>[0]["payload"]) => {
    if (!selectedMethod) return
    updateMutation.mutate(
      { id: selectedMethod.id, payload: values },
      {
        onSuccess: () => {
          setFormOpen(false)
          setSelectedMethod(null)
          notify.success(t("method_updated"))
        },
        onError: (error) => notify.error(getErrorMessage(error)),
      }
    )
  }

  const handleToggleActive = (method: PaymentMethodResponseDto) => {
    toggleMutation.mutate(
      { id: method.id, active: !method.isActive },
      {
        onSuccess: () => notify.success(t("method_status_updated")),
        onError: (error) => notify.error(getErrorMessage(error)),
      }
    )
  }

  const handleRestoreDefaults = () => {
    if (!window.confirm(t("restore_confirm"))) return
    restoreMutation.mutate(undefined, {
      onSuccess: (result) => notify.success(t("restored", { count: result.inserted })),
      onError: (error) => notify.error(getErrorMessage(error)),
    })
  }

  const openCreateDialog = () => {
    setSelectedMethod(null)
    setFormOpen(true)
  }

  const openEditDialog = (method: PaymentMethodResponseDto) => {
    setSelectedMethod(method)
    setFormOpen(true)
  }

  const handleDialogClose = () => {
    setFormOpen(false)
    setSelectedMethod(null)
  }

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="p-4 sm:p-6 lg:p-8">
        <div className="relative flex flex-col gap-2">
          <Badge className="max-w-fit" tone="primary">
            {t("payment_methods")}
          </Badge>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{t("catalog")}</h1>
          <p className="max-w-4xl text-sm leading-5 text-muted-foreground">{t("catalog_desc")}</p>
          <CreditCard
            color="#58626b"
            className="absolute -top-10 -right-20 -z-10 size-50 shrink-0 animate-float opacity-5 md:-top-10 md:-right-10 md:size-70 lg:-top-20 lg:-right-30 lg:size-100"
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("search_methods")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleRestoreDefaults}
              disabled={restoreMutation.isPending}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="mr-2 size-4" />
              {t("restore_defaults")}
            </Button>
            <Button onClick={openCreateDialog} className="w-full sm:w-auto">
              <Plus className="mr-2 size-4" />
              {t("new_method")}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          ) : (
            <PaymentMethodsTable methods={filtered} onEdit={openEditDialog} onToggleActive={handleToggleActive} />
          )}
        </div>

        <PendingAuthorizationsSection />

        <PaymentMethodFormDialog
          open={formOpen}
          onOpenChange={handleDialogClose}
          methodToEdit={selectedMethod}
          onSubmit={selectedMethod ? handleEdit : handleCreate}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      </CardContent>
    </Card>
  )
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string; title?: string } } }).response
    return response?.data?.error ?? response?.data?.message ?? response?.data?.title ?? "Error"
  }
  return "Error"
}
