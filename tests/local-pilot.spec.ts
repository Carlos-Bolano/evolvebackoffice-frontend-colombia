import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"

test.use({ trace: "off", screenshot: "only-on-failure" })
test.skip(!process.env.E2E_PILOT_FILE, "Set E2E_PILOT_FILE to the private local pilot credentials.")

test("Piloto local: login real y acceso a órdenes/configuración WhatsApp", async ({ page }) => {
  const pilot = JSON.parse(readFileSync(process.env.E2E_PILOT_FILE!, "utf8").replace(/^\uFEFF/, "")) as {
    tenantPublicId: string
    tenantEmail: string
    tenantPassword: string
    branchId: string
  }
  await page.addInitScript(
    ({ tenantId, branchId }) => {
      localStorage.setItem("business.orders.branchId", branchId)
      if (localStorage.getItem("pos-manager-storage")) return
      localStorage.setItem(
        "pos-manager-storage",
        JSON.stringify({
          state: { session: null, locale: "es", onboardingCompleted: { [tenantId]: true } },
          version: 0,
        })
      )
    },
    { tenantId: pilot.tenantPublicId, branchId: pilot.branchId }
  )
  await page.goto("/login")
  await expect(page.getByLabel("Public ID del tenant (GUID)")).toHaveValue("")
  await page.getByLabel("Public ID del tenant (GUID)").fill(pilot.tenantPublicId)
  await page.getByRole("textbox", { name: /email|correo/i }).fill(pilot.tenantEmail)
  await page.getByLabel("Contraseña", { exact: true }).fill(pilot.tenantPassword)
  await page.getByRole("button", { name: "Continuar como Administrador de Negocio", exact: true }).click()
  await expect(page).toHaveURL(/\/business\//)
  await page.goto("/business/orders")
  await expect(page.getByRole("searchbox")).toBeVisible()
  await page.goto(`/business/branches/${pilot.branchId}/config`)
  await expect(page.getByText("Canal WhatsApp (Evolution API)", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Guardar configuración WhatsApp", exact: true })).toBeVisible()
})
