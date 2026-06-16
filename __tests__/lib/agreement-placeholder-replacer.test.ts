import { replaceBookingPlaceholders } from "@/lib/agreement-placeholder-replacer";

describe("replaceBookingPlaceholders — ceny z dopłatami", () => {
  it("uwzględnia addonTotalCents w trip_total_price i trip_deposit_amount", () => {
    const html = "{{trip_total_price}} {{trip_deposit_amount}}";
    const formData = {
      participants_count: 2,
      participants: [],
    };
    const tripPriceCents = 10000; // 100 PLN/os.
    const addonTotalCents = 5000; // 50 PLN łącznie dopłat
    // total = 20000 + 5000 = 25000 gr => 250.00 PLN; zaliczka 30% => 7500 gr => 75.00 PLN
    const out = replaceBookingPlaceholders(
      html,
      formData,
      tripPriceCents,
      null,
      addonTotalCents,
    );
    expect(out).toBe("250.00 75.00");
  });

  it("bez dopłat zachowuje dotychczasowe liczenie (tylko baza × osoby)", () => {
    const html = "{{trip_total_price}} {{trip_deposit_amount}}";
    const formData = { participants_count: 2, participants: [] };
    const tripPriceCents = 10000;
    const out = replaceBookingPlaceholders(html, formData, tripPriceCents, null);
    expect(out).toBe("200.00 60.00");
  });
});

describe("replaceBookingPlaceholders — widoczność pól kontaktu (wiersze <tr>)", () => {
  const baseHtml = `
    <table>
      <tr><td>Imię Nazwisko:</td><td>{{contact_full_name}}</td></tr>
      <tr><td>Adres:</td><td>{{contact_address}}</td></tr>
      <tr><td>Ulica:</td><td>{{contact_street}}</td></tr>
      <tr><td>Miasto:</td><td>{{contact_city}}</td></tr>
      <tr><td>Kod:</td><td>{{contact_zip}}</td></tr>
      <tr><td>PESEL:</td><td>{{contact_pesel}}</td></tr>
      <tr><td>Telefon:</td><td>{{contact_phone}}</td></tr>
      <tr><td>E-mail:</td><td>{{contact_email}}</td></tr>
    </table>
  `;

  const formData = {
    contact: {
      first_name: "Jan",
      last_name: "Kowalski",
      email: "jan@example.com",
      phone: "123",
      pesel: "90010112345",
      address: { street: "Test 1", city: "Poznań", zip: "00-001" },
    },
    participants: [],
    participants_count: 1,
  };

  it("usuwa wiersz PESEL gdy pole nie jest zbierane (pesel=false, fallback require_pesel=true)", () => {
    const out = replaceBookingPlaceholders(baseHtml, formData, null, null, null, {
      requiredContactFields: { pesel: false, email: true, phone: true, address: true },
      requirePeselFallback: true,
    });
    expect(out).not.toContain("PESEL:");
    expect(out).toContain("Telefon:");
    expect(out).toContain(">123<");
    expect(out).toContain("E-mail:");
    expect(out).toContain(">jan@example.com<");
  });

  it("usuwa wiersze e-mail i telefon gdy pola nie są zbierane (email=false, phone=false)", () => {
    const out = replaceBookingPlaceholders(baseHtml, formData, null, null, null, {
      requiredContactFields: { pesel: true, email: false, phone: false, address: true },
      requirePeselFallback: true,
    });
    expect(out).not.toContain("E-mail:");
    expect(out).not.toContain("Telefon:");
    expect(out).toContain("PESEL:");
    expect(out).toContain(">90010112345<");
  });

  it("usuwa wszystkie wiersze adresu gdy adres nie jest zbierany (address=false)", () => {
    const out = replaceBookingPlaceholders(baseHtml, formData, null, null, null, {
      requiredContactFields: { pesel: true, email: true, phone: true, address: false },
      requirePeselFallback: true,
    });
    expect(out).not.toContain("Adres:");
    expect(out).not.toContain("Ulica:");
    expect(out).not.toContain("Miasto:");
    expect(out).not.toContain("Kod:");
    expect(out).toContain("PESEL:");
    expect(out).toContain(">90010112345<");
  });
});

describe("replaceBookingPlaceholders — selected_services per uczestnik", () => {
  const catalogs = {
    form_diets: [{ id: "diet-1", title: "Dieta wegetariańska" }],
    form_extra_insurances: [
      { id: "ins-2", title: "Ubezpieczenie typ 2" },
      { id: "ins-3", title: "Ubezpieczenie typ 3" },
    ],
    form_additional_attractions: [],
  };

  it("podstawia usługi pogrupowane per uczestnik z <br>", () => {
    const html = "<td>{{selected_services}}</td>";
    const formData = {
      participants: [
        {
          first_name: "Jan",
          last_name: "Kowalski",
          selected_services: {
            diets: [{ service_id: "diet-1", price_cents: 0 }],
            insurances: [{ service_id: "ins-2", price_cents: 10000 }],
          },
        },
        {
          first_name: "Anna",
          last_name: "Nowak",
          selected_services: {
            insurances: [{ service_id: "ins-3", price_cents: 12000 }],
          },
        },
      ],
      service_catalogs: catalogs,
    };

    const out = replaceBookingPlaceholders(html, formData, null, null);
    expect(out).toContain("Uczestnik 1<br>");
    expect(out).toContain("Dieta wegetariańska - bezpłatna<br>");
    expect(out).toContain("Ubezpieczenie typ 2 - 100.00 zł");
    expect(out).toContain("Uczestnik 2<br>");
    expect(out).toContain("Ubezpieczenie typ 3 - 120.00 zł");
  });

  it("podstawia brak gdy nie ma usług", () => {
    const html = "{{selected_services}}";
    const formData = {
      participants: [{ first_name: "Jan", last_name: "Kowalski", selected_services: {} }],
      service_catalogs: catalogs,
    };
    const out = replaceBookingPlaceholders(html, formData, null, null);
    expect(out).toBe("brak");
  });
});
