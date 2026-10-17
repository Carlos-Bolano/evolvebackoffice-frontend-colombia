import { api } from "@/config/axios-client"
import { appConfig } from "@/config/env"
import { useAppStore } from "@/store/app-store"
import type { AiChatResponse, AiChatStreamEvent, AiConversation, AiConversationDetail, SendChatPayload } from "../types"

const BASE = "/api/ai/chat"

export async function getConversations(): Promise<AiConversation[]> {
  const response = await api.get<AiConversation[]>(`${BASE}/conversations`)
  return response.data
}

export async function getConversation(id: string): Promise<AiConversationDetail> {
  const response = await api.get<AiConversationDetail>(`${BASE}/conversations/${id}`)
  return response.data
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`${BASE}/conversations/${id}`)
}

export interface ChatStreamHandlers {
  /** Fragmento incremental de texto del asistente. */
  onDelta: (text: string) => void
  /** Descarta lo previsualizado (el modelo recurrió a herramientas). */
  onReset: () => void
  /** Respuesta final autoritativa ya persistida en el servidor. */
  onDone: (result: AiChatResponse) => void
  /** Error ocurrido tras iniciar el stream. */
  onError: (message: string) => void
}

/**
 * Envía un mensaje por el endpoint SSE y va notificando los eventos conforme
 * llegan. Se usa `fetch` con ReadableStream (axios no soporta streaming en el
 * navegador) replicando las cabeceras del interceptor de axios.
 */
export async function streamChatMessage(
  payload: SendChatPayload,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const { accessToken, tenantId } = useAppStore.getState().session ?? {}

  const response = await fetch(`${appConfig.apiBaseUrl}${BASE}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(`No se pudo iniciar la conversación (HTTP ${response.status}).`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })

    let separator = buffer.indexOf("\n\n")
    while (separator >= 0) {
      const rawEvent = buffer.slice(0, separator)
      buffer = buffer.slice(separator + 2)
      handleRawEvent(rawEvent, handlers)
      separator = buffer.indexOf("\n\n")
    }

    if (done) break
  }

  // Resto sin separador final (por si el servidor no cerró con "\n\n").
  if (buffer.trim().length > 0) handleRawEvent(buffer, handlers)
}

function handleRawEvent(rawEvent: string, handlers: ChatStreamHandlers): void {
  const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"))
  if (!dataLine) return

  const data = dataLine.slice(5).trim()
  if (data.length === 0 || data === "[DONE]") return

  let event: AiChatStreamEvent
  try {
    event = JSON.parse(data) as AiChatStreamEvent
  } catch {
    return
  }

  switch (event.type) {
    case "delta":
      if (event.content) handlers.onDelta(event.content)
      break
    case "reset":
      handlers.onReset()
      break
    case "done":
      handlers.onDone({
        conversationId: event.conversationId ?? "",
        conversationTitle: event.conversationTitle ?? "",
        message: event.content ?? "",
        chart: event.chart ?? null,
      })
      break
    case "error":
      handlers.onError(event.message ?? "Ocurrió un error al generar la respuesta.")
      break
  }
}
