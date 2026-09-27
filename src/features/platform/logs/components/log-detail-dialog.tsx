import { useMemo } from "react"
import { Copy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLogDetail } from "../hooks/use-logs"
import { LEVEL_LABEL_KEY, LEVEL_TONE } from "../constants"
import { notify } from "@/hooks/use-notify"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/utils/format"
import { useTranslation } from "@/i18n/use-i18n"

interface LogDetailDialogProps {
  /** Id del evento a mostrar; null = cerrado. */
  eventId: number | null
  onOpenChange: (open: boolean) => void
}

export function LogDetailDialog({ eventId, onOpenChange }: LogDetailDialogProps) {
  const { t } = useTranslation("platform-logs")
  const { data, isLoading } = useLogDetail(eventId)

  const properties = useMemo(() => {
    if (!data?.propertiesJson) return null
    try {
      return JSON.stringify(JSON.parse(data.propertiesJson), null, 2)
    } catch {
      return data.propertiesJson
    }
  }, [data?.propertiesJson])

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => notify.success(t("copied")))
  }

  return (
    <Dialog open={eventId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            {data ? <Badge tone={LEVEL_TONE[data.level] ?? "neutral"}>{t(LEVEL_LABEL_KEY[data.level])}</Badge> : null}
            <span className="truncate">{t("detail_title")}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">{t("detail_title")}</DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("loading")}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <Meta label={t("date")} value={formatDateTime(data.timestampUtc)} />
              <Meta label={t("duration")} value={data.elapsedMs != null ? `${Math.round(data.elapsedMs)} ms` : "—"} />
              <Meta label={t("tenant_col")} value={data.tenantId ?? t("no_tenant")} />
              <Meta
                label={t("path")}
                value={
                  data.requestPath ? `${data.requestMethod ? `${data.requestMethod} ` : ""}${data.requestPath}` : "—"
                }
              />
              <Meta label={t("status_code")} value={data.statusCode != null ? String(data.statusCode) : "—"} />
              <Meta label={t("source")} value={data.source ?? "—"} />
              <Meta label={t("service")} value={`${data.serviceName} · ${data.environment} · v${data.version}`} />
              <Meta
                label={t("trace_id")}
                value={data.traceId ?? "—"}
                copyValue={data.traceId ?? undefined}
                onCopy={copy}
              />
            </div>

            <Section title={t("full_message")} text={data.message} copyValue={data.message} onCopy={copy} />

            {data.messageTemplate && data.messageTemplate !== data.message ? (
              <Section title={t("message_template")} text={data.messageTemplate} />
            ) : null}

            <Section
              title={t("exception")}
              text={data.exception}
              empty={t("no_exception")}
              danger
              copyValue={data.exception ?? undefined}
              onCopy={copy}
            />

            <Section
              title={t("properties")}
              text={properties}
              empty={t("no_properties")}
              copyValue={properties ?? undefined}
              onCopy={copy}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Meta({
  label,
  value,
  copyValue,
  onCopy,
}: {
  label: string
  value: string
  copyValue?: string
  onCopy?: (text: string) => void
}) {
  const { t } = useTranslation("platform-logs")
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="mt-0.5 flex items-start gap-1">
        <span className="min-w-0 [overflow-wrap:anywhere] text-foreground">{value}</span>
        {copyValue && onCopy ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5 shrink-0"
            aria-label={`${t("copy")} ${label}`}
            onClick={() => onCopy(copyValue)}
          >
            <Copy className="size-3" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function Section({
  title,
  text,
  empty,
  danger,
  copyValue,
  onCopy,
}: {
  title: string
  text: string | null
  empty?: string
  danger?: boolean
  copyValue?: string
  onCopy?: (text: string) => void
}) {
  const { t } = useTranslation("platform-logs")

  if (!text) {
    return empty ? (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
        <p className="rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground">{empty}</p>
      </div>
    ) : null
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
        {copyValue && onCopy ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`${t("copy")} ${title}`}
            onClick={() => onCopy(copyValue)}
          >
            <Copy className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <pre
        className={cn(
          "max-h-48 overflow-auto rounded-xl border border-border/70 bg-muted/40 p-3 text-xs [overflow-wrap:anywhere] whitespace-pre-wrap",
          danger && "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        )}
      >
        {text}
      </pre>
    </div>
  )
}
