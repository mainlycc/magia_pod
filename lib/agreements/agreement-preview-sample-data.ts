/** Przykładowe dane formularza do podglądu umowy (panel koordynatora / ?podglad=1 na reserve). */

export const AGREEMENT_PREVIEW_SAMPLE_CONTACT = {
  first_name: "Jan",
  last_name: "Kowalski",
  email: "jan.kowalski@example.com",
  phone: "+48600111222",
  pesel: "90010112345",
  address: {
    street: "ul. Testowa 1",
    city: "Warszawa",
    zip: "00-001",
  },
} as const;

export const AGREEMENT_PREVIEW_SAMPLE_PARTICIPANT = {
  first_name: "Anna",
  last_name: "Kowalska",
  birth_date: "1990-01-01",
  email: "",
  phone: "",
  document_type: "ID" as const,
  document_number: "",
};

export const AGREEMENT_PREVIEW_SAMPLE_COMPANY = {
  name: "Przykładowa Firma Sp. z o.o.",
  nip: "1234567890",
  address: {
    street: "ul. Biznesowa 10",
    city: "Poznań",
    zip: "60-001",
  },
  has_representative: false,
  representative_first_name: "",
  representative_last_name: "",
};

export function getAgreementPreviewSampleFormDataIndividual() {
  return {
    contact: { ...AGREEMENT_PREVIEW_SAMPLE_CONTACT },
    participants: [{ ...AGREEMENT_PREVIEW_SAMPLE_PARTICIPANT }],
    participants_count: 1,
  };
}

export function getAgreementPreviewSampleFormDataCompany() {
  return {
    contact: { ...AGREEMENT_PREVIEW_SAMPLE_CONTACT },
    company: { ...AGREEMENT_PREVIEW_SAMPLE_COMPANY },
    participants: [{ ...AGREEMENT_PREVIEW_SAMPLE_PARTICIPANT }],
    participants_count: 3,
  };
}

/** Wartości domyślne formularza rezerwacji w trybie ?podglad=1 */
export function getBookingFormPreviewDefaults() {
  return {
    applicant_type: "individual" as const,
    contact: { ...AGREEMENT_PREVIEW_SAMPLE_CONTACT },
    company: {
      name: "",
      nip: "",
      address: { street: "", city: "", zip: "" },
      has_representative: false,
      representative_first_name: "",
      representative_last_name: "",
    },
    participants: [{ ...AGREEMENT_PREVIEW_SAMPLE_PARTICIPANT }],
    participants_count: undefined,
    participant_services: [],
    consents: {
      rodo: true,
      terms: true,
      conditions: true,
      agreement_consent: true,
      conditions_de_pl_consent: true,
      standard_form_consent: true,
      electronic_services_consent: true,
      rodo_info_consent: true,
      insurance_terms_consent: true,
      insurance_data_consent: true,
      insurance_other_person_consent: true,
    },
  };
}
