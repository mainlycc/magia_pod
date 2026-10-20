import { describe, expect, it } from "@jest/globals"
import {
  isCompletedTrip,
  isPastTrip,
  shouldAutoCompleteTrip,
} from "@/lib/trips/trip-lifecycle"

describe("isPastTrip", () => {
  it("używa end_date jeśli jest", () => {
    const now = new Date("2026-06-15T12:00:00")
    expect(
      isPastTrip({ start_date: "2026-06-01", end_date: "2026-06-10" }, now),
    ).toBe(true)
    expect(
      isPastTrip({ start_date: "2026-06-01", end_date: "2026-06-20" }, now),
    ).toBe(false)
  })

  it("fallback do start_date gdy brak end_date", () => {
    const now = new Date("2026-06-15T12:00:00")
    expect(isPastTrip({ start_date: "2026-06-10", end_date: null }, now)).toBe(
      true,
    )
    expect(isPastTrip({ start_date: "2026-06-20", end_date: null }, now)).toBe(
      false,
    )
  })

  it("tego samego dnia jeszcze nie uznaje za minioną", () => {
    const now = new Date("2026-06-15T12:00:00")
    expect(isPastTrip({ end_date: "2026-06-15" }, now)).toBe(false)
  })

  it("zwraca false gdy brak dat", () => {
    expect(isPastTrip({ start_date: null, end_date: null })).toBe(false)
  })
})

describe("isCompletedTrip", () => {
  const now = new Date("2026-06-15T12:00:00")

  it("to nieaktywna z minioną datą", () => {
    expect(
      isCompletedTrip(
        { is_active: false, end_date: "2026-06-01" },
        now,
      ),
    ).toBe(true)
  })

  it("aktywna z minioną datą jeszcze nie jest zrealizowaną", () => {
    expect(
      isCompletedTrip({ is_active: true, end_date: "2026-06-01" }, now),
    ).toBe(false)
  })

  it("nieaktywna przyszła to nie zrealizowana", () => {
    expect(
      isCompletedTrip({ is_active: false, end_date: "2026-07-01" }, now),
    ).toBe(false)
  })
})

describe("shouldAutoCompleteTrip", () => {
  const now = new Date("2026-06-15T12:00:00")

  it("true tylko dla aktywnych z minioną datą", () => {
    expect(
      shouldAutoCompleteTrip(
        { is_active: true, end_date: "2026-06-01" },
        now,
      ),
    ).toBe(true)
  })

  it("false dla już nieaktywnych", () => {
    expect(
      shouldAutoCompleteTrip(
        { is_active: false, end_date: "2026-06-01" },
        now,
      ),
    ).toBe(false)
  })

  it("false dla aktywnych przyszłych", () => {
    expect(
      shouldAutoCompleteTrip(
        { is_active: true, end_date: "2026-07-01" },
        now,
      ),
    ).toBe(false)
  })
})
