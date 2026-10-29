import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"

test.use({ trace: "off", screenshot: "on" })
test.skip(!process.env.E2E_PILOT_FILE, "Set E2E_PILOT_FILE to private local pilot credentials.")

for (const width of [1440, 390]) {
  test(`Navegación ${width}px: conserva sucursal automática y traduce selector vacío`, async ({ page }) => {
    const pilot = JSON.parse(readFileSync(process.env.E2E_PILOT_FILE!, "utf8").replace(/^\uFEFF/, "")) as {
      tenantPublicId: string
      tenantEmail: string
      tenantPassword: string
      branchId: string
    }
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/login")
    await page.getByLabel("Public ID del tenant (GUID)").fill(pilot.tenantPublicId)
    await page.getByRole("textbox", { name: /email|correo/i }).fill(pilot.tenantEmail)
    await page.getByLabel("Contraseña", { exact: true }).fill(pilot.tenantPassword)
    await page.getByRole("button", { name: "Continuar como Administrador de Negocio", exact: true }).click()
    await expect(page).toHaveURL(/\/business\//)
    await page.goto("/business/orders")
    await expect(page.getByRole("searchbox")).toBeVisible()
    await page.getByRole("link", { name: "Zonas y Rutas", exact: true }).click()
    await expect(page.getByRole("combobox", { name: "Sucursal", exact: true })).toHaveValue(pilot.branchId)
    await page.getByRole("link", { name: "Turnos y Cluvi", exact: true }).click()
    await expect(page.getByRole("combobox", { name: "Sucursal", exact: true })).toHaveValue(pilot.branchId)
    await page.getByRole("link", { name: "Tablero de Órdenes", exact: true }).click()
    if (width < 640)
      await page.getByRole("combobox", { name: "Sucursal consultada", exact: true }).selectOption("__ALL__")
    else await page.getByRole("button", { name: /Todas las sucursales|Global/ }).click()
    await page.getByRole("link", { name: "Zonas y Rutas", exact: true }).click()
    const branch = page.getByRole("combobox", { name: "Sucursal", exact: true })
    await expect(branch).toHaveValue("")
    await expect(branch.locator('option[value=""]')).toHaveText("Selecciona una sucursal")
    await expect(page.getByText("select_branch", { exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}
