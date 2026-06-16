import {
  extractPurchasedInsuranceTypes,
  resolveOwuTypesToAttach,
} from "@/lib/insurance-local/owu-email-attachments"

describe("extractPurchasedInsuranceTypes", () => {
  it("zwraca typy wykupionych ubezpieczeń bez anulowanych", () => {
    const types = extractPurchasedInsuranceTypes([
      {
        status: "purchased",
        trip_insurance_variants: { insurance_variants: { type: 2 } },
      },
      {
        status: "confirmed",
        trip_insurance_variants: { insurance_variants: { type: 3 } },
      },
      {
        status: "cancelled",
        trip_insurance_variants: { insurance_variants: { type: 1 } },
      },
    ])

    expect(types).toEqual([2, 3])
  })

  it("zwraca pustą tablicę gdy brak aktywnych ubezpieczeń", () => {
    expect(extractPurchasedInsuranceTypes([])).toEqual([])
    expect(
      extractPurchasedInsuranceTypes([
        {
          status: "cancelled",
          trip_insurance_variants: { insurance_variants: { type: 2 } },
        },
      ]),
    ).toEqual([])
  })
})

describe("resolveOwuTypesToAttach", () => {
  const doc2 = {
    insurance_type: 2,
    file_name: "insurance-owu/trip/type-2.pdf",
    display_name: "OWU Typ 2",
  }
  const doc3 = {
    insurance_type: 3,
    file_name: "insurance-owu/trip/type-3.pdf",
    display_name: "OWU Typ 3",
  }

  it("nie zwraca OWU gdy klient nie wykupił ubezpieczenia", () => {
    const result = resolveOwuTypesToAttach({
      purchasedTypes: [],
      documentsByType: new Map([
        [2, doc2],
        [3, doc3],
      ]),
      attachSettings: new Map([
        [2, true],
        [3, true],
      ]),
    })

    expect(result).toEqual([])
  })

  it("zwraca OWU tylko dla wykupionych typów z włączoną wysyłką i istniejącym plikiem", () => {
    const result = resolveOwuTypesToAttach({
      purchasedTypes: [2, 3],
      documentsByType: new Map([[2, doc2]]),
      attachSettings: new Map([
        [2, true],
        [3, true],
      ]),
    })

    expect(result).toEqual([2])
  })

  it("pomija typ gdy wysyłka po rezerwacji jest wyłączona", () => {
    const result = resolveOwuTypesToAttach({
      purchasedTypes: [2],
      documentsByType: new Map([[2, doc2]]),
      attachSettings: new Map([[2, false]]),
    })

    expect(result).toEqual([])
  })

  it("domyślnie włącza wysyłkę gdy brak ustawienia w bazie", () => {
    const result = resolveOwuTypesToAttach({
      purchasedTypes: [2],
      documentsByType: new Map([[2, doc2]]),
      attachSettings: new Map(),
    })

    expect(result).toEqual([2])
  })
})
