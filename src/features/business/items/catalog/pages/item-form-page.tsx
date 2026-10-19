import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { BackLink } from "@/components/ui/back-link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorState } from "@/components/ui/error-state"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslation } from "@/i18n/use-i18n"
import { createItemSchema, type CreateItemFormValues } from "../schemas/item-schema"
import { useCreateItem, useItemById, useUpdateItem } from "../hooks/use-items"
import { useDepartmentsAll } from "../../departments/hooks/use-departments"
import { ItemTaxEditor } from "../components/item-tax-editor"
import { ItemModifierEditor } from "../components/item-modifier-editor"

const defaultValues: CreateItemFormValues = {
  name: "",
  sku: null,
  description: null,
  plu: 0,
  departmentId: 0,
  itemType: 0,
  unitOfMeasure: null,
  taxable: false,
  webItem: false,
  extendedDescription: null,
  subDescription1: null,
  subDescription2: null,
  subDescription3: null,
  priceMustBeEntered: false,
  brandId: 0,
  itemPresentationId: 0,
  askQuantity: 0,
}

export function ItemFormPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation("business-items-catalog")

  // La ruta /new no declara :itemId (queda undefined); la ruta /:itemId llega con el string "new".
  const isCreateMode = !itemId || itemId === "new"
  const detailId = !isCreateMode && itemId ? itemId : ""

  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("tab")
  const [activeTab, setActiveTabState] = useState(
    !isCreateMode && (tabParam === "taxes" || tabParam === "modifiers") ? tabParam : "info"
  )

  /** Cambia de pestaña y la refleja en la URL (deep-link). */
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (tab === "info") next.delete("tab")
        else next.set("tab", tab)
        return next
      },
      { replace: true }
    )
  }

  const { data: item, isLoading: itemLoading, isError: itemError } = useItemById(detailId)

  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const { data: departments, isLoading: departmentsLoading } = useDepartmentsAll()

  const form = useForm<CreateItemFormValues>({
    resolver: zodResolver(createItemSchema(t)) as never,
    defaultValues,
  })

  useEffect(() => {
    if (!item) return

    form.reset({
      name: item.name ?? "",
      sku: item.sku,
      description: item.description,
      plu: item.plu,
      departmentId: item.departmentId,
      itemType: item.itemType,
      unitOfMeasure: item.unitOfMeasure,
      taxable: item.taxable,
      webItem: item.webItem,
      extendedDescription: null,
      subDescription1: null,
      subDescription2: null,
      subDescription3: null,
      priceMustBeEntered: item.priceMustBeEntered,
      brandId: item.brandId,
      itemPresentationId: item.itemPresentationId,
      askQuantity: item.askQuantity,
    })
  }, [item, form])

  const handleSubmit = (values: CreateItemFormValues) => {
    // Transform form values to API types (convert undefined to null)
    const transformValues = (v: CreateItemFormValues) => ({
      ...v,
      sku: v.sku ?? null,
      description: v.description ?? null,
      unitOfMeasure: v.unitOfMeasure ?? null,
      extendedDescription: v.extendedDescription ?? null,
      subDescription1: v.subDescription1 ?? null,
      subDescription2: v.subDescription2 ?? null,
      subDescription3: v.subDescription3 ?? null,
    })

    if (!isCreateMode && item) {
      updateItem.mutate({ id: item.id, payload: transformValues(values) })
    } else {
      createItem.mutate(transformValues(values), {
        onSuccess: (created) => navigate(`/business/items/catalog/${created.id}`),
      })
    }
  }

  const isSubmitting = createItem.isPending || updateItem.isPending

  if (!isCreateMode && (itemError || (!itemLoading && !item))) {
    return (
      <ErrorState
        eyebrow="Item"
        title={t("item_not_found")}
        description={t("item_not_found_desc")}
        action={<Button onClick={() => navigate("/business/items/catalog")}>{t("back_to_catalog")}</Button>}
      />
    )
  }

  const detailsFormVisible = !(!isCreateMode && itemLoading)
  const heroTitle = isCreateMode ? t("create_item") : (item?.name ?? item?.sku ?? t("edit_item"))
  const heroDescription = item?.description || t("item_form_desc")

  return (
    <Card className="flex h-[calc(100vh-5.5rem)] flex-col overflow-hidden border-border/80 bg-card/70 shadow-none md:h-[calc(100vh-6.5rem)]">
      {/* Hero: backlink + título (nombre del item) + descripción del item */}
      <CardHeader className="relative shrink-0 overflow-hidden border-b border-border/70 px-5 pt-6 pb-5 sm:px-7 sm:pt-7">
        <div className="pointer-events-none absolute -top-16 -right-14 size-64 rounded-full border border-primary/10 bg-primary/[0.035]" />
        <div className="relative min-w-0 space-y-3">
          <div>
            <BackLink to="/business/items/catalog">{t("back_to_catalog")}</BackLink>
          </div>
          {itemLoading && !isCreateMode ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-2/3 max-w-sm" />
              <Skeleton className="h-4 w-1/2 max-w-md" />
            </div>
          ) : (
            <div className="space-y-1">
              <CardTitle className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
                {heroTitle}
              </CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">{heroDescription}</p>
            </div>
          )}
        </div>
      </CardHeader>

      {/* Cuerpo: área con scroll */}
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-4 sm:p-5">
        {!detailsFormVisible ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-full" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col gap-5">
            {!isCreateMode && (
              <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-1 sm:grid sm:w-full sm:grid-cols-3">
                <TabsTrigger value="info">{t("tab_info")}</TabsTrigger>
                <TabsTrigger value="taxes">{t("tab_taxes")}</TabsTrigger>
                <TabsTrigger value="modifiers">{t("tab_modifiers")}</TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="info" className="min-h-0 flex-1 overflow-y-auto pr-1">
              <Form {...form}>
                <form id="item-form" className="space-y-5" onSubmit={form.handleSubmit(handleSubmit)}>
                  {/* Basic Info */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("name")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("name_placeholder")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("sku")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("sku_placeholder")}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("description")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("description_placeholder")}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Numeric Fields */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="plu"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("plu")}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="departmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("department")}</FormLabel>
                          <Select
                            value={String(field.value ?? 0)}
                            onValueChange={(value) => field.onChange(Number(value))}
                            disabled={departmentsLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("department_placeholder")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">{t("department_none")}</SelectItem>
                              {(departments ?? []).map((d) => (
                                <SelectItem key={d.id} value={String(d.internalId)}>
                                  {d.parentName ? `${d.name} (${d.parentName})` : d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="itemType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("item_type")}</FormLabel>
                          <Select
                            value={String(field.value ?? 0)}
                            onValueChange={(value) => field.onChange(Number(value))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("item_type")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">{t("item_type_standard")}</SelectItem>
                              <SelectItem value="1">{t("item_type_weighted")}</SelectItem>
                              <SelectItem value="2">{t("item_type_no_inventory")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="unitOfMeasure"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("unit_of_measure")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("unit_of_measure_placeholder")}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="brandId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("brand_id")}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="askQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("ask_quantity")}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Boolean Toggles */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="taxable"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>{t("taxable")}</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="webItem"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>{t("web_item")}</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priceMustBeEntered"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <FormLabel>{t("price_must_be_entered")}</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {form.formState.errors.root ? (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
                  ) : null}
                </form>
              </Form>
            </TabsContent>

            {!isCreateMode && item && (
              <>
                <TabsContent value="taxes" className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <ItemTaxEditor item={item} />
                </TabsContent>
                <TabsContent value="modifiers" className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <ItemModifierEditor item={item} />
                </TabsContent>
              </>
            )}
          </Tabs>
        )}
      </CardContent>

      {/* Footer sticky: Cancel + Guardar (asocia al form por id) */}
      {detailsFormVisible && (isCreateMode || activeTab === "info") ? (
        <div className="shrink-0 border-t border-border/70 bg-card/80 px-4 py-3 sm:px-5">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/business/items/catalog")}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" form="item-form" disabled={isSubmitting}>
              {isSubmitting ? t("saving") : isCreateMode ? t("create_item") : t("update_item")}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
