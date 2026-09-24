import { describe, it, expect } from "@jest/globals"
import {
  normalizePersonName,
  normalizeBookingPersonNames,
} from "@/lib/names/normalize-person-name"

describe("normalizePersonName", () => {
  it("sprowadza CAPS do formy normalnej", () => {
    expect(normalizePersonName("JOANNA")).toBe("Joanna")
    expect(normalizePersonName("GANCARZ")).toBe("Gancarz")
    expect(normalizePersonName("KLAUDIA")).toBe("Klaudia")
  })

  it("obsługuje polskie znaki", () => {
    expect(normalizePersonName("ŁUKASZ")).toBe("Łukasz")
    expect(normalizePersonName("ŚWIĄTEK")).toBe("Świątek")
    expect(normalizePersonName("ZAZIĘBSKA")).toBe("Zaziębska")
  })

  it("obsługuje myślniki i apostrofy", () => {
    expect(normalizePersonName("ANNA-MARIA")).toBe("Anna-Maria")
    expect(normalizePersonName("O'BRIEN")).toBe("O'Brien")
  })

  it("sprowadza całe małe litery", () => {
    expect(normalizePersonName("joanna")).toBe("Joanna")
  })

  it("nie rusza mieszanego zapisu", () => {
    expect(normalizePersonName("McDonald")).toBe("McDonald")
    expect(normalizePersonName("Joanna")).toBe("Joanna")
    expect(normalizePersonName("Anna-Maria")).toBe("Anna-Maria")
  })

  it("trimuje i scala spacje", () => {
    expect(normalizePersonName("  JOANNA  ")).toBe("Joanna")
    expect(normalizePersonName("JAN   KOWALSKI")).toBe("Jan Kowalski")
  })
})

describe("normalizeBookingPersonNames", () => {
  it("normalizuje kontakt i uczestników", () => {
    const result = normalizeBookingPersonNames({
      contact_first_name: "JOANNA",
      contact_last_name: "GANCARZ",
      participants: [
        { first_name: "KLAUDIA", last_name: "GANCARZ" },
        { first_name: "Jan", last_name: "Kowalski" },
      ],
    })

    expect(result.contact_first_name).toBe("Joanna")
    expect(result.contact_last_name).toBe("Gancarz")
    expect(result.participants[0]).toMatchObject({
      first_name: "Klaudia",
      last_name: "Gancarz",
    })
    expect(result.participants[1]).toMatchObject({
      first_name: "Jan",
      last_name: "Kowalski",
    })
  })
})
