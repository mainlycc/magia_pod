/**
 * Logger operacji ubezpieczeniowych z maskowaniem danych osobowych
 */

import { createClient } from '@/lib/supabase/server';
import {
  InsuranceOperationType,
  InsuranceLogStatus,
} from './types';
import { getHdiClient } from '../hdi/client';

/**
 * Maskuje dane osobowe w payloadzie
 */
function maskPersonalData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const masked = { ...data };
  const sensitiveFields = [
    'pesel',
    'personalId',
    'personalIdTypeCode',
    'documentNumber',
    'phone',
    'email',
    'address',
    'addresses',
    'bankAccountNumber',
    'taxId',
    'name',
    'surname',
    'first_name',
    'last_name',
  ];

  for (const key in masked) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      if (typeof masked[key] === 'string' && masked[key].length > 0) {
        masked[key] = '***MASKED***';
      } else if (Array.isArray(masked[key])) {
        masked[key] = masked[key].map(() => '***MASKED***');
      }
    } else if (Array.isArray(masked[key])) {
      masked[key] = masked[key].map((item: any) => maskPersonalData(item));
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskPersonalData(masked[key]);
    }
  }

  return masked;
}

/**
 * Loguje operację ubezpieczeniową
 */
export async function logInsuranceOperation(params: {
  submissionId: string;
  operationType: InsuranceOperationType;
  status: InsuranceLogStatus;
  requestPayload?: any;
  responsePayload?: any;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const hdiClient = getHdiClient();

    // Maskuj dane osobowe w payloadach
    const maskedRequest = params.requestPayload
      ? hdiClient.maskPersonalData(params.requestPayload)
      : null;

    const maskedResponse = params.responsePayload
      ? hdiClient.maskPersonalData(params.responsePayload)
      : null;

    const { error } = await supabase.from('insurance_logs').insert({
      submission_id: params.submissionId,
      operation_type: params.operationType,
      status: params.status,
      request_payload: maskedRequest,
      response_payload: maskedResponse,
      error_code: params.errorCode || null,
      error_message: params.errorMessage || null,
    });

    if (error) {
      console.error('Failed to log insurance operation:', error);
      // Nie rzucamy błędu, żeby nie przerwać głównego flow
    }
  } catch (error) {
    console.error('Error in logInsuranceOperation:', error);
    // Nie rzucamy błędu, żeby nie przerwać głównego flow
  }
}

/**
 * Loguje sukces operacji
 */
export async function logInsuranceSuccess(params: {
  submissionId: string;
  operationType: InsuranceOperationType;
  requestPayload?: any;
  responsePayload?: any;
}): Promise<void> {
  await logInsuranceOperation({
    ...params,
    status: 'success',
  });
}

/**
 * Loguje błąd operacji
 */
export async function logInsuranceError(params: {
  submissionId: string;
  operationType: InsuranceOperationType;
  requestPayload?: any;
  responsePayload?: any;
  errorCode?: string;
  errorMessage: string;
}): Promise<void> {
  await logInsuranceOperation({
    ...params,
    status: 'error',
  });
}

