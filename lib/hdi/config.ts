/**
 * Konfiguracja integracji z HDI Embedded API
 */

export interface HdiConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeout: number;
  environment: 'test' | 'production';
}

let cachedConfig: HdiConfig | null = null;

/**
 * Pobiera konfigurację HDI z zmiennych środowiskowych
 */
export function getHdiConfig(): HdiConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const baseUrl = process.env.HDI_BASE_URL;
  const clientId = process.env.HDI_CLIENT_ID;
  const clientSecret = process.env.HDI_CLIENT_SECRET;
  const timeout = parseInt(process.env.HDI_TIMEOUT_MS || '30000', 10);
  const environment = (process.env.HDI_ENV || 'test') as 'test' | 'production';

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error(
      'HDI configuration missing. Required: HDI_BASE_URL, HDI_CLIENT_ID, HDI_CLIENT_SECRET'
    );
  }

  cachedConfig = {
    baseUrl: baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl,
    clientId,
    clientSecret,
    timeout,
    environment,
  };

  return cachedConfig;
}

/**
 * Resetuje cache konfiguracji (przydatne w testach)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}
