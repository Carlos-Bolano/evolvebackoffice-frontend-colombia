import { useState } from "react"
import { Search, Users, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { useCustomers, useCreateCustomer, useUpdateCustomer, useToggleCustomerActive } from "../hooks/use-customers"
import { CustomersTable } from "../components/customers-table"
import { CustomerFormDialog } from "../components/customer-form-dialog"
import type { CreateCustomerFormValues } from "../schemas/customer-schema"
import type { CustomerResponseDto } from "../types"

export function CustomersPage() {
  const { t } = useTranslation("business-customers")
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResponseDto | null>(null)

  const { data, isLoading } = useCustomers()
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const toggleActiveMutation = useToggleCustomerActive()

  const customers = data?.items ?? []
  const totalCount = data?.totalCount ?? customers.length

  const filteredCustomers = search
    ? customers.filter((customer) => {
        const term = search.toLowerCase()
        return (
          [customer.firstName, customer.lastName].filter(Boolean).join(" ").toLowerCase().includes(term) ||
          customer.emailAddress?.toLowerCase().includes(term) ||
          customer.identificationNumber?.toLowerCase().includes(term) ||
          customer.city?.toLowerCase().includes(term) ||
          customer.phoneNumber?.toLowerCase().includes(term)
        )
      })
    : customers

  const handleCreate = (values: CreateCustomerFormValues) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        setFormOpen(false)
        notify.success(t("customer_created"))
      },
      onError: (error) => notify.error(getErrorMessage(error)),
    })
  }

  const handleEdit = (values: CreateCustomerFormValues) => {
    if (!selectedCustomer) return
    updateMutation.mutate(
      { id: selectedCustomer.id, payload: values },
      {
        onSuccess: () => {
          setFormOpen(false)
          setSelectedCustomer(null)
          notify.success(t("customer_updated"))
        },
        onError: (error) => notify.error(getErrorMessage(error)),
      }
    )
  }

  const handleToggleActive = (customer: CustomerResponseDto) => {
    toggleActiveMutation.mutate(
      { id: customer.id, active: !customer.isActive },
      {
        onSuccess: () => notify.success(t("customer_status_updated")),
        onError: (error) => notify.error(getErrorMessage(error)),
      }
    )
  }

  const openCreateDialog = () => {
    setSelectedCustomer(null)
    setFormOpen(true)
  }

  const openEditDialog = (customer: CustomerResponseDto) => {
    setSelectedCustomer(customer)
    setFormOpen(true)
  }

  const handleDialogClose = () => {
    setFormOpen(false)
    setSelectedCustomer(null)
  }

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="p-4 sm:p-6 lg:p-8">
        <div className="relative flex flex-col gap-2">
          <Badge className="max-w-fit" tone="primary">
            {t("customers")}
          </Badge>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{t("customer_catalog")}</h1>
          <p className="max-w-4xl text-sm leading-5 text-muted-foreground">{t("customer_catalog_desc")}</p>
          <Users
            color="#58626b"
            className="absolute -top-10 -right-20 -z-10 size-50 shrink-0 animate-float opacity-5 md:-top-10 md:-right-10 md:size-70 lg:-top-20 lg:-right-30 lg:size-100"
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("search_customers")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openCreateDialog} className="w-full sm:w-auto">
            <Plus className="mr-2 size-4" />
            {t("new_customer")}
          </Button>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          ) : (
            <>
              <CustomersTable
                customers={filteredCustomers}
                onEdit={openEditDialog}
                onToggleActive={handleToggleActive}
              />
              {totalCount > customers.length && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("showing_of", { shown: customers.length, total: totalCount })}
                </p>
              )}
            </>
          )}
        </div>

        <CustomerFormDialog
          open={formOpen}
          onOpenChange={handleDialogClose}
          customerToEdit={selectedCustomer}
          onSubmit={selectedCustomer ? handleEdit : handleCreate}
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
