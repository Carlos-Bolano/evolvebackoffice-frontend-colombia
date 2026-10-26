import { test, expect, request, type APIRequestContext, type APIResponse, type Page } from "@playwright/test"
import { createHmac, randomUUID } from "node:crypto"

// Configurar domicilios (ubicación, zonas sugeridas, checklist), turnos automáticos,
// seguimiento, Cluvi/WooCommerce independientes y teléfonos E.164 por país.
// Requiere el backend QA aislado: E2E_BACKEND_DIR, E2E_JWT_SECRET, E2E_API_URL (y E2E_BASE_URL si no es 5173).
const apiUrl = process.env.E2E_API_URL ?? "http://localhost:5285"
test.describe.configure({ mode: "serial", timeout: 90_000 })
test.skip(!process.env.E2E_BACKEND_DIR || !process.env.E2E_JWT_SECRET, "Configure the isolated local backend.")

const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII="
const suffix = randomUUID().slice(0, 8)
const tenantName = `Playwright Setup ${suffix}`
// Punto devuelto por la búsqueda de dirección simulada (Nominatim no se consulta en QA).
const STORE = { lat: 4.6533, lon: -74.0836 }

let platform: APIRequestContext
let api: APIRequestContext
let tenant: { id: string; tenantId: string; contactEmail: string; adminTemporaryPassword: string }
let branch: { id: string }
let item: { id: string }
let courier: { id: string; temporaryWebPassword: string }
let modules: { id: string; moduleId: string; moduleCode: string }[]

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), `${response.status()} ${response.url()} ${await response.text()}`).toBeTruthy()
  return response.json() as Promise<T>
}

async function session(page: Page, accessToken: string) {
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
    { tenantId: tenant.tenantId, accessToken, branchId: branch.id }
  )
}

let token: string

async function setTenantModule(code: string, isEnabled: boolean) {
  const module = modules.find((m) => m.moduleCode === code)!
  await json(await api.put(`/api/tenant-modules/${module.moduleId}`, { data: { isEnabled, quantity: 5 } }))
}

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15_000)
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ contentType: "image/png", body: Buffer.from(pixel, "base64") })
  )
  await page.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([{ lat: String(STORE.lat), lon: String(STORE.lon), display_name: "Calle 72 #10-34, Bogotá" }]),
    })
  )
})

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
        contactEmail: `setup-${suffix}@example.test`,
        adminIdentification: `97${Date.now()}`,
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
  // El seguimiento exige un ADMIN/MANAGER sin cambio de contraseña pendiente.
  const changed = await api.post("/api/auth/change-password", {
    data: { currentPassword: tenant.adminTemporaryPassword, newPassword: `SetupAdmin!${suffix}8` },
  })
  expect(changed.ok(), await changed.text()).toBe(true)
  modules = await json(await api.get("/api/tenant-modules"))
  for (const code of ["ORDERS", "DOMICILIOS"]) await setTenantModule(code, true)
  branch = await json(
    await api.post("/api/branches", { data: { name: `Sucursal Setup ${suffix}`, timeZoneId: "America/Bogota" } })
  )
  for (const module of modules.filter((m) => ["ORDERS", "DOMICILIOS"].includes(m.moduleCode)))
    await json(await api.post(`/api/branches/${branch.id}/modules`, { data: { tenantModulePublicId: module.id } }))
  item = await json(await api.post("/api/items", { data: { name: "Producto Setup", sku: `ST-${suffix}` } }))
  await json(
    await api.post(`/api/branches/${branch.id}/items`, {
      data: { branchPublicId: branch.id, itemPublicId: item.id, price: 10000, cost: 2500, quantity: 100 },
    })
  )
})

test.afterAll(async () => {
  if (tenant?.id && platform) {
    const owned = await json<{ id: string; name: string }>(await platform.get(`/api/tenants/${tenant.id}`))
    expect(owned.name).toBe(tenantName.toUpperCase())
    expect((await platform.delete(`/api/tenants/${tenant.id}`)).ok()).toBe(true)
  }
  await api?.dispose()
  await platform?.dispose()
})

test("Sidebar: Domicilios es una pestaña propia y solo ella queda activa", async ({ page }) => {
  await session(page, token)
  await page.goto("/business/dashboard")
  const nav = page.locator("aside nav")
  await nav.getByRole("link", { name: "Domicilios", exact: true }).click()
  await expect(page).toHaveURL(/\/business\/orders\/deliveries$/)
  await expect(nav.getByRole("link", { name: "Domicilios", exact: true })).toHaveAttribute("aria-current", "page")
  await expect(nav.getByRole("link", { name: "Órdenes", exact: true })).not.toHaveAttribute("aria-current", "page")
  await nav.getByRole("link", { name: "Órdenes", exact: true }).click()
  await expect(nav.getByRole("link", { name: "Órdenes", exact: true })).toHaveAttribute("aria-current", "page")
  await expect(nav.getByRole("link", { name: "Domicilios", exact: true })).not.toHaveAttribute("aria-current", "page")
})

test("Domicilios avisa la configuración pendiente y lleva al checklist", async ({ page }) => {
  await session(page, token)
  await page.goto("/business/orders/deliveries")
  const banner = page.getByRole("status").filter({ hasText: "pasos listos" })
  await expect(banner).toContainText("Ubicación de la sucursal")
  await expect(banner).toContainText("Zonas y tarifas")
  await banner.getByRole("link", { name: "Completar configuración", exact: true }).click()
  await expect(page).toHaveURL(/\/business\/orders\/setup$/)
  await expect(page.getByRole("heading", { name: "Configurar domicilios" })).toBeVisible()
  await expect(page.getByText(/0 de 4 pasos completos/)).toBeVisible()
})

test("Ubicación: busca la dirección, guarda y marca el paso como completo", async ({ page }) => {
  await session(page, token)
  await page.goto("/business/orders/setup")
  const location = page.locator("#location")
  await location.getByLabel("Dirección de la sucursal (calle, número, ciudad)").fill("Calle 72 #10-34 Bogotá")
  await location.getByRole("button", { name: "Buscar", exact: true }).click()
  await expect(location.getByText(`${STORE.lat.toFixed(5)}, ${STORE.lon.toFixed(5)}`)).toBeVisible()
  const saved = page.waitForResponse((r) => r.url().endsWith("/location") && r.request().method() === "PUT")
  await location.getByRole("button", { name: "Guardar ubicación", exact: true }).click()
  expect((await saved).ok()).toBe(true)
  await expect(page.getByText("La tienda está ubicada en el mapa.", { exact: true })).toBeVisible()
  const stored = await json<{ latitude: number; longitude: number }>(await api.get(`/api/branches/${branch.id}`))
  expect(stored.latitude).toBeCloseTo(STORE.lat, 5)
  expect(stored.longitude).toBeCloseTo(STORE.lon, 5)
  await page.screenshot({ path: "test-results/setup-location.png", fullPage: true })
})

test("Zonas sugeridas: tres anillos en un clic y la tarifa cobra el más cercano", async ({ page }) => {
  await session(page, token)
  await page.goto("/business/orders/setup#zones")
  const zones = page.locator("#zones")
  await expect(zones.getByText("Crear zonas sugeridas", { exact: true })).toBeVisible()
  const prices = zones.getByPlaceholder("Tarifa de envío")
  await prices.nth(0).fill("3000")
  await prices.nth(1).fill("5000")
  await prices.nth(2).fill("7000")
  await zones.getByRole("button", { name: "Crear las 3 zonas", exact: true }).click()
  await expect(page.getByText("Zonas creadas.", { exact: true })).toBeVisible()
  const created = await json<{ name: string; radiusMeters: number; latitude: number; shippingCost: number }[]>(
    await api.get(`/api/delivery-enhancements/zones?branchId=${branch.id}`)
  )
  expect(created.map((z) => z.radiusMeters).sort((a, b) => a - b)).toEqual([2000, 4000, 6000])
  expect(created.every((z) => Math.abs(z.latitude - STORE.lat) < 1e-6)).toBe(true)
  // ~3 km al norte de la tienda: cae en el anillo de 2–4 km.
  const quote = (lat: number) =>
    api
      .get(`/api/delivery-enhancements/quote?branchId=${branch.id}&latitude=${lat}&longitude=${STORE.lon}`)
      .then((r) => json<{ zoneName: string; shippingCost: number }>(r))
  expect((await quote(STORE.lat)).shippingCost).toBe(3000)
  expect((await quote(STORE.lat + 0.027)).shippingCost).toBe(5000)
  // Modo probar tarifa: pulsar el mapa sobre la tienda cotiza el primer anillo.
  await zones.getByRole("switch").click()
  await zones.getByRole("region", { name: "Mapa de domicilios pendientes" }).click()
  await expect(zones.getByText(/Zona 0–2 km · Envío/)).toBeVisible()
  await expect(page.getByText("Hay zonas activas cobrando envío automáticamente.", { exact: true })).toBeVisible()
  await page.screenshot({ path: "test-results/setup-zones.png", fullPage: true })
})

test("Turnos: asignar un pedido abre el turno solo y la base se corrige", async ({ page }) => {
  courier = await json(
    await api.post("/api/users", {
      data: {
        firstName: "Rita",
        lastName: "QA",
        identificationTypeId: 1,
        identificationNumber: `96${Date.now()}`,
        email: `rita-${suffix}@example.test`,
        role: "DELIVERY",
        phoneNumber: "+573004445566",
        deliveryBranchId: branch.id,
      },
    })
  )
  const order = await json<{ id: string }>(
    await api.post("/api/orders", {
      data: {
        branchId: branch.id,
        status: "Confirmed",
        customerName: `Cliente turno ${suffix}`,
        customerPhone: "+573000000001",
        paymentMethod: "EFFECTIVO",
        shippingStreet: "Calle QA 1",
        shippingCity: "Bogotá",
        items: [{ itemPublicId: item.id, quantity: 1 }],
      },
    })
  )
  for (const status of ["Preparing", "Ready"]) {
    const moved = await api.put(`/api/orders/${order.id}/status`, { data: { status } })
    expect(moved.ok(), `${status}: ${moved.status()} ${await moved.text()}`).toBe(true)
  }
  const before = await json<{ shifts: { courierId: string }[] }>(
    await api.get(`/api/delivery-operations?branchId=${branch.id}`)
  )
  expect(before.shifts.some((s) => s.courierId === courier.id)).toBe(false)
  const assigned = await api.put(`/api/orders/${order.id}/courier`, { data: { courierId: courier.id } })
  expect(assigned.ok(), `${assigned.status()} ${await assigned.text()}`).toBe(true)
  const after = await json<{ shifts: { id: string; courierId: string; openingCash: number; settledAt: string | null }[] }>(
    await api.get(`/api/delivery-operations?branchId=${branch.id}`)
  )
  const shift = after.shifts.find((s) => s.courierId === courier.id)
  expect(shift?.settledAt).toBeNull()
  expect(shift?.openingCash).toBe(0)

  await session(page, token)
  await page.goto("/business/orders/operations")
  await page.getByLabel("Sucursal", { exact: true }).selectOption(branch.id)
  await expect(page.getByText("Rita QA · En turno", { exact: true })).toBeVisible()
  await expect(page.getByText(/Los turnos se abren solos/)).toBeVisible()
  await page.getByLabel("Base entregada Rita QA", { exact: true }).fill("40000")
  await page.getByRole("button", { name: "Corregir base", exact: true }).click()
  await expect(page.getByText(/Base entregada: \$\s?40\.000/)).toBeVisible()
})

test("Seguimiento: explica qué pedirle al domiciliario y comparte el acceso", async ({ page }) => {
  await session(page, token)
  await page.goto("/business/orders/tracking")
  await page.getByLabel("Sucursal", { exact: true }).selectOption(branch.id)
  // Turno abierto al asignarle el pedido, pero aún con contraseña temporal: no se puede rastrear.
  await expect(page.getByText("En turno, pero sin seguimiento", { exact: true })).toBeVisible()
  await expect(page.getByText(/Rita QA — aún no entra a la app/)).toBeVisible()
  // Rita entra a la app (cambia su contraseña temporal) y pasa a la lista con su pista.
  const rita = await request.newContext({ baseURL: apiUrl, extraHTTPHeaders: { "X-Tenant-Id": tenant.tenantId } })
  const login = await json<{ token: string }>(
    await rita.post("/api/auth/login/admin", {
      data: { email: `rita-${suffix}@example.test`, password: courier.temporaryWebPassword },
    })
  )
  const changed = await rita.post("/api/auth/change-password", {
    headers: { Authorization: `Bearer ${login.token}` },
    data: { currentPassword: courier.temporaryWebPassword, newPassword: `RitaQa!${suffix}8` },
  })
  expect(changed.ok(), await changed.text()).toBe(true)
  await rita.dispose()
  await page.getByRole("button", { name: "Actualizar", exact: true }).click()
  await expect(page.getByText("Rita QA", { exact: true })).toBeVisible()
  await expect(page.getByText(/Aún no comparte ubicación: pídele que abra la app/)).toBeVisible()
  await expect(page.getByText("En turno, pero sin seguimiento", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Acceso de domiciliarios", { exact: true })).toBeVisible()
  const share = page.getByRole("link", { name: "Enviar por WhatsApp", exact: true })
  await expect(share).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=.*%2Fdelivery/)
  await expect(page.locator("code")).toHaveText(/\/delivery$/)
  await page.screenshot({ path: "test-results/setup-tracking.png", fullPage: true })
})

test("Teléfono: selector de país guarda E.164 y rechaza números inválidos", async ({ page }) => {
  await session(page, token)
  await page.goto("/business/people/customers")
  await page.getByRole("button", { name: "Nuevo cliente", exact: true }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Número de documento", { exact: true }).fill(`95${Date.now()}`)
  await dialog.getByLabel("Nombres", { exact: true }).fill(`Cliente MX ${suffix}`)
  await dialog.getByLabel("País del teléfono", { exact: true }).selectOption("MX")
  const phone = dialog.getByLabel("Teléfono", { exact: true })
  await phone.fill("123")
  await expect(dialog.getByText(/Número inválido para México/)).toBeVisible()
  await phone.fill("55 1234 5678")
  await expect(dialog.getByText("+525512345678", { exact: true })).toBeVisible()
  const created = page.waitForResponse(
    (r) => /\/api\/customers$/i.test(new URL(r.url()).pathname) && r.request().method() === "POST"
  )
  await dialog.getByRole("button", { name: "Crear cliente", exact: true }).click()
  const response = await created
  expect(response.ok(), await response.text()).toBe(true)
  expect(((await response.json()) as { phoneNumber: string }).phoneNumber).toBe("+525512345678")
  // Pegar un número internacional cambia el país solo.
  await page.getByRole("button", { name: "Nuevo cliente", exact: true }).first().click()
  await page.getByRole("dialog").getByLabel("Teléfono", { exact: true }).fill("+57 300 123 4567")
  await expect(page.getByRole("dialog").getByLabel("País del teléfono", { exact: true })).toHaveValue("CO")
  await expect(page.getByRole("dialog").getByText("+573001234567", { exact: true })).toBeVisible()
})

test("WhatsApp: valida número con el país del negocio y la prueba exige canal", async () => {
  const check = (phone: string) =>
    api
      .get(`/api/branches/${branch.id}/whatsapp/check-phone`, { params: { phone } })
      .then((r) =>
        json<{ valid: boolean; e164: string | null; numberType: string | null; onWhatsApp: boolean | null; region: string }>(r)
      )
  expect(await check("300 123 4567")).toMatchObject({
    valid: true,
    e164: "+573001234567",
    numberType: "MOBILE",
    onWhatsApp: null,
    region: "CO",
  })
  expect(await check("+52 55 1234 5678")).toMatchObject({ valid: true, e164: "+525512345678" })
  expect((await check("123")).valid).toBe(false)
  const testMessage = await api.post(`/api/branches/${branch.id}/whatsapp/test-message`)
  expect([400, 404]).toContain(testMessage.status())
})

test("Integraciones: Cluvi y WooCommerce aparecen solo con su propio módulo", async ({ page }) => {
  await session(page, token)
  // Espera la carga de módulos del tenant: mientras carga, ninguna pestaña de integración se muestra.
  const expectTabs = async (woo: number, cluvi: number) => {
    const modulesLoaded = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/tenant-modules")
    await page.goto(`/business/branches/${branch.id}/config`)
    await modulesLoaded
    await expect(page.getByRole("button", { name: "Información", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "WooCommerce", exact: true })).toHaveCount(woo)
    await expect(page.getByRole("button", { name: "CLUVI", exact: true })).toHaveCount(cluvi)
  }
  await expectTabs(0, 0)
  await setTenantModule("WOOCOMMERCE", true)
  await expectTabs(1, 0)
  await setTenantModule("CLUVI", true)
  await expectTabs(1, 1)
  // Desactivar WooCommerce no afecta a Cluvi: son independientes.
  await setTenantModule("WOOCOMMERCE", false)
  await expectTabs(0, 1)
  await page.goto(`/business/branches/${branch.id}/config?tab=cluvi`)
  await expect(page.getByRole("button", { name: "Paso 4: Operación", exact: true })).toBeVisible()
  await page.screenshot({ path: "test-results/setup-integrations.png", fullPage: true })
})
