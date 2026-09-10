// Toss Securities OpenAPI integration.
// Source of truth: https://developers.tossinvest.com/ and the current OpenAPI schema.
// This module is used for market-data/account synchronization; the simulator itself
// keeps simulated cash/holdings separate from any real brokerage balance.

export interface TossApiConfig {
  clientId?: string;
  clientSecret?: string;
  accountNo?: string;
  isConfigured: boolean;
  useLiveAccount: boolean;
}

export interface TossTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface TossQuoteItem {
  symbol: string;
  ticker: string;
  name: string;
  currentPrice: number;
  change: number;
  changeRate: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  previousClose: number;
  volume: number;
  tradeAmount: number;
  market: 'KR' | 'US';
  currency: 'KRW' | 'USD';
  timestamp: string;
}

const TOSS_BASE_URL = 'https://openapi.tossinvest.com';
let cachedTossToken: { token: string; expiresAt: number } | null = null;
let inFlightTokenPromise: Promise<string | null> | null = null;
let tokenCooldownUntil = 0;

export function getTossApiConfig(): TossApiConfig {
  const clientId = (process.env.TOSS_CLIENT_ID || process.env.TOSS_SECURITIES_CLIENT_ID || '').trim();
  const clientSecret = (process.env.TOSS_CLIENT_SECRET || process.env.TOSS_SECURITIES_CLIENT_SECRET || '').trim();
  const accountNo = (process.env.TOSS_ACCOUNT_NO || process.env.TOSS_SECURITIES_ACCOUNT_NO || '').trim();

  return {
    clientId,
    clientSecret,
    accountNo,
    isConfigured: Boolean(clientId && clientSecret),
    useLiveAccount: Boolean(clientId && clientSecret && accountNo),
  };
}

export async function getTossAccessToken(): Promise<string | null> {
  const config = getTossApiConfig();
  if (!config.clientId || !config.clientSecret) return null;

  const now = Date.now();
  if (cachedTossToken && cachedTossToken.expiresAt > now + 60_000) {
    return cachedTossToken.token;
  }
  if (now < tokenCooldownUntil) return null;
  if (inFlightTokenPromise) return inFlightTokenPromise;

  inFlightTokenPromise = (async () => {
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
      });

      const response = await fetch(`${TOSS_BASE_URL}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!response.ok) {
        tokenCooldownUntil = Date.now() + 60_000;
        console.warn(`[Toss OpenAPI] Token request failed: HTTP ${response.status}`);
        return null;
      }

      const data = (await response.json()) as TossTokenResponse;
      if (!data.access_token) {
        tokenCooldownUntil = Date.now() + 60_000;
        console.warn('[Toss OpenAPI] Token response did not contain access_token.');
        return null;
      }

      cachedTossToken = {
        token: data.access_token,
        expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 86_400) * 1000,
      };
      console.log('✅ [Toss OpenAPI] OAuth2 authentication succeeded.');
      return data.access_token;
    } catch (error) {
      tokenCooldownUntil = Date.now() + 60_000;
      console.warn('[Toss OpenAPI] OAuth2 request exception:', error);
      return null;
    } finally {
      inFlightTokenPromise = null;
    }
  })();

  return inFlightTokenPromise;
}

export function toTossSymbol(ticker: string, _market: 'KR' | 'US'): string {
  return ticker.trim().toUpperCase();
}

/**
 * Current-price endpoint from the official Toss OpenAPI spec:
 * GET /api/v1/prices?symbols=005930 or symbols=AAPL
 * Response shape: { result: [{ symbol, timestamp, lastPrice, currency }] }
 */
export async function fetchTossStockQuote(ticker: string, market: 'KR' | 'US'): Promise<TossQuoteItem | null> {
  const token = await getTossAccessToken();
  if (!token) return null;

  const symbol = toTossSymbol(ticker, market);

  try {
    const url = new URL(`${TOSS_BASE_URL}/api/v1/prices`);
    url.searchParams.set('symbols', symbol);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[Toss OpenAPI] Price request failed for ${symbol}: HTTP ${response.status}`);
      return null;
    }

    const payload: any = await response.json();
    const result = Array.isArray(payload?.result) ? payload.result : [];
    const item = result.find((entry: any) => String(entry?.symbol || '').toUpperCase() === symbol) || result[0];
    const currentPrice = Number(item?.lastPrice);

    // The price endpoint intentionally does not invent previous-close/open/high/low
    // values. Missing fields remain zero and can be supplemented by another provider.
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;

    const currency = item?.currency === 'USD' || market === 'US' ? 'USD' : 'KRW';
    return {
      symbol,
      ticker,
      name: ticker,
      currentPrice: currency === 'KRW' ? Math.round(currentPrice) : Number(currentPrice.toFixed(2)),
      change: 0,
      changeRate: 0,
      openPrice: 0,
      highPrice: 0,
      lowPrice: 0,
      previousClose: 0,
      volume: 0,
      tradeAmount: 0,
      market,
      currency,
      timestamp: item?.timestamp || new Date().toISOString(),
    };
  } catch (error) {
    console.warn(`[Toss OpenAPI] Price request exception for ${symbol}:`, error);
    return null;
  }
}

/**
 * Account-scoped endpoint. The simulator does not overwrite its simulated
 * portfolio with this response; callers may use it only for explicit sync/status UI.
 */
export async function fetchTossAccountBalance() {
  const config = getTossApiConfig();
  const token = await getTossAccessToken();
  if (!token || !config.accountNo) return null;

  try {
    const response = await fetch(`${TOSS_BASE_URL}/api/v1/holdings`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tossinvest-Account': config.accountNo,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[Toss OpenAPI] Holdings request failed: HTTP ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[Toss OpenAPI] Holdings request exception:', error);
    return null;
  }
}
