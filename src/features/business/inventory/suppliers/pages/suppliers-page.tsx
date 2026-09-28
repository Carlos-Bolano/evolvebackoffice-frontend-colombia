import { useState } from "react"
import { Plus, Search, Truck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useToggleSupplierActive } from "../hooks/use-suppliers"
import { SuppliersTable } from "../components/suppliers-table"
import { SupplierFormDialog } from "../components/supplier-form-dialog"
import type { CreateSupplierFormValues } from "../schemas/supplier-schema"
import type { SupplierResponseDto } from "../types"

export function SuppliersPage() {
  const { t } = useTranslation("business-suppliers")
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierResponseDto | null>(null)

  const { data, isLoading } = useSuppliers()
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()
  const toggleActiveMutation = useToggleSupplierActive()

  const suppliers = data?.items ?? []
  const totalCount = data?.totalCount ?? suppliers.length

  const filteredSuppliers = search
    ? suppliers.filter((supplier) => {
        const term = search.toLowerCase()
        return (
          supplier.company?.toLowerCase().includes(term) ||
          [supplier.firstName, supplier.lastName].filter(Boolean).join(" ").toLowerCase().includes(term) ||
          supplier.emailAddress?.toLowerCase().includes(term) ||
          supplier.identificationNumber?.toLowerCase().includes(term) ||
          supplier.code?.toLowerCase().includes(term) ||
          supplier.phoneNumber?.toLowerCase().includes(term)
        )
      })
    : suppliers

  const handleCreate = (values: CreateSupplierFormValues) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        setFormOpen(false)
        notify.success(t("supplier_created"))
      },
      onError: (error) => notify.error(getErrorMessage(error)),
    })
  }

  const handleEdit = (values: CreateSupplierFormValues) => {
    if (!selectedSupplier) return
    updateMutation.mutate(
      { id: selectedSupplier.id, payload: values },
      {
        onSuccess: () => {
          setFormOpen(false)
          setSelectedSupplier(null)
          notify.success(t("supplier_updated"))
        },
        onError: (error) => notify.error(getErrorMessage(error)),
      }
    )
  }

  const handleToggleActive = (supplier: SupplierResponseDto) => {
    toggleActiveMutation.mutate(
      { id: supplier.id, active: supplier.inactive },
      {
        onSuccess: () => notify.success(t("supplier_status_updated")),
        onError: (error) => notify.error(getErrorMessage(error)),
      }
    )
  }

  const openCreateDialog = () => {
    setSelectedSupplier(null)
    setFormOpen(true)
  }

  const openEditDialog = (supplier: SupplierResponseDto) => {
    setSelectedSupplier(supplier)
    setFormOpen(true)
  }

  const handleDialogClose = () => {
    setFormOpen(false)
    setSelectedSupplier(null)
  }

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="p-4 sm:p-6 lg:p-8">
        <div className="relative flex flex-col gap-2">
          <Badge className="max-w-fit" tone="primary">
            {t("suppliers")}
          </Badge>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{t("supplier_catalog")}</h1>
          <p className="max-w-4xl text-sm leading-5 text-muted-foreground">{t("supplier_catalog_desc")}</p>
          <Truck
            color="#58626b"
            className="absolute -top-10 -right-20 -z-10 size-50 shrink-0 animate-float opacity-5 md:-top-10 md:-right-10 md:size-70 lg:-top-20 lg:-right-30 lg:size-100"
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("search_suppliers")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openCreateDialog} className="w-full sm:w-auto">
            <Plus className="mr-2 size-4" />
            {t("new_supplier")}
          </Button>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          ) : (
            <>
              <SuppliersTable
                suppliers={filteredSuppliers}
                onEdit={openEditDialog}
                onToggleActive={handleToggleActive}
              />
              {totalCount > suppliers.length && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("showing_of", { shown: suppliers.length, total: totalCount })}
                </p>
              )}
            </>
          )}
        </div>

        <SupplierFormDialog
          open={formOpen}
          onOpenChange={handleDialogClose}
          supplierToEdit={selectedSupplier}
          onSubmit={selectedSupplier ? handleEdit : handleCreate}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      </CardContent>
    </Card>
  )
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: { message?: string; title?: string } } }).response
    return response?.data?.message ?? response?.data?.title ?? "Error"
  }
  return "Error"
}
