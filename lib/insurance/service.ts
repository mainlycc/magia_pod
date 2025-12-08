/**
 * Serwis ubezpieczeń - główna warstwa biznesowa
 * Łączy operacje na bazie danych z integracją HDI API
 */

import { createClient } from '@/lib/supabase/server';
import { HdiApiClient, HdiApiError } from '@/lib/hdi/client';
import {
  mapParticipantToHdi,
  mapTripToHdiParameters,
  buildCalculatePayload,
  buildRegisterPayload,
  mapHdiOfferToBatch,
  mapHdiRegisterToBatch,
  mapHdiIssueToBatch,
  mapHdiPolicyToBatch,
} from './mapper';
import {
  validateParticipantsForHdi,
  formatValidationErrors,
} from './validation';
import {
  InsuranceSubmission,
  ParticipantData,
  TripData,
  CreateBatchOptions,
  CalculateOfferOptions,
  RegisterPolicyOptions,
  IssuePolicyOptions,
  PaymentNotification,
  InsuranceProduct,
} from './types';
import { logInsuranceSuccess, logInsuranceError } from './logger';

export class InsuranceService {
  private hdiClient: HdiApiClient;
  private supabase: Awaited<ReturnType<typeof createClient>>;

  constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.hdiClient = new HdiApiClient();
    this.supabase = supabase;
  }

  /**
   * Tworzy nowe zgłoszenie ubezpieczeniowe dla wycieczki
   */
  async createInsuranceBatchForTrip(
    options: CreateBatchOptions
  ): Promise<InsuranceSubmission> {
    const { tripId, bookingIds, productCode, variantCode } = options;

    // Pobierz wycieczkę
    const { data: trip, error: tripError } = await this.supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      throw new Error(`Wycieczka nie została znaleziona: ${tripError?.message}`);
    }

    // Pobierz rezerwacje (potwierdzone)
    let bookingsQuery = this.supabase
      .from('bookings')
      .select('id')
      .eq('trip_id', tripId)
      .eq('status', 'confirmed');

    if (bookingIds && bookingIds.length > 0) {
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery;

    if (bookingsError) {
      throw new Error(`Błąd pobierania rezerwacji: ${bookingsError.message}`);
    }

    if (!bookings || bookings.length === 0) {
      throw new Error('Brak potwierdzonych rezerwacji dla tej wycieczki');
    }

    // Pobierz uczestników z potwierdzonych rezerwacji
    const { data: participants, error: participantsError } = await this.supabase
      .from('participants')
      .select('*')
      .in(
        'booking_id',
        bookings.map((b) => b.id)
      );

    if (participantsError) {
      throw new Error(`Błąd pobierania uczestników: ${participantsError.message}`);
    }

    if (!participants || participants.length === 0) {
      throw new Error('Brak uczestników w potwierdzonych rezerwacjach');
    }

    // Pobierz produkt ubezpieczeniowy
    let finalProductCode = productCode;
    let finalVariantCode = variantCode;

    if (!finalProductCode) {
      // Pobierz domyślny produkt
      const { data: defaultProduct } = await this.supabase
        .from('insurance_products')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (defaultProduct) {
        finalProductCode = defaultProduct.code;
        finalVariantCode = finalVariantCode || defaultProduct.variant_code || undefined;
      } else {
        throw new Error('Brak skonfigurowanego produktu ubezpieczeniowego');
      }
    }

    // Utwórz zgłoszenie
    const { data: submission, error: submissionError } = await this.supabase
      .from('insurance_submissions')
      .insert({
        trip_id: tripId,
        participants_count: participants.length,
        status: 'pending',
        hdi_product_code: finalProductCode,
        hdi_variant_code: finalVariantCode,
      })
      .select()
      .single();

    if (submissionError || !submission) {
      throw new Error(`Błąd tworzenia zgłoszenia: ${submissionError?.message}`);
    }

    // Dodaj uczestników do zgłoszenia
    const submissionParticipants = participants.map((p, index) => ({
      submission_id: submission.id,
      participant_id: p.id,
      hdi_order: index + 1,
      hdi_required_data: {},
    }));

    const { error: participantsInsertError } = await this.supabase
      .from('insurance_submission_participants')
      .insert(submissionParticipants);

    if (participantsInsertError) {
      // Usuń zgłoszenie jeśli nie udało się dodać uczestników
      await this.supabase
        .from('insurance_submissions')
        .delete()
        .eq('id', submission.id);
      throw new Error(
        `Błąd dodawania uczestników: ${participantsInsertError.message}`
      );
    }

    return submission as InsuranceSubmission;
  }

  /**
   * Waliduje dane uczestników przed wysłaniem
   */
  async validateParticipantsData(
    submissionId: string
  ): Promise<{ isValid: boolean; errors: string[] }> {
    // Pobierz zgłoszenie z wycieczką
    const { data: submission, error: subError } = await this.supabase
      .from('insurance_submissions')
      .select('*, trips:trips(*)')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      throw new Error(`Zgłoszenie nie zostało znalezione: ${subError?.message}`);
    }

    // Pobierz uczestników
    const { data: submissionParticipants, error: partError } = await this.supabase
      .from('insurance_submission_participants')
      .select('*, participants:participants(*)')
      .eq('submission_id', submissionId);

    if (partError) {
      throw new Error(`Błąd pobierania uczestników: ${partError.message}`);
    }

    const participants: ParticipantData[] = (submissionParticipants || []).map(
      (sp: any) => ({
        id: sp.participants.id,
        first_name: sp.participants.first_name,
        last_name: sp.participants.last_name,
        pesel: sp.participants.pesel,
        email: sp.participants.email,
        phone: sp.participants.phone,
        document_type: sp.participants.document_type,
        document_number: sp.participants.document_number,
        birth_date: sp.participants.birth_date,
        citizenship_code: sp.participants.citizenship_code,
        gender_code: sp.participants.gender_code,
        address: sp.participants.address,
      })
    );

    const trip: TripData | null = (submission as any).trips
      ? {
          id: (submission as any).trips.id,
          title: (submission as any).trips.title,
          start_date: (submission as any).trips.start_date,
          end_date: (submission as any).trips.end_date,
          location: (submission as any).trips.location,
          category: (submission as any).trips.category,
        }
      : null;

    const validation = validateParticipantsForHdi(participants, trip);

    return {
      isValid: validation.isValid,
      errors: validation.errors.map((e) => e.message),
    };
  }

  /**
   * Kalkuluje ofertę ubezpieczenia
   */
  async calculateInsuranceOffer(
    options: CalculateOfferOptions
  ): Promise<InsuranceSubmission> {
    const { batchId, productCode, variantCode, paymentSchemeCode } = options;

    // Pobierz zgłoszenie
    const submission = await this.getSubmission(batchId);

    // Walidacja danych
    const validation = await this.validateParticipantsData(batchId);
    if (!validation.isValid) {
      throw new Error(
        `Dane uczestników są niekompletne:\n${validation.errors.join('\n')}`
      );
    }

    // Pobierz uczestników i wycieczkę
    const { participants, trip } = await this.getParticipantsAndTrip(batchId);

    // Mapuj uczestników do formatu HDI
    const hdiParticipants = participants.map((p, index) =>
      mapParticipantToHdi(p, index + 1, ['INSURED'])
    );

    // Mapuj parametry wycieczki
    const tripParameters = mapTripToHdiParameters(trip);

    // Przygotuj daty
    if (!trip.start_date || !trip.end_date) {
      throw new Error('Wycieczka musi mieć określone daty rozpoczęcia i zakończenia');
    }

    const validFrom = new Date(trip.start_date).toISOString();
    const validTo = new Date(trip.end_date).toISOString();

    // Przygotuj payload
    const payload = buildCalculatePayload(
      productCode,
      variantCode,
      validFrom,
      validTo,
      hdiParticipants,
      tripParameters,
      'PL'
    );

    try {
      // Wywołaj API HDI
      const hdiResponse = await this.hdiClient.calculateOffer(payload);

      // Zaloguj operację
      await logInsuranceSuccess({
        submissionId: batchId,
        operationType: 'calculate',
        requestPayload: HdiApiClient.maskPayload(payload),
        responsePayload: hdiResponse,
      });

      // Zaktualizuj zgłoszenie
      const updates = mapHdiOfferToBatch(hdiResponse, submission);
      const { data: updated, error: updateError } = await this.supabase
        .from('insurance_submissions')
        .update({
          ...updates,
          api_payload: HdiApiClient.maskPayload(payload),
        })
        .eq('id', batchId)
        .select()
        .single();

      if (updateError || !updated) {
        throw new Error(`Błąd aktualizacji zgłoszenia: ${updateError?.message}`);
      }

      return updated as InsuranceSubmission;
    } catch (error: any) {
      // Zaloguj błąd
      await logInsuranceError({
        submissionId: batchId,
        operationType: 'calculate',
        requestPayload: HdiApiClient.maskPayload(payload),
        errorCode: error instanceof HdiApiError ? error.code : undefined,
        errorMessage: error.message,
      });

      // Zaktualizuj status na error
      await this.supabase
        .from('insurance_submissions')
        .update({
          status: 'error',
          error_message: error.message,
        })
        .eq('id', batchId);

      throw error;
    }
  }

  /**
   * Rejestruje polisę w HDI
   */
  async registerInsurancePolicy(
    options: RegisterPolicyOptions
  ): Promise<InsuranceSubmission> {
    const { batchId, offerId, variantCode, paymentSchemeCode, languageCode } =
      options;

    const submission = await this.getSubmission(batchId);

    if (!submission.external_offer_id && !offerId) {
      throw new Error('Brak ID oferty. Najpierw wykonaj kalkulację.');
    }

    const finalOfferId = offerId || submission.external_offer_id!;

    // Pobierz uczestników i wycieczkę
    const { participants, trip } = await this.getParticipantsAndTrip(batchId);

    // Mapuj uczestników
    const hdiParticipants = participants.map((p, index) =>
      mapParticipantToHdi(p, index + 1, ['INSURED'])
    );

    // Przygotuj daty
    if (!trip.start_date || !trip.end_date) {
      throw new Error('Wycieczka musi mieć określone daty');
    }

    const validFrom = new Date(trip.start_date).toISOString();
    const validTo = new Date(trip.end_date).toISOString();

    // Pobierz wymagane zgody (domyślnie podstawowe)
    const consents = [
      { code: 'GENERAL', accepted: true },
      { code: 'GDPR', accepted: true },
    ];

    // Przygotuj payload
    const payload = buildRegisterPayload(
      submission.hdi_product_code!,
      variantCode,
      finalOfferId,
      paymentSchemeCode,
      validFrom,
      validTo,
      hdiParticipants,
      consents,
      languageCode || 'PL'
    );

    try {
      const hdiResponse = await this.hdiClient.registerPolicy(payload);

      await logInsuranceSuccess({
        submissionId: batchId,
        operationType: 'register',
        requestPayload: HdiApiClient.maskPayload(payload),
        responsePayload: hdiResponse,
      });

      const updates = mapHdiRegisterToBatch(hdiResponse, submission);
      const { data: updated, error: updateError } = await this.supabase
        .from('insurance_submissions')
        .update({
          ...updates,
          hdi_variant_code: variantCode,
          hdi_payment_scheme_code: paymentSchemeCode,
        })
        .eq('id', batchId)
        .select()
        .single();

      if (updateError || !updated) {
        throw new Error(`Błąd aktualizacji: ${updateError?.message}`);
      }

      return updated as InsuranceSubmission;
    } catch (error: any) {
      await logInsuranceError({
        submissionId: batchId,
        operationType: 'register',
        requestPayload: HdiApiClient.maskPayload(payload),
        errorCode: error instanceof HdiApiError ? error.code : undefined,
        errorMessage: error.message,
      });

      await this.supabase
        .from('insurance_submissions')
        .update({
          status: 'error',
          error_message: error.message,
        })
        .eq('id', batchId);

      throw error;
    }
  }

  /**
   * Wystawia polisę
   */
  async issueInsurancePolicy(
    options: IssuePolicyOptions
  ): Promise<InsuranceSubmission> {
    const { batchId, offerId, paymentMethodCode } = options;

    const submission = await this.getSubmission(batchId);

    if (!submission.external_offer_id && !offerId) {
      throw new Error('Brak ID oferty');
    }

    const finalOfferId = offerId || submission.external_offer_id!;

    try {
      const hdiResponse = await this.hdiClient.issuePolicy(
        finalOfferId,
        paymentMethodCode
      );

      await logInsuranceSuccess({
        submissionId: batchId,
        operationType: 'issue',
        requestPayload: { offerID: finalOfferId, paymentMethodCode },
        responsePayload: hdiResponse,
      });

      const updates = mapHdiIssueToBatch(hdiResponse, submission);
      const { data: updated, error: updateError } = await this.supabase
        .from('insurance_submissions')
        .update({
          ...updates,
          sent_at: new Date().toISOString(),
        })
        .eq('id', batchId)
        .select()
        .single();

      if (updateError || !updated) {
        throw new Error(`Błąd aktualizacji: ${updateError?.message}`);
      }

      return updated as InsuranceSubmission;
    } catch (error: any) {
      await logInsuranceError({
        submissionId: batchId,
        operationType: 'issue',
        requestPayload: { offerID: finalOfferId, paymentMethodCode },
        errorCode: error instanceof HdiApiError ? error.code : undefined,
        errorMessage: error.message,
      });

      await this.supabase
        .from('insurance_submissions')
        .update({
          status: 'error',
          error_message: error.message,
        })
        .eq('id', batchId);

      throw error;
    }
  }

  /**
   * Synchronizuje status polisy z HDI
   */
  async syncInsuranceBatchStatus(batchId: string): Promise<InsuranceSubmission> {
    const submission = await this.getSubmission(batchId);

    if (!submission.external_policy_number) {
      throw new Error('Brak numeru polisy. Polisa nie została jeszcze wystawiona.');
    }

    try {
      const hdiResponse = await this.hdiClient.getPolicy(
        submission.external_policy_number
      );

      await logInsuranceSuccess({
        submissionId: batchId,
        operationType: 'sync',
        requestPayload: { policyNumber: submission.external_policy_number },
        responsePayload: hdiResponse,
      });

      const updates = mapHdiPolicyToBatch(hdiResponse, submission);
      const { data: updated, error: updateError } = await this.supabase
        .from('insurance_submissions')
        .update({
          ...updates,
          last_sync_at: new Date().toISOString(),
          sync_attempts: 0, // Reset przy sukcesie
        })
        .eq('id', batchId)
        .select()
        .single();

      if (updateError || !updated) {
        throw new Error(`Błąd aktualizacji: ${updateError?.message}`);
      }

      return updated as InsuranceSubmission;
    } catch (error: any) {
      // Zwiększ licznik prób
      const newAttempts = (submission.sync_attempts || 0) + 1;
      const status =
        newAttempts >= 5 ? 'manual_check_required' : submission.status;

      await logInsuranceError({
        submissionId: batchId,
        operationType: 'sync',
        requestPayload: { policyNumber: submission.external_policy_number },
        errorCode: error instanceof HdiApiError ? error.code : undefined,
        errorMessage: error.message,
      });

      await this.supabase
        .from('insurance_submissions')
        .update({
          last_sync_at: new Date().toISOString(),
          sync_attempts: newAttempts,
          status,
          error_message: error.message,
        })
        .eq('id', batchId);

      throw error;
    }
  }

  /**
   * Powiadamia o płatności
   */
  async notifyPayment(
    batchId: string,
    paymentData: PaymentNotification
  ): Promise<void> {
    try {
      await this.hdiClient.notifyPayment(paymentData);

      await logInsuranceSuccess({
        submissionId: batchId,
        operationType: 'payment',
        requestPayload: paymentData,
      });
    } catch (error: any) {
      await logInsuranceError({
        submissionId: batchId,
        operationType: 'payment',
        requestPayload: paymentData,
        errorCode: error instanceof HdiApiError ? error.code : undefined,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Pobiera zgłoszenie
   */
  private async getSubmission(batchId: string): Promise<InsuranceSubmission> {
    const { data, error } = await this.supabase
      .from('insurance_submissions')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error || !data) {
      throw new Error(`Zgłoszenie nie zostało znalezione: ${error?.message}`);
    }

    return data as InsuranceSubmission;
  }

  /**
   * Pobiera uczestników i wycieczkę
   */
  private async getParticipantsAndTrip(batchId: string): Promise<{
    participants: ParticipantData[];
    trip: TripData;
  }> {
    // Pobierz zgłoszenie z wycieczką
    const { data: submission, error: subError } = await this.supabase
      .from('insurance_submissions')
      .select('*, trips:trips(*)')
      .eq('id', batchId)
      .single();

    if (subError || !submission) {
      throw new Error(`Zgłoszenie nie zostało znalezione: ${subError?.message}`);
    }

    const trip = (submission as any).trips;
    if (!trip) {
      throw new Error('Wycieczka nie została znaleziona');
    }

    // Pobierz uczestników
    const { data: submissionParticipants, error: partError } = await this.supabase
      .from('insurance_submission_participants')
      .select('*, participants:participants(*)')
      .eq('submission_id', batchId)
      .order('hdi_order', { ascending: true });

    if (partError) {
      throw new Error(`Błąd pobierania uczestników: ${partError.message}`);
    }

    const participants: ParticipantData[] = (submissionParticipants || []).map(
      (sp: any) => ({
        id: sp.participants.id,
        first_name: sp.participants.first_name,
        last_name: sp.participants.last_name,
        pesel: sp.participants.pesel,
        email: sp.participants.email,
        phone: sp.participants.phone,
        document_type: sp.participants.document_type,
        document_number: sp.participants.document_number,
        birth_date: sp.participants.birth_date,
        citizenship_code: sp.participants.citizenship_code,
        gender_code: sp.participants.gender_code,
        address: sp.participants.address,
      })
    );

    return {
      participants,
      trip: {
        id: trip.id,
        title: trip.title,
        start_date: trip.start_date,
        end_date: trip.end_date,
        location: trip.location,
        category: trip.category,
      },
    };
  }

  /**
   * Anuluje zgłoszenie ubezpieczeniowe
   */
  async cancelInsuranceBatch(batchId: string): Promise<InsuranceSubmission> {
    const submission = await this.getSubmission(batchId);

    // Sprawdź czy można anulować (tylko dla statusów: sent, registered, issued)
    const cancellableStatuses = ['sent', 'registered', 'issued'];
    if (!cancellableStatuses.includes(submission.status)) {
      throw new Error(
        `Nie można anulować zgłoszenia ze statusem: ${submission.status}`
      );
    }

    // TODO: Jeśli HDI API obsługuje anulowanie, wywołaj tutaj
    // Na razie tylko oznaczamy jako anulowane lokalnie
    const { data: updated, error: updateError } = await this.supabase
      .from('insurance_submissions')
      .update({
        status: 'cancelled',
        error_message: 'Anulowane przez administratora',
      })
      .eq('id', batchId)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error(`Błąd anulowania zgłoszenia: ${updateError?.message}`);
    }

    // Zaloguj operację
    await logInsuranceSuccess({
      submissionId: batchId,
      operationType: 'cancel',
      requestPayload: { reason: 'Anulowane przez administratora' },
    });

    return updated as InsuranceSubmission;
  }
}

/**
 * Singleton instance getter dla InsuranceService
 */
let insuranceServiceInstance: InsuranceService | null = null;

export async function getInsuranceService(): Promise<InsuranceService> {
  if (!insuranceServiceInstance) {
    const supabase = await createClient();
    insuranceServiceInstance = new InsuranceService(supabase);
  }
  return insuranceServiceInstance;
}