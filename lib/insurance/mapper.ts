/**
 * Funkcje mapujące dane z systemu do formatu HDI API
 */

import {
  ParticipantData,
  TripData,
  HdiPerson,
  HdiAddress,
  HdiOfferResponse,
  HdiRegisterResponse,
  HdiIssueResponse,
  HdiPolicyResponse,
  InsuranceSubmission,
} from './types';

/**
 * Mapuje uczestnika do formatu HDI
 */
export function mapParticipantToHdi(
  participant: ParticipantData,
  order: number,
  roles: string[] = ['INSURED']
): HdiPerson {
  const hdiPerson: HdiPerson = {
    order,
    roles: roles.map((code) => ({ code })),
    typeCode: 'INDIVIDUAL',
  };

  if (participant.first_name) {
    hdiPerson.name = participant.first_name;
  }

  if (participant.last_name) {
    hdiPerson.surname = participant.last_name;
  }

  if (participant.birth_date) {
    // Konwertuj datę urodzenia do formatu ISO (YYYY-MM-DD)
    const birthDate = new Date(participant.birth_date);
    if (!isNaN(birthDate.getTime())) {
      hdiPerson.dateOfBirth = birthDate.toISOString().split('T')[0];
    }
  }

  if (participant.citizenship_code) {
    hdiPerson.citizenshipCode = participant.citizenship_code;
  } else {
    // Domyślnie PL jeśli nie podano
    hdiPerson.citizenshipCode = 'PL';
  }

  if (participant.gender_code) {
    hdiPerson.genderCode = participant.gender_code;
  }

  if (participant.email) {
    hdiPerson.email = participant.email;
  }

  if (participant.phone) {
    hdiPerson.phone = participant.phone;
  }

  // PESEL jako personalId
  if (participant.pesel) {
    hdiPerson.personalIdTypeCode = 'PESEL';
    hdiPerson.personalId = participant.pesel;
  }

  // Dokument tożsamości
  if (participant.document_type && participant.document_number) {
    hdiPerson.documentTypeCode = participant.document_type;
    hdiPerson.documentNumber = participant.document_number;
  }

  // Adres
  if (participant.address) {
    const addresses: HdiAddress[] = [];
    const address: HdiAddress = {
      addressTypeCode: 'Residence',
      countryCode: participant.address.country || 'PL',
      city: participant.address.city || '',
      zipCode: participant.address.zip || '',
    };

    if (participant.address.street) {
      // Próba podziału ulicy na street i houseNumber
      const streetMatch = participant.address.street.match(/^(.+?)\s+(\d+[a-zA-Z]?)$/);
      if (streetMatch) {
        address.street = streetMatch[1];
        address.houseNumber = streetMatch[2];
      } else {
        address.street = participant.address.street;
      }
    }

    addresses.push(address);
    hdiPerson.addresses = addresses;
  }

  return hdiPerson;
}

/**
 * Mapuje wycieczkę do parametrów HDI
 */
export function mapTripToHdiParameters(trip: TripData): Array<{ code: string; value: string; type: string }> {
  const parameters: Array<{ code: string; value: string; type: string }> = [];

  if (trip.location) {
    // Próba określenia regionu na podstawie lokalizacji
    // Można rozszerzyć o bardziej zaawansowaną logikę
    const region = determineRegion(trip.location);
    if (region) {
      parameters.push({
        code: 'DESTINATION_REGION',
        value: region,
        type: 'string',
      });
    }
  }

  if (trip.category) {
    parameters.push({
      code: 'TRIP_CATEGORY',
      value: trip.category,
      type: 'string',
    });
  }

  return parameters;
}

/**
 * Określa region na podstawie lokalizacji (uproszczona wersja)
 */
function determineRegion(location: string): string | null {
  const locationUpper = location.toUpperCase();

  // Europa
  if (
    locationUpper.includes('EUROPA') ||
    locationUpper.includes('EUROPE') ||
    locationUpper.includes('FRANCJA') ||
    locationUpper.includes('FRANCE') ||
    locationUpper.includes('HISZPANIA') ||
    locationUpper.includes('SPAIN') ||
    locationUpper.includes('WŁOCHY') ||
    locationUpper.includes('ITALY') ||
    locationUpper.includes('NIEMCY') ||
    locationUpper.includes('GERMANY') ||
    locationUpper.includes('GRECJA') ||
    locationUpper.includes('GREECE')
  ) {
    return 'EUROPE';
  }

  // Azja
  if (
    locationUpper.includes('AZJA') ||
    locationUpper.includes('ASIA') ||
    locationUpper.includes('TAJLANDIA') ||
    locationUpper.includes('THAILAND') ||
    locationUpper.includes('JAPONIA') ||
    locationUpper.includes('JAPAN') ||
    locationUpper.includes('CHINY') ||
    locationUpper.includes('CHINA')
  ) {
    return 'ASIA';
  }

  // Ameryka Północna
  if (
    locationUpper.includes('AMERYKA') ||
    locationUpper.includes('AMERICA') ||
    locationUpper.includes('USA') ||
    locationUpper.includes('KANADA') ||
    locationUpper.includes('CANADA')
  ) {
    return 'NORTH_AMERICA';
  }

  // Ameryka Południowa
  if (
    locationUpper.includes('BRAZYLIA') ||
    locationUpper.includes('BRAZIL') ||
    locationUpper.includes('ARGENTYNA') ||
    locationUpper.includes('ARGENTINA')
  ) {
    return 'SOUTH_AMERICA';
  }

  // Afryka
  if (
    locationUpper.includes('AFRYKA') ||
    locationUpper.includes('AFRICA') ||
    locationUpper.includes('EGIPT') ||
    locationUpper.includes('EGYPT')
  ) {
    return 'AFRICA';
  }

  // Domyślnie Europa
  return 'EUROPE';
}

/**
 * Mapuje odpowiedź calculate do batch
 */
export function mapHdiOfferToBatch(
  hdiResponse: HdiOfferResponse,
  batch: InsuranceSubmission
): Partial<InsuranceSubmission> {
  return {
    external_offer_id: hdiResponse.offerID,
    status: 'calculating',
    api_response: hdiResponse,
  };
}

/**
 * Mapuje odpowiedź register do batch
 */
export function mapHdiRegisterToBatch(
  hdiResponse: HdiRegisterResponse,
  batch: InsuranceSubmission
): Partial<InsuranceSubmission> {
  return {
    external_offer_id: hdiResponse.offerID,
    status: 'registered',
    api_response: hdiResponse,
  };
}

/**
 * Mapuje odpowiedź issue do batch
 */
export function mapHdiIssueToBatch(
  hdiResponse: HdiIssueResponse,
  batch: InsuranceSubmission
): Partial<InsuranceSubmission> {
  return {
    external_policy_id: hdiResponse.policyId,
    external_policy_number: hdiResponse.policyNumber,
    policy_number: hdiResponse.policyNumber,
    status: 'issued',
    policy_status_code: 'NEW', // Status początkowy przed płatnością
    api_response: hdiResponse,
  };
}

/**
 * Mapuje odpowiedź policy do batch
 */
export function mapHdiPolicyToBatch(
  hdiResponse: HdiPolicyResponse,
  batch: InsuranceSubmission
): Partial<InsuranceSubmission> {
  return {
    external_policy_id: hdiResponse.policyID,
    external_policy_number: hdiResponse.policyNumber,
    policy_number: hdiResponse.policyNumber,
    policy_status_code: hdiResponse.policyStatusCode,
    status: mapPolicyStatusToBatchStatus(hdiResponse.policyStatusCode),
    api_response: hdiResponse,
  };
}

/**
 * Mapuje status polisy HDI do statusu batch
 */
function mapPolicyStatusToBatchStatus(policyStatusCode: string): InsuranceSubmission['status'] {
  switch (policyStatusCode) {
    case 'ACTIVE':
      return 'accepted';
    case 'NEW':
    case 'PENDING':
      return 'issued';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'issued';
  }
}

/**
 * Przygotowuje payload dla calculate/all/schemas
 */
export function buildCalculatePayload(
  productCode: string,
  variantCode: string | undefined,
  validFrom: string,
  validTo: string,
  participants: HdiPerson[],
  tripParameters: Array<{ code: string; value: string; type: string }>,
  languageCode: string = 'PL'
): any {
  const payload: any = {
    productCode,
    validFrom,
    validTo,
    languageCode,
    persons: participants,
  };

  if (variantCode) {
    payload.variantCode = variantCode;
  }

  if (tripParameters.length > 0) {
    payload.parameters = tripParameters;
  }

  return payload;
}

/**
 * Przygotowuje payload dla register
 */
export function buildRegisterPayload(
  productCode: string,
  variantCode: string,
  offerId: string,
  paymentSchemeCode: string,
  validFrom: string,
  validTo: string,
  participants: HdiPerson[],
  consents: Array<{ code: string; accepted: boolean }>,
  languageCode: string = 'PL',
  tripParameters?: Array<{ code: string; value: string; type: string }>
): any {
  const payload: any = {
    productCode,
    variantCode,
    offerId,
    paymentSchemeCode,
    validFrom,
    validTo,
    languageCode,
    persons: participants,
    consents,
  };

  if (tripParameters && tripParameters.length > 0) {
    payload.parameters = tripParameters;
  }

  return payload;
}
