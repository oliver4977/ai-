// Toss Securities (토스증권) OpenAPI Integration Module
// Official Spec: https://openapi.tossinvest.com
// Provides real-time quote, market status, order execution, and account balance syncing

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

let cachedTossToken: { token: string; expiresAt: number } | null = null;
let inFlightTokenPromise: Promise<string | null> | null = null;
let tokenCooldownUntil: number = 0;

// Get Toss Securities API credentials from server environment
export function getTossApiConfig(): TossApiConfig {
  const clientId = (process.env.TOSS_CLIENT_ID || process.env.TOSS_SECURITIES_CLIENT_ID || "").trim();
  const clientSecret = (process.env.TOSS_CLIENT_SECRET || process.env.TOSS_SECURITIES_CLIENT_SECRET || "").trim();
  const accountNo = (process.env.TOSS_ACCOUNT_NO || process.env.TOSS_SECURITIES_ACCOUNT_NO || "").trim();

  return {
    clientId,
    clientSecret,
    accountNo,
    isConfigured: !!(clientId && clientSecret),
    useLiveAccount: !!(clientId && clientSecret && accountNo),
  };
}

// Authenticate with Toss Securities Open API OAuth2 Client Credentials flow with mutex & cooldown
export async function getTossAccessToken(): Promise<string | null> {
  const config = getTossApiConfig();
  if (!config.clientId || !config.clientSecret) {
    return null;
  }

  const now = Date.now();
  if (cachedTossToken && cachedTossToken.expiresAt > now + 60000) {
    return cachedTossToken.token;
  }

  // If currently in a cooldown due to previous rate limit (429) or failure, skip
  if (now < tokenCooldownUntil) {
    return null;
  }

  // If another call is already fetching a token, reuse that promise (mutex)
  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  inFlightTokenPromise = (async () => {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', config.clientId!);
      params.append('client_secret', config.clientSecret!);

      const response = await fetch('https://openapi.tossinvest.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'AlphaTrader-MTS-Pro',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        // Cooldown for 60 seconds on error / 429
        tokenCooldownUntil = Date.now() + 60000;
        const errText = await response.text();
        console.warn(`[Toss OpenAPI] Token issue returned ${response.status}. Cooldown active for 60s.`);
        return null;
      }

      const data: TossTokenResponse = await response.json();
      if (data.access_token) {
        cachedTossToken = {
          token: data.access_token,
          expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
        };
        console.log('✅ [Toss OpenAPI] Successfully authenticated OAuth2 Access Token');
        return data.access_token;
      }
      return null;
    } catch (err) {
      tokenCooldownUntil = Date.now() + 60000;
      console.warn('[Toss OpenAPI] OAuth2 token request exception, cooldown 60s:', err);
      return null;
    } finally {
      inFlightTokenPromise = null;
    }
  })();

  return inFlightTokenPromise;
}

// Convert common ticker format to Toss OpenAPI symbol format
export function toTossSymbol(ticker: string, market: 'KR' | 'US'): string {
  const clean = ticker.trim().toUpperCase();
  if (market === 'KR' || /^\d{6}$/.test(clean)) {
    return clean; // KR: 6-digit standard code (e.g. "005930")
  }
  return clean; // US: standard ticker (e.g. "NVDA", "TSLA")
}

// Fetch Real-time Stock Quote from Toss Securities Open API
export async function fetchTossStockQuote(ticker: string, market: 'KR' | 'US'): Promise<TossQuoteItem | null> {
  const token = await getTossAccessToken();
  if (!token) return null;

  try {
    const symbol = toTossSymbol(ticker, market);
    const endpoint = market === 'KR' 
      ? `https://openapi.tossinvest.com/v1/market/kr/stocks/${symbol}/realtime`
      : `https://openapi.tossinvest.com/v1/market/us/stocks/${symbol}/realtime`;

    const res = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AlphaTrader-MTS-Pro',
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const item = data.data || data;

    const currentPrice = Number(item.price || item.currentPrice || item.closePrice || 0);
    const previousClose = Number(item.previousClose || item.prevClosePrice || currentPrice);
    const change = Number(item.change || (currentPrice - previousClose));
    const changeRate = Number(item.changeRate || item.changePercent || (previousClose ? (change / previousClose) * 100 : 0));

    return {
      symbol,
      ticker,
      name: item.name || item.stockName || ticker,
      currentPrice: market === 'KR' ? Math.round(currentPrice) : Number(currentPrice.toFixed(2)),
      change: market === 'KR' ? Math.round(change) : Number(change.toFixed(2)),
      changeRate: Number(changeRate.toFixed(2)),
      openPrice: Number(item.open || item.openPrice || previousClose),
      highPrice: Number(item.high || item.highPrice || currentPrice),
      lowPrice: Number(item.low || item.lowPrice || currentPrice),
      previousClose,
      volume: Number(item.volume || item.accumulatedVolume || 0),
      tradeAmount: Number(item.tradeAmount || item.accumulatedTradeAmount || 0),
      market,
      currency: market === 'KR' ? 'KRW' : 'USD',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[Toss OpenAPI] Failed to fetch quote for ${ticker}:`, err);
    return null;
  }
}

// Fetch Account Balance and Holdings from Toss Securities Open API
export async function fetchTossAccountBalance() {
  const config = getTossApiConfig();
  const token = await getTossAccessToken();
  if (!token || !config.accountNo) return null;

  try {
    const res = await fetch('https://openapi.tossinvest.com/v1/accounts/balance', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tossinvest-Account': config.accountNo,
        'Content-Type': 'application/json',
        'User-Agent': 'AlphaTrader-MTS-Pro',
      },
    });

    if (!res.ok) {
      console.warn(`[Toss OpenAPI] Account balance fetch returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[Toss OpenAPI] Account balance error:', err);
    return null;
  }
}
