import { Link } from "react-router-dom"
import { CheckCircle2, ChevronRight, Circle, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/i18n/use-i18n"
import { cn } from "@/lib/utils"
import type { DeliverySetupStep } from "../hooks/use-delivery-setup"

interface Props {
  steps: DeliverySetupStep[]
  completed: number
  /** Versión compacta: una franja con el progreso y un enlace a la configuración. */
  compact?: boolean
  onNavigateAnchor?: (anchor: string) => void
}

/**
 * Lista de pasos para dejar los domicilios listos en una sucursal, con el
 * estado de cada uno y un acceso directo para resolverlo.
 */
export function DeliverySetupChecklist({ steps, completed, compact = false, onNavigateAnchor }: Props) {
  const { t } = useTranslation("business-orders")
  const total = steps.length
  const pending = steps.filter((s) => !s.done && !s.optional)

  if (compact) {
    if (pending.length === 0) return null
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <span>
          {t("setup_banner", { done: completed, total })}{" "}
          <strong>{pending.map((s) => t(`setup_step_${s.key}`)).join(" · ")}</strong>
        </span>
        <Button asChild size="sm" variant="outline">
          <Link to="/business/orders/setup">
            <Settings2 className="mr-1.5 size-4" />
            {t("setup_open")}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("setup_checklist_title")}</CardTitle>
        <CardDescription>{t("setup_progress", { done: completed, total })}</CardDescription>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
        >
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(completed / Math.max(total, 1)) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => {
          const Icon = step.done ? CheckCircle2 : Circle
          const content = (
            <>
              <Icon className={cn("size-5 shrink-0", step.done ? "text-emerald-600" : "text-muted-foreground")} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {t(`setup_step_${step.key}`)}
                  {step.optional && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{t("setup_optional")}</span>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(step.done ? `setup_step_${step.key}_done` : `setup_step_${step.key}_hint`)}
                </span>
              </span>
              {!step.done && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
            </>
          )
          const className = cn(
            "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
            step.done ? "border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-500/5" : "hover:bg-accent/60"
          )
          if (step.done) {
            return (
              <div key={step.key} className={className}>
                {content}
              </div>
            )
          }
          return step.to.startsWith("#") ? (
            <button key={step.key} type="button" className={className} onClick={() => onNavigateAnchor?.(step.to)}>
              {content}
            </button>
          ) : (
            <Link key={step.key} to={step.to} className={className}>
              {content}
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
