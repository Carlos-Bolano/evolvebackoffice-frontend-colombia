import { useCallback, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { notify } from "@/hooks/use-notify"
import { getApiErrorMessage } from "@/utils/api-error"
import { deleteConversation, getConversation, getConversations, streamChatMessage } from "../services/ai-chat.service"
import type { AiChatResponse, SendChatPayload } from "../types"

export const aiChatKeys = {
  all: ["ai-chat"] as const,
  conversations: () => ["ai-chat", "conversations"] as const,
  conversation: (id: string) => ["ai-chat", "conversation", id] as const,
}

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: aiChatKeys.conversations(),
    queryFn: getConversations,
    enabled,
    staleTime: 30_000,
  })
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: aiChatKeys.conversation(id ?? ""),
    queryFn: () => getConversation(id as string),
    enabled: id !== null,
    staleTime: 15_000,
  })
}

interface SendStreamOptions {
  /** Se invoca cuando la respuesta terminó y ya está persistida en el servidor. */
  onReady?: (result: AiChatResponse) => void
  /** Mensaje mostrado si la petición falla antes de recibir eventos. */
  errorMessage: string
}

/**
 * Envía mensajes al asistente en modo streaming (SSE) manteniendo el texto
 * parcial en `draft` para renderizarlo en vivo. Al terminar refresca el
 * historial y la conversación para mostrar la versión persistida.
 */
export function useChatStream() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setDraft(null)
  }, [])

  const send = useCallback(
    async (payload: SendChatPayload, options: SendStreamOptions): Promise<void> => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setDraft("")

      // Se usa un objeto mutable porque TS no rastrea asignaciones hechas
      // dentro de callbacks sobre variables `let`.
      const outcome: { result: AiChatResponse | null } = { result: null }

      try {
        await streamChatMessage(
          payload,
          {
            onDelta: (text) => setDraft((prev) => (prev ?? "") + text),
            onReset: () => setDraft(""),
            onDone: (result) => {
              outcome.result = result
            },
            onError: (message) => notify.error(message),
          },
          controller.signal
        )
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          notify.error(getApiErrorMessage(error, options.errorMessage))
        }
      } finally {
        abortRef.current = null
      }

      const result = outcome.result
      const newConversationId =
        result?.conversationId && result.conversationId !== payload.conversationId ? result.conversationId : null

      // El detalle de una conversación nueva se precarga antes de activarla para
      // que el panel no muestre un spinner al reemplazar la previsualización.
      if (result && newConversationId) {
        await qc.fetchQuery({
          queryKey: aiChatKeys.conversation(newConversationId),
          queryFn: () => getConversation(newConversationId),
          staleTime: 15_000,
        })
        options.onReady?.(result)
      } else {
        const conversationId = result?.conversationId ?? payload.conversationId
        if (conversationId) {
          await qc.invalidateQueries({ queryKey: aiChatKeys.conversation(conversationId) })
        }
        if (result) options.onReady?.(result)
      }

      // La previsualización se oculta en el mismo tick en que el historial ya
      // está actualizado (evita ver la respuesta duplicada por un instante).
      setDraft(null)
      void qc.invalidateQueries({ queryKey: aiChatKeys.conversations() })
    },
    [qc]
  )

  return { draft, send, cancel, isStreaming: draft !== null }
}

export function useDeleteConversation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: aiChatKeys.all })
    },
  })
}
