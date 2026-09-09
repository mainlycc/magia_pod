import { describe, expect, it } from "@jest/globals"
import { filterActiveParticipants, isParticipantActive } from "@/lib/participants/active"

describe("isParticipantActive", () => {
  it("traktuje brak flagi jako aktywnego", () => {
    expect(isParticipantActive({})).toBe(true)
    expect(isParticipantActive({ is_active: null })).toBe(true)
    expect(isParticipantActive({ is_active: undefined })).toBe(true)
    expect(isParticipantActive(null)).toBe(true)
  })

  it("respektuje is_active=false", () => {
    expect(isParticipantActive({ is_active: false })).toBe(false)
    expect(isParticipantActive({ is_active: true })).toBe(true)
  })
})

describe("filterActiveParticipants", () => {
  it("odfiltrowuje wyłączonych", () => {
    const list = [
      { id: "1", is_active: true },
      { id: "2", is_active: false },
      { id: "3" },
    ]
    expect(filterActiveParticipants(list).map((p) => p.id)).toEqual(["1", "3"])
  })
})
