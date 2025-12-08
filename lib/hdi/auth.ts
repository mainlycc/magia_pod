/**
 * Klient OAuth2 dla HDI Embedded API
 * Obsługuje pobieranie i odświeżanie tokenów dostępu
 */

import { getHdiConfig } from './config';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface CachedToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

// Cache tokenów w pamięci (dla każdego środowiska osobno)
const tokenCache = new Map<string, CachedToken>();

/**
 * Pobiera token dostępu z cache lub z API HDI
 */
export async function getAccessToken(): Promise<string> {
  const config = getHdiConfig();
  const cacheKey = config.environment;

  // Sprawdź cache
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    // Token jest jeszcze ważny (z 1 minuty zapasu)
    return cached.accessToken;
  }

  // Jeśli mamy refresh token, spróbuj odświeżyć
  if (cached?.refreshToken) {
    try {
      const newToken = await refreshToken(cached.refreshToken);
      return newToken.accessToken;
    } catch (error) {
      // Jeśli refresh się nie powiódł, pobierz nowy token
      console.warn('Token refresh failed, getting new token:', error);
    }
  }

  // Pobierz nowy token
  const token = await fetchNewToken();
  return token.accessToken;
}

/**
 * Pobiera nowy token z API HDI
 */
async function fetchNewToken(): Promise<CachedToken> {
  const config = getHdiConfig();
  const tokenUrl = `${config.baseUrl}/newToken`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get HDI access token: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data: TokenResponse = await response.json();

  if (!data.access_token) {
    throw new Error('Invalid token response from HDI API');
  }

  const expiresAt = Date.now() + (data.expires_in * 1000);
  const cached: CachedToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };

  tokenCache.set(config.environment, cached);
  return cached;
}

/**
 * Odświeża token używając refresh token
 */
export async function refreshToken(refreshToken: string): Promise<CachedToken> {
  const config = getHdiConfig();
  const tokenUrl = `${config.baseUrl}/refreshToken`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to refresh HDI access token: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data: TokenResponse = await response.json();

  if (!data.access_token) {
    throw new Error('Invalid refresh token response from HDI API');
  }

  const expiresAt = Date.now() + (data.expires_in * 1000);
  const cached: CachedToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
  };

  tokenCache.set(config.environment, cached);
  return cached;
}

/**
 * Czyści cache tokenów (przydatne w testach lub przy zmianie konfiguracji)
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}
