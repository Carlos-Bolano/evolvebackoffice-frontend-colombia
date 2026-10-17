/** Especificación de gráfica declarativa devuelta por el asistente (ChartSpecDto). */
export interface ChartSeries {
  name: string
  data: number[]
}

export interface ChartSpec {
  type: "line" | "bar" | "pie"
  title?: string | null
  labels: string[]
  series: ChartSeries[]
}

export interface AiConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface AiMessage {
  id: string
  role: "user" | "assistant"
  content: string
  chart: ChartSpec | null
  createdAt: string
}

export interface AiConversationDetail {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: AiMessage[]
}

export interface AiChatResponse {
  conversationId: string
  conversationTitle: string
  message: string
  chart: ChartSpec | null
}

export interface SendChatPayload {
  conversationId?: string | null
  message: string
  /** Solicita al backend regenerar la última respuesta del asistente. */
  regenerate?: boolean
}

/** Evento emitido por el endpoint SSE (POST /api/ai/chat/stream). */
export interface AiChatStreamEvent {
  type: "delta" | "reset" | "done" | "error"
  /** Fragmento incremental (type = "delta") o contenido final (type = "done"). */
  content?: string | null
  /** Mensaje de error legible (type = "error"). */
  message?: string | null
  conversationId?: string | null
  conversationTitle?: string | null
  chart?: ChartSpec | null
}
