/**
 * Typy TypeScript dla modułu ubezpieczeń HDI
 */

// Typy dla bazy danych
export interface InsuranceSubmission {
  id: string;
  trip_id: string;
  booking_id: string | null;
  participants_count: number;
  submission_date: string;
  status:
    | 'pending'
    | 'calculating'
    | 'registered'
    | 'sent'
    | 'issued'
    | 'accepted'
    | 'error'
    | 'cancelled'
    | 'manual_check_required';
  error_message: string | null;
  api_payload: any;
  api_response: any;
  policy_number: string | null;
  external_offer_id: string | null;
  external_policy_id: string | null;
  external_policy_number: string | null;
  hdi_product_code: string | null;
  hdi_variant_code: string | null;
  hdi_payment_scheme_code: string | null;
  sent_at: string | null;
  last_sync_at: string | null;
  sync_attempts: number;
  policy_status_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsuranceSubmissionParticipant {
  id: string;
  submission_id: string;
  participant_id: string;
  hdi_required_data: any;
  hdi_person_uid: string | null;
  hdi_order: number | null;
  status: string | null;
  created_at: string;
}

export interface InsuranceProduct {
  id: string;
  code: string;
  name: string;
  variant_code: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsuranceLog {
  id: string;
  submission_id: string;
  operation_type: 'calculate' | 'register' | 'issue' | 'sync' | 'cancel' | 'payment';
  status: 'success' | 'error';
  request_payload: any;
  response_payload: any;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export type InsuranceOperationType = 'calculate' | 'register' | 'issue' | 'sync' | 'cancel' | 'payment';
export type InsuranceLogStatus = 'success' | 'error';

// Typy dla odpowiedzi HDI API
export interface HdiOfferResponse {
  offerID: string;
  effectiveDate: string;
  paymentSchemas: Array<{
    pricingVariants: Array<{
      code: string;
      premiumCurrencyCode: string;
      tariffPaymentSchemeCode: string;
      installmentPremium: any;
      policyPremium: any;
    }>;
  }>;
}

export interface HdiRegisterResponse {
  offerID: string;
  effectiveDate: string;
  validityDate?: string;
  variants: Array<{
    code: string;
    premiumCurrencyCode: string;
    tariffPaymentSchemeCode: string;
    installmentPremium: any;
    policyPremium: any;
  }>;
}

export interface HdiIssueResponse {
  policyId: string;
  policyNumber: string;
  installments: Array<{
    number: number;
    typeCode: string;
    dueDate: string;
    value: number;
    currencyCode: string;
    statusCode: string;
  }>;
}

export interface HdiPolicyResponse {
  policyID: string;
  policyNumber: string;
  policyStatusCode: string;
  version: number;
  policyIssueDate: string;
  productCode: string;
  variantCode: string;
  paymentSchemeCode: string;
  validFrom: string;
  validTo: string;
  languageCode: string;
  parameters?: Array<{ code: string; value: string }>;
  risks?: Array<{ code: string; insuranceSum?: number }>;
  persons: Array<HdiPerson>;
  consents: Array<{
    code: string;
    accepted: boolean;
    acceptanceDate?: string;
  }>;
  installments: Array<{
    number: number;
    typeCode: string;
    dueDate: string;
    value: number;
    currencyCode: string;
    statusCode: string;
  }>;
  premium: any;
}

export interface HdiPerson {
  order?: number;
  roles: Array<{ code: string }>;
  typeCode: string;
  personUid?: string;
  name?: string;
  surname?: string;
  companyName?: string;
  dateOfBirth?: string;
  genderCode?: string;
  citizenshipCode?: string;
  email?: string;
  phone?: string;
  personalIdTypeCode?: string;
  personalId?: string;
  taxIdTypeCode?: string;
  taxId?: string;
  bankAccountNumber?: string;
  documentTypeCode?: string;
  documentNumber?: string;
  parameters?: Array<{ code: string; value: string; type?: string }>;
  addresses?: Array<HdiAddress>;
  share?: number;
}

export interface HdiAddress {
  addressTypeCode: string;
  countryCode: string;
  city: string;
  zipCode: string;
  street?: string;
  houseNumber?: string;
  appartmentNumber?: string;
}

// Typy dla walidacji
export interface ValidationError {
  field: string;
  message: string;
  participantId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Typy dla mapowania
export interface ParticipantData {
  id: string;
  first_name: string;
  last_name: string;
  pesel: string | null;
  email: string | null;
  phone: string | null;
  document_type: string | null;
  document_number: string | null;
  birth_date: string | null;
  citizenship_code: string | null;
  gender_code: string | null;
  address: {
    street?: string;
    city?: string;
    zip?: string;
    country?: string;
  } | null;
}

export interface TripData {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  category: string | null;
}

// Typy dla serwisu
export interface CreateBatchOptions {
  tripId: string;
  bookingIds?: string[];
  productCode?: string;
  variantCode?: string;
}

export interface CalculateOfferOptions {
  batchId: string;
  productCode: string;
  variantCode?: string;
  paymentSchemeCode?: string;
}

export interface RegisterPolicyOptions {
  batchId: string;
  offerId: string;
  variantCode: string;
  paymentSchemeCode: string;
  languageCode?: string;
}

export interface IssuePolicyOptions {
  batchId: string;
  offerId: string;
  paymentMethodCode: string;
}

export interface PaymentNotification {
  policyNumber: string;
  paymentDate: string;
  installment: number;
  totalAmount: number;
  currencyCode: string;
  paymentStatus: 'PAID' | 'NEGATIVE';
  errorCode?: string;
}
