import { useCallback, useState } from "react"
import { Check, Copy, Loader2, RotateCcw, Sparkles, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/ui/markdown"
import { useTranslation } from "@/i18n/use-i18n"
import { ChatChartBlock } from "./chat-chart-block"
import type { ChartSpec } from "../types"

export interface ChatMessageView {
  id: string
  role: "user" | "assistant"
  content: string
  chart: ChartSpec | null
}

interface ChatMessageProps {
  message: ChatMessageView
  /** Iniciales del usuario para el avatar (vacío = icono genérico). */
  userInitials?: string
  /** Si se entrega, se muestra el botón para regenerar esta respuesta. */
  onRegenerate?: () => void
  /** Deshabilita las acciones mientras hay una respuesta en curso. */
  busy?: boolean
}

// Estilo común del markdown del asistente: prosa compacta y tablas legibles.
const ASSISTANT_MARKDOWN_CLASS = cn(
  "prose prose-sm max-w-none text-sm dark:prose-invert",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_table]:my-2 [&_table]:w-full [&_table]:text-xs",
  "[&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:align-bottom [&_th]:font-semibold",
  "[&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_tr]:border-border/60",
  "[&_li]:my-0.5 [&_ol]:my-1.5 [&_p]:my-1.5 [&_ul]:my-1.5"
)

const AVATAR_BASE = "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"

function AssistantAvatar() {
  return (
    <div className={cn(AVATAR_BASE, "bg-primary/10 text-primary")} aria-hidden>
      <Sparkles className="size-3.5" />
    </div>
  )
}

function UserAvatar({ initials }: { initials?: string }) {
  return (
    <div className={cn(AVATAR_BASE, "bg-primary text-primary-foreground")} aria-hidden>
      {initials ? initials : <User className="size-3.5" />}
    </div>
  )
}

export function ChatMessage({ message, userInitials, onRegenerate, busy }: ChatMessageProps) {
  const { t } = useTranslation("business-ai-chat")
  const isUser = message.role === "user"

  return (
    <div className={cn("flex w-full gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {isUser ? <UserAvatar initials={userInitials} /> : <AssistantAvatar />}

      <div className={cn("flex min-w-0 flex-1 flex-col", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
            isUser ? "bg-primary text-primary-foreground" : "border border-border/70 bg-muted/40 text-foreground"
          )}
        >
          {!isUser ? (
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
              <Sparkles className="size-3" />
              {t("assistant")}
            </div>
          ) : null}

          {isUser ? (
            <p className="text-sm wrap-anywhere whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Markdown id={message.id} className={ASSISTANT_MARKDOWN_CLASS}>
              {message.content}
            </Markdown>
          )}

          {message.chart ? (
            <div className="mt-2.5">
              <ChatChartBlock chart={message.chart} />
            </div>
          ) : null}
        </div>

        {!isUser ? <MessageActions content={message.content} onRegenerate={onRegenerate} busy={busy} /> : null}
      </div>
    </div>
  )
}

interface MessageActionsProps {
  content: string
  onRegenerate?: () => void
  busy?: boolean
}

/** Acciones rápidas bajo una respuesta del asistente (copiar / regenerar). */
function MessageActions({ content, onRegenerate, busy }: MessageActionsProps) {
  const { t } = useTranslation("business-ai-chat")
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // El portapapeles puede estar bloqueado por el navegador; se ignora.
    }
  }, [content])

  return (
    <div className="mt-1 flex items-center gap-0.5 pl-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        aria-label={copied ? t("copied") : t("copy")}
        title={copied ? t("copied") : t("copy")}
      >
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      </Button>

      {onRegenerate ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={onRegenerate}
          disabled={busy}
          aria-label={t("regenerate")}
          title={t("regenerate")}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}

/** Indicador de escritura mostrado mientras el backend prepara la respuesta. */
export function ChatWritingIndicator() {
  const { t } = useTranslation("business-ai-chat")

  return (
    <div className="flex w-full gap-2">
      <AssistantAvatar />
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <div className="max-w-[92%] rounded-2xl border border-border/70 bg-muted/40 px-3.5 py-2.5 text-sm shadow-sm">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <Sparkles className="size-3" />
            {t("assistant")}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            {t("thinking")}
          </div>
        </div>
      </div>
    </div>
  )
}
