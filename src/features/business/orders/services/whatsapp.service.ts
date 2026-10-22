import { api } from "@/config/axios-client"

export type WhatsAppChannelStatus =
  | "Disconnected"
  | "Provisioning"
  | "WaitingForQr"
  | "Connecting"
  | "Connected"
  | "Error"

export type WhatsAppEventCode =
  | "OrderConfirmed"
  | "OrderReady"
  | "OrderShipped"
  | "OrderDelivered"
  | "OrderCancelled"
  | "CourierAssigned"
  | "CourierReassigned"

export type WhatsAppRecipientType = "Customer" | "Courier"

export type WhatsAppMessageStatus =
  | "Queued"
  | "Sending"
  | "Accepted"
  | "Delivered"
  | "Read"
  | "Failed"
  | "Suppressed"
  | "UnknownOutcome"

export interface WhatsAppTemplateConfig {
  eventCode: WhatsAppEventCode
  recipientType: WhatsAppRecipientType
  templateText: string
  isActive: boolean
}

export interface BranchWhatsAppChannel {
  id: string | null
  branchId: string
  enabled: boolean
  status: WhatsAppChannelStatus
  maskedPhone: string | null
  sessionGeneration: number
  lastEvidenceAtUtc: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  automaticEvents: WhatsAppEventCode[]
  notifyExternalPlatformOrders: boolean
  templates: WhatsAppTemplateConfig[]
}

interface WhatsAppTemplateResponse {
  templateCode: WhatsAppEventCode
  recipientType: WhatsAppRecipientType
  bodyTemplate: string
}

type BranchWhatsAppChannelResponse = Omit<BranchWhatsAppChannel, "templates"> & {
  templates: WhatsAppTemplateResponse[]
}

function mapChannel(raw: BranchWhatsAppChannelResponse): BranchWhatsAppChannel {
  return {
    ...raw,
    templates: raw.templates.map((template) => ({
      eventCode: template.templateCode,
      recipientType: template.recipientType,
      templateText: template.bodyTemplate,
      isActive: true,
    })),
  }
}

export interface UpdateBranchWhatsAppChannelDto {
  enabled: boolean
  automaticEvents: WhatsAppEventCode[]
  notifyExternalPlatformOrders: boolean
  templates: WhatsAppTemplateConfig[]
}

export interface BranchWhatsAppQr {
  channelId: string
  qrCodeBase64: string | null
  pairingCode: string | null
  expiresAtUtc: string
  sessionGeneration: number
}

export interface WhatsAppContactPermission {
  orderId: string
  recipientType: WhatsAppRecipientType
  allowed: boolean
  source: string
  updatedAtUtc?: string | null
}

export interface OrderWhatsAppPreview {
  orderId: string
  recipientType: WhatsAppRecipientType
  templateCode: WhatsAppEventCode
  recipientName: string | null
  maskedPhone: string | null
  renderedText: string
  eligible: boolean
  ineligibleReason: string | null
  contactPermissionAllowed: boolean
  channelStatus: WhatsAppChannelStatus
  previewVersion: string
}

export interface OrderWhatsAppMessage {
  id: string
  orderId: string
  recipientType: WhatsAppRecipientType
  recipientName: string | null
  maskedPhone: string | null
  templateCode: WhatsAppEventCode
  renderedText: string
  status: WhatsAppMessageStatus
  isAutomatic: boolean
  attemptCount: number
  lastErrorCode: string | null
  lastErrorMessage: string | null
  createdAtUtc: string
  acceptedAtUtc: string | null
  deliveredAtUtc: string | null
  readAtUtc: string | null
  canRetry: boolean
  canResendUnknownOutcome: boolean
}

export const WHATSAPP_EVENTS: readonly WhatsAppEventCode[] = [
  "OrderConfirmed",
  "OrderReady",
  "OrderShipped",
  "OrderDelivered",
  "OrderCancelled",
  "CourierAssigned",
  "CourierReassigned",
] as const

export const WHATSAPP_VARIABLES = [
  "{{customerName}}",
  "{{orderNumber}}",
  "{{branchName}}",
  "{{total}}",
  "{{status}}",
  "{{courierName}}",
] as const

function makeIdempotencyHeader(idempotencyKey?: string): Record<string, string> {
  return {
    "Idempotency-Key": idempotencyKey || crypto.randomUUID(),
  }
}

export async function getBranchWhatsAppChannel(branchId: string): Promise<BranchWhatsAppChannel> {
  const { data } = await api.get<BranchWhatsAppChannelResponse>(`/api/branches/${branchId}/whatsapp`)
  return mapChannel(data)
}

export interface WhatsAppConnectionVerification {
  connected: boolean
  providerState: string
  checkedAtUtc: string
  maskedPhone: string | null
}

export async function verifyBranchWhatsAppConnection(branchId: string): Promise<WhatsAppConnectionVerification> {
  return (await api.get<WhatsAppConnectionVerification>(`/api/branches/${branchId}/whatsapp/connection`)).data
}

export async function updateBranchWhatsAppChannel(
  branchId: string,
  payload: UpdateBranchWhatsAppChannelDto
): Promise<BranchWhatsAppChannel> {
  const { data } = await api.put<BranchWhatsAppChannelResponse>(`/api/branches/${branchId}/whatsapp`, {
    ...payload,
    templates: payload.templates.map((template) => ({
      templateCode: template.eventCode,
      recipientType: template.recipientType,
      bodyTemplate: template.templateText,
    })),
  })
  return mapChannel(data)
}

export async function connectBranchWhatsAppChannel(
  branchId: string,
  idempotencyKey?: string
): Promise<BranchWhatsAppChannel> {
  const { data } = await api.post<BranchWhatsAppChannelResponse>(
    `/api/branches/${branchId}/whatsapp/connect`,
    {},
    { headers: makeIdempotencyHeader(idempotencyKey) }
  )
  return mapChannel(data)
}

export async function getBranchWhatsAppQr(branchId: string): Promise<BranchWhatsAppQr | null> {
  const response = await api.get<BranchWhatsAppQr>(`/api/branches/${branchId}/whatsapp/qr`)
  if (response.status === 204 || !response.data) {
    return null
  }
  return response.data
}

export async function disconnectBranchWhatsAppChannel(branchId: string): Promise<BranchWhatsAppChannel> {
  const { data } = await api.post<BranchWhatsAppChannelResponse>(`/api/branches/${branchId}/whatsapp/disconnect`, {})
  return mapChannel(data)
}

export async function updateOrderWhatsAppContactPermission(
  orderId: string,
  payload: { recipientType: WhatsAppRecipientType; allowed: boolean; source: string }
): Promise<WhatsAppContactPermission> {
  const { data } = await api.put<WhatsAppContactPermission>(
    `/api/orders/${orderId}/whatsapp/contact-permission`,
    payload
  )
  return data
}

export async function previewOrderWhatsAppNotification(
  orderId: string,
  payload: { recipientType: WhatsAppRecipientType; templateCode: WhatsAppEventCode }
): Promise<OrderWhatsAppPreview> {
  const { data } = await api.post<OrderWhatsAppPreview>(`/api/orders/${orderId}/whatsapp/preview`, payload)
  return data
}

export async function sendOrderWhatsAppNotification(
  orderId: string,
  payload: { recipientType: WhatsAppRecipientType; templateCode: WhatsAppEventCode; previewVersion: string },
  idempotencyKey?: string
): Promise<OrderWhatsAppMessage> {
  const { data } = await api.post<OrderWhatsAppMessage>(`/api/orders/${orderId}/whatsapp/notifications`, payload, {
    headers: makeIdempotencyHeader(idempotencyKey),
  })
  return data
}

export async function getOrderWhatsAppMessages(
  orderId: string,
  pageNumber = 1,
  pageSize = 20
): Promise<{ data: OrderWhatsAppMessage[]; totalCount: number }> {
  const { data } = await api.get<{ data?: OrderWhatsAppMessage[]; totalCount?: number }>(
    `/api/orders/${orderId}/whatsapp/messages`,
    { params: { pageNumber, pageSize } }
  )
  const list = Array.isArray(data?.data) ? data.data : []
  const totalCount = typeof data?.totalCount === "number" ? data.totalCount : list.length
  return { data: list, totalCount }
}

export async function retryOrderWhatsAppMessage(
  orderId: string,
  messageId: string,
  idempotencyKey?: string
): Promise<OrderWhatsAppMessage> {
  const { data } = await api.post<OrderWhatsAppMessage>(
    `/api/orders/${orderId}/whatsapp/messages/${messageId}/retry`,
    {},
    { headers: makeIdempotencyHeader(idempotencyKey) }
  )
  return data
}

export async function resendOrderWhatsAppMessage(
  orderId: string,
  messageId: string,
  payload: { acknowledgeDuplicateRisk: boolean; reason: string },
  idempotencyKey?: string
): Promise<OrderWhatsAppMessage> {
  const { data } = await api.post<OrderWhatsAppMessage>(
    `/api/orders/${orderId}/whatsapp/messages/${messageId}/resend`,
    payload,
    { headers: makeIdempotencyHeader(idempotencyKey) }
  )
  return data
}
