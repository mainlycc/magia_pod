/**
 * Walidacja danych uczestników przed wysłaniem do HDI
 */

import { ParticipantData, ValidationError, ValidationResult, TripData } from './types';

/**
 * Waliduje dane uczestnika dla HDI
 */
export function validateParticipantForHdi(
  participant: ParticipantData,
  trip: TripData | null = null
): ValidationResult {
  const errors: ValidationError[] = [];

  // Imię - wymagane
  if (!participant.first_name || participant.first_name.trim().length < 2) {
    errors.push({
      field: 'first_name',
      message: 'Imię jest wymagane i musi mieć co najmniej 2 znaki',
      participantId: participant.id,
    });
  }

  // Nazwisko - wymagane
  if (!participant.last_name || participant.last_name.trim().length < 2) {
    errors.push({
      field: 'last_name',
      message: 'Nazwisko jest wymagane i musi mieć co najmniej 2 znaki',
      participantId: participant.id,
    });
  }

  // Data urodzenia - wymagana
  if (!participant.birth_date) {
    errors.push({
      field: 'birth_date',
      message: 'Data urodzenia jest wymagana',
      participantId: participant.id,
    });
  } else {
    const birthDate = new Date(participant.birth_date);
    if (isNaN(birthDate.getTime())) {
      errors.push({
        field: 'birth_date',
        message: 'Nieprawidłowy format daty urodzenia',
        participantId: participant.id,
      });
    } else {
      // Sprawdź czy data nie jest w przyszłości
      if (birthDate > new Date()) {
        errors.push({
          field: 'birth_date',
          message: 'Data urodzenia nie może być w przyszłości',
          participantId: participant.id,
        });
      }
      // Sprawdź czy osoba nie jest za stara (np. > 120 lat)
      const age = new Date().getFullYear() - birthDate.getFullYear();
      if (age > 120) {
        errors.push({
          field: 'birth_date',
          message: 'Data urodzenia wydaje się nieprawidłowa',
          participantId: participant.id,
        });
      }
    }
  }

  // PESEL lub document_number - przynajmniej jedno wymagane
  if (!participant.pesel && !participant.document_number) {
    errors.push({
      field: 'pesel',
      message: 'PESEL lub numer dokumentu jest wymagany',
      participantId: participant.id,
    });
  }

  // Walidacja PESEL jeśli podano
  if (participant.pesel) {
    if (!/^\d{11}$/.test(participant.pesel)) {
      errors.push({
        field: 'pesel',
        message: 'PESEL musi składać się z dokładnie 11 cyfr',
        participantId: participant.id,
      });
    }
  }

  // Walidacja document_number jeśli podano
  if (participant.document_number) {
    if (participant.document_number.trim().length < 3) {
      errors.push({
        field: 'document_number',
        message: 'Numer dokumentu musi mieć co najmniej 3 znaki',
        participantId: participant.id,
      });
    }

    // Jeśli podano document_number, powinien być też document_type
    if (!participant.document_type) {
      errors.push({
        field: 'document_type',
        message: 'Typ dokumentu jest wymagany gdy podano numer dokumentu',
        participantId: participant.id,
      });
    }
  }

  // Adres - wymagane podstawowe pola
  if (!participant.address) {
    errors.push({
      field: 'address',
      message: 'Adres jest wymagany',
      participantId: participant.id,
    });
  } else {
    // Miasto - wymagane
    if (!participant.address.city || participant.address.city.trim().length < 2) {
      errors.push({
        field: 'address.city',
        message: 'Miasto jest wymagane',
        participantId: participant.id,
      });
    }

    // Kod pocztowy - wymagany
    if (!participant.address.zip || participant.address.zip.trim().length < 4) {
      errors.push({
        field: 'address.zip',
        message: 'Kod pocztowy jest wymagany',
        participantId: participant.id,
      });
    }

    // Kraj - wymagany (domyślnie PL)
    if (!participant.address.country) {
      // Możemy ustawić domyślnie PL, ale lepiej wymusić
      errors.push({
        field: 'address.country',
        message: 'Kraj jest wymagany',
        participantId: participant.id,
      });
    }
  }

  // Obywatelstwo - opcjonalne, ale zalecane
  if (!participant.citizenship_code) {
    // To nie jest błąd, ale możemy dodać ostrzeżenie
    // Domyślnie ustawimy PL w mapperze
  } else {
    // Walidacja formatu ISO 3166-1 alpha-2 (2 litery)
    if (!/^[A-Z]{2}$/.test(participant.citizenship_code)) {
      errors.push({
        field: 'citizenship_code',
        message: 'Kod obywatelstwa musi być w formacie ISO 3166-1 alpha-2 (np. PL, DE, FR)',
        participantId: participant.id,
      });
    }
  }

  // Email - opcjonalny, ale jeśli podano, sprawdź format
  if (participant.email && participant.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(participant.email)) {
      errors.push({
        field: 'email',
        message: 'Nieprawidłowy format adresu email',
        participantId: participant.id,
      });
    }
  }

  // Telefon - opcjonalny, ale jeśli podano, sprawdź podstawowy format
  if (participant.phone && participant.phone.trim().length > 0) {
    // Usuń spacje i znaki specjalne dla walidacji
    const phoneDigits = participant.phone.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      errors.push({
        field: 'phone',
        message: 'Numer telefonu wydaje się nieprawidłowy',
        participantId: participant.id,
      });
    }
  }

  // Walidacja dat wycieczki jeśli podano
  if (trip) {
    if (!trip.start_date || !trip.end_date) {
      errors.push({
        field: 'trip_dates',
        message: 'Wycieczka musi mieć określone daty rozpoczęcia i zakończenia',
        participantId: participant.id,
      });
    } else {
      const startDate = new Date(trip.start_date);
      const endDate = new Date(trip.end_date);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.push({
          field: 'trip_dates',
          message: 'Nieprawidłowy format dat wycieczki',
          participantId: participant.id,
        });
      } else if (endDate <= startDate) {
        errors.push({
          field: 'trip_dates',
          message: 'Data zakończenia musi być późniejsza niż data rozpoczęcia',
          participantId: participant.id,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Waliduje listę uczestników
 */
export function validateParticipantsForHdi(
  participants: ParticipantData[],
  trip: TripData | null = null
): ValidationResult {
  const allErrors: ValidationError[] = [];

  if (participants.length === 0) {
    return {
      isValid: false,
      errors: [
        {
          field: 'participants',
          message: 'Musi być co najmniej jeden uczestnik',
        },
      ],
    };
  }

  for (const participant of participants) {
    const result = validateParticipantForHdi(participant, trip);
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Zwraca czytelny komunikat błędów walidacji
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return '';
  }

  const groupedByParticipant = new Map<string, ValidationError[]>();

  for (const error of errors) {
    const key = error.participantId || 'general';
    if (!groupedByParticipant.has(key)) {
      groupedByParticipant.set(key, []);
    }
    groupedByParticipant.get(key)!.push(error);
  }

  const messages: string[] = [];

  for (const [participantId, participantErrors] of groupedByParticipant) {
    if (participantId === 'general') {
      messages.push(...participantErrors.map((e) => e.message));
    } else {
      const participantName =
        participantErrors[0]?.participantId || 'Uczestnik';
      const errorMessages = participantErrors.map((e) => `  - ${e.message}`);
      messages.push(`${participantName}:`, ...errorMessages);
    }
  }

  return messages.join('\n');
}
