import { describe, expect, it } from "vitest"
import { analyzePhone, isFormPhoneValid, normalizePhoneForSave, toCountryCode } from "../phone"

describe("analyzePhone", () => {
  it("interpreta números nacionales con el país del negocio", () => {
    expect(analyzePhone("300 123 4567", "CO")).toMatchObject({
      e164: "+573001234567",
      valid: true,
      country: "CO",
      nationalNumber: "3001234567",
      type: "MOBILE",
    })
    expect(analyzePhone("55 1234 5678", "MX").e164).toBe("+525512345678")
  })

  it("respeta el indicativo escrito aunque el negocio sea de otro país", () => {
    expect(analyzePhone("+52 55 1234 5678", "CO")).toMatchObject({ e164: "+525512345678", country: "MX" })
    expect(analyzePhone("0057 300 123 4567", "MX").e164).toBe("+573001234567")
  })

  it("acepta dígitos que ya traen el indicativo", () => {
    expect(analyzePhone("573001234567", "CO").e164).toBe("+573001234567")
  })

  it("marca inválidos los números incompletos o vacíos", () => {
    expect(analyzePhone("300 12", "CO").valid).toBe(false)
    expect(analyzePhone("", "CO")).toMatchObject({ e164: null, valid: false })
  })

  it("detecta teléfonos fijos", () => {
    expect(analyzePhone("601 234 5678", "CO").type).toBe("FIXED_LINE")
  })
})

describe("normalizePhoneForSave / isFormPhoneValid", () => {
  it("guarda en E.164 solo si el número es válido", () => {
    expect(normalizePhoneForSave("300 123 4567", "CO")).toBe("+573001234567")
    expect(normalizePhoneForSave("abc", "CO")).toBe("abc")
  })

  it("permite vacío y registros antiguos colombianos sin indicativo", () => {
    expect(isFormPhoneValid(null)).toBe(true)
    expect(isFormPhoneValid("")).toBe(true)
    expect(isFormPhoneValid("3001234567")).toBe(true)
    expect(isFormPhoneValid("+525512345678")).toBe(true)
    expect(isFormPhoneValid("123")).toBe(false)
  })
})

describe("toCountryCode", () => {
  it("usa Colombia cuando el país no es válido", () => {
    expect(toCountryCode("mx")).toBe("MX")
    expect(toCountryCode(null)).toBe("CO")
    expect(toCountryCode("ZZ")).toBe("CO")
  })
})
