import {
  test,
  expect,
  request,
  type APIRequestContext,
  type APIResponse,
  type Page,
  type BrowserContext,
} from "@playwright/test"
import { createHmac, randomUUID } from "node:crypto"
import type { PublicDeliveryTracking } from "../src/features/business/orders/types/tracking"

// Owned local tenant only. GPS and tiles are synthetic; application HTTP, DB and SignalR are real.
const apiUrl = process.env.E2E_API_URL ?? "http://localhost:5285"
const suffix = randomUUID().slice(0, 8)
const tenantName = `Playwright Tracking ${suffix}`
let platform: APIRequestContext, api: APIRequestContext, delivery: APIRequestContext
let tenant: { id: string; tenantId: string; name: string; contactEmail: string; adminTemporaryPassword: string }
let token: string,
  courierToken: string,
  branch: { id: string },
  courier: { id: string },
  shift: { id: string },
  order: { id: string }
let publicUrl = ""
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII="
test.describe.configure({ mode: "serial", timeout: 90_000 })
test.skip(!process.env.E2E_BACKEND_DIR || !process.env.E2E_JWT_SECRET, "Configure the isolated QA backend.")

async function json<T = { id: string }>(r: APIResponse): Promise<T> {
  expect(r.ok(), `${r.status()} ${r.url()} ${await r.text()}`).toBeTruthy()
  return r.json() as Promise<T>
}
async function tiles(context: BrowserContext) {
  await context.route("https://tile.openstreetmap.org/**", (r) =>
    r.fulfill({ contentType: "image/png", body: Buffer.from(png, "base64") })
  )
}
async function session(page: Page, accessToken = token, role = "BusinessAdmin") {
  await page.addInitScript(
    ({ tenantId, accessToken, branchId, role }) => {
      const payload = JSON.parse(atob(accessToken.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")))
      localStorage.setItem("business.orders.branchId", branchId)
      localStorage.setItem(
        "pos-manager-storage",
        JSON.stringify({
          state: {
            session: {
              accessToken,
              refreshToken: null,
              expiresAtUtc: new Date(Date.now() + 3600000).toISOString(),
              user: { id: payload.sub, email: "tracking@example.test", fullName: "Tracking QA", role },
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
    { tenantId: tenant.tenantId, accessToken, branchId: branch.id, role }
  )
}
async function publicData(url = publicUrl) {
  return json<PublicDeliveryTracking>(
    await platform.post("/api/public/delivery-tracking", {
      data: { token: new URL(url).hash.slice(1) },
      headers: { Authorization: "" },
    })
  )
}
async function openOrder(page: Page) {
  await session(page)
  await page.goto("/business/orders")
  await page
    .locator(`[data-rfd-draggable-id="${order.id}"]`)
    .getByRole("button", { name: "Productos del pedido", exact: true })
    .click()
  return page.getByRole("region", { name: "Enlace de seguimiento del cliente", exact: true })
}
test.beforeEach(async ({ context, page }) => {
  await tiles(context)
  page.setDefaultTimeout(15_000)
})
test.beforeAll(async () => {
  test.setTimeout(120_000)
  expect(["localhost", "127.0.0.1"]).toContain(new URL(apiUrl).hostname)
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url")
  const raw = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ iss: "posco.local", aud: "posco.clients", sub: randomUUID(), role: "ADMIN", tid: "11111111-1111-1111-1111-111111111111", exp: Math.floor(Date.now() / 1000) + 3600 })}`
  platform = await request.newContext({
    baseURL: apiUrl,
    extraHTTPHeaders: {
      Authorization: `Bearer ${raw}.${createHmac("sha256", process.env.E2E_JWT_SECRET!).update(raw).digest("base64url")}`,
    },
  })
  tenant = await json(
    await platform.post("/api/tenants", {
      data: {
        name: tenantName,
        contactEmail: `tracking-${suffix}@example.test`,
        adminIdentification: `98${Date.now()}`,
        maxRegisters: 3,
        countryCode: "CO",
        timeZoneId: "America/Bogota",
      },
    })
  )
  token = (
    await json<{ token: string }>(
      await platform.post("/api/auth/login/admin", {
        headers: { "X-Tenant-Id": tenant.tenantId },
        data: { email: tenant.contactEmail, password: tenant.adminTemporaryPassword },
      })
    )
  ).token
  api = await request.newContext({
    baseURL: apiUrl,
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, "X-Tenant-Id": tenant.tenantId },
  })
  expect(
    (
      await api.post("/api/auth/change-password", {
        data: { currentPassword: tenant.adminTemporaryPassword, newPassword: `TrackingAdmin!${suffix}8` },
      })
    ).ok()
  ).toBeTruthy()
  const modules = await json<{ id: string; moduleId: string; moduleCode: string }[]>(
    await api.get("/api/tenant-modules")
  )
  for (const m of modules.filter((m) => ["ORDERS", "DOMICILIOS"].includes(m.moduleCode)))
    expect(
      (await api.put(`/api/tenant-modules/${m.moduleId}`, { data: { isEnabled: true, quantity: 5 } })).ok()
    ).toBeTruthy()
  branch = await json(
    await api.post("/api/branches", { data: { name: `Tracking ${suffix}`, timeZoneId: "America/Bogota" } })
  )
  for (const m of modules.filter((m) => ["ORDERS", "DOMICILIOS"].includes(m.moduleCode)))
    await json(await api.post(`/api/branches/${branch.id}/modules`, { data: { tenantModulePublicId: m.id } }))
  const item = await json(await api.post("/api/items", { data: { name: "Tracking product", sku: `TR-${suffix}` } }))
  await json(
    await api.post(`/api/branches/${branch.id}/items`, {
      data: { branchPublicId: branch.id, itemPublicId: item.id, price: 10000, cost: 2500, quantity: 100 },
    })
  )
  const email = `courier-${suffix}@example.test`
  const created = await json<{ id: string; temporaryWebPassword: string }>(
    await api.post("/api/users", {
      data: {
        firstName: "GPS",
        lastName: "QA",
        identificationTypeId: 1,
        identificationNumber: `71${Date.now()}`,
        email,
        role: "DELIVERY",
        phoneNumber: "3002223344",
        deliveryBranchId: branch.id,
      },
    })
  )
  courier = created
  courierToken = (
    await json<{ token: string }>(
      await platform.post("/api/auth/login/admin", {
        headers: { "X-Tenant-Id": tenant.tenantId },
        data: { email, password: created.temporaryWebPassword },
      })
    )
  ).token
  delivery = await request.newContext({
    baseURL: apiUrl,
    extraHTTPHeaders: { Authorization: `Bearer ${courierToken}`, "X-Tenant-Id": tenant.tenantId },
  })
  expect(
    (
      await delivery.post("/api/auth/change-password", {
        data: { currentPassword: created.temporaryWebPassword, newPassword: `Tracking!${suffix}Qa8` },
      })
    ).ok()
  ).toBeTruthy()
  shift = await json(
    await api.post("/api/delivery-operations/shifts", {
      data: { courierId: courier.id, branchId: branch.id, openingCash: 0 },
    })
  )
  order = await json(
    await api.post("/api/orders", {
      data: {
        branchId: branch.id,
        customerName: "Private Tracking Customer",
        customerPhone: "+573000000001",
        shippingStreet: "Private street 123",
        shippingLatitude: 4.63,
        shippingLongitude: -74.09,
        paymentMethod: "EFFECTIVO",
        items: [{ itemPublicId: item.id, quantity: 1 }],
      },
    })
  )
  for (const status of ["Preparing", "Ready", "Shipped"])
    expect(
      (
        await api.put(`/api/orders/${order.id}/status`, {
          data: { status, courierId: status === "Shipped" ? courier.id : undefined },
        })
      ).ok()
    ).toBeTruthy()
})
test.afterAll(async () => {
  if (tenant?.id && platform) {
    const owned = await json<{ id: string; name: string }>(await platform.get(`/api/tenants/${tenant.id}`))
    expect(owned.name).toBe(tenantName.toUpperCase())
    expect(owned.id).toBe(tenant.id)
    expect((await platform.delete(`/api/tenants/${tenant.id}`)).ok()).toBeTruthy()
  }
  await delivery?.dispose()
  await api?.dispose()
  await platform?.dispose()
})

test("Tracking: crea enlace desde pedido y bloquea Evolution sin canal", async ({ page }) => {
  const panel = await openOrder(page)
  await panel.getByRole("button", { name: "Crear enlace de seguimiento", exact: true }).click()
  publicUrl = await panel.getByRole("textbox", { name: "Enlace de seguimiento", exact: true }).inputValue()
  expect(new URL(publicUrl).pathname).toBe("/track")
  expect(new URL(publicUrl).search).toBe("")
  await panel.getByRole("button", { name: "Enviar seguimiento por Evolution", exact: true }).click()
  const dialog = page.getByRole("dialog").last()
  await expect(dialog.getByRole("button", { name: "Enviar por Evolution API", exact: true })).toBeDisabled()
  await expect(dialog.locator('a[href^="whatsapp:"], a[href*="wa.me"]')).toHaveCount(0)
})

test("Tracking: GPS consentido mueve mapas interno y publico sin cambiar zoom; pausa oculta posicion", async ({
  page,
  browser,
}) => {
  await session(page)
  await page.goto("/business/orders/tracking")
  await expect(page.getByText("Seguimiento en vivo conectado.", { exact: true })).toBeVisible()
  const dc = await browser.newContext({
    geolocation: { latitude: 4.61, longitude: -74.08, accuracy: 10 },
    permissions: ["geolocation"],
    viewport: { width: 390, height: 844 },
  })
  const pc = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await tiles(dc)
  await tiles(pc)
  const dp = await dc.newPage(),
    pp = await pc.newPage()
  try {
    await session(dp, courierToken, "Delivery")
    await dp.goto(`${process.env.E2E_BASE_URL ?? "http://localhost:5173"}/delivery`)
    await pp.goto(publicUrl)
    await expect(pp.getByText("Seguimiento en vivo conectado.", { exact: true })).toBeVisible()
    expect((await publicData()).position).toBeNull()
    const started = dp.waitForResponse(
      (r) => r.url().endsWith("/api/delivery-tracking/me/session") && r.request().method() === "POST"
    )
    await dp.getByRole("button", { name: "Compartir ubicación", exact: true }).click()
    expect((await started).ok()).toBeTruthy()
    await dc.setGeolocation({ latitude: 4.61, longitude: -74.08, accuracy: 10 })
    await expect(dp.getByText("Ubicación publicada.", { exact: true })).toBeVisible()
    await expect(pp.locator('[data-tracking-marker="courier"]')).toHaveAttribute("data-latitude", "4.61")
    await expect(page.locator(`[data-tracking-marker="${shift.id}"]`)).toHaveAttribute("data-latitude", "4.61")
    await expect(pp.getByText(/Ruta estimada: 5 min/)).toBeVisible()
    const markerBox = (await pp.locator('[data-tracking-marker="courier"]').boundingBox())!
    const mapBox = (await pp.getByRole("region", { name: "Mapa de seguimiento de entregas" }).boundingBox())!
    expect(markerBox.x).toBeGreaterThanOrEqual(mapBox.x)
    expect(markerBox.y).toBeGreaterThanOrEqual(mapBox.y)
    expect(markerBox.x + markerBox.width).toBeLessThanOrEqual(mapBox.x + mapBox.width)
    expect(markerBox.y + markerBox.height).toBeLessThanOrEqual(mapBox.y + mapBox.height)
    const beforeZoom = Number(await pp.locator("[data-map-zoom]").getAttribute("data-map-zoom"))
    await pp.getByRole("button", { name: "Zoom out", exact: true }).click()
    await expect(pp.locator("[data-map-zoom]")).toHaveAttribute("data-map-zoom", String(beforeZoom - 1))
    const zoom = await pp.locator("[data-map-zoom]").getAttribute("data-map-zoom")
    // Give the server's five-second write throttle time to elapse before the next GPS sample.
    await new Promise((r) => setTimeout(r, 5100))
    await dc.setGeolocation({ latitude: 4.612, longitude: -74.082, accuracy: 12 })
    await expect(pp.locator('[data-tracking-marker="courier"]')).toHaveAttribute("data-latitude", "4.612", {
      timeout: 25000,
    })
    await expect(page.locator(`[data-tracking-marker="${shift.id}"]`)).toHaveAttribute("data-latitude", "4.612")
    expect(await pp.locator("[data-map-zoom]").getAttribute("data-map-zoom")).toBe(zoom)
    const data = await publicData()
    expect(Object.keys(data).sort()).toEqual(
      [
        "checkedAtUtc",
        "destination",
        "expiresAtUtc",
        "locationStatus",
        "otherStops",
        "position",
        "reference",
        "roadRoute",
        "staleAfterSeconds",
        "status",
      ].sort()
    )
    expect(JSON.stringify(data)).not.toMatch(
      /Private Tracking Customer|Private street|3000000001|courierId|trail|tenantId/
    )
    for (const p of [dp, pp])
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await pp.screenshot({ path: "test-results/tracking-public-mobile.png", fullPage: true })
    await page.screenshot({ path: "test-results/tracking-operator.png", fullPage: true })
    await dp.getByRole("button", { name: "Pausar ubicación", exact: true }).click()
    await expect(pp.locator("[data-tracking-marker]")).toHaveCount(0)
    await expect(pp.getByText("Ubicación en pausa", { exact: true })).toBeVisible()
  } finally {
    await dc.close()
    await pc.close()
  }
})

test("Tracking: renovar y revocar retiran acceso del cliente abierto", async ({ page, browser }) => {
  const panel = await openOrder(page),
    pc = await browser.newContext()
  await tiles(pc)
  const pp = await pc.newPage()
  try {
    await pp.goto(publicUrl)
    await expect(pp.getByRole("heading", { name: "Sigue tu entrega" })).toBeVisible()
    await panel.getByRole("button", { name: "Renovar enlace", exact: true }).click()
    await panel
      .getByRole("group", { name: "Confirmar cambio del enlace" })
      .getByRole("button", { name: "Confirmar", exact: true })
      .click()
    await expect(panel.getByRole("textbox", { name: "Enlace de seguimiento", exact: true })).not.toHaveValue(publicUrl)
    await expect(pp.getByRole("alert")).toContainText("Este enlace de seguimiento ya no está disponible", {
      timeout: 20000,
    })
    publicUrl = await panel.getByRole("textbox", { name: "Enlace de seguimiento", exact: true }).inputValue()
    await pp.goto(publicUrl)
    await expect(pp.getByText("Ubicación en pausa", { exact: true })).toBeVisible()
    await panel.getByRole("button", { name: "Revocar enlace", exact: true }).click()
    await panel
      .getByRole("group", { name: "Confirmar cambio del enlace" })
      .getByRole("button", { name: "Confirmar", exact: true })
      .click()
    await expect(pp.getByRole("alert")).toContainText("Este enlace de seguimiento ya no está disponible", {
      timeout: 20000,
    })
    await expect(pp.locator(".leaflet-container")).toHaveCount(0)
  } finally {
    await pc.close()
  }
})

test("Tracking: permiso GPS denegado detiene sesion y ofrece recuperacion; roles aislados", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: (_ok: unknown, fail: (e: { code: number }) => void) => {
          setTimeout(() => fail({ code: 1 }), 0)
          return 1
        },
        clearWatch: () => {},
      },
    })
  })
  await session(page, courierToken, "Delivery")
  await page.goto("/delivery")
  await page.getByRole("button", { name: "Compartir ubicación", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Permite la ubicación para este sitio")
  await expect
    .poll(
      async () => (await json<{ sharing: boolean }>(await delivery.get("/api/delivery-tracking/me/session"))).sharing
    )
    .toBe(false)
  expect((await delivery.get(`/api/delivery-tracking/branches/${branch.id}`)).status()).toBe(403)
  expect((await api.post("/api/delivery-tracking/me/session")).status()).toBe(403)
  expect((await api.get(`/api/delivery-tracking/branches/${randomUUID()}`)).status()).toBe(404)
})

test("Tracking: fallback sin SignalR conserva lectura publica sin credenciales de administrador", async ({ page }) => {
  const link = await json<{ url: string }>(
    await api.post(`/api/delivery-tracking/orders/${order.id}/link`, { data: { renew: false } })
  )
  publicUrl = link.url
  await session(page)
  await page.route("**/hubs/delivery-tracking/**", (r) => r.abort())
  const received = page.waitForRequest((r) => r.url().endsWith("/api/public/delivery-tracking"))
  await page.goto(publicUrl)
  const req = await received
  expect(req.headers()["authorization"]).toBeUndefined()
  expect(req.headers()["x-tenant-id"]).toBeUndefined()
  expect(req.headers()["referer"]).toBeUndefined()
  await expect(page.getByText(/Actualización periódica activa/)).toBeVisible()
  const s = await json<{ sessionId: string }>(await delivery.post("/api/delivery-tracking/me/session"))
  await json(
    await delivery.post("/api/delivery-tracking/me/positions", {
      data: {
        sessionId: s.sessionId,
        latitude: 4.615,
        longitude: -74.085,
        accuracyMeters: 10,
        recordedAtUtc: new Date().toISOString(),
      },
    })
  )
  await expect(page.locator('[data-tracking-marker="courier"]')).toHaveAttribute("data-latitude", "4.615", {
    timeout: 20000,
  })
  expect((await delivery.delete(`/api/delivery-tracking/me/session/${s.sessionId}`)).ok()).toBeTruthy()
})

test("Tracking: muestra GPS vencido sin marcador ni ETA y finaliza al entregar", async ({ page }) => {
  const s = await json<{ sessionId: string }>(await delivery.post("/api/delivery-tracking/me/session"))
  await json(
    await delivery.post("/api/delivery-tracking/me/positions", {
      data: {
        sessionId: s.sessionId,
        latitude: 4.615,
        longitude: -74.085,
        accuracyMeters: 10,
        recordedAtUtc: new Date().toISOString(),
      },
    })
  )
  await page.goto(publicUrl)
  await expect(page.locator('[data-tracking-marker="courier"]')).toHaveCount(1)
  // Advance browser display time only; the server's real clock is asserted separately below.
  await page.clock.install()
  await page.clock.fastForward(65_000)
  // El intervalo de refresco (5 s) se creó antes de instalar el reloj falso y sigue en tiempo
  // real: hay que esperar al menos un ciclo real para que relea Date.now() ya adelantado.
  await expect(page.locator('[data-tracking-marker="courier"]')).toHaveCount(0, { timeout: 12_000 })
  await expect(page.getByText("Ubicación sin actualizar", { exact: true })).toBeVisible()
  await expect(page.getByText(/Ruta estimada: 5 min/)).toHaveCount(0)
  expect((await api.put(`/api/orders/${order.id}/status`, { data: { status: "Delivered" } })).ok()).toBeTruthy()
  const final = await publicData()
  expect(final.locationStatus).toBe("finished")
  expect(final.position).toBeNull()
  expect(final.destination).toBeNull()
  await page
    .getByRole("button", { name: "Actualizar", exact: true })
    .count()
    .then(async (n) => {
      if (n) await page.getByRole("button", { name: "Actualizar", exact: true }).click()
      else await page.reload()
    })
  await expect(page.getByText("Seguimiento de ubicación finalizado", { exact: true })).toBeVisible()
  expect((await delivery.delete(`/api/delivery-tracking/me/session/${s.sessionId}`)).ok()).toBeTruthy()
})
