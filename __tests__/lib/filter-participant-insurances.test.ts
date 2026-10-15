import { describe, expect, it } from "@jest/globals"
import { shouldIncludeParticipantInsurance } from "@/lib/insurance-local/filter-participant-insurances"

describe("shouldIncludeParticipantInsurance", () => {
  it("odrzuca orphan bez uczestnika", () => {
    expect(shouldIncludeParticipantInsurance(null)).toBe(false)
  })

  it("odrzuca wpis bez id uczestnika", () => {
    expect(shouldIncludeParticipantInsurance({ is_active: true })).toBe(false)
  })

  it("odrzuca wyłączonego uczestnika", () => {
    expect(shouldIncludeParticipantInsurance({ id: "p1", is_active: false })).toBe(false)
  })

  it("przyjmuje aktywnego uczestnika", () => {
    expect(shouldIncludeParticipantInsurance({ id: "p1", is_active: true })).toBe(true)
    expect(shouldIncludeParticipantInsurance({ id: "p1" })).toBe(true)
  })

  it("obsługuje tablicę z joinów Supabase", () => {
    expect(shouldIncludeParticipantInsurance([{ id: "p1", is_active: false }])).toBe(false)
    expect(shouldIncludeParticipantInsurance([{ id: "p1", is_active: true }])).toBe(true)
  })
})
