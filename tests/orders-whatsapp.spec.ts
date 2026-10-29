import { test, expect, request, type APIRequestContext, type APIResponse, type Page } from "@playwright/test"
import { createHmac, randomUUID } from "node:crypto"

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:5285"
test.describe.configure({ mode: "serial", timeout: 90_000 })
test.skip(!process.env.E2E_BACKEND_DIR || !process.env.E2E_JWT_SECRET, "Configure the isolated local backend.")

let platform: APIRequestContext
let api: APIRequestContext
let tenant: { id: string; tenantId: string; name: string; contactEmail: string; adminTemporaryPassword: string }
let branch: { id: string }
let item: { id: string }
let token: string
let pendingId: string
let wasteId: string
const suffix = randomUUID().slice(0, 8)
const tenantName = `Playwright UX ${suffix}`
const proofPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII="

async function workflowOrder(name: string, status = "Pending", delivery = false) {
  return json<{ id: string }>(
    await api.post("/api/orders", {
      data: {
        branchId: branch.id,
        status,
        customerName: name,
        customerPhone: "+573000000001",
        paymentMethod: "CASH",
        shippingStreet: delivery ? "Calle QA 1" : null,
        shippingCity: delivery ? "Bogotá" : null,
        items: [{ itemPublicId: item.id, quantity: 1 }],
      },
    })
  )
}

async function dragWorkflowOrder(page: Page, id: string, targetStatus: string, valid = true) {
  const handle = page.locator(`[data-rfd-draggable-id="${id}"]`).getByRole("button", { name: /^Arrastrar pedido/ })
  await handle.scrollIntoViewIfNeeded()
  const target = page.locator(`[data-rfd-droppable-id="${targetStatus}"]`)
  const from = (await handle.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 3 })
  await expect(page.locator('body > [data-order-dragging="true"]')).toBeVisible()
  await page.mouse.move(to.x + Math.min(to.width / 2, 120), Math.min(to.y + 270, page.viewportSize()!.height - 40), {
    steps: 20,
  })
  if (valid) await expect(target).toHaveAttribute("data-drag-over", "true")
  await page.mouse.up()
  await expect(page.locator('body > [data-order-dragging="true"]')).toHaveCount(0)
}

async function createScopedCourier(name: string) {
  return json<{ id: string }>(
    await api.post("/api/users", {
      data: {
        firstName: name,
        lastName: "QA",
        identificationTypeId: 1,
        identificationNumber: `93${Date.now()}`,
        email: `courier-${randomUUID()}@example.test`,
        role: "DELIVERY",
        phoneNumber: "3002223344",
        deliveryBranchId: branch.id,
      },
    })
  )
}

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15_000)
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ contentType: "image/png", body: Buffer.from(proofPng, "base64") })
  )
})

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), `${response.status()} ${response.url()} ${await response.text()}`).toBeTruthy()
  return response.json() as Promise<T>
}

async function session(page: Page) {
  await page.addInitScript(
    ({ tenantId, accessToken, branchId }) => {
      localStorage.setItem("business.orders.branchId", branchId)
      localStorage.setItem(
        "pos-manager-storage",
        JSON.stringify({
          state: {
            session: {
              accessToken,
              refreshToken: null,
              expiresAtUtc: new Date(Date.now() + 3600000).toISOString(),
              user: { id: "qa", email: "qa@example.test", fullName: "QA", role: "BusinessAdmin" },
              tenantId,
              forcePasswordChange: false,
            },
            theme: "light",
            locale: "es",
            onboardingCompleted: { [tenantId]: true },
            onboardingDrafts: {},
          },
          version: 0,
        })
      )
    },
    { tenantId: tenant.tenantId, accessToken: token, branchId: branch.id }
  )
}

test.beforeAll(async () => {
  test.setTimeout(120_000)
  expect(["localhost", "127.0.0.1"]).toContain(new URL(apiUrl).hostname)
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ iss: "posco.local", aud: "posco.clients", sub: randomUUID(), role: "ADMIN", tid: "11111111-1111-1111-1111-111111111111", exp: Math.floor(Date.now() / 1000) + 3600 })}`
  const adminToken = `${unsigned}.${createHmac("sha256", process.env.E2E_JWT_SECRET!).update(unsigned).digest("base64url")}`
  platform = await request.newContext({ baseURL: apiUrl, extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` } })
  tenant = await json(
    await platform.post("/api/tenants", {
      data: {
        name: tenantName,
        contactEmail: `ux-${suffix}@example.test`,
        adminIdentification: `98${Date.now()}`,
        maxRegisters: 3,
        countryCode: "CO",
        timeZoneId: "America/Bogota",
      },
    })
  )
  const login = await json<{ token: string }>(
    await platform.post("/api/auth/login/admin", {
      headers: { "X-Tenant-Id": tenant.tenantId },
      data: { email: tenant.contactEmail, password: tenant.adminTemporaryPassword },
    })
  )
  token = login.token
  api = await request.newContext({
    baseURL: apiUrl,
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, "X-Tenant-Id": tenant.tenantId },
  })
  const modules = await json<{ id: string; moduleId: string; moduleCode: string }[]>(
    await api.get("/api/tenant-modules")
  )
  for (const module of modules.filter((m) => ["ORDERS", "DOMICILIOS"].includes(m.moduleCode)))
    expect(
      (await api.put(`/api/tenant-modules/${module.moduleId}`, { data: { isEnabled: true, quantity: 5 } })).ok()
    ).toBe(true)
  branch = await json(
    await api.post("/api/branches", { data: { name: `Sucursal UX ${suffix}`, timeZoneId: "America/Bogota" } })
  )
  for (const module of modules.filter((m) => ["ORDERS", "DOMICILIOS"].includes(m.moduleCode)))
    expect(
      (await api.post(`/api/branches/${branch.id}/modules`, { data: { tenantModulePublicId: module.id } })).ok()
    ).toBe(true)
  item = await json(await api.post("/api/items", { data: { name: "Producto UX", sku: `UX-${suffix}` } }))
  await json(
    await api.post(`/api/branches/${branch.id}/items`, {
      data: { branchPublicId: branch.id, itemPublicId: item.id, price: 10000, cost: 2500, quantity: 100 },
    })
  )
  const create = async (name: string) =>
    json<{ id: string }>(
      await api.post("/api/orders", {
        data: {
          branchId: branch.id,
          status: "Pending",
          customerName: name,
          customerPhone: "+573000000001",
          paymentMethod: "EFFECTIVO",
          items: [{ itemPublicId: item.id, quantity: 1 }],
        },
      })
    )
  pendingId = (await create(`Cliente búsqueda ${suffix}`)).id
  wasteId = (await create(`Cliente merma ${suffix}`)).id
})

test.afterAll(async () => {
  if (tenant?.id && platform) {
    const owned = await json<{ id: string; name: string }>(await platform.get(`/api/tenants/${tenant.id}`))
    expect(owned.name).toBe(tenantName.toUpperCase())
    expect(owned.id).toBe(tenant.id)
    if (process.env.E2E_EVOLUTION_URL && process.env.E2E_EVOLUTION_KEY && branch?.id) {
      const evolution = await request.newContext({
        baseURL: process.env.E2E_EVOLUTION_URL,
        extraHTTPHeaders: { apikey: process.env.E2E_EVOLUTION_KEY },
      })
      const instance =
        `posco-${tenant.id.replaceAll("-", "")}`.slice(0, 18) + `-${branch.id.replaceAll("-", "")}`.slice(0, 13)
      const removed = await evolution.delete(`/instance/delete/${instance}`)
      expect([200, 404]).toContain(removed.status())
      await evolution.dispose()
    }
    expect((await platform.delete(`/api/tenants/${tenant.id}`)).ok()).toBe(true)
  }
  await api?.dispose()
  await platform?.dispose()
})

test("Filtros: busca cliente y combina servicio/pago en Kanban", async ({ page }) => {
  await session(page)
  await page.goto("/business/orders")
  await page.getByRole("searchbox").fill(`Cliente búsqueda ${suffix}`)
  await expect(page.locator(`[data-rfd-draggable-id="${pendingId}"]`)).toBeVisible()
  await expect(page.locator(`[data-rfd-draggable-id="${wasteId}"]`)).toHaveCount(0)
  const fulfillment = page.getByRole("combobox").filter({ has: page.locator('option[value="pickup"]') })
  await fulfillment.selectOption("pickup")
  await expect(page.locator(`[data-rfd-draggable-id="${pendingId}"]`)).toBeVisible()
  const payment = page.getByRole("combobox").filter({ has: page.locator('option[value="paid"]') })
  await payment.selectOption("paid")
  await expect(page.locator(`[data-rfd-draggable-id="${pendingId}"]`)).toHaveCount(0)
  await payment.selectOption("pending")
  await expect(page.locator(`[data-rfd-draggable-id="${pendingId}"]`)).toBeVisible()
  await expect(page.getByRole("button", { name: "Tabla compacta", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Limpiar filtros", exact: true }).click()
  await expect(page.locator(`[data-rfd-draggable-id="${wasteId}"]`)).toBeVisible()
})

test("Acción rápida: confirma, prepara y deja listo sin arrastrar", async ({ page }) => {
  await session(page)
  await page.goto("/business/orders")
  const card = page.locator(`[data-rfd-draggable-id="${pendingId}"]`)
  for (const label of ["Confirmar →", "Preparar →", "Listo →"]) {
    await card.getByRole("button", { name: label, exact: true }).click()
  }
  await expect
    .poll(async () => (await json<{ statusCode: string }>(await api.get(`/api/orders/${pendingId}`))).statusCode)
    .toBe("Ready")
})

for (const width of [1440, 390]) {
  test(`Kanban ${width}px: crear pedido visible con sucursal y en vista global`, async ({ page }) => {
    await session(page)
    await page.addInitScript(
      ({ tenantId }) => {
        const legacyView = {
          platformFilter: "all",
          orderScope: "active",
          viewMode: "table",
          datePreset: "all",
          fulfillmentFilter: "",
          courierFilter: "",
          paymentFilter: "",
          syncAlertFilter: "",
          quickView: "",
        }
        localStorage.setItem(`order-view:${tenantId}:qa:all`, JSON.stringify(legacyView))
        localStorage.setItem(
          `order-saved-views:${tenantId}:qa:all`,
          JSON.stringify([
            {
              id: "00000000-0000-4000-8000-000000000001",
              name: "Vista anterior",
              view: legacyView,
            },
          ])
        )
      },
      { tenantId: tenant.tenantId }
    )
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/business/orders")
    const create = page.getByRole("button", { name: "Crear Orden", exact: true })
    await expect(create).toBeEnabled()
    await expect(create).toBeInViewport()
    await expect(page.getByRole("button", { name: "Tabla compacta", exact: true })).toHaveCount(0)
    await expect(page.getByRole("table")).toHaveCount(0)
    await expect(page.locator(`[data-rfd-draggable-id="${pendingId}"]`)).toBeVisible()
    await expect(page.getByText(/Mis vistas guardadas/)).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Guardar vista actual", exact: true })).toHaveCount(0)
    await expect(page.getByRole("table")).toHaveCount(0)
    await expect(page.locator(`[data-rfd-draggable-id="${pendingId}"]`)).toBeVisible()
    await create.click()
    await expect(page.getByRole("dialog").getByRole("radio", { name: "Para recoger", exact: true })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    if (width < 640)
      await page.getByRole("combobox", { name: "Sucursal consultada", exact: true }).selectOption("__ALL__")
    else await page.getByRole("button", { name: /Todas las sucursales|Global/ }).click()
    await expect(create).toBeEnabled()
    await create.click()
    const chooser = page.getByRole("dialog")
    await expect(chooser).toContainText("Selecciona la sucursal donde quieres crear el pedido.")
    await chooser.getByRole("combobox", { name: "Sucursal consultada", exact: true }).selectOption(branch.id)
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("radio", { name: "Para recoger", exact: true })).toBeVisible()
    await expect(dialog.getByLabel("Productos", { exact: true })).toBeVisible()
  })
}

test("WhatsApp: bloquea ambas conexiones hasta guardar el canal y sus cambios", async ({ page }) => {
  const initial = await api.get(`/api/branches/${branch.id}/whatsapp`)
  expect(initial.status()).toBe(204)
  expect(await initial.text()).toBe("")
  expect((await api.get(`/api/branches/${randomUUID()}/whatsapp`)).status()).toBe(404)
  let channelReads = 0
  page.on("request", (req) => {
    if (req.method() === "GET" && req.url().endsWith(`/api/branches/${branch.id}/whatsapp`)) channelReads++
  })
  await session(page)
  await page.goto(`/business/branches/${branch.id}/config#whatsapp`)
  const card = page.locator("#whatsapp")
  const connect = card.getByRole("button", { name: "Conectar / Generar QR", exact: true })
  const link = card.getByRole("button", { name: "Vincular número", exact: true })
  await expect(connect).toBeVisible()
  await expect(connect).toBeDisabled()
  await expect(link).toBeDisabled()
  await expect(card.getByText(/Esta sucursal aún no tiene un canal WhatsApp/)).toBeVisible()
  const initialReads = channelReads
  await page.waitForTimeout(6500) // An unconfigured channel must not trigger the six-second polling loop.
  expect(channelReads).toBe(initialReads)
  await card.getByRole("switch", { name: "Habilitar notificaciones WhatsApp en esta sucursal", exact: true }).check()
  await expect(connect).toBeDisabled()
  const save = card.getByRole("button", { name: "Guardar configuración WhatsApp", exact: true })
  const saved = page.waitForResponse(
    (r) => r.url().endsWith(`/api/branches/${branch.id}/whatsapp`) && r.request().method() === "PUT"
  )
  await save.click()
  expect((await saved).status()).toBe(202)
  await expect(connect).toBeEnabled()
  await expect(link).toBeEnabled()
  await card.getByRole("textbox", { name: "Plantillas de mensajes", exact: true }).fill("Borrador sin guardar")
  await expect(connect).toBeDisabled()
  await expect(link).toBeDisabled()
  await page.reload()
  await expect(connect).toBeDisabled()
  await expect(link).toBeDisabled()
  page.once("dialog", (dialog) => dialog.accept())
  await card.getByRole("button", { name: "Descartar borrador", exact: true }).click()
  await expect(connect).toBeEnabled()
  await expect(link).toBeEnabled()
  await card.getByRole("switch", { name: "Habilitar notificaciones WhatsApp en esta sucursal", exact: true }).uncheck()
  const paused = page.waitForResponse(
    (r) => r.url().endsWith(`/api/branches/${branch.id}/whatsapp`) && r.request().method() === "PUT"
  )
  await save.click()
  expect((await paused).status()).toBe(202)
})

test("WhatsApp: guarda plantillas desde navegador y conserva texto al recargar", async ({ page }) => {
  await session(page)
  await page.goto(`/business/branches/${branch.id}/config`)
  await expect(page.getByText("Canal WhatsApp (Evolution API)", { exact: true })).toBeVisible()
  const template = page.getByRole("textbox", { name: "Plantillas de mensajes", exact: true })
  await template.fill("Hola {{customerName}}, pedido {{orderNumber}} de prueba local.")
  const saved = page.waitForResponse(
    (r) => r.url().endsWith(`/api/branches/${branch.id}/whatsapp`) && r.request().method() === "PUT"
  )
  await page.getByRole("button", { name: "Guardar configuración WhatsApp", exact: true }).click()
  expect((await saved).status()).toBe(202)
  await page.reload()
  await expect(template).toHaveValue("Hola {{customerName}}, pedido {{orderNumber}} de prueba local.")
})

test("WhatsApp: exige preview y bloquea envío del canal pausado", async ({ page }) => {
  await session(page)
  await page.goto("/business/orders")
  await page
    .locator(`[data-rfd-draggable-id="${pendingId}"]`)
    .getByRole("button", { name: "Productos del pedido", exact: true })
    .click()
  await page.getByRole("dialog").getByRole("button", { name: "Avisar al cliente", exact: true }).click()
  const dialog = page.getByRole("dialog").last()
  await expect(dialog.getByRole("button", { name: "Enviar por Evolution API", exact: true })).toBeDisabled()
  await dialog.getByRole("button", { name: "Previsualizar mensaje", exact: true }).click()
  await expect(dialog.getByText(/No elegible:/)).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Enviar por Evolution API", exact: true })).toBeDisabled()
  await expect(
    dialog.getByText("No se han enviado mensajes por Evolution API para este pedido.", { exact: true })
  ).toBeVisible()
})

test("WhatsApp real local: aprovisiona, obtiene QR y pausa notificaciones", async ({ page }) => {
  test.skip(!process.env.E2E_EVOLUTION_URL || !process.env.E2E_EVOLUTION_KEY, "Local Evolution must be running.")
  await session(page)
  await page.goto(`/business/branches/${branch.id}/config`)
  await page.getByRole("switch", { name: "Habilitar notificaciones WhatsApp en esta sucursal", exact: true }).check()
  let saved = page.waitForResponse(
    (r) => r.url().endsWith(`/api/branches/${branch.id}/whatsapp`) && r.request().method() === "PUT"
  )
  await page.getByRole("button", { name: "Guardar configuración WhatsApp", exact: true }).click()
  expect((await saved).status()).toBe(202)
  await page.getByRole("button", { name: "Conectar / Generar QR", exact: true }).click()
  await expect(page.getByRole("img", { name: "WhatsApp QR", exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/El QR vence en/)).toBeVisible()
  await expect
    .poll(async () => (await json<{ status: string }>(await api.get(`/api/branches/${branch.id}/whatsapp`))).status)
    .toBe("WaitingForQr")
  // Pausing must persist without requiring a linked WhatsApp number or sending a message.
  await page.getByRole("switch", { name: "Habilitar notificaciones WhatsApp en esta sucursal", exact: true }).uncheck()
  saved = page.waitForResponse(
    (r) => r.url().endsWith(`/api/branches/${branch.id}/whatsapp`) && r.request().method() === "PUT"
  )
  await page.getByRole("button", { name: "Guardar configuración WhatsApp", exact: true }).click()
  expect((await saved).status()).toBe(202)
  expect((await json<{ enabled: boolean }>(await api.get(`/api/branches/${branch.id}/whatsapp`))).enabled).toBe(false)
})

test("Zonas: crea, cotiza cobertura y elimina desde la interfaz", async ({ page }) => {
  await session(page)
  // Las zonas viven ahora en Órdenes → Configurar (Rutas solo enlaza aquí).
  await page.goto("/business/orders/routes")
  await page.getByRole("link", { name: "Configurar", exact: true }).last().click()
  await expect(page).toHaveURL(/\/business\/orders\/setup/)
  const zones = page.locator("#zones")
  const map = zones.getByRole("region", { name: "Mapa de domicilios pendientes" })
  // Sin ubicación de sucursal, el centro de la zona se elige pulsando el mapa.
  await map.click()
  await zones.getByLabel("Nombre de zona", { exact: true }).fill(`Zona UX ${suffix}`)
  await zones.getByLabel("Tarifa de envío", { exact: true }).fill("4200")
  await zones.getByRole("button", { name: "Agregar zona", exact: true }).click()
  await expect(page.getByText(`Zona UX ${suffix}`, { exact: true })).toBeVisible()
  await zones.getByRole("switch").click()
  await map.click()
  await expect(page.getByText(/Zona UX.*4\.200/).last()).toBeVisible()
  await page.getByRole("button", { name: "Eliminar zona", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar zona", exact: true }).click()
  await expect(page.getByText(`Zona UX ${suffix} ·`, { exact: false })).toHaveCount(0)
})

test("Notificaciones: conserva aviso nuevo, permite leerlo y silenciar", async ({ page }) => {
  await session(page)
  await page.goto("/business/orders")
  await expect(page.locator(`[data-rfd-draggable-id="${pendingId}"]`)).toBeVisible()
  const created = await json<{ id: string }>(
    await api.post("/api/orders", {
      data: {
        branchId: branch.id,
        status: "Pending",
        customerName: `Notificación ${suffix}`,
        customerPhone: "+573000000001",
        paymentMethod: "EFFECTIVO",
        items: [{ itemPublicId: item.id, quantity: 1 }],
      },
    })
  )
  await expect(page.locator(`[data-rfd-draggable-id="${created.id}"]`)).toBeVisible({ timeout: 40_000 })
  await page.getByRole("button", { name: "Centro de notificaciones", exact: true }).click()
  await expect(page.getByText(`Notificación ${suffix}`, { exact: false }).last()).toBeVisible()
  await page.getByRole("button", { name: "Silenciar sonido", exact: true }).click()
  await expect(page.getByRole("button", { name: "Activar sonido", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Marcar todo leído", exact: true }).click()
})

test("Cancelación: elige merma desde tarjeta y descuenta inventario una sola vez", async ({ page }) => {
  await session(page)
  await page.goto("/business/orders")
  const before = await json<{ quantity: number }>(await api.get(`/api/branches/${branch.id}/items/by-item/${item.id}`))
  const card = page.locator(`[data-rfd-draggable-id="${wasteId}"]`)
  await card.getByRole("button", { name: "Confirmar →", exact: true }).click()
  await card.getByRole("button", { name: "Preparar →", exact: true }).click()
  await card.getByRole("button", { name: "Acciones rápidas", exact: true }).click()
  await page.getByRole("menuitem", { name: "Cancelar", exact: true }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("button", { name: /Registrar como merma/ }).click()
  await dialog.getByPlaceholder("Motivo de cancelación (opcional)").fill("Prueba local de merma")
  const cancelled = page.waitForResponse(
    (r) => r.url().endsWith(`/api/orders/${wasteId}/cancel`) && r.request().method() === "POST"
  )
  await dialog.getByRole("button", { name: "Confirmar cancelación", exact: true }).click()
  const response = await cancelled
  expect(response.ok()).toBe(true)
  expect(response.request().postDataJSON()).toEqual({ reason: "Prueba local de merma", cancellationType: "Waste" })
  const order = await json<{ statusCode: string; cancellationType: string }>(await api.get(`/api/orders/${wasteId}`))
  expect(order.statusCode).toBe("Cancelled")
  expect(order.cancellationType).toBe("Waste")
  const after = await json<{ quantity: number }>(await api.get(`/api/branches/${branch.id}/items/by-item/${item.id}`))
  expect(after.quantity).toBe(before.quantity - 1)
})

test("Cierre: concilia con un clic, filtra filas e imprime resumen", async ({ page }) => {
  await session(page)
  await page.goto("/business/orders")
  const card = page.locator(`[data-rfd-draggable-id="${pendingId}"]`)
  await card.getByRole("button", { name: "Despachar →", exact: true }).click()
  await card.getByRole("button", { name: "Entregar ✓", exact: true }).click()
  await expect
    .poll(async () => (await json<{ statusCode: string }>(await api.get(`/api/orders/${pendingId}`))).statusCode)
    .toBe("Delivered")
  await page.goto("/business/orders/closing")
  const row = page.getByRole("row").filter({ hasText: `Cliente búsqueda ${suffix}` })
  await row.getByRole("button", { name: "Confirmar pago", exact: true }).click()
  await expect
    .poll(async () => (await json<{ isReconciled: boolean }>(await api.get(`/api/orders/${pendingId}`))).isReconciled)
    .toBe(true)
  await page.getByRole("button", { name: /Todas \(/ }).click()
  await page.getByPlaceholder("Buscar por # orden o cliente…").fill(`Cliente búsqueda ${suffix}`)
  await expect(row).toBeVisible()
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printCalled = "true"
    }
  })
  await page.getByRole("button", { name: "Imprimir resumen", exact: true }).click()
  await expect(page.locator("body")).toHaveAttribute("data-print-called", "true")
})

test("UX: cancelado aparece en historial y nunca indica cobrar", async ({ page }) => {
  await session(page)
  await page.goto("/business/orders")
  await page.getByRole("button", { name: /^Historial \(/ }).click()
  const card = page.locator(`[data-rfd-draggable-id="${wasteId}"]`)
  await expect(
    page.locator('[data-rfd-droppable-id="Cancelled"]').locator(`[data-rfd-draggable-id="${wasteId}"]`)
  ).toBeVisible()
  await expect(card.locator('input[type="checkbox"]')).toHaveCount(0)
  await card.getByRole("button", { name: "Productos del pedido", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Pedido cancelado · no cobrar", { exact: true })).toBeVisible()
  await expect(dialog.getByText(/^COBRAR/)).toHaveCount(0)
  await expect(dialog.getByText("Efectivo", { exact: true })).toBeVisible()
  await expect(dialog.getByText("CASH", { exact: true })).toHaveCount(0)
})

test("UX: borrador WhatsApp se conserva al navegar, cancelar salida y recargar", async ({ page }) => {
  await session(page)
  await page.goto(`/business/branches/${branch.id}/config`)
  const template = page.getByRole("textbox", { name: "Plantillas de mensajes", exact: true })
  const original = await template.inputValue()
  const draft = original + " borrador UX"
  await template.fill(draft)
  await expect(page.getByRole("status").filter({ hasText: "Cambios sin guardar" })).toBeVisible()
  // Click the application link while retaining the browser's real navigation flow.
  const ordersLink = page.getByRole("link", { name: "Órdenes", exact: true })
  page.once("dialog", (dialog) => dialog.dismiss())
  await ordersLink.click()
  await expect(template).toHaveValue(draft)
  page.once("dialog", (dialog) => dialog.accept())
  await ordersLink.click()
  await expect(page).toHaveURL(/\/orders$/)
  await page.goto(`/business/branches/${branch.id}/config`)
  await expect(template).toHaveValue(draft)
  page.once("dialog", (dialog) => dialog.accept())
  await page.reload()
  await expect(template).toHaveValue(draft)
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Descartar borrador", exact: true }).click()
  await expect(template).toHaveValue(original)
  await expect(page.getByRole("button", { name: "Descartar borrador", exact: true })).toHaveCount(0)
})

test("UX: formulario recoger omite envío y mantiene confirmación visible", async ({ page }) => {
  await session(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/business/orders")
  await page.getByRole("button", { name: "Crear Orden", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("radio", { name: "Para recoger", exact: true })).toBeChecked()
  expect(
    await dialog
      .getByRole("radio", { name: "Para recoger", exact: true })
      .evaluate((radio) => getComputedStyle(radio).appearance)
  ).toBe("auto")
  await expect(dialog.getByLabel("Dirección", { exact: true })).toHaveCount(0)
  await dialog.getByLabel("Productos", { exact: true }).click()
  await page.getByRole("option", { name: /Producto UX/i }).click()
  await dialog.getByLabel("Nombre del cliente", { exact: true }).fill("Cliente recoger UX")
  await dialog.getByRole("radio", { name: "Domicilio", exact: true }).check()
  await dialog.getByLabel("Dirección", { exact: true }).fill("Calle temporal")
  await dialog.getByLabel("Costo de Envío", { exact: true }).fill("7000")
  await dialog.getByRole("radio", { name: "Para recoger", exact: true }).check()
  const submit = dialog.getByRole("button", { name: "Crear Orden", exact: true })
  await expect(submit).toBeInViewport()
  await dialog.getByLabel("Notas de conciliación", { exact: true }).fill("Pedido para recoger, sin tarifa")
  await expect(submit).toBeInViewport()
  const created = page.waitForResponse((r) => r.url().endsWith("/api/orders") && r.request().method() === "POST")
  await submit.click()
  const response = await created
  expect(response.status()).toBe(201)
  const payload = response.request().postDataJSON()
  expect(payload.shippingStreet).toBeNull()
  expect(payload.shippingCity).toBeNull()
  expect(payload.shippingLatitude).toBeNull()
  expect(payload.shippingLongitude).toBeNull()
  expect(payload.shippingCost).toBeNull()
  expect(payload.automaticShipping).toBe(false)
})

test("UX: domiciliario visible al entrar en móvil y acciones táctiles amplias", async ({ page }) => {
  const order = await json<{ id: string }>(
    await api.post("/api/orders", {
      data: {
        branchId: branch.id,
        status: "Confirmed",
        customerName: "Cliente móvil UX",
        customerPhone: "+573000000001",
        shippingStreet: "Calle móvil 123",
        paymentMethod: "CASH",
        items: [{ itemPublicId: item.id, quantity: 1 }],
      },
    })
  )
  for (const status of ["Preparing", "Ready"])
    expect((await api.put(`/api/orders/${order.id}/status`, { data: { status } })).ok()).toBe(true)
  await session(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/business/orders/deliveries")
  const card = page.getByTestId(`delivery-order-${order.id}`)
  await expect(card).toBeInViewport()
  await page.screenshot({ path: "test-results/ux-deliveries-mobile.png", fullPage: true })
  await expect(page.getByRole("combobox", { name: "Sucursal consultada", exact: true })).toHaveValue(branch.id)
  await expect(
    page.getByRole("combobox", { name: "Sucursal consultada", exact: true }).locator("option:checked")
  ).toHaveText(new RegExp(`Sucursal UX ${suffix}`, "i"))
  for (const name of ["Asignar", "Enviar"]) {
    const box = await card.getByRole("button", { name, exact: true }).boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await card.getByRole("button", { name: "Avisar al cliente", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText(/No elegible:/)).toBeVisible()
  await expect(dialog.getByRole("link", { name: "Configurar canal WhatsApp", exact: true })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Enviar por Evolution API", exact: true })).toBeDisabled()
  await expect(dialog.locator('a[href^="whatsapp:"], a[href*="wa.me"]')).toHaveCount(0)
})

test("UX: iniciar turno se presenta antes de la configuración WhatsApp", async ({ page }) => {
  await session(page)
  await page.goto("/business/orders/operations")
  const start = page.getByRole("button", { name: "Iniciar turno", exact: true })
  const settings = page.locator("summary").filter({ hasText: "Configuración WhatsApp" })
  await expect(start).toBeVisible()
  await expect(settings).toBeVisible()
  expect((await start.boundingBox())!.y).toBeLessThan((await settings.boundingBox())!.y)
  await expect(page.getByRole("textbox", { name: "Plantillas de mensajes", exact: true })).not.toBeVisible()
})

test("UX2: busca fuera de los primeros 100 y conserva favoritos, recientes y borrador", async ({ page }) => {
  test.setTimeout(180_000)
  for (let index = 0; index < 102; index++) {
    const product = await json<{ id: string }>(
      await api.post("/api/items", { data: { name: `Relleno UX2 ${index}`, sku: `FILL-${suffix}-${index}` } })
    )
    await json(
      await api.post(`/api/branches/${branch.id}/items`, {
        data: { branchPublicId: branch.id, itemPublicId: product.id, price: 100, quantity: 10 },
      })
    )
  }
  const first = await json<{ data: { itemPublicId: string }[] }>(
    await api.get(`/api/branches/${branch.id}/items?pageSize=100`)
  )
  expect(first.data.some((p) => p.itemPublicId === item.id)).toBe(false)
  await session(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/business/orders")
  await page.getByRole("button", { name: "Crear Orden", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Buscar producto", { exact: true }).fill(`UX-${suffix}`)
  await dialog.getByLabel("Productos", { exact: true }).click()
  await page.getByRole("option", { name: /Producto UX/i }).click()
  await dialog.getByLabel(/Cantidad: PRODUCTO UX/i).fill("2")
  await dialog.getByText("Marcar o quitar favoritos", { exact: true }).click()
  const favorite = dialog.getByRole("button", { name: "PRODUCTO UX", exact: true })
  await favorite.click()
  await expect(favorite).toHaveAttribute("aria-pressed", "true")
  await dialog.getByRole("button", { name: "Favoritos", exact: true }).click()
  await dialog.getByLabel("Productos", { exact: true }).click()
  await expect(page.getByRole("option", { name: /Producto UX/i })).toBeVisible()
  await page.keyboard.press("Escape")
  await dialog.getByRole("button", { name: "Recientes", exact: true }).click()
  await dialog.getByLabel("Productos", { exact: true }).click()
  await expect(page.getByRole("option", { name: /Producto UX/i })).toBeVisible()
  await page.keyboard.press("Escape")
  await dialog.getByLabel("Nombre del cliente", { exact: true }).fill("Borrador UX2")
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click()
  await page.reload()
  await page.getByRole("button", { name: "Crear Orden", exact: true }).click()
  await expect(dialog.getByText(/Recuperamos tu pedido sin terminar/)).toBeVisible()
  await expect(dialog.getByLabel("Nombre del cliente", { exact: true })).toHaveValue("Borrador UX2")
  await expect(dialog.getByLabel(/Cantidad: PRODUCTO UX/i)).toHaveValue("2")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  page.once("dialog", (confirm) => confirm.accept())
  await dialog.getByRole("button", { name: "Descartar borrador", exact: true }).click()
  await expect(dialog.getByLabel(/Cantidad: PRODUCTO UX/i)).toHaveCount(0)
})

test("UX2: teléfono completa cliente y dirección, permite ocasional y vincula el pedido", async ({ page }) => {
  const customer = await json<{ id: string; personPublicId: string }>(
    await api.post("/api/customers", {
      data: {
        firstName: "Contacto UX2",
        lastName: "Prueba",
        identificationTypeId: 1,
        identificationNumber: `8${Date.now()}`,
        phoneNumber: "+57 (300) 222-3333",
        address: "Calle QA 22",
        city: "Bogota",
      },
    })
  )
  await session(page)
  await page.goto("/business/orders")
  await page.getByRole("button", { name: "Crear Orden", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Buscar producto", { exact: true }).fill(`UX-${suffix}`)
  await dialog.getByLabel("Productos", { exact: true }).click()
  await page.getByRole("option", { name: /Producto UX/i }).click()
  await dialog.getByLabel("Teléfono", { exact: true }).fill("3002223333")
  await dialog.getByRole("button", { name: /CONTACTO UX2 PRUEBA/i }).click()
  await expect(dialog.getByLabel("Nombre del cliente", { exact: true })).toHaveValue("CONTACTO UX2 PRUEBA")
  await dialog.getByRole("radio", { name: "Domicilio", exact: true }).check()
  await expect(dialog.getByLabel("Dirección", { exact: true })).toHaveValue("Calle QA 22")
  await dialog.getByRole("button", { name: "Continuar como cliente ocasional", exact: true }).click()
  await expect(dialog.getByText(/Cliente vinculado/)).toHaveCount(0)
  await dialog.getByRole("button", { name: /CONTACTO UX2 PRUEBA/i }).click()
  await dialog.getByRole("radio", { name: "Para recoger", exact: true }).check()
  const created = page.waitForResponse((r) => r.url().endsWith("/api/orders") && r.request().method() === "POST")
  await dialog.getByRole("button", { name: "Crear Orden", exact: true }).click()
  const response = await created
  expect(response.status()).toBe(201)
  expect(response.request().postDataJSON().customerId).toBe(customer.id)
  expect(response.request().postDataJSON().personId).toBe(customer.personPublicId)
  await expect(dialog).toHaveCount(0)
  await page.getByRole("button", { name: "Crear Orden", exact: true }).click()
  await expect(dialog.getByLabel("Nombre del cliente", { exact: true })).toHaveValue("")
  await expect(dialog.getByLabel(/Cantidad: PRODUCTO UX/i)).toHaveCount(0)
})

test("UX2: recuperación revisa cambios de precio antes de permitir crear", async ({ page }) => {
  await session(page)
  await page.goto("/business/orders")
  await page.getByRole("button", { name: "Crear Orden", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Buscar producto", { exact: true }).fill(`UX-${suffix}`)
  await dialog.getByLabel("Productos", { exact: true }).click()
  await page.getByRole("option", { name: /Producto UX/i }).click()
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click()
  const branchItem = await json<{ id: string }>(await api.get(`/api/branches/${branch.id}/items/by-item/${item.id}`))
  await json(await api.put(`/api/branches/${branch.id}/items/${branchItem.id}/pricing`, { data: { price: 12000 } }))
  await page.getByRole("button", { name: "Crear Orden", exact: true }).click()
  await expect(dialog.getByText(/Cambiaron precios del catálogo/)).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Crear Orden", exact: true })).toBeDisabled()
  await dialog.getByRole("button", { name: "Actualizar precios y revisar total", exact: true }).click()
  await expect(dialog.getByLabel(/Precio: PRODUCTO UX/i)).toHaveValue("12000")
  await expect(dialog.getByRole("button", { name: "Crear Orden", exact: true })).toBeEnabled()
})

test("UX2: filtros rápidos persisten al volver sin vistas guardadas", async ({ page }) => {
  await session(page)
  await page.goto("/business/orders")
  await page.getByRole("button", { name: "Listos sin asignar", exact: true }).click()
  await page.reload()
  await expect(page.getByRole("button", { name: "Listos sin asignar", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await expect(page.locator('[data-rfd-droppable-id="Ready"]')).toBeVisible()
  await expect(page.getByText(/Mis vistas guardadas/)).toHaveCount(0)
  await expect(page.getByLabel("Nombre de la vista", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Todos los activos", exact: true }).click()
  await expect(page.getByRole("button", { name: "Todos los activos", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
})

test("UX2: muestra desconexión y recupera seguimiento al volver la red", async ({ page, context }) => {
  await session(page)
  await page.goto("/business/orders")
  await expect(page.getByText("Seguimiento conectado", { exact: true })).toBeVisible({ timeout: 40_000 })
  await context.setOffline(true)
  await expect(page.getByText("Sin conexión. Conservamos los datos visibles.", { exact: true })).toBeVisible()
  await context.setOffline(false)
  await page.getByRole("button", { name: "Reintentar conexión", exact: true }).click()
  await expect(page.getByText("Seguimiento conectado", { exact: true })).toBeVisible({ timeout: 40_000 })
  await expect(page.getByText(/Última respuesta hace/)).toBeVisible()
})

test("UX2: detalle muestra cronología real y permite recuperar error de carga", async ({ page }) => {
  const timelineOrder = await json<{ id: string }>(
    await api.post("/api/orders", {
      data: {
        branchId: branch.id,
        status: "Pending",
        customerName: "Cronología independiente QA",
        paymentMethod: "CASH",
        items: [{ itemPublicId: item.id, quantity: 1 }],
      },
    })
  )

  const own = await json<{ totalCount: number; data: { kind: string }[] }>(
    await api.get(`/api/orders/${timelineOrder.id}/timeline`)
  )
  expect(own.data.some((e) => e.kind === "created")).toBe(true)
  expect((await api.get(`/api/orders/${randomUUID()}/timeline`)).status()).toBe(404)
  await session(page)
  let fail = true
  await page.route(`**/api/orders/${timelineOrder.id}/timeline*`, (route) =>
    fail ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" }) : route.continue()
  )
  await page.goto("/business/orders")
  await page
    .locator(`[data-rfd-draggable-id="${timelineOrder.id}"]`)
    .getByRole("button", { name: "Productos del pedido", exact: true })
    .click()
  const timeline = page.getByRole("region", { name: "Cronología del pedido", exact: true })
  await expect(timeline.getByText("No se pudo cargar el historial.", { exact: true })).toBeVisible()
  fail = false
  await timeline.getByRole("button", { name: "Actualizar", exact: true }).first().click()
  await expect(timeline.getByText("Pedido creado", { exact: true })).toBeVisible()
})

test("UX2: asistente Evolution guía los pasos y exige preview sin enviar mensajes", async ({ page }) => {
  await json(
    await api.put(`/api/branches/${branch.id}/whatsapp`, {
      data: { enabled: false, automaticEvents: [], notifyExternalPlatformOrders: false, templates: [] },
    })
  )
  await session(page)
  await page.setViewportSize({ width: 390, height: 844 })
  let sends = 0
  page.on("request", (r) => {
    if (r.method() === "POST" && /whatsapp\/notifications$/.test(new URL(r.url()).pathname)) sends++
  })
  await page.goto(`/business/branches/${branch.id}/config#whatsapp`)
  const assistant = page.getByRole("region", { name: "Asistente de configuración · Evolution API", exact: true })
  await expect(assistant).toBeVisible()
  await assistant.getByRole("button", { name: "2. Verificar conexión", exact: true }).click()
  await assistant.getByRole("button", { name: "Verificar conexión", exact: true }).click()
  await expect(assistant.getByText(/La conexión todavía no está confirmada/)).toBeVisible()
  await assistant.getByRole("button", { name: "3. Probar aviso autorizado", exact: true }).click()
  await assistant
    .getByLabel("Buscar pedido por referencia o cliente", { exact: true })
    .fill(`Cliente búsqueda ${suffix}`)
  await expect(assistant.getByLabel("Pedido para la prueba", { exact: true }).locator("option")).toHaveCount(2)
  await assistant.getByLabel("Pedido para la prueba", { exact: true }).selectOption(pendingId)
  await assistant.getByRole("button", { name: "Avisar al cliente", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("Evolution API")
  await expect(dialog.getByRole("button", { name: "Enviar por Evolution API", exact: true })).toBeDisabled()
  await page.keyboard.press("Escape")
  await assistant.getByRole("button", { name: "Configurar eventos sin enviar una prueba", exact: true }).click()
  await expect(assistant.getByText(/Aún no hay una prueba aceptada/)).toBeVisible()
  expect(sends).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("UX2: asistente distingue cola de aceptación con transporte simulado", async ({ page }) => {
  // Only this UI transport is simulated. No request can reach a real WhatsApp recipient.
  const rawChannel = await json<Record<string, unknown>>(
    await api.put(`/api/branches/${branch.id}/whatsapp`, {
      data: { enabled: false, automaticEvents: [], notifyExternalPlatformOrders: false, templates: [] },
    })
  )
  await session(page)
  await page.route(`**/api/branches/${branch.id}/whatsapp`, (route) =>
    route.fulfill({ json: { ...rawChannel, status: "Connected", enabled: true } })
  )
  await page.route(`**/api/branches/${branch.id}/whatsapp/connection`, (route) =>
    route.fulfill({
      json: { connected: true, providerState: "open", checkedAtUtc: new Date().toISOString(), maskedPhone: "***0001" },
    })
  )
  let queued = false
  let accepted = false
  let idempotencyKey = ""
  const message = () => ({
    id: "synthetic-ui-message",
    orderId: pendingId,
    recipientType: "Customer",
    recipientName: "QA",
    maskedPhone: "***0001",
    templateCode: "OrderConfirmed",
    renderedText: "Aviso sintético QA",
    status: accepted ? "Accepted" : "Queued",
    isAutomatic: false,
    attemptCount: accepted ? 1 : 0,
    createdAtUtc: new Date().toISOString(),
    acceptedAtUtc: accepted ? new Date().toISOString() : null,
    deliveredAtUtc: null,
    readAtUtc: null,
    canRetry: false,
    canResendUnknownOutcome: false,
  })
  await page.route(`**/api/orders/${pendingId}/whatsapp/messages*`, (route) =>
    route.fulfill({ json: { data: queued ? [message()] : [], totalCount: queued ? 1 : 0 } })
  )
  await page.route(`**/api/orders/${pendingId}/whatsapp/preview`, (route) =>
    route.fulfill({
      json: {
        orderId: pendingId,
        recipientType: "Customer",
        templateCode: "OrderConfirmed",
        recipientName: "QA",
        maskedPhone: "***0001",
        renderedText: "Aviso sintético QA",
        eligible: true,
        ineligibleReason: null,
        contactPermissionAllowed: true,
        channelStatus: "Connected",
        previewVersion: "synthetic-v1",
      },
    })
  )
  await page.route(`**/api/orders/${pendingId}/whatsapp/notifications`, (route) => {
    idempotencyKey = route.request().headers()["idempotency-key"] ?? ""
    expect(route.request().postDataJSON().previewVersion).toBe("synthetic-v1")
    queued = true
    return route.fulfill({ status: 202, json: message() })
  })
  await page.goto(`/business/branches/${branch.id}/config#whatsapp`)
  const assistant = page.getByRole("region", { name: "Asistente de configuración · Evolution API", exact: true })
  await assistant.getByRole("button", { name: "2. Verificar conexión", exact: true }).click()
  await assistant.getByRole("button", { name: "Verificar conexión", exact: true }).click()
  await expect(assistant.getByText("Conexión confirmada por Evolution.", { exact: true })).toBeVisible()
  await assistant.getByRole("button", { name: "Siguiente", exact: true }).click()
  await assistant
    .getByLabel("Buscar pedido por referencia o cliente", { exact: true })
    .fill(`Cliente búsqueda ${suffix}`)
  await expect(assistant.getByLabel("Pedido para la prueba", { exact: true }).locator("option")).toHaveCount(2)
  await assistant.getByLabel("Pedido para la prueba", { exact: true }).selectOption(pendingId)
  await assistant.getByRole("button", { name: "Avisar al cliente", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Aviso sintético QA", { exact: true })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Enviar por Evolution API", exact: true })).toBeDisabled()
  await dialog.getByRole("button", { name: "Previsualizar mensaje", exact: true }).click()
  await dialog.getByRole("button", { name: "Enviar por Evolution API", exact: true }).click()
  await expect.poll(() => queued).toBe(true)
  expect(idempotencyKey).not.toBe("")
  await page.keyboard.press("Escape")
  await expect(assistant.getByText(/Esperando un aviso manual aceptado/)).toBeVisible()
  await expect(assistant.getByRole("button", { name: "Siguiente", exact: true })).toBeDisabled()
  accepted = true
  await expect(assistant.getByText(/El aviso fue aceptado por el proveedor/)).toBeVisible({ timeout: 10_000 })
  await assistant.getByRole("button", { name: "Siguiente", exact: true }).click()
  await expect(assistant.getByText(/Selecciona los eventos y revisa sus plantillas/)).toBeVisible()
})

test("UX3: cambia de sucursal sin filtros invisibles y conserva borradores por sede", async ({ page }) => {
  const courier = await createScopedCourier("Repartidor sucursal")
  const otherBranch = await json<{ id: string }>(
    await api.post("/api/branches", { data: { name: "Sucursal alternativa QA", timeZoneId: "America/Bogota" } })
  )
  const modules = await json<{ id: string; moduleCode: string }[]>(await api.get("/api/tenant-modules"))
  const ordersModule = modules.find((m) => m.moduleCode === "ORDERS")!
  await json(
    await api.post(`/api/branches/${otherBranch.id}/modules`, { data: { tenantModulePublicId: ordersModule.id } })
  )
  await json(
    await api.post(`/api/branches/${otherBranch.id}/items`, {
      data: { branchPublicId: otherBranch.id, itemPublicId: item.id, price: 10000, quantity: 10 },
    })
  )
  const otherOrder = await json<{ id: string }>(
    await api.post("/api/orders", {
      data: {
        branchId: otherBranch.id,
        status: "Pending",
        customerName: "Pedido sede alternativa",
        paymentMethod: "CASH",
        items: [{ itemPublicId: item.id, quantity: 1 }],
      },
    })
  )
  await session(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/business/orders")
  await page.getByRole("button", { name: "Listos sin asignar", exact: true }).click()
  await page.getByRole("button", { name: /^Filtros/ }).click()
  const courierSelect = page.getByRole("combobox", { name: "Todos los domiciliarios", exact: true })
  await expect(courierSelect.locator(`option[value="${courier.id}"]`)).toHaveCount(1)
  const filtered = page
    .waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/orders" && new URL(r.url()).searchParams.get("courierId") === courier.id
    )
    .catch(() => null)
  await courierSelect.selectOption(courier.id)
  await expect(page.getByRole("button", { name: "Listos sin asignar", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false"
  )
  expect((await filtered)?.status()).toBe(200)
  await page.getByRole("button", { name: "Crear Orden", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Nombre del cliente", { exact: true }).fill("Borrador sede original")
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click()
  await page.getByRole("combobox", { name: "Sucursal consultada", exact: true }).selectOption(otherBranch.id)
  await expect(courierSelect).toHaveValue("")
  await expect(page.locator(`[data-rfd-draggable-id="${otherOrder.id}"]`)).toBeVisible()
  await expect(page.locator(`[data-rfd-draggable-id="${otherOrder.id}"]`)).toBeVisible()
  await page.getByRole("button", { name: "Crear Orden", exact: true }).click()
  await expect(dialog.getByLabel("Nombre del cliente", { exact: true })).toHaveValue("")
  await dialog.getByLabel("Nombre del cliente", { exact: true }).fill("Borrador sede alternativa")
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click()
  await page.getByRole("combobox", { name: "Sucursal consultada", exact: true }).selectOption(branch.id)
  await page.getByRole("button", { name: "Crear Orden", exact: true }).click()
  await expect(dialog.getByLabel("Nombre del cliente", { exact: true })).toHaveValue("Borrador sede original")
})

test("UX3: identifica un domiciliario guardado que dejó de estar disponible", async ({ page }) => {
  const courier = await createScopedCourier("Filtro guardado")
  await session(page)
  await page.goto("/business/orders")
  const courierSelect = page.getByRole("combobox", { name: "Todos los domiciliarios", exact: true })
  await expect(courierSelect.locator(`option[value="${courier.id}"]`)).toHaveCount(1)
  await courierSelect.selectOption(courier.id)
  await json(
    await api.put(`/api/users/${courier.id}`, {
      data: {
        firstName: "Filtro guardado",
        lastName: "QA",
        role: "DELIVERY",
        isActive: false,
        deliveryBranchId: branch.id,
      },
    })
  )
  await page.reload()
  await expect(
    page.getByText("El domiciliario guardado no figura en la lista actual. El filtro sigue aplicado.", { exact: true })
  ).toBeVisible()
  await expect(courierSelect).toHaveValue(courier.id)
  await page.getByRole("button", { name: "Quitar filtro de domiciliario", exact: true }).click()
  await expect(courierSelect).toHaveValue("")
  await expect(
    page.getByText("El domiciliario guardado no figura en la lista actual. El filtro sigue aplicado.", { exact: true })
  ).toHaveCount(0)
})

for (const width of [1440, 390]) {
  test(`Operativa: popup ${width}px mantiene cabecera y acciones sin tapar contenido`, async ({ page }, testInfo) => {
    const order = await workflowOrder("Popup QA " + width, "Confirmed", true)
    await session(page)
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/business/orders")
    if (width > 640) {
      await page.getByRole("button", { name: "Oscuro", exact: true }).click()
      await expect(page.locator("html")).toHaveClass(/dark/)
    }
    await page
      .locator(`[data-rfd-draggable-id="${order.id}"]`)
      .getByRole("button", { name: "Productos del pedido", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    const content = dialog.getByRole("region", { name: "Contenido del pedido", exact: true })
    const actions = dialog.getByRole("group", { name: "Acciones del pedido", exact: true })
    const next = actions.getByRole("button", { name: /^Preparar/ })
    await expect(next).toBeEnabled()
    await expect(next).toBeInViewport()
    if (width > 640) expect((await dialog.boundingBox())!.width).toBeGreaterThan(800)
    const close = dialog.getByRole("button", { name: "Close", exact: true })
    const closeRect = (await close.boundingBox())!
    const badge = (await dialog.getByText("Confirmado", { exact: true }).boundingBox())!
    expect(
      badge.x < closeRect.x + closeRect.width &&
        badge.x + badge.width > closeRect.x &&
        badge.y < closeRect.y + closeRect.height &&
        badge.y + badge.height > closeRect.y
    ).toBe(false)
    const before = (await actions.boundingBox())!
    await content.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect(next).toBeInViewport()
    await expect(close).toBeInViewport()
    expect(Math.abs((await actions.boundingBox())!.y - before.y)).toBeLessThan(2)
    await content.evaluate((element) => {
      element.scrollTop = 0
    })
    await page.screenshot({ path: testInfo.outputPath("popup-" + width + ".png"), animations: "disabled" })
  })
}

test("Operativa: flecha avanza una selección mixta exactamente un estado", async ({ page }) => {
  const first = await workflowOrder("Lote siguiente A")
  const second = await workflowOrder("Lote siguiente B")
  const third = await workflowOrder("Lote siguiente C", "Confirmed")
  await session(page)
  await page.goto("/business/orders")
  const requests: { orderIds: string[]; status: string }[] = []
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().endsWith("/api/orders/status/bulk"))
      requests.push(request.postDataJSON())
  })
  for (const order of [first, second, third])
    await page.locator(`[data-rfd-draggable-id="${order.id}"]`).getByRole("checkbox").check()
  await page.getByRole("button", { name: "Siguiente estado", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("Pendiente → Confirmado")
  await expect(dialog).toContainText("Confirmado → Preparando")
  await dialog.getByRole("button", { name: "Aplicar cambio", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(requests).toHaveLength(2)
  expect(requests.find((request) => request.status === "Confirmed")!.orderIds.sort()).toEqual(
    [first.id, second.id].sort()
  )
  expect(requests.find((request) => request.status === "Preparing")!.orderIds).toEqual([third.id])
  for (const [order, status] of [
    [first, "Confirmed"],
    [second, "Confirmed"],
    [third, "Preparing"],
  ] as const)
    expect((await json<{ statusCode: string }>(await api.get(`/api/orders/${order.id}`))).statusCode).toBe(status)
})

test("Operativa: selección individual exige domiciliario antes de avanzar a envío", async ({ page }) => {
  const order = await workflowOrder("Sin domiciliario QA", "Confirmed", true)
  for (const status of ["Preparing", "Ready"])
    expect((await api.put(`/api/orders/${order.id}/status`, { data: { status } })).ok()).toBe(true)
  await session(page)
  await page.goto("/business/orders")
  await page.locator(`[data-rfd-draggable-id="${order.id}"]`).getByRole("checkbox").check()
  await page.getByRole("button", { name: "Siguiente estado", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("Elija un domiciliario")
  await expect(dialog.getByRole("button", { name: "Aplicar cambio", exact: true })).toBeDisabled()
  expect((await json<{ statusCode: string }>(await api.get(`/api/orders/${order.id}`))).statusCode).toBe("Ready")
})

test("Operativa: fallo entre grupos conserva éxitos y bloquea reenvío incierto", async ({ page }) => {
  const first = await workflowOrder("Parcial A")
  const second = await workflowOrder("Parcial B", "Confirmed")
  await session(page)
  await page.route("**/api/orders/status/bulk", (route) =>
    route.request().postDataJSON().status === "Preparing" ? route.abort("failed") : route.continue()
  )
  await page.goto("/business/orders")
  for (const order of [first, second])
    await page.locator(`[data-rfd-draggable-id="${order.id}"]`).getByRole("checkbox").check()
  await page.getByRole("button", { name: "Siguiente estado", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Aplicar cambio", exact: true }).click()
  await expect(
    dialog
      .getByText("No se recibió el resultado del lote. Actualice el tablero antes de reintentar.", { exact: true })
      .first()
  ).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Reintentar fallidos", exact: true })).toBeDisabled()
  expect((await json<{ statusCode: string }>(await api.get(`/api/orders/${first.id}`))).statusCode).toBe("Confirmed")
  expect((await json<{ statusCode: string }>(await api.get(`/api/orders/${second.id}`))).statusCode).toBe("Confirmed")
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect(page.locator(`[data-rfd-draggable-id="${first.id}"]`).getByRole("checkbox")).not.toBeChecked()
  await expect(page.locator(`[data-rfd-draggable-id="${second.id}"]`).getByRole("checkbox")).toBeChecked()
})

test("Operativa: arrastre con ratón rechaza saltos y acepta la zona baja de la columna", async ({ page }) => {
  const order = await workflowOrder("Arrastre ratón QA")
  await session(page)
  await page.setViewportSize({ width: 1600, height: 1200 })
  await page.goto("/business/orders")
  const filtered = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/orders" &&
      new URL(response.url()).searchParams.get("search") === "Arrastre ratón QA"
  )
  await page.getByRole("searchbox").fill("Arrastre ratón QA")
  await filtered
  const target = page.locator('[data-rfd-droppable-id="Confirmed"]')
  await expect(target.locator("[data-rfd-draggable-id]")).toHaveCount(0)
  let changes = 0
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().endsWith(`/api/orders/${order.id}/status`)) changes++
  })
  await dragWorkflowOrder(page, order.id, "Preparing", false)
  expect(changes).toBe(0)
  await dragWorkflowOrder(page, order.id, "Confirmed")
  await expect
    .poll(async () => (await json<{ statusCode: string }>(await api.get(`/api/orders/${order.id}`))).statusCode)
    .toBe("Confirmed")
  expect(changes).toBe(1)
  await expect(target.locator(`[data-rfd-draggable-id="${order.id}"]`)).toBeVisible()
  let release: () => void = () => {}
  const failResponse = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**/api/orders/${order.id}/status`, async (route) => {
    await failResponse
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Cambio rechazado QA" }),
    })
  })
  await dragWorkflowOrder(page, order.id, "Preparing")
  await expect(
    page.locator('[data-rfd-droppable-id="Preparing"]').locator(`[data-rfd-draggable-id="${order.id}"]`)
  ).toBeVisible()
  release()
  await expect(target.locator(`[data-rfd-draggable-id="${order.id}"]`)).toBeVisible()
  expect((await json<{ statusCode: string }>(await api.get(`/api/orders/${order.id}`))).statusCode).toBe("Confirmed")
})

test("Operativa: arrastrar una selección mueve el grupo después de confirmar", async ({ page }) => {
  const first = await workflowOrder("Arrastre grupo QA A")
  const second = await workflowOrder("Arrastre grupo QA B")
  await session(page)
  await page.setViewportSize({ width: 1600, height: 1200 })
  await page.goto("/business/orders")
  const filtered = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/orders" &&
      new URL(response.url()).searchParams.get("search") === "Arrastre grupo QA"
  )
  await page.getByRole("searchbox").fill("Arrastre grupo QA")
  await filtered
  for (const order of [first, second])
    await page.locator(`[data-rfd-draggable-id="${order.id}"]`).getByRole("checkbox").check()
  await dragWorkflowOrder(page, first.id, "Confirmed")
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "Mover 2 pedidos", exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: "Aplicar cambio", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  for (const order of [first, second])
    expect((await json<{ statusCode: string }>(await api.get(`/api/orders/${order.id}`))).statusCode).toBe("Confirmed")
})

test("Operativa: arrastre por teclado funciona en móvil con desplazamiento horizontal", async ({ page }) => {
  const order = await workflowOrder("Arrastre teclado QA")
  await session(page)
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto("/business/orders")
  const filtered = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/orders" &&
      new URL(response.url()).searchParams.get("search") === "Arrastre teclado QA"
  )
  await page.getByRole("searchbox").fill("Arrastre teclado QA")
  await filtered
  const handle = page
    .locator(`[data-rfd-draggable-id="${order.id}"]`)
    .getByRole("button", { name: /^Arrastrar pedido/ })
  await handle.focus()
  await page.keyboard.press("Space")
  await expect(page.locator('body > [data-order-dragging="true"]')).toBeVisible()
  await page.keyboard.press("ArrowRight")
  await expect(page.locator('[data-rfd-droppable-id="Confirmed"]')).toHaveAttribute("data-drag-over", "true")
  await page.keyboard.press("Space")
  await expect
    .poll(async () => (await json<{ statusCode: string }>(await api.get(`/api/orders/${order.id}`))).statusCode)
    .toBe("Confirmed")
})
