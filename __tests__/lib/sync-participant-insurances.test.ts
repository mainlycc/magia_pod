import {
  buildParticipantInsuranceRows,
  parseSelectedInsurancesForSync,
  tripInsuranceVariantIdFromServiceId,
} from "@/lib/insurance-local/sync-participant-insurances"
import { SYNCED_INSURANCE_ID_PREFIX } from "@/lib/insurance-local/sync-form-extra-insurances"

const TRIP_VARIANT_ID = "77777777-8888-9999-0000-000000000012"
const BOOKING_ID = "22222222-3333-4444-5555-666666666612"
const PARTICIPANT_ID = "33333333-4444-5555-6666-777777777713"

describe("tripInsuranceVariantIdFromServiceId", () => {
  it("parsuje service_id zsynchronizowanego z modułu ubezpieczeń", () => {
    expect(
      tripInsuranceVariantIdFromServiceId(`${SYNCED_INSURANCE_ID_PREFIX}${TRIP_VARIANT_ID}`),
    ).toBe(TRIP_VARIANT_ID)
  })

  it("zwraca null dla pozycji manualnej bez prefiksu local-ins:", () => {
    expect(tripInsuranceVariantIdFromServiceId("manual-insurance-uuid")).toBeNull()
    expect(tripInsuranceVariantIdFromServiceId("")).toBeNull()
    expect(tripInsuranceVariantIdFromServiceId(`${SYNCED_INSURANCE_ID_PREFIX} `)).toBeNull()
  })
})

describe("parseSelectedInsurancesForSync", () => {
  it("wyciąga tablicę insurances z selected_services", () => {
    const selected = {
      insurances: [
        { service_id: `${SYNCED_INSURANCE_ID_PREFIX}${TRIP_VARIANT_ID}`, price_cents: 9900 },
      ],
      diets: [{ service_id: "diet-1" }],
    }
    expect(parseSelectedInsurancesForSync(selected)).toEqual([
      { service_id: `${SYNCED_INSURANCE_ID_PREFIX}${TRIP_VARIANT_ID}`, price_cents: 9900 },
    ])
  })

  it("zwraca pustą tablicę gdy brak ubezpieczeń", () => {
    expect(parseSelectedInsurancesForSync(null)).toEqual([])
    expect(parseSelectedInsurancesForSync({ diets: [] })).toEqual([])
    expect(parseSelectedInsurancesForSync({ insurances: "invalid" })).toEqual([])
  })
})

describe("buildParticipantInsuranceRows", () => {
  it("mapuje selected_services na wiersze participant_insurances", () => {
    const rows = buildParticipantInsuranceRows({
      id: PARTICIPANT_ID,
      booking_id: BOOKING_ID,
      selected_services: {
        insurances: [
          { service_id: `${SYNCED_INSURANCE_ID_PREFIX}${TRIP_VARIANT_ID}`, price_cents: 9900 },
          { service_id: "manual-only-id", price_cents: 5000 },
        ],
      },
    })

    expect(rows).toEqual([
      {
        booking_id: BOOKING_ID,
        participant_id: PARTICIPANT_ID,
        trip_insurance_variant_id: TRIP_VARIANT_ID,
      },
    ])
  })

  it("deduplikuje ten sam wariant ubezpieczenia", () => {
    const serviceId = `${SYNCED_INSURANCE_ID_PREFIX}${TRIP_VARIANT_ID}`
    const rows = buildParticipantInsuranceRows({
      id: PARTICIPANT_ID,
      booking_id: BOOKING_ID,
      selected_services: {
        insurances: [
          { service_id: serviceId },
          { service_id: serviceId },
        ],
      },
    })

    expect(rows).toHaveLength(1)
  })

  it("zwraca pustą listę gdy brak booking_id", () => {
    expect(
      buildParticipantInsuranceRows({
        id: PARTICIPANT_ID,
        booking_id: null,
        selected_services: {
          insurances: [{ service_id: `${SYNCED_INSURANCE_ID_PREFIX}${TRIP_VARIANT_ID}` }],
        },
      }),
    ).toEqual([])
  })

  it("zwraca pustą listę gdy usunięto wszystkie ubezpieczenia z selected_services", () => {
    expect(
      buildParticipantInsuranceRows({
        id: PARTICIPANT_ID,
        booking_id: BOOKING_ID,
        selected_services: {},
      }),
    ).toEqual([])
  })
})
