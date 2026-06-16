import { describe, expect, it } from "@jest/globals";
import {
  buildParticipantServicesFromCatalog,
  formatSelectedServicesPerParticipant,
} from "@/lib/resolve-participant-service-titles";

describe("buildParticipantServicesFromCatalog", () => {
  const catalogs = {
    form_diets: [
      { id: "diet-1", title: "Dieta wegetariańska", variants: [{ id: "v1", title: "Wariant A" }] },
    ],
    form_extra_insurances: [{ id: "ins-1", title: "Ubezpieczenie rozszerzone" }],
    form_additional_attractions: [{ id: "attr-1", title: "Rejs statkiem" }],
  };

  it("rozwiązuje tytuły usług po service_id", () => {
    const participants = [
      {
        selected_services: {
          diets: [{ service_id: "diet-1", variant_id: "v1" }],
          insurances: [{ service_id: "ins-1" }],
          attractions: [{ service_id: "attr-1", include_in_contract: true }],
        },
      },
    ];

    const out = buildParticipantServicesFromCatalog(participants, catalogs);

    expect(out.map((s) => s.service_title)).toEqual([
      "Wariant A",
      "Ubezpieczenie rozszerzone",
      "Rejs statkiem",
    ]);
  });

  it("pomija atrakcje z include_in_contract=false", () => {
    const participants = [
      {
        selected_services: {
          attractions: [{ service_id: "attr-1", include_in_contract: false }],
        },
      },
    ];

    const out = buildParticipantServicesFromCatalog(participants, catalogs);
    expect(out).toHaveLength(0);
  });
});

describe("formatSelectedServicesPerParticipant", () => {
  const catalogs = {
    form_diets: [
      { id: "diet-veg", title: "Dieta wegetariańska" },
      { id: "diet-std", title: "Dieta zwykła" },
    ],
    form_extra_insurances: [
      { id: "ins-2", title: "Dodatkowe ubezpieczenie typ 2" },
      { id: "ins-3", title: "Dodatkowe ubezpieczenie typ 3" },
    ],
    form_additional_attractions: [{ id: "attr-ship", title: "Rejs statkiem" }],
  };

  it("grupuje usługi per uczestnik bez mieszania", () => {
    const participants = [
      {
        selected_services: {
          diets: [{ service_id: "diet-veg", price_cents: 0 }],
          insurances: [{ service_id: "ins-2", price_cents: 15000 }],
          attractions: [{ service_id: "attr-ship", price_cents: 20000, include_in_contract: true }],
        },
      },
      {
        selected_services: {
          diets: [{ service_id: "diet-std", price_cents: null }],
          insurances: [{ service_id: "ins-3", price_cents: 18000 }],
          attractions: [{ service_id: "attr-ship", price_cents: 20000, include_in_contract: true }],
        },
      },
    ];

    const text = formatSelectedServicesPerParticipant(participants, catalogs);

    expect(text).toContain("Uczestnik 1");
    expect(text).toContain("Dieta wegetariańska - bezpłatna");
    expect(text).toContain("Dodatkowe ubezpieczenie typ 2 - 150.00 zł");
    expect(text).toContain("Rejs statkiem - 200.00 zł");
    expect(text).toContain("Uczestnik 2");
    expect(text).toContain("Dieta zwykła - bezpłatna");
    expect(text).toContain("Dodatkowe ubezpieczenie typ 3 - 180.00 zł");
    const section1 = text.split("Uczestnik 2")[0];
    expect(section1).toContain("Dodatkowe ubezpieczenie typ 2 - 150.00 zł");
    expect(section1).not.toContain("typ 3");
  });

  it("zwraca brak gdy żaden uczestnik nie ma usług", () => {
    const participants = [{ selected_services: {} }, { selected_services: undefined }];
    expect(formatSelectedServicesPerParticipant(participants, catalogs)).toBe("brak");
  });

  it("pokazuje nagłówek uczestnika bez usług gdy inni mają usługi", () => {
    const participants = [
      {
        selected_services: {
          diets: [{ service_id: "diet-veg", price_cents: 0 }],
        },
      },
      { selected_services: {} },
    ];

    const text = formatSelectedServicesPerParticipant(participants, catalogs);
    expect(text).toContain("Uczestnik 1\nDieta wegetariańska - bezpłatna");
    expect(text).toContain("Uczestnik 2");
  });

  it("pomija atrakcje z include_in_contract=false", () => {
    const participants = [
      {
        selected_services: {
          attractions: [{ service_id: "attr-ship", price_cents: 20000, include_in_contract: false }],
        },
      },
    ];

    expect(formatSelectedServicesPerParticipant(participants, catalogs)).toBe("brak");
  });
});
