/**
 * Klient API HDI Embedded
 * Obsługuje wszystkie operacje związane z ubezpieczeniami podróży
 */

import { getAccessToken } from './auth';
import { getHdiConfig } from './config';

export interface HdiError {
  code?: string;
  message: string;
  status: number;
}

export class HdiApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    message?: string
  ) {
    super(message || `HDI API error: ${status}`);
    this.name = 'HdiApiError';
  }
}

/**
 * Maskuje dane osobowe w payloadzie dla logowania
 */
function maskPersonalData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const masked = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveFields = [
    'pesel',
    'personalId',
    'documentNumber',
    'email',
    'phone',
    'address',
    'addresses',
    'street',
    'houseNumber',
    'zipCode',
  ];

  for (const key in masked) {
    if (sensitiveFields.includes(key)) {
      if (typeof masked[key] === 'string' && masked[key].length > 0) {
        masked[key] = '***MASKED***';
      } else if (typeof masked[key] === 'object') {
        masked[key] = maskPersonalData(masked[key]);
      }
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskPersonalData(masked[key]);
    }
  }

  return masked;
}

/**
 * Główna klasa klienta HDI API
 */
export class HdiApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    const config = getHdiConfig();
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
  }

  /**
   * Wykonuje żądanie HTTP do API HDI
   */
  private async _request<T>(
    method: string,
    endpoint: string,
    body?: any,
    retries = 3
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    const token = await getAccessToken();

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(this.timeout),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          let errorData: any = {};
          try {
            errorData = await response.json();
          } catch {
            errorData = { message: await response.text() };
          }

          const error = new HdiApiError(
            response.status,
            errorData.code || errorData.errorCode,
            errorData.message || errorData.error || response.statusText
          );

          // Nie retry dla błędów 4xx (błędy klienta)
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }

          lastError = error;
          // Retry dla błędów 5xx i błędów sieciowych
          if (attempt < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          throw error;
        }

        // Pusty response (np. dla POST payment)
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return {} as T;
        }

        return await response.json();
      } catch (error: any) {
        lastError = error;

        // Błędy sieciowe - retry
        if (
          error.name === 'AbortError' ||
          error.name === 'TypeError' ||
          error.message?.includes('fetch')
        ) {
          if (attempt < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Kalkuluje ofertę ubezpieczenia
   * POST calculate/all/schemas
   */
  async calculateOffer(payload: any): Promise<any> {
    return this._request('POST', 'calculate/all/schemas', payload);
  }

  /**
   * Rejestruje dane polisy
   * POST register
   */
  async registerPolicy(payload: any): Promise<any> {
    return this._request('POST', 'register', payload);
  }

  /**
   * Aktualizuje zarejestrowaną polisę
   * PUT register
   */
  async updatePolicy(offerId: string, payload: any): Promise<any> {
    const updatePayload = { ...payload, offerId };
    return this._request('PUT', 'register', updatePayload);
  }

  /**
   * Wystawia polisę
   * PUT issue
   */
  async issuePolicy(offerId: string, paymentMethodCode: string): Promise<any> {
    return this._request('PUT', 'issue', {
      offerID: offerId,
      paymentMethodCode,
    });
  }

  /**
   * Powiadamia o płatności
   * POST payment
   */
  async notifyPayment(payments: any): Promise<void> {
    await this._request('POST', 'payment', { payments });
  }

  /**
   * Pobiera szczegóły polisy
   * GET policy
   */
  async getPolicy(policyNumber: string, employeeCode?: string): Promise<any> {
    const params = new URLSearchParams({ policyNumber });
    if (employeeCode) {
      params.append('employeeCode', employeeCode);
    }
    return this._request('GET', `policy?${params.toString()}`);
  }

  /**
   * Pobiera listę polis
   * GET policies
   */
  async listPolicies(filters: {
    productCode?: string;
    policyRoleCode?: string;
    personTypeCode?: string;
    name?: string;
    surname?: string;
    email?: string;
    phone?: string;
    personalID?: string;
    page?: number;
    size?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (filters.productCode) params.append('productCode', filters.productCode);
    if (filters.policyRoleCode) params.append('policyRoleCode', filters.policyRoleCode);
    if (filters.personTypeCode) params.append('personTypeCode', filters.personTypeCode);
    if (filters.name) params.append('name', filters.name);
    if (filters.surname) params.append('surname', filters.surname);
    if (filters.email) params.append('email', filters.email);
    if (filters.phone) params.append('phone', filters.phone);
    if (filters.personalID) params.append('personalID', filters.personalID);
    params.append('page', String(filters.page || 1));
    params.append('size', String(filters.size || 100));

    return this._request('GET', `policies?${params.toString()}`);
  }

  /**
   * Pobiera listę dokumentów polisy
   * GET policyDocuments
   */
  async getPolicyDocuments(policyId: string, employeeCode?: string): Promise<any> {
    const params = new URLSearchParams({ policyID: policyId });
    if (employeeCode) {
      params.append('employeeCode', employeeCode);
    }
    return this._request('GET', `policyDocuments?${params.toString()}`);
  }

  /**
   * Pobiera link do pobrania dokumentu
   * GET document
   */
  async getDocument(uri: string, employeeCode?: string): Promise<{ signedURL: string }> {
    const params = new URLSearchParams({ uri });
    if (employeeCode) {
      params.append('employeeCode', employeeCode);
    }
    return this._request('GET', `document?${params.toString()}`);
  }

  /**
   * Pobiera definicje kwestionariuszy
   * GET questionnaires
   */
  async getQuestionnaires(params: {
    productCode: string;
    offerID?: string;
    variantCode?: string;
    roleCode?: string;
    languages?: string[];
    questionnaireCode?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams({ productCode: params.productCode });
    if (params.offerID) queryParams.append('offerID', params.offerID);
    if (params.variantCode) queryParams.append('variantCode', params.variantCode);
    if (params.roleCode) queryParams.append('roleCode', params.roleCode);
    if (params.languages) {
      params.languages.forEach((lang) => queryParams.append('languages', lang));
    }
    if (params.questionnaireCode) {
      queryParams.append('questionnaireCode', params.questionnaireCode);
    }

    return this._request('GET', `questionnaires?${queryParams.toString()}`);
  }

  /**
   * Pobiera listę zgód wymaganych dla polisy
   * GET consents
   */
  async getConsents(productCode: string, variantCode?: string): Promise<any> {
    const params = new URLSearchParams({ productCode });
    if (variantCode) {
      params.append('variantCode', variantCode);
    }
    return this._request('GET', `consents?${params.toString()}`);
  }

  /**
   * Zwraca zmaskowany payload dla logowania
   */
  static maskPayload(payload: any): any {
    return maskPersonalData(payload);
  }

  /**
   * Maskuje dane osobowe w payloadzie (instancja)
   */
  maskPersonalData(payload: any): any {
    return maskPersonalData(payload);
  }
}

/**
 * Singleton instance getter dla HdiApiClient
 */
let hdiClientInstance: HdiApiClient | null = null;

export function getHdiClient(): HdiApiClient {
  if (!hdiClientInstance) {
    hdiClientInstance = new HdiApiClient();
  }
  return hdiClientInstance;
}
