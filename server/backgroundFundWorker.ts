import fs from 'fs';
import path from 'path';
import { Type } from '@google/genai';
import { 
  SimulationAccount, 
  AIFundDecision, 
  AIFundLiveThought, 
  StockItem, 
  HoldingStock, 
  OrderRecord,
  ApiQuotaUsage,
  DualAccountFundState,
  OrderType,
  OrderSide
} from '../src/types';
import { getLiveStockQuotes, getMarketSessionStatus, getRealMarketNews } from './marketService';

const DB_FILE = path.join(process.cwd(), 'server_fund_storage.json');

// Initial Account States (Total 10억 = 단기 5억 + 중장기 5억)
const INITIAL_SHORT_TERM_ACCOUNT: SimulationAccount = {
  accountNumber: '883-91-0428-10-A',
  accountName: '단기 트레이딩 AI 계좌 (5억원)',
  initialCapitalKRW: 500000000,
  cashKRW: 500000000,
  cashUSD: 0,
  exchangeRateUSD_KRW: 1400,
  holdings: [],
  orders: [],
  totalAssetKRW: 500000000,
  totalEvaluationProfitKRW: 0,
  totalProfitRate: 0,
  dailyProfitKRW: 0,
  dailyProfitRate: 0,
  aiAutoTradeEnabled: true,
  aiTradeFrequency: 'AGGRESSIVE',
  maxPositionSizePercent: 20,
};

const INITIAL_LONG_TERM_ACCOUNT: SimulationAccount = {
  accountNumber: '883-91-0428-10-B',
  accountName: '중장기 가치투자 AI 계좌 (5억원)',
  initialCapitalKRW: 500000000,
  cashKRW: 500000000,
  cashUSD: 0,
  exchangeRateUSD_KRW: 1400,
  holdings: [],
  orders: [],
  totalAssetKRW: 500000000,
  totalEvaluationProfitKRW: 0,
  totalProfitRate: 0,
  dailyProfitKRW: 0,
  dailyProfitRate: 0,
  aiAutoTradeEnabled: true,
  aiTradeFrequency: 'CONSERVATIVE',
  maxPositionSizePercent: 30,
};

const INITIAL_MASTER_ACCOUNT: SimulationAccount = {
  accountNumber: '883-91-0428-10',
  accountName: 'Alpha-Q 10억 AI 자율운용 펀드 (단기 5억 + 중장기 5억)',
  initialCapitalKRW: 1000000000,
  cashKRW: 1000000000,
  cashUSD: 0,
  exchangeRateUSD_KRW: 1400,
  holdings: [],
  orders: [],
  totalAssetKRW: 1000000000,
  totalEvaluationProfitKRW: 0,
  totalProfitRate: 0,
  dailyProfitKRW: 0,
  dailyProfitRate: 0,
  aiAutoTradeEnabled: true,
  aiTradeFrequency: 'BALANCED',
  maxPositionSizePercent: 20,
  barbellStrategy: {
    enabled: true,
    dayTradeCapKRW: 500000000,
    valueCompoundingCapKRW: 500000000,
    dayTradeCurrentAllocKRW: 0,
    valueCompoundingCurrentAllocKRW: 0,
  },
};

function getKstDateStr(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // 'YYYY-MM-DD'
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function getKstHourMinute(): { hour: number; minute: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.format(new Date()).split(':');
    return {
      hour: parseInt(parts[0], 10) || 0,
      minute: parseInt(parts[1], 10) || 0,
    };
  } catch (e) {
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
  }
}

export function generateAIRequestId(prefix: string = 'REQ'): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${dateStr}-${rand}`;
}

const INITIAL_QUOTA: ApiQuotaUsage = {
  dailyLimit: 20,
  shortTermDailyLimit: 18,
  longTermDailyLimit: 2,
  dailyApiCalls: 0,
  shortTermCalls: 0,
  longTermCalls: 0,
  remainingCalls: 20,
  lastShortTermCallTime: 0,
  lastLongTermCallTime: 0,
  lastShortTermFailed: false,
  lastLongTermFailed: false,
  lastLongTermSlot: '',
  executedSlots: [],
  currentDate: getKstDateStr(),
  isLimitReached: false,
  limitMessage: '',
  nextShortTermScheduled: '1시간 후 (시장 운영시간 중)',
  nextLongTermScheduled: '09:00 / 18:00 (하루 2회)',
};

export interface ServerFundState {
  account: SimulationAccount;
  masterAccount: SimulationAccount;
  shortTermAccount: SimulationAccount;
  longTermAccount: SimulationAccount;
  quotaUsage: ApiQuotaUsage;
  decisions: AIFundDecision[];
  shortTermDecisions: AIFundDecision[];
  longTermDecisions: AIFundDecision[];
  liveThoughts: AIFundLiveThought[];
  lastBotTick: string;
  isAutoBotActive: boolean;
  marketStatusKR: { isOpen: boolean; statusText: string };
  marketStatusUS: { isOpen: boolean; statusText: string };
}

// Global in-memory cache
let inMemoryState: ServerFundState = {
  account: { ...INITIAL_MASTER_ACCOUNT },
  masterAccount: { ...INITIAL_MASTER_ACCOUNT },
  shortTermAccount: { ...INITIAL_SHORT_TERM_ACCOUNT },
  longTermAccount: { ...INITIAL_LONG_TERM_ACCOUNT },
  quotaUsage: { ...INITIAL_QUOTA },
  decisions: [],
  shortTermDecisions: [],
  longTermDecisions: [],
  liveThoughts: [],
  lastBotTick: new Date().toISOString(),
  isAutoBotActive: true,
  marketStatusKR: { isOpen: false, statusText: '국내 증시 마감' },
  marketStatusUS: { isOpen: false, statusText: '미국 증시 마감' },
};

// Interval and Cooldown Constants
const SHORT_TERM_INTERVAL_MS = 3600000; // 1 Hour interval for Short-Term AI
const LONG_TERM_MIN_INTERVAL_MS = 14400000; // 4 Hours minimum between slots
const ERROR_COOLDOWN_MS = 300000; // 5 minutes cooldown on AI error/failure

// Standardized AI response schema for Gemini Structured Output
const AI_DECISION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    strategy: { type: Type.STRING, enum: ['short_term', 'long_term'] },
    action: { type: Type.STRING, enum: ['BUY', 'SELL', 'HOLD'] },
    symbol: { type: Type.STRING, description: '선택한 종목 티커. HOLD일 경우 null 또는 빈 문자열' },
    confidence: { type: Type.INTEGER, description: '신뢰도 (50~99)' },
    expectedProfitPercent: { type: Type.NUMBER, description: '목표 기대 수익률 (%)' },
    stopLossPercent: { type: Type.NUMBER, description: '손절 관리 기준 (%)' },
    riskRewardRatio: { type: Type.STRING, description: '손익비 (예: 1 : 2.5)' },
    reason: { type: Type.STRING, description: '핵심 매매/관망 판단 사유 요약' },
    rationales: {
      type: Type.OBJECT,
      properties: {
        marketAnalysis: { type: Type.STRING, description: '시장 및 섹터 동향 분석' },
        valuationOrMomentum: { type: Type.STRING, description: '가격 변동률 및 밸류에이션/모멘텀 분석' },
        newsCatalyst: { type: Type.STRING, description: '실시간 뉴스 감정 및 기업 이슈' },
        riskManagement: { type: Type.STRING, description: '익절/손절 및 리스크 관리 전략' },
      },
      required: ['marketAnalysis', 'valuationOrMomentum', 'newsCatalyst', 'riskManagement'],
    },
  },
  required: ['strategy', 'action', 'confidence', 'expectedProfitPercent', 'stopLossPercent', 'reason', 'rationales'],
};

// Check and reset daily quota on date rollover (KST basis)
function checkAndResetDailyQuota() {
  const todayStr = getKstDateStr();
  if (inMemoryState.quotaUsage.currentDate !== todayStr) {
    console.log(`[API Quota Reset] Date changed from ${inMemoryState.quotaUsage.currentDate} to ${todayStr}. Resetting daily calls.`);
    inMemoryState.quotaUsage.currentDate = todayStr;
    inMemoryState.quotaUsage.dailyApiCalls = 0;
    inMemoryState.quotaUsage.shortTermCalls = 0;
    inMemoryState.quotaUsage.longTermCalls = 0;
    inMemoryState.quotaUsage.remainingCalls = 20;
    inMemoryState.quotaUsage.lastLongTermSlot = '';
    inMemoryState.quotaUsage.executedSlots = [];
    inMemoryState.quotaUsage.lastShortTermFailed = false;
    inMemoryState.quotaUsage.lastLongTermFailed = false;
    inMemoryState.quotaUsage.isLimitReached = false;
    inMemoryState.quotaUsage.limitMessage = '';

    const isoNow = new Date().toISOString();
    inMemoryState.liveThoughts.unshift({
      id: `TH-QUOTA-RESET-${Date.now().toString().slice(-6)}`,
      timestamp: isoNow,
      type: 'SCAN',
      message: `[일일 AI 한도 초기화] 새 날짜(${todayStr})가 시작되어 AI 일일 분석 한도(단기 18회 + 중장기 2회 = 총 20회)가 리셋되었습니다.`,
      score: 99,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
    saveServerFundState();
  }

  // Update remaining calls
  inMemoryState.quotaUsage.remainingCalls = Math.max(0, 20 - inMemoryState.quotaUsage.dailyApiCalls);
  if (inMemoryState.quotaUsage.dailyApiCalls >= 20) {
    inMemoryState.quotaUsage.isLimitReached = true;
    inMemoryState.quotaUsage.limitMessage = '오늘의 AI 분석 횟수(20/20회)를 모두 사용했습니다. 다음 분석은 내일 다시 시작됩니다.';
  } else {
    inMemoryState.quotaUsage.isLimitReached = false;
    inMemoryState.quotaUsage.limitMessage = '';
  }
}

// Load from disk on server launch
export function loadServerFundState(): ServerFundState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && (parsed.account || parsed.shortTermAccount)) {
        inMemoryState.shortTermAccount = parsed.shortTermAccount || { ...INITIAL_SHORT_TERM_ACCOUNT };
        inMemoryState.longTermAccount = parsed.longTermAccount || { ...INITIAL_LONG_TERM_ACCOUNT };
        inMemoryState.account = parsed.account || { ...INITIAL_MASTER_ACCOUNT };
        inMemoryState.masterAccount = parsed.masterAccount || inMemoryState.account;
        inMemoryState.quotaUsage = parsed.quotaUsage || { ...INITIAL_QUOTA };
        inMemoryState.decisions = Array.isArray(parsed.decisions) ? parsed.decisions : [];
        inMemoryState.shortTermDecisions = Array.isArray(parsed.shortTermDecisions) ? parsed.shortTermDecisions : [];
        inMemoryState.longTermDecisions = Array.isArray(parsed.longTermDecisions) ? parsed.longTermDecisions : [];
        inMemoryState.liveThoughts = Array.isArray(parsed.liveThoughts) ? parsed.liveThoughts : [];
        inMemoryState.isAutoBotActive = parsed.isAutoBotActive ?? true;
        inMemoryState.lastBotTick = parsed.lastBotTick || new Date().toISOString();

        checkAndResetDailyQuota();
        recalculateAllAccountValuationsSync();
        return inMemoryState;
      }
    }
  } catch (err) {
    console.error('Failed to load server fund state from disk:', err);
  }
  saveServerFundState();
  return inMemoryState;
}

export function saveServerFundState() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist server fund state to disk:', err);
  }
}

export function updateHoldingsMarketPrices(pricesMap: Record<string, number>, liveExchangeRate?: number): boolean {
  let changed = false;
  if (liveExchangeRate && liveExchangeRate > 1000 && inMemoryState.account.exchangeRateUSD_KRW !== liveExchangeRate) {
    inMemoryState.account.exchangeRateUSD_KRW = liveExchangeRate;
    inMemoryState.shortTermAccount.exchangeRateUSD_KRW = liveExchangeRate;
    inMemoryState.longTermAccount.exchangeRateUSD_KRW = liveExchangeRate;
    inMemoryState.masterAccount.exchangeRateUSD_KRW = liveExchangeRate;
    changed = true;
  }

  inMemoryState.shortTermAccount.holdings.forEach((h) => {
    const livePrice = pricesMap[h.ticker];
    if (typeof livePrice === 'number' && livePrice > 0 && livePrice !== h.currentPrice) {
      h.currentPrice = livePrice;
      changed = true;
    }
  });

  inMemoryState.longTermAccount.holdings.forEach((h) => {
    const livePrice = pricesMap[h.ticker];
    if (typeof livePrice === 'number' && livePrice > 0 && livePrice !== h.currentPrice) {
      h.currentPrice = livePrice;
      changed = true;
    }
  });

  if (changed) {
    recalculateAllAccountValuationsSync();
    saveServerFundState();
  }
  return changed;
}

// Safely insert order into account avoiding duplicates
function safeAddOrderToAccount(targetAccount: SimulationAccount, order: OrderRecord) {
  const exists = targetAccount.orders.some(
    (o) => o.id === order.id || (order.requestId && o.requestId === order.requestId && o.side === order.side && o.ticker === order.ticker)
  );
  if (!exists) {
    targetAccount.orders.unshift(order);
    if (targetAccount.orders.length > 200) targetAccount.orders.pop();
  }
}

// Safely insert decision avoiding duplicates
function safeAddDecision(decision: AIFundDecision, isShortTerm: boolean) {
  const targetList = isShortTerm ? inMemoryState.shortTermDecisions : inMemoryState.longTermDecisions;
  const exists = targetList.some(
    (d) => d.id === decision.id || (decision.requestId && d.requestId === decision.requestId)
  );
  if (!exists) {
    targetList.unshift(decision);
    if (targetList.length > 100) targetList.pop();
  }
}

// Synchronously recalculate totals across short-term, long-term, and master accounts
export function recalculateAllAccountValuationsSync() {
  const rate = inMemoryState.account.exchangeRateUSD_KRW || 1400;

  // 1. Short-term account
  let shortHoldingsEval = 0;
  let shortPurchase = 0;
  inMemoryState.shortTermAccount.holdings.forEach((h) => {
    const isKR = h.market === 'KR' || h.currency === 'KRW';
    const evalKRW = isKR ? h.currentPrice * h.quantity : h.currentPrice * h.quantity * rate;
    const buyKRW = isKR ? h.averageBuyPrice * h.quantity : h.averageBuyPrice * h.quantity * rate;
    h.totalEvaluationAmount = Math.round(evalKRW);
    h.totalPurchaseAmount = Math.round(buyKRW);
    h.evaluationProfit = h.totalEvaluationAmount - h.totalPurchaseAmount;
    h.profitRate = h.averageBuyPrice > 0 ? Number((((h.currentPrice - h.averageBuyPrice) / h.averageBuyPrice) * 100).toFixed(2)) : 0;
    shortHoldingsEval += h.totalEvaluationAmount;
    shortPurchase += h.totalPurchaseAmount;
  });
  inMemoryState.shortTermAccount.totalAssetKRW = Math.round(
    inMemoryState.shortTermAccount.cashKRW + (inMemoryState.shortTermAccount.cashUSD || 0) * rate + shortHoldingsEval
  );
  inMemoryState.shortTermAccount.totalEvaluationProfitKRW = inMemoryState.shortTermAccount.totalAssetKRW - inMemoryState.shortTermAccount.initialCapitalKRW;
  inMemoryState.shortTermAccount.totalProfitRate = Number(
    (((inMemoryState.shortTermAccount.totalAssetKRW - inMemoryState.shortTermAccount.initialCapitalKRW) / (inMemoryState.shortTermAccount.initialCapitalKRW || 1)) * 100).toFixed(2)
  );

  // 2. Long-term account
  let longHoldingsEval = 0;
  let longPurchase = 0;
  inMemoryState.longTermAccount.holdings.forEach((h) => {
    const isKR = h.market === 'KR' || h.currency === 'KRW';
    const evalKRW = isKR ? h.currentPrice * h.quantity : h.currentPrice * h.quantity * rate;
    const buyKRW = isKR ? h.averageBuyPrice * h.quantity : h.averageBuyPrice * h.quantity * rate;
    h.totalEvaluationAmount = Math.round(evalKRW);
    h.totalPurchaseAmount = Math.round(buyKRW);
    h.evaluationProfit = h.totalEvaluationAmount - h.totalPurchaseAmount;
    h.profitRate = h.averageBuyPrice > 0 ? Number((((h.currentPrice - h.averageBuyPrice) / h.averageBuyPrice) * 100).toFixed(2)) : 0;
    longHoldingsEval += h.totalEvaluationAmount;
    longPurchase += h.totalPurchaseAmount;
  });
  inMemoryState.longTermAccount.totalAssetKRW = Math.round(
    inMemoryState.longTermAccount.cashKRW + (inMemoryState.longTermAccount.cashUSD || 0) * rate + longHoldingsEval
  );
  inMemoryState.longTermAccount.totalEvaluationProfitKRW = inMemoryState.longTermAccount.totalAssetKRW - inMemoryState.longTermAccount.initialCapitalKRW;
  inMemoryState.longTermAccount.totalProfitRate = Number(
    (((inMemoryState.longTermAccount.totalAssetKRW - inMemoryState.longTermAccount.initialCapitalKRW) / (inMemoryState.longTermAccount.initialCapitalKRW || 1)) * 100).toFixed(2)
  );

  // 3. Master account (Combined 10억)
  const masterInitial = inMemoryState.shortTermAccount.initialCapitalKRW + inMemoryState.longTermAccount.initialCapitalKRW;
  const masterCashKRW = inMemoryState.shortTermAccount.cashKRW + inMemoryState.longTermAccount.cashKRW;
  const masterCashUSD = (inMemoryState.shortTermAccount.cashUSD || 0) + (inMemoryState.longTermAccount.cashUSD || 0);
  const masterTotalAssetKRW = inMemoryState.shortTermAccount.totalAssetKRW + inMemoryState.longTermAccount.totalAssetKRW;
  const masterProfitKRW = masterTotalAssetKRW - masterInitial;
  const masterProfitRate = Number(((masterProfitKRW / (masterInitial || 1)) * 100).toFixed(2));

  // Combine holdings and orders with strict deduplication
  const combinedHoldings = [...inMemoryState.shortTermAccount.holdings, ...inMemoryState.longTermAccount.holdings];
  combinedHoldings.forEach((h) => {
    h.allocationPercent = masterTotalAssetKRW > 0 ? Number(((h.totalEvaluationAmount / masterTotalAssetKRW) * 100).toFixed(1)) : 0;
  });

  const orderMap = new Map<string, OrderRecord>();
  inMemoryState.shortTermAccount.orders.forEach((o) => orderMap.set(o.id, o));
  inMemoryState.longTermAccount.orders.forEach((o) => orderMap.set(o.id, o));

  const combinedOrders = Array.from(orderMap.values()).sort((a, b) => {
    const timeA = new Date(a.executedAt || a.timestamp).getTime() || 0;
    const timeB = new Date(b.executedAt || b.timestamp).getTime() || 0;
    return timeB - timeA;
  });

  const decMap = new Map<string, AIFundDecision>();
  inMemoryState.shortTermDecisions.forEach((d) => decMap.set(d.id, d));
  inMemoryState.longTermDecisions.forEach((d) => decMap.set(d.id, d));
  const combinedDecisions = Array.from(decMap.values()).sort((a, b) => {
    const timeA = new Date(a.executedAt || a.timestamp).getTime() || 0;
    const timeB = new Date(b.executedAt || b.timestamp).getTime() || 0;
    return timeB - timeA;
  });
  inMemoryState.decisions = combinedDecisions;

  inMemoryState.masterAccount = {
    ...INITIAL_MASTER_ACCOUNT,
    initialCapitalKRW: masterInitial,
    cashKRW: masterCashKRW,
    cashUSD: masterCashUSD,
    holdings: combinedHoldings,
    orders: combinedOrders,
    totalAssetKRW: masterTotalAssetKRW,
    totalEvaluationProfitKRW: masterProfitKRW,
    totalProfitRate: masterProfitRate,
    aiAutoTradeEnabled: inMemoryState.isAutoBotActive,
    barbellStrategy: {
      enabled: true,
      dayTradeCapKRW: inMemoryState.shortTermAccount.initialCapitalKRW,
      valueCompoundingCapKRW: inMemoryState.longTermAccount.initialCapitalKRW,
      dayTradeCurrentAllocKRW: shortHoldingsEval,
      valueCompoundingCurrentAllocKRW: longHoldingsEval,
    },
  };

  inMemoryState.account = inMemoryState.masterAccount;
}

export function getServerFundState(): ServerFundState {
  inMemoryState.marketStatusKR = getMarketSessionStatus('KR');
  inMemoryState.marketStatusUS = getMarketSessionStatus('US');
  checkAndResetDailyQuota();
  return inMemoryState;
}

export function syncServerFundState(clientState: DualAccountFundState): ServerFundState {
  if (clientState.shortTermAccount) {
    inMemoryState.shortTermAccount = clientState.shortTermAccount;
  }
  if (clientState.longTermAccount) {
    inMemoryState.longTermAccount = clientState.longTermAccount;
  }
  if (clientState.quotaUsage) {
    inMemoryState.quotaUsage = clientState.quotaUsage;
  }
  if (Array.isArray(clientState.decisions)) {
    inMemoryState.decisions = clientState.decisions;
  }
  if (Array.isArray(clientState.liveThoughts)) {
    inMemoryState.liveThoughts = clientState.liveThoughts;
  }
  recalculateAllAccountValuationsSync();
  saveServerFundState();
  return inMemoryState;
}

// -------------------------------------------------------------------------------------------------
// LIVE PRICE RESOLUTION HELPER (Strict Real-Time Quotes - No Mock / Stale Fallbacks)
// -------------------------------------------------------------------------------------------------
export async function fetchVerifiedLiveExecutionPrice(
  ticker: string,
  market?: 'KR' | 'US',
  name?: string
): Promise<number | null> {
  const cleanTicker = (ticker || '').trim().toUpperCase();
  if (!cleanTicker) return null;
  const inferredMarket: 'KR' | 'US' = market || (/^\d{6}$/.test(cleanTicker) ? 'KR' : 'US');

  try {
    const quotes = await getLiveStockQuotes([
      { ticker: cleanTicker, market: inferredMarket, name }
    ]);
    const quote = quotes[cleanTicker];
    if (
      quote &&
      typeof quote.price === 'number' &&
      !isNaN(quote.price) &&
      isFinite(quote.price) &&
      quote.price > 0
    ) {
      return inferredMarket === 'KR' ? Math.round(quote.price) : Number(quote.price.toFixed(2));
    }
  } catch (err) {
    console.warn(`[LiveExecutionPrice] Failed to fetch live quote for ${cleanTicker}:`, err);
  }
  return null;
}

// -------------------------------------------------------------------------------------------------
// MANUAL TRADE EXECUTION (User-initiated direct order)
// -------------------------------------------------------------------------------------------------
export interface ManualTradeRequest {
  ticker: string;
  name: string;
  exchange?: any;
  market?: 'KR' | 'US';
  side: OrderSide;
  type?: OrderType;
  price?: number;
  quantity: number;
  accountType?: 'SHORT_TERM' | 'LONG_TERM';
  executedBy?: 'USER' | 'AI_AGENT';
}

export interface TradeExecutionResult {
  success: boolean;
  rejected?: boolean;
  executionStatus: 'COMPLETED' | 'REJECTED_MARKET_CLOSED' | 'REJECTED_PRICE_UNAVAILABLE' | 'REJECTED_INSUFFICIENT_FUNDS' | 'REJECTED_INSUFFICIENT_QUANTITY' | 'ERROR';
  message: string;
  order?: OrderRecord;
  state?: ServerFundState;
}

export async function executeManualTrade(req: ManualTradeRequest): Promise<TradeExecutionResult> {
  const isKR = req.market === 'KR' || /^\d{6}$/.test(req.ticker);
  const marketType: 'KR' | 'US' = isKR ? 'KR' : 'US';
  const sessionInfo = getMarketSessionStatus(marketType);

  if (req.quantity <= 0) {
    return {
      success: false,
      rejected: true,
      executionStatus: 'ERROR',
      message: '주문 수량은 0보다 커야 합니다.',
    };
  }

  // 1. Strict Market Session Check: Only REGULAR session allows trade execution
  if (sessionInfo.session !== 'REGULAR') {
    const rejectReason = `현재 ${marketType === 'KR' ? '국내' : '미국'} 증시가 정규 거래 시간이 아니므로 주문을 체결할 수 없습니다. (현재 상태: ${sessionInfo.statusText})`;
    return {
      success: false,
      rejected: true,
      executionStatus: 'REJECTED_MARKET_CLOSED',
      message: rejectReason,
    };
  }

  // 2. Fetch fresh verified live market price right before execution (No mock fallback)
  const livePrice = await fetchVerifiedLiveExecutionPrice(req.ticker, marketType, req.name);
  if (!livePrice || typeof livePrice !== 'number' || isNaN(livePrice) || !isFinite(livePrice) || livePrice <= 0) {
    return {
      success: false,
      rejected: true,
      executionStatus: 'REJECTED_PRICE_UNAVAILABLE',
      message: `실시간 시장가격을 조회할 수 없어 주문 체결이 안전하게 차단되었습니다. (${req.name || req.ticker})`,
    };
  }

  const executionPrice = livePrice;
  const executedAt = new Date().toISOString();

  // 3. Select target account (defaults to short-term for fast trades or long-term for value)
  const targetAcc = (req.accountType === 'LONG_TERM') 
    ? inMemoryState.longTermAccount 
    : inMemoryState.shortTermAccount;

  const rate = targetAcc.exchangeRateUSD_KRW || 1400;
  const singlePriceKRW = isKR ? executionPrice : executionPrice * rate;
  const totalAmountKRW = Math.round(singlePriceKRW * req.quantity);
  const totalAmountUSD = isKR ? undefined : Number((executionPrice * req.quantity).toFixed(2));

  if (req.side === 'BUY') {
    if (targetAcc.cashKRW < totalAmountKRW) {
      return {
        success: false,
        rejected: true,
        executionStatus: 'REJECTED_INSUFFICIENT_FUNDS',
        message: `주문 가능 현금 부족: 필요 금액 ${totalAmountKRW.toLocaleString()}원 (보유 현금: ${targetAcc.cashKRW.toLocaleString()}원)`,
      };
    }

    // 0 Fee virtual transaction
    targetAcc.cashKRW -= totalAmountKRW;
    const existingHolding = targetAcc.holdings.find(h => h.ticker === req.ticker);
    if (existingHolding) {
      const prevQty = existingHolding.quantity;
      const newTotalQty = prevQty + req.quantity;
      if (isKR) {
        const prevTotalCost = existingHolding.averageBuyPrice * prevQty;
        const newAvgBuyPrice = Math.round((prevTotalCost + totalAmountKRW) / newTotalQty);
        existingHolding.averageBuyPrice = newAvgBuyPrice;
      } else {
        const prevAvgUSD = existingHolding.averageBuyPrice;
        const newAvgUSD = Number((((prevAvgUSD * prevQty) + (executionPrice * req.quantity)) / newTotalQty).toFixed(2));
        existingHolding.averageBuyPrice = newAvgUSD;
      }
      existingHolding.quantity = newTotalQty;
      existingHolding.currentPrice = executionPrice;
      existingHolding.totalPurchaseAmount += totalAmountKRW;
      const evalKRW = isKR ? Math.round(newTotalQty * executionPrice) : Math.round(newTotalQty * executionPrice * rate);
      existingHolding.totalEvaluationAmount = evalKRW;
      existingHolding.evaluationProfit = evalKRW - existingHolding.totalPurchaseAmount;
      existingHolding.profitRate = Number((((executionPrice - existingHolding.averageBuyPrice) / (existingHolding.averageBuyPrice || 1)) * 100).toFixed(2));
      existingHolding.lastUpdated = executedAt;
    } else {
      targetAcc.holdings.push({
        ticker: req.ticker,
        name: req.name,
        exchange: req.exchange || (isKR ? 'KOSPI' : 'NASDAQ'),
        market: marketType,
        currency: isKR ? 'KRW' : 'USD',
        quantity: req.quantity,
        averageBuyPrice: executionPrice,
        currentPrice: executionPrice,
        totalPurchaseAmount: totalAmountKRW,
        totalEvaluationAmount: totalAmountKRW,
        evaluationProfit: 0,
        profitRate: 0,
        allocationPercent: 0,
        aiVerdict: 'BUY',
        aiTargetPrice: isKR ? Math.round(executionPrice * 1.15) : Number((executionPrice * 1.15).toFixed(2)),
        aiStopLoss: isKR ? Math.round(executionPrice * 0.95) : Number((executionPrice * 0.95).toFixed(2)),
        aiActionNote: '사용자 직접 매수 체결',
        strategyTrack: (req.accountType === 'LONG_TERM') ? 'VALUE_COMPOUNDING' : 'DAY_TRADE_MOMENTUM',
        buyTimestamp: Date.now(),
        lastUpdated: executedAt,
      });
    }

    const orderRecord: OrderRecord = {
      id: `ORD-USR-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      executedAt,
      timestamp: executedAt,
      ticker: req.ticker,
      name: req.name,
      exchange: req.exchange || (isKR ? 'KOSPI' : 'NASDAQ'),
      market: marketType,
      currency: isKR ? 'KRW' : 'USD',
      side: 'BUY',
      type: req.type || 'MARKET',
      price: executionPrice,
      quantity: req.quantity,
      totalAmount: totalAmountKRW,
      totalAmountUSD,
      fee: 0,
      status: 'COMPLETED',
      executedBy: req.executedBy || 'USER',
      strategyTrack: (req.accountType === 'LONG_TERM') ? 'VALUE_COMPOUNDING' : 'DAY_TRADE_MOMENTUM',
      reasoning: `정규장 실시간 직접 매수 체결 (${req.quantity}주 @ ${isKR ? executionPrice.toLocaleString() + '원' : '$' + executionPrice.toFixed(2)})`,
    };
    safeAddOrderToAccount(targetAcc, orderRecord);

    recalculateAllAccountValuationsSync();
    saveServerFundState();

    return {
      success: true,
      executionStatus: 'COMPLETED',
      message: `${req.name} ${req.quantity}주 매수 주문이 체결되었습니다. (체결단가: ${isKR ? executionPrice.toLocaleString() + '원' : '$' + executionPrice.toFixed(2)})`,
      order: orderRecord,
      state: inMemoryState,
    };
  } else {
    // SELL
    const existingHoldingIndex = targetAcc.holdings.findIndex(h => h.ticker === req.ticker);
    if (existingHoldingIndex === -1 || targetAcc.holdings[existingHoldingIndex].quantity < req.quantity) {
      return {
        success: false,
        rejected: true,
        executionStatus: 'REJECTED_INSUFFICIENT_QUANTITY',
        message: `매도 가능 수량 부족: 보유 ${existingHoldingIndex === -1 ? 0 : targetAcc.holdings[existingHoldingIndex].quantity}주 (요청: ${req.quantity}주)`,
      };
    }

    const holding = targetAcc.holdings[existingHoldingIndex];
    // 0 Fee virtual transaction
    targetAcc.cashKRW += totalAmountKRW;

    if (holding.quantity === req.quantity) {
      targetAcc.holdings.splice(existingHoldingIndex, 1);
    } else {
      holding.quantity -= req.quantity;
      const evalKRW = isKR ? Math.round(holding.quantity * executionPrice) : Math.round(holding.quantity * executionPrice * rate);
      const purchaseKRW = isKR ? Math.round(holding.quantity * holding.averageBuyPrice) : Math.round(holding.quantity * holding.averageBuyPrice * rate);
      holding.totalPurchaseAmount = purchaseKRW;
      holding.totalEvaluationAmount = evalKRW;
      holding.evaluationProfit = evalKRW - purchaseKRW;
      holding.currentPrice = executionPrice;
      holding.lastUpdated = executedAt;
    }

    const orderRecord: OrderRecord = {
      id: `ORD-USR-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      executedAt,
      timestamp: executedAt,
      ticker: req.ticker,
      name: req.name,
      exchange: req.exchange || (isKR ? 'KOSPI' : 'NASDAQ'),
      market: marketType,
      currency: isKR ? 'KRW' : 'USD',
      side: 'SELL',
      type: req.type || 'MARKET',
      price: executionPrice,
      quantity: req.quantity,
      totalAmount: totalAmountKRW,
      totalAmountUSD,
      fee: 0,
      status: 'COMPLETED',
      executedBy: req.executedBy || 'USER',
      strategyTrack: (req.accountType === 'LONG_TERM') ? 'VALUE_COMPOUNDING' : 'DAY_TRADE_MOMENTUM',
      reasoning: `정규장 실시간 직접 매도 체결 (${req.quantity}주 @ ${isKR ? executionPrice.toLocaleString() + '원' : '$' + executionPrice.toFixed(2)})`,
    };
    safeAddOrderToAccount(targetAcc, orderRecord);

    recalculateAllAccountValuationsSync();
    saveServerFundState();

    return {
      success: true,
      executionStatus: 'COMPLETED',
      message: `${req.name} ${req.quantity}주 매도 주문이 체결되었습니다. (체결단가: ${isKR ? executionPrice.toLocaleString() + '원' : '$' + executionPrice.toFixed(2)})`,
      order: orderRecord,
      state: inMemoryState,
    };
  }
}

// Reset both accounts with 5:5 5억원 split (or custom total capital)
export function resetServerFundState(totalCapital: number = 1000000000): ServerFundState {
  const cap = typeof totalCapital === 'number' && totalCapital >= 0 ? totalCapital : 1000000000;
  const halfCap = Math.round(cap / 2);

  inMemoryState.shortTermAccount = {
    ...INITIAL_SHORT_TERM_ACCOUNT,
    initialCapitalKRW: halfCap,
    cashKRW: halfCap,
    cashUSD: 0,
    holdings: [],
    orders: [],
    totalAssetKRW: halfCap,
    totalEvaluationProfitKRW: 0,
    totalProfitRate: 0,
    dailyProfitKRW: 0,
    dailyProfitRate: 0,
  };

  inMemoryState.longTermAccount = {
    ...INITIAL_LONG_TERM_ACCOUNT,
    initialCapitalKRW: halfCap,
    cashKRW: halfCap,
    cashUSD: 0,
    holdings: [],
    orders: [],
    totalAssetKRW: halfCap,
    totalEvaluationProfitKRW: 0,
    totalProfitRate: 0,
    dailyProfitKRW: 0,
    dailyProfitRate: 0,
  };

  inMemoryState.decisions = [];
  inMemoryState.shortTermDecisions = [];
  inMemoryState.longTermDecisions = [];
  inMemoryState.liveThoughts = [
    {
      id: `TH-RESET-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'SCAN',
      message: `[계좌 초기화 완료] 단기 계좌 및 중장기 계좌의 모든 보유주식이 청산되고 총 ${cap === 0 ? '0원' : (cap / 100000000).toFixed(0) + '억 원'}으로 초기화되었습니다.`,
      score: 99,
    },
  ];

  recalculateAllAccountValuationsSync();
  saveServerFundState();
  return inMemoryState;
}

export function updateServerAutoTradeStatus(enabled: boolean): ServerFundState {
  inMemoryState.isAutoBotActive = enabled;
  inMemoryState.shortTermAccount.aiAutoTradeEnabled = enabled;
  inMemoryState.longTermAccount.aiAutoTradeEnabled = enabled;
  inMemoryState.masterAccount.aiAutoTradeEnabled = enabled;
  inMemoryState.account.aiAutoTradeEnabled = enabled;
  saveServerFundState();
  return inMemoryState;
}

// -------------------------------------------------------------------------------------------------
// 1. SHORT-TERM TRADING AI ENGINE (1시간 주기 최대 1회, 일 최대 18회, 시장 운영시간 내)
// -------------------------------------------------------------------------------------------------
async function executeShortTermAITradeStep(aiClient: any, universe: StockItem[] = []): Promise<AIFundDecision | null> {
  const account = inMemoryState.shortTermAccount;
  const rate = account.exchangeRateUSD_KRW || 1400;
  const isKROpen = inMemoryState.marketStatusKR.isOpen;
  const isUSOpen = inMemoryState.marketStatusUS.isOpen;

  // Strict check: Only open markets are eligible for short-term trading
  if (!isKROpen && !isUSOpen) {
    return null;
  }

  // Filter universe to open markets
  const openUniverse = universe.filter((u) => {
    if (u.market === 'KR' && isKROpen) return true;
    if (u.market === 'US' && isUSOpen) return true;
    return false;
  });

  if (openUniverse.length === 0) {
    return null;
  }

  // Sort candidates by momentum (24h change % magnitude or volume)
  const sortedUniverse = [...openUniverse].sort((a, b) => {
    const changeA = Math.abs(typeof a.changePercent === 'number' ? a.changePercent : 0);
    const changeB = Math.abs(typeof b.changePercent === 'number' ? b.changePercent : 0);
    return changeB - changeA;
  });

  const candidateList = sortedUniverse.slice(0, 10);
  const candidateQuotes = await getLiveStockQuotes(
    candidateList.map((c) => ({ ticker: c.ticker, market: c.market, name: c.name }))
  );

  // Filter candidates to ONLY those with verified real-time live quotes (price > 0)
  const validCandidates = candidateList.filter((c) => {
    const q = candidateQuotes[c.ticker];
    return q && typeof q.price === 'number' && q.price > 0;
  });

  if (validCandidates.length === 0) {
    console.warn('[Short-term AI] No candidates with valid real-time quotes found. Skipping AI call.');
    return null;
  }

  // Fetch real breaking market news for top items
  const sampleTickersToNews = [
    ...account.holdings.slice(0, 3).map((h) => ({ ticker: h.ticker, name: h.name })),
    ...validCandidates.slice(0, 3).map((c) => ({ ticker: c.ticker, name: c.name })),
  ];

  const newsPromises = sampleTickersToNews.map(async (item) => {
    const newsItems = await getRealMarketNews(item.name || item.ticker, 2);
    return {
      ticker: item.ticker,
      name: item.name,
      headlines: newsItems.map((n) => `[${n.publisher}] ${n.title}`).join(' // ') || '특이 뉴스 없음',
    };
  });

  const newsResults = await Promise.all(newsPromises);
  const newsMap: Record<string, string> = {};
  newsResults.forEach((nr) => {
    newsMap[nr.ticker] = nr.headlines;
  });

  const candidateDataFormatted = validCandidates.map((c) => {
    const q = candidateQuotes[c.ticker];
    return {
      ticker: c.ticker,
      name: c.name,
      market: c.market,
      exchange: c.exchange,
      price: q.price,
      changePercent: q.changePercent ?? c.changePercent,
      volume: q.volume || c.volume,
      sector: c.sector || '일반',
      news: newsMap[c.ticker] || '일반 시황',
    };
  });

  const holdingsFormatted = account.holdings.map((h) => ({
    ticker: h.ticker,
    name: h.name,
    quantity: h.quantity,
    averageBuyPrice: h.averageBuyPrice,
    currentPrice: h.currentPrice,
    profitRate: h.profitRate,
    totalEvaluationAmountKRW: h.totalEvaluationAmount,
    news: newsMap[h.ticker] || '보유 포지션',
  }));

  const recentMemories = inMemoryState.shortTermDecisions.slice(0, 5).map((d) => ({
    time: d.executedAt || d.timestamp,
    action: d.action,
    ticker: d.ticker,
    name: d.name,
    reason: d.rationales?.newsCatalyst || d.rationales?.marketAnalysis || '단기 모멘텀',
  }));

  const systemInstruction = `당신은 5억 원의 가상 단기 트레이딩 자금을 운용하는 전문 단기 퀀트 AI 트레이더 [알파-Q (단기 트레이딩)]입니다.
당신은 실시간 현재가, 당일 등락률, 거래량, 업종, 실시간 뉴스 헤드라인을 종합 분석하여 [BUY, SELL, HOLD] 중 최적의 행동을 결정합니다.
- 보유 현금이 충분하고 후보 종목 중 상승 돌파 모멘텀 또는 뚜렷한 촉매(Catalyst)가 확인되는 경우 적극적으로 [BUY]를 결정하십시오.
- 기존 보유 종목 중 목표가 도달 또는 이익 실현/손절이 필요한 경우 [SELL]을 결정하십시오.
- 시장이 극도로 불확실하거나 적절한 진입 기회가 없을 때만 [HOLD]를 선택하십시오.`;

  const userPrompt = `
[단기 트레이딩 계좌 현황]
- 총 자산: ${account.totalAssetKRW.toLocaleString()}원 (초기 자금: 500,000,000원)
- 주문가능 현금 (KRW): ${account.cashKRW.toLocaleString()}원
- 누적 수익률: ${account.totalProfitRate}%
- 현재 보유 종목 (${holdingsFormatted.length}개):
${holdingsFormatted.length > 0 ? JSON.stringify(holdingsFormatted, null, 2) : '현재 보유 주식 없음 (100% 현금 대기 중)'}

[AI 최근 단기 매매 기록]
${recentMemories.length > 0 ? JSON.stringify(recentMemories, null, 2) : '최근 매매 기록 없음 (초기 상태)'}

[실시간 개장 시장 단기 매수 후보군 (${candidateDataFormatted.length}개)]
${JSON.stringify(candidateDataFormatted, null, 2)}

[의사결정 요구사항]
위 실시간 데이터와 단기 계좌 현황을 바탕으로 BUY, SELL, HOLD 결정을 JSON 형식으로 내리십시오.
`;

  // Check quota limit before attempting call
  if (inMemoryState.quotaUsage.dailyApiCalls >= 20 || inMemoryState.quotaUsage.shortTermCalls >= 18) {
    console.warn('[Short-term AI] Daily call quota reached. Skipping call.');
    return null;
  }

  // PRE-INCREMENT QUOTA USAGE (Hard count before API dispatch)
  inMemoryState.quotaUsage.dailyApiCalls += 1;
  inMemoryState.quotaUsage.shortTermCalls += 1;
  inMemoryState.quotaUsage.lastShortTermCallTime = Date.now();
  inMemoryState.quotaUsage.remainingCalls = Math.max(0, 20 - inMemoryState.quotaUsage.dailyApiCalls);
  saveServerFundState();

  const requestId = generateAIRequestId('REQ-ST');
  const requestStartTime = new Date().toISOString();
  let aiResponseTime: string = requestStartTime;
  const usedModel = 'gemini-3.7-flash';
  let aiResult: any = null;

  console.log(`[AI_REQUEST]\nrequestId: ${requestId}\nstrategy: short_term\nmodel: ${usedModel}\ncandidates: ${candidateDataFormatted.map((c) => c.ticker).join(', ')}\ntime: ${requestStartTime}`);

  try {
    const response = await aiClient.models.generateContent({
      model: usedModel,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: AI_DECISION_RESPONSE_SCHEMA,
      },
    });

    aiResponseTime = new Date().toISOString();
    const text = response?.text;
    if (!text) {
      throw new Error('Gemini API returned empty response content.');
    }

    aiResult = JSON.parse(text);
    if (!aiResult || !aiResult.action || !['BUY', 'SELL', 'HOLD'].includes(aiResult.action)) {
      throw new Error('Malformed AI response JSON: missing valid action.');
    }

    inMemoryState.quotaUsage.lastShortTermFailed = false;
    console.log(`[GEMINI_RESPONSE]\nrequestId: ${requestId}\nsuccess: true\nmodel: ${usedModel}\naction: ${aiResult.action}\nsymbol: ${aiResult.symbol || 'NONE'}\nconfidence: ${aiResult.confidence}%\ntime: ${aiResponseTime}`);
  } catch (apiErr: any) {
    aiResponseTime = new Date().toISOString();
    console.warn(`[GEMINI_RESPONSE_FAIL]\nrequestId: ${requestId}\nsuccess: false\nerror: ${apiErr?.message || 'Unknown Gemini API Error'}\ntime: ${aiResponseTime}`);
    
    // On failure: enforce 5-minute cooldown and HOLD (no fake trading executed)
    inMemoryState.quotaUsage.lastShortTermFailed = true;
    inMemoryState.quotaUsage.lastShortTermCallTime = Date.now();

    inMemoryState.liveThoughts.unshift({
      id: `TH-ERR-${Date.now().toString().slice(-6)}`,
      timestamp: aiResponseTime,
      type: 'RISK_CHECK',
      message: `[단기 AI 호출 지연 - 안전 관망 유지 (ID: ${requestId})] ${apiErr?.message || 'API 응답 지연'} (가상 잔고 보존 및 HOLD)`,
      score: 0,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return null;
  }

  const action = aiResult?.action || 'HOLD';
  const symbol = aiResult?.symbol ? String(aiResult.symbol).trim() : null;

  // 1. HOLD Decision - No order created, no fake transaction
  if (action === 'HOLD' || !symbol) {
    const executedAt = new Date().toISOString();
    const holdThought: AIFundLiveThought = {
      id: `TH-ST-HOLD-${Date.now().toString().slice(-6)}`,
      timestamp: executedAt,
      type: 'SCAN',
      message: `[단기 AI 관망 유지 (${inMemoryState.quotaUsage.shortTermCalls}/18회, ID: ${requestId})] ${aiResult.reason || '단기 리스크 관리 및 관망 유지'}`,
      score: aiResult.confidence || 85,
    };
    inMemoryState.liveThoughts.unshift(holdThought);
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return null;
  }

  // 2. SELL Decision
  if (action === 'SELL') {
    const holdingToSell = account.holdings.find((h) => h.ticker === symbol);
    if (!holdingToSell) {
      console.warn(`[ORDER_VALIDATED]\nrequestId: ${requestId}\nstatus: REJECTED\nreason: Symbol ${symbol} not held in account.`);
      saveServerFundState();
      return null;
    }

    const sessionInfo = getMarketSessionStatus(holdingToSell.market);
    if (sessionInfo.session !== 'REGULAR') {
      console.warn(`[ORDER_VALIDATED]\nrequestId: ${requestId}\nstatus: REJECTED\nreason: Market closed (${sessionInfo.statusText})`);
      saveServerFundState();
      return null;
    }

    // Strictly fetch fresh live execution quote right before execution - NO FALLBACK
    const livePrice = await fetchVerifiedLiveExecutionPrice(holdingToSell.ticker, holdingToSell.market, holdingToSell.name);
    if (!livePrice || typeof livePrice !== 'number' || isNaN(livePrice) || !isFinite(livePrice) || livePrice <= 0) {
      console.warn(`[ORDER_VALIDATED]\nrequestId: ${requestId}\nstatus: REJECTED\nreason: Real-time live quote unavailable for SELL ${holdingToSell.ticker}`);
      saveServerFundState();
      return null;
    }
    const realSellPrice = livePrice;

    const isKR = holdingToSell.market === 'KR' || holdingToSell.currency === 'KRW';
    const singleSellKRW = isKR ? realSellPrice : realSellPrice * rate;
    const sellAmountKRW = Math.round(holdingToSell.quantity * singleSellKRW);
    const sellAmountUSD = isKR ? undefined : Number((holdingToSell.quantity * realSellPrice).toFixed(2));
    const finalProfitRate = Number((((realSellPrice - holdingToSell.averageBuyPrice) / (holdingToSell.averageBuyPrice || 1)) * 100).toFixed(2));
    const isProfit = finalProfitRate >= 0;

    const orderId = `ORD-ST-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const executedAt = new Date().toISOString();

    // Execute Sell in Short-term account (0 fee)
    account.holdings = account.holdings.filter((h) => h.ticker !== holdingToSell.ticker);
    account.cashKRW += sellAmountKRW;

    const orderRecord: OrderRecord = {
      id: orderId,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: usedModel,
      aiRequestTime: requestStartTime,
      aiResponseTime,
      executedAt,
      timestamp: executedAt,
      ticker: holdingToSell.ticker,
      name: holdingToSell.name,
      exchange: holdingToSell.exchange,
      market: holdingToSell.market,
      currency: isKR ? 'KRW' : 'USD',
      side: 'SELL',
      type: 'AI_OPTIMAL',
      price: realSellPrice,
      quantity: holdingToSell.quantity,
      totalAmount: sellAmountKRW,
      totalAmountUSD: sellAmountUSD,
      fee: 0,
      status: 'COMPLETED',
      executedBy: 'AI_AGENT',
      strategyTrack: 'DAY_TRADE_MOMENTUM',
      reasoning: `[단기 AI 매도] ${finalProfitRate >= 0 ? '+' : ''}${finalProfitRate}% (${(sellAmountKRW / 100000000).toFixed(2)}억 회수). 사유: ${aiResult.reason}`,
    };
    safeAddOrderToAccount(account, orderRecord);

    const decision: AIFundDecision = {
      id: `AI-DEC-ST-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: usedModel,
      aiRequestTime: requestStartTime,
      aiResponseTime,
      rawAIResponseSummary: aiResult.reason,
      executedAt,
      timestamp: executedAt,
      action: 'SELL',
      ticker: holdingToSell.ticker,
      name: holdingToSell.name,
      market: holdingToSell.market,
      exchange: holdingToSell.exchange,
      currency: isKR ? 'KRW' : 'USD',
      price: realSellPrice,
      quantity: holdingToSell.quantity,
      amountKRW: sellAmountKRW,
      amountUSD: sellAmountUSD,
      confidence: aiResult.confidence || 92,
      expectedProfitPercent: finalProfitRate,
      stopLossPercent: 0,
      riskRewardRatio: aiResult.riskRewardRatio || '1 : 2.5',
      macroRegime: '단기 모멘텀 이익실현 / 손절',
      tradeCategory: 'QUICK_SCALP_PROFIT',
      strategyTrack: 'DAY_TRADE_MOMENTUM',
      rationales: aiResult.rationales,
      aiPersona: '알파-Q (단기 트레이딩)',
      executionStatus: 'COMPLETED',
    };

    safeAddDecision(decision, true);

    inMemoryState.liveThoughts.unshift({
      id: `TH-ST-SELL-${Date.now()}`,
      timestamp: executedAt,
      ticker: holdingToSell.ticker,
      stockName: holdingToSell.name,
      type: isProfit ? 'EXECUTE_SELL' : 'RISK_CHECK',
      message: `[단기 AI 매도 체결 (ID: ${requestId})] ${holdingToSell.name} ${holdingToSell.quantity}주 매도 (${finalProfitRate >= 0 ? '+' : ''}${finalProfitRate}%, ${(sellAmountKRW / 100000000).toFixed(2)}억 원 회수).`,
      score: aiResult.confidence || 95,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return decision;
  }

  // 3. BUY Decision
  if (action === 'BUY') {
    const targetCandidate = validCandidates.find((c) => c.ticker === symbol);
    if (!targetCandidate) {
      console.warn(`[ORDER_VALIDATED]\nrequestId: ${requestId}\nstatus: REJECTED\nreason: Target symbol ${symbol} candidate not in valid real-time candidate list.`);
      saveServerFundState();
      return null;
    }

    const sessionInfo = getMarketSessionStatus(targetCandidate.market);
    if (sessionInfo.session !== 'REGULAR') {
      console.warn(`[ORDER_VALIDATED]\nrequestId: ${requestId}\nstatus: REJECTED\nreason: Market closed (${sessionInfo.statusText})`);
      saveServerFundState();
      return null;
    }

    if (account.cashKRW < 10000000) {
      console.warn(`[ORDER_VALIDATED]\nrequestId: ${requestId}\nstatus: REJECTED\nreason: Insufficient cash balance (${account.cashKRW.toLocaleString()} KRW)`);
      const executedAt = new Date().toISOString();
      inMemoryState.liveThoughts.unshift({
        id: `TH-ST-NOCASH-${Date.now().toString().slice(-6)}`,
        timestamp: executedAt,
        type: 'RISK_CHECK',
        message: `[단기 계좌 현금 부족] ${targetCandidate.name} 매수 시도하였으나 단기 가용현금(${account.cashKRW.toLocaleString()}원) 부족으로 보류.`,
        score: 80,
      });
      if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
      saveServerFundState();
      return null;
    }

    // Strictly re-fetch verified live execution price right before BUY execution - No mock fallback
    const freshLivePrice = await fetchVerifiedLiveExecutionPrice(targetCandidate.ticker, targetCandidate.market, targetCandidate.name);
    if (!freshLivePrice || typeof freshLivePrice !== 'number' || isNaN(freshLivePrice) || !isFinite(freshLivePrice) || freshLivePrice <= 0) {
      console.warn(`[ORDER_VALIDATED]\nrequestId: ${requestId}\nstatus: REJECTED\nreason: Real-time live execution price unavailable for BUY ${targetCandidate.ticker}`);
      saveServerFundState();
      return null;
    }
    const realLivePrice = freshLivePrice;

    const isKR = targetCandidate.market === 'KR' || /^\d{6}$/.test(targetCandidate.ticker);
    const singlePriceKRW = isKR ? realLivePrice : realLivePrice * rate;

    // Short-term position sizing: ~50M KRW cap per position
    const desiredAllocKRW = 50000000;
    const allocateKRW = Math.min(desiredAllocKRW, account.cashKRW);
    const quantity = Math.max(1, Math.floor(allocateKRW / (singlePriceKRW || 100000)));
    const totalCostKRW = Math.round(quantity * singlePriceKRW);
    const totalCostUSD = isKR ? undefined : Number((quantity * realLivePrice).toFixed(2));

    if (totalCostKRW > account.cashKRW) {
      console.warn(`[ORDER_VALIDATED]\nrequestId: ${requestId}\nstatus: REJECTED\nreason: Total cost exceeds cash.`);
      saveServerFundState();
      return null;
    }

    const orderId = `ORD-ST-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const executedAt = new Date().toISOString();

    // 0 fee virtual trade
    account.cashKRW -= totalCostKRW;

    const targetProfit = Math.min(100, Math.max(0.5, Number(aiResult.expectedProfitPercent) || 6.0));
    const stopLossPct = Math.min(50, Math.max(0.5, Number(aiResult.stopLossPercent) || 2.5));
    const targetPrice = isKR ? Math.round(realLivePrice * (1 + targetProfit / 100)) : Number((realLivePrice * (1 + targetProfit / 100)).toFixed(2));
    const stopLoss = isKR ? Math.round(realLivePrice * (1 - stopLossPct / 100)) : Number((realLivePrice * (1 - stopLossPct / 100)).toFixed(2));

    const existingIdx = account.holdings.findIndex((h) => h.ticker === targetCandidate.ticker);
    if (existingIdx >= 0) {
      const current = account.holdings[existingIdx];
      const prevQty = current.quantity;
      const newQty = prevQty + quantity;
      let newAvgPrice = realLivePrice;
      if (isKR) {
        const prevTotalPurchase = current.totalPurchaseAmount;
        newAvgPrice = Math.round((prevTotalPurchase + totalCostKRW) / newQty);
      } else {
        const prevAvgUSD = current.averageBuyPrice;
        newAvgPrice = Number((((prevAvgUSD * prevQty) + (realLivePrice * quantity)) / newQty).toFixed(2));
      }
      const newTotalPurchase = current.totalPurchaseAmount + totalCostKRW;
      const totalEval = isKR ? Math.round(newQty * realLivePrice) : Math.round(newQty * realLivePrice * rate);
      account.holdings[existingIdx] = {
        ...current,
        quantity: newQty,
        averageBuyPrice: newAvgPrice,
        currentPrice: realLivePrice,
        totalPurchaseAmount: newTotalPurchase,
        totalEvaluationAmount: totalEval,
        evaluationProfit: totalEval - newTotalPurchase,
        profitRate: Number((((realLivePrice - newAvgPrice) / (newAvgPrice || 1)) * 100).toFixed(2)),
        lastUpdated: executedAt,
      };
    } else {
      account.holdings.push({
        ticker: targetCandidate.ticker,
        name: targetCandidate.name,
        exchange: targetCandidate.exchange,
        market: targetCandidate.market,
        currency: isKR ? 'KRW' : 'USD',
        quantity,
        averageBuyPrice: realLivePrice,
        currentPrice: realLivePrice,
        totalPurchaseAmount: totalCostKRW,
        totalEvaluationAmount: totalCostKRW,
        evaluationProfit: 0,
        profitRate: 0,
        allocationPercent: 0,
        aiVerdict: 'STRONG_BUY',
        aiTargetPrice: targetPrice,
        aiStopLoss: stopLoss,
        strategyTrack: 'DAY_TRADE_MOMENTUM',
        buyTimestamp: Date.now(),
        aiActionNote: `[단기 AI (Gemini)] 체결가: ${realLivePrice.toLocaleString()}${isKR ? '원' : '$'}, 목표가: ${targetPrice.toLocaleString()} (+${targetProfit}%)`,
        lastUpdated: executedAt,
      });
    }

    const orderRecord: OrderRecord = {
      id: orderId,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: usedModel,
      aiRequestTime: requestStartTime,
      aiResponseTime,
      executedAt,
      timestamp: executedAt,
      ticker: targetCandidate.ticker,
      name: targetCandidate.name,
      exchange: targetCandidate.exchange,
      market: targetCandidate.market,
      currency: isKR ? 'KRW' : 'USD',
      side: 'BUY',
      type: 'AI_OPTIMAL',
      price: realLivePrice,
      quantity,
      totalAmount: totalCostKRW,
      totalAmountUSD: totalCostUSD,
      fee: 0,
      status: 'COMPLETED',
      executedBy: 'AI_AGENT',
      strategyTrack: 'DAY_TRADE_MOMENTUM',
      reasoning: `[단기 AI 매수 체결] ${targetCandidate.name} ${quantity}주 (${(totalCostKRW / 100000000).toFixed(2)}억 원). 사유: ${aiResult.reason}`,
    };
    safeAddOrderToAccount(account, orderRecord);

    const decision: AIFundDecision = {
      id: `AI-DEC-ST-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: usedModel,
      aiRequestTime: requestStartTime,
      aiResponseTime,
      rawAIResponseSummary: aiResult.reason,
      executedAt,
      timestamp: executedAt,
      action: 'BUY',
      ticker: targetCandidate.ticker,
      name: targetCandidate.name,
      market: targetCandidate.market,
      exchange: targetCandidate.exchange,
      currency: isKR ? 'KRW' : 'USD',
      price: realLivePrice,
      quantity,
      amountKRW: totalCostKRW,
      amountUSD: totalCostUSD,
      confidence: aiResult.confidence || 95,
      expectedProfitPercent: targetProfit,
      stopLossPercent: stopLossPct,
      riskRewardRatio: aiResult.riskRewardRatio || '1 : 2.5',
      macroRegime: '단기 거래량 급증 돌파 모멘텀',
      tradeCategory: 'HIGH_VOLATILITY_BREAKOUT',
      strategyTrack: 'DAY_TRADE_MOMENTUM',
      rationales: aiResult.rationales,
      aiPersona: '알파-Q (단기 트레이딩)',
      executionStatus: 'COMPLETED',
    };

    safeAddDecision(decision, true);

    inMemoryState.liveThoughts.unshift({
      id: `TH-ST-BUY-${Date.now()}`,
      timestamp: executedAt,
      ticker: targetCandidate.ticker,
      stockName: targetCandidate.name,
      type: 'EXECUTE_BUY',
      message: `[단기 AI 매수 체결 (ID: ${requestId})] ${targetCandidate.name} ${quantity}주 (${(totalCostKRW / 100000000).toFixed(2)}억 원) 자동 체결.`,
      score: 98,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return decision;
  }

  saveServerFundState();
  return null;
}

// -------------------------------------------------------------------------------------------------
// 2. LONG-TERM VALUE INVESTING AI ENGINE (하루 2회 09:00 / 18:00 정밀 분석)
// -------------------------------------------------------------------------------------------------
async function executeLongTermAITradeStep(
  aiClient: any, 
  universe: StockItem[] = [], 
  slotName: '09:00' | '18:00' = '09:00'
): Promise<AIFundDecision | null> {
  const account = inMemoryState.longTermAccount;
  const rate = account.exchangeRateUSD_KRW || 1400;
  const isKROpen = inMemoryState.marketStatusKR.isOpen;
  const isUSOpen = inMemoryState.marketStatusUS.isOpen;

  // Filter candidates
  const openUniverse = universe.filter((u) => {
    if (u.market === 'KR' && isKROpen) return true;
    if (u.market === 'US' && isUSOpen) return true;
    return false;
  });

  const targetUniverse = openUniverse.length > 0 ? openUniverse : universe;
  if (targetUniverse.length === 0) {
    return null;
  }

  // Filter for blue-chip / dividend / fundamental leaders
  const candidates = targetUniverse
    .filter((u) => u.sector === '반도체' || u.sector === '빅테크' || u.sector === 'AI' || u.sector === '헬스케어' || u.marketCap !== '-')
    .slice(0, 10);

  const candidateList = candidates.length > 0 ? candidates : targetUniverse.slice(0, 10);
  const candidateQuotes = await getLiveStockQuotes(
    candidateList.map((c) => ({ ticker: c.ticker, market: c.market, name: c.name }))
  );

  const validCandidates = candidateList.filter((c) => {
    const q = candidateQuotes[c.ticker];
    return q && typeof q.price === 'number' && q.price > 0;
  });

  if (validCandidates.length === 0) {
    console.warn('[Long-term AI] No candidates with valid real-time quotes found.');
    return null;
  }

  const sampleTickersToNews = [
    ...account.holdings.slice(0, 4).map((h) => ({ ticker: h.ticker, name: h.name })),
    ...validCandidates.slice(0, 4).map((c) => ({ ticker: c.ticker, name: c.name })),
  ];

  const newsPromises = sampleTickersToNews.map(async (item) => {
    const newsItems = await getRealMarketNews(item.name || item.ticker, 2);
    return {
      ticker: item.ticker,
      name: item.name,
      headlines: newsItems.map((n) => `[${n.publisher}] ${n.title}`).join(' // ') || '기업 펀더멘털 안정',
    };
  });

  const newsResults = await Promise.all(newsPromises);
  const newsMap: Record<string, string> = {};
  newsResults.forEach((nr) => {
    newsMap[nr.ticker] = nr.headlines;
  });

  const candidateDataFormatted = validCandidates.map((c) => {
    const q = candidateQuotes[c.ticker];
    return {
      ticker: c.ticker,
      name: c.name,
      market: c.market,
      exchange: c.exchange,
      price: q.price,
      changePercent: q.changePercent ?? c.changePercent,
      sector: c.sector || '우량주',
      marketCap: q.marketCap || c.marketCap,
      news: newsMap[c.ticker] || '기업 기본 분석',
    };
  });

  const holdingsFormatted = account.holdings.map((h) => ({
    ticker: h.ticker,
    name: h.name,
    quantity: h.quantity,
    averageBuyPrice: h.averageBuyPrice,
    currentPrice: h.currentPrice,
    profitRate: h.profitRate,
    totalEvaluationAmountKRW: h.totalEvaluationAmount,
    news: newsMap[h.ticker] || '장기 보유 포지션',
  }));

  const recentMemories = inMemoryState.longTermDecisions.slice(0, 5).map((d) => ({
    time: d.executedAt || d.timestamp,
    action: d.action,
    ticker: d.ticker,
    name: d.name,
    reason: d.rationales?.valuationOrMomentum || d.rationales?.marketAnalysis || '중장기 가치투자',
  }));

  const systemInstruction = `당신은 5억 원의 가상 중장기 가치투자 자금을 운용하는 전문 밸류에이션 AI 펀드매니저 [벤자민-Q (중장기 가치투자)]입니다.
당신은 하루 2회(09:00, 18:00) 거시 경제, 기업 밸류에이션, 실시간 가격 및 뉴스를 종합하여 [BUY, SELL, HOLD]를 결정합니다.
- 우량 기업의 밸류에이션 매력도가 높고 안전마진이 확보된 경우 [BUY]를 결정하십시오.
- 기존 보유 종목이 장기 목표가에 도달하였거나 펀더멘털 훼손이 발생한 경우 [SELL]을 결정하십시오.
- 그 외의 경우 불필요한 회전을 피하고 장기 복리 효과를 위해 [HOLD]를 유지하십시오.`;

  const userPrompt = `
[중장기 가치투자 계좌 현황 (${slotName} 정기 분석)]
- 총 자산: ${account.totalAssetKRW.toLocaleString()}원 (초기 자금: 500,000,000원)
- 주문가능 현금 (KRW): ${account.cashKRW.toLocaleString()}원
- 누적 수익률: ${account.totalProfitRate}%
- 현재 보유 종목 (${holdingsFormatted.length}개):
${holdingsFormatted.length > 0 ? JSON.stringify(holdingsFormatted, null, 2) : '현재 보유 주식 없음 (100% 현금 대기 중)'}

[AI 최근 중장기 매매 기록]
${recentMemories.length > 0 ? JSON.stringify(recentMemories, null, 2) : '최근 매매 기록 없음 (초기 상태)'}

[실시간 우량 가치주 후보군 (${candidateDataFormatted.length}개)]
${JSON.stringify(candidateDataFormatted, null, 2)}

[의사결정 요구사항]
위 실시간 데이터와 중장기 계좌 현황을 바탕으로 BUY, SELL, HOLD 결정을 JSON 형식으로 내리십시오.
`;

  // Pre-check quota
  if (inMemoryState.quotaUsage.dailyApiCalls >= 20 || inMemoryState.quotaUsage.longTermCalls >= 2) {
    console.warn('[Long-term AI] Daily call quota reached. Skipping call.');
    return null;
  }

  // Pre-increment quota and record slot
  const todayStr = getKstDateStr();
  const slotKey = `${todayStr}-${slotName}`;
  inMemoryState.quotaUsage.dailyApiCalls += 1;
  inMemoryState.quotaUsage.longTermCalls += 1;
  inMemoryState.quotaUsage.lastLongTermCallTime = Date.now();
  inMemoryState.quotaUsage.lastLongTermSlot = slotName;
  if (!inMemoryState.quotaUsage.executedSlots.includes(slotKey)) {
    inMemoryState.quotaUsage.executedSlots.push(slotKey);
  }
  inMemoryState.quotaUsage.remainingCalls = Math.max(0, 20 - inMemoryState.quotaUsage.dailyApiCalls);
  saveServerFundState();

  const requestId = generateAIRequestId('REQ-LT');
  const requestStartTime = new Date().toISOString();
  let aiResponseTime: string = requestStartTime;
  const usedModel = 'gemini-3.7-flash';
  let aiResult: any = null;

  console.log(`[AI_REQUEST]\nrequestId: ${requestId}\nstrategy: long_term\nslot: ${slotName}\nmodel: ${usedModel}\ncandidates: ${candidateDataFormatted.map((c) => c.ticker).join(', ')}\ntime: ${requestStartTime}`);

  try {
    const response = await aiClient.models.generateContent({
      model: usedModel,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: AI_DECISION_RESPONSE_SCHEMA,
      },
    });

    aiResponseTime = new Date().toISOString();
    const text = response?.text;
    if (!text) {
      throw new Error('Gemini API returned empty response content.');
    }

    aiResult = JSON.parse(text);
    if (!aiResult || !aiResult.action || !['BUY', 'SELL', 'HOLD'].includes(aiResult.action)) {
      throw new Error('Malformed AI response JSON: missing valid action.');
    }

    inMemoryState.quotaUsage.lastLongTermFailed = false;
    console.log(`[AI_RESPONSE]\nrequestId: ${requestId}\nsuccess: true\nmodel: ${usedModel}\naction: ${aiResult.action}\nsymbol: ${aiResult.symbol || 'NONE'}\ntime: ${aiResponseTime}`);
  } catch (apiErr: any) {
    aiResponseTime = new Date().toISOString();
    console.warn(`[AI_RESPONSE_FAIL]\nrequestId: ${requestId}\nsuccess: false\nerror: ${apiErr?.message || 'Unknown Gemini API Error'}\ntime: ${aiResponseTime}`);
    
    inMemoryState.quotaUsage.lastLongTermFailed = true;
    inMemoryState.quotaUsage.lastLongTermCallTime = Date.now();

    inMemoryState.liveThoughts.unshift({
      id: `TH-ERR-${Date.now().toString().slice(-6)}`,
      timestamp: aiResponseTime,
      type: 'RISK_CHECK',
      message: `[중장기 AI 호출 지연 - 안전 관망 유지 (ID: ${requestId})] ${apiErr?.message || 'API 응답 지연'} (가상 잔고 보존 및 HOLD)`,
      score: 0,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return null;
  }

  const action = aiResult?.action || 'HOLD';
  const symbol = aiResult?.symbol ? String(aiResult.symbol).trim() : null;

  // 1. HOLD Decision
  if (action === 'HOLD' || !symbol) {
    const executedAt = new Date().toISOString();
    const holdThought: AIFundLiveThought = {
      id: `TH-LT-HOLD-${Date.now().toString().slice(-6)}`,
      timestamp: executedAt,
      type: 'SCAN',
      message: `[중장기 AI 관망 유지 (${slotName} 회차, ${inMemoryState.quotaUsage.longTermCalls}/2회, ID: ${requestId})] ${aiResult.reason || '장기 가치 안전마진 확보 대기'}`,
      score: aiResult.confidence || 90,
    };
    inMemoryState.liveThoughts.unshift(holdThought);
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return null;
  }

  // 2. SELL Decision
  if (action === 'SELL') {
    const holdingToSell = account.holdings.find((h) => h.ticker === symbol);
    if (!holdingToSell) {
      console.warn(`[Long-term AI] SELL ${symbol} skipped: not held in long-term account.`);
      saveServerFundState();
      return null;
    }

    const sessionInfo = getMarketSessionStatus(holdingToSell.market);
    if (sessionInfo.session !== 'REGULAR') {
      console.warn(`[Long-term AI] SELL ${symbol} rejected: market is closed (${sessionInfo.statusText})`);
      saveServerFundState();
      return null;
    }

    // Strictly fetch fresh live execution quote right before execution - NO FALLBACK
    const livePrice = await fetchVerifiedLiveExecutionPrice(holdingToSell.ticker, holdingToSell.market, holdingToSell.name);
    if (!livePrice || typeof livePrice !== 'number' || isNaN(livePrice) || !isFinite(livePrice) || livePrice <= 0) {
      console.warn(`[Long-term AI] SELL ${symbol} rejected: live quote unavailable.`);
      saveServerFundState();
      return null;
    }
    const realSellPrice = livePrice;

    const isKR = holdingToSell.market === 'KR' || holdingToSell.currency === 'KRW';
    const singleSellKRW = isKR ? realSellPrice : realSellPrice * rate;
    const sellAmountKRW = Math.round(holdingToSell.quantity * singleSellKRW);
    const sellAmountUSD = isKR ? undefined : Number((holdingToSell.quantity * realSellPrice).toFixed(2));
    const finalProfitRate = Number((((realSellPrice - holdingToSell.averageBuyPrice) / (holdingToSell.averageBuyPrice || 1)) * 100).toFixed(2));
    const isProfit = finalProfitRate >= 0;

    const orderId = `ORD-LT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const executedAt = new Date().toISOString();

    // 0 fee virtual trade
    account.holdings = account.holdings.filter((h) => h.ticker !== holdingToSell.ticker);
    account.cashKRW += sellAmountKRW;

    const orderRecord: OrderRecord = {
      id: orderId,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: usedModel,
      aiRequestTime: requestStartTime,
      aiResponseTime,
      executedAt,
      timestamp: executedAt,
      ticker: holdingToSell.ticker,
      name: holdingToSell.name,
      exchange: holdingToSell.exchange,
      market: holdingToSell.market,
      currency: isKR ? 'KRW' : 'USD',
      side: 'SELL',
      type: 'AI_OPTIMAL',
      price: realSellPrice,
      quantity: holdingToSell.quantity,
      totalAmount: sellAmountKRW,
      totalAmountUSD: sellAmountUSD,
      fee: 0,
      status: 'COMPLETED',
      executedBy: 'AI_AGENT',
      strategyTrack: 'VALUE_COMPOUNDING',
      reasoning: `[중장기 AI 매도] ${finalProfitRate >= 0 ? '+' : ''}${finalProfitRate}% (${(sellAmountKRW / 100000000).toFixed(2)}억 회수). 사유: ${aiResult.reason}`,
    };
    safeAddOrderToAccount(account, orderRecord);

    const decision: AIFundDecision = {
      id: `AI-DEC-LT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: usedModel,
      aiRequestTime: requestStartTime,
      aiResponseTime,
      rawAIResponseSummary: aiResult.reason,
      executedAt,
      timestamp: executedAt,
      action: 'SELL',
      ticker: holdingToSell.ticker,
      name: holdingToSell.name,
      market: holdingToSell.market,
      exchange: holdingToSell.exchange,
      currency: isKR ? 'KRW' : 'USD',
      price: realSellPrice,
      quantity: holdingToSell.quantity,
      amountKRW: sellAmountKRW,
      amountUSD: sellAmountUSD,
      confidence: aiResult.confidence || 95,
      expectedProfitPercent: finalProfitRate,
      stopLossPercent: 0,
      riskRewardRatio: aiResult.riskRewardRatio || '1 : 3.5',
      macroRegime: '중장기 목표가 달성 수익실현',
      tradeCategory: 'VALUE_FUNDAMENTAL_COMPOUND',
      strategyTrack: 'VALUE_COMPOUNDING',
      rationales: aiResult.rationales,
      aiPersona: '벤자민-Q (중장기 가치투자)',
      executionStatus: 'COMPLETED',
    };

    safeAddDecision(decision, false);

    inMemoryState.liveThoughts.unshift({
      id: `TH-LT-SELL-${Date.now()}`,
      timestamp: executedAt,
      ticker: holdingToSell.ticker,
      stockName: holdingToSell.name,
      type: isProfit ? 'EXECUTE_SELL' : 'RISK_CHECK',
      message: `[중장기 AI 매도 완료 (${slotName} 회차, ID: ${requestId})] ${holdingToSell.name} ${holdingToSell.quantity}주 매도 (${finalProfitRate >= 0 ? '+' : ''}${finalProfitRate}%, ${(sellAmountKRW / 100000000).toFixed(2)}억 원 회수).`,
      score: aiResult.confidence || 95,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return decision;
  }

  // 3. BUY Decision
  if (action === 'BUY') {
    const targetCandidate = validCandidates.find((c) => c.ticker === symbol);
    if (!targetCandidate) {
      console.warn(`[Long-term AI] BUY ${symbol} candidate not in valid real-time candidate list.`);
      saveServerFundState();
      return null;
    }

    const sessionInfo = getMarketSessionStatus(targetCandidate.market);
    if (sessionInfo.session !== 'REGULAR') {
      console.warn(`[Long-term AI] BUY ${symbol} rejected: market is closed (${sessionInfo.statusText})`);
      saveServerFundState();
      return null;
    }

    if (account.cashKRW < 20000000) {
      const executedAt = new Date().toISOString();
      inMemoryState.liveThoughts.unshift({
        id: `TH-LT-NOCASH-${Date.now().toString().slice(-6)}`,
        timestamp: executedAt,
        type: 'RISK_CHECK',
        message: `[중장기 계좌 현금 부족] ${targetCandidate.name} 매수 시도하였으나 가용현금(${account.cashKRW.toLocaleString()}원) 부족으로 보류.`,
        score: 80,
      });
      if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
      saveServerFundState();
      return null;
    }

    // Strictly re-fetch verified live execution price right before BUY execution - No mock fallback
    const freshLivePrice = await fetchVerifiedLiveExecutionPrice(targetCandidate.ticker, targetCandidate.market, targetCandidate.name);
    if (!freshLivePrice || typeof freshLivePrice !== 'number' || isNaN(freshLivePrice) || !isFinite(freshLivePrice) || freshLivePrice <= 0) {
      console.warn(`[Long-term AI] BUY ${symbol} rejected: invalid live execution price.`);
      saveServerFundState();
      return null;
    }
    const realLivePrice = freshLivePrice;

    const isKR = targetCandidate.market === 'KR' || /^\d{6}$/.test(targetCandidate.ticker);
    const singlePriceKRW = isKR ? realLivePrice : realLivePrice * rate;

    // Long-term position sizing: ~100M KRW cap per position
    const desiredAllocKRW = 100000000;
    const allocateKRW = Math.min(desiredAllocKRW, account.cashKRW);
    const quantity = Math.max(1, Math.floor(allocateKRW / (singlePriceKRW || 100000)));
    const totalCostKRW = Math.round(quantity * singlePriceKRW);
    const totalCostUSD = isKR ? undefined : Number((quantity * realLivePrice).toFixed(2));

    if (totalCostKRW > account.cashKRW) {
      saveServerFundState();
      return null;
    }

    const orderId = `ORD-LT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const executedAt = new Date().toISOString();

    // 0 fee virtual trade
    account.cashKRW -= totalCostKRW;

    const targetProfit = Math.min(100, Math.max(0.5, Number(aiResult.expectedProfitPercent) || 25.0));
    const stopLossPct = Math.min(50, Math.max(0.5, Number(aiResult.stopLossPercent) || 8.0));
    const targetPrice = isKR ? Math.round(realLivePrice * (1 + targetProfit / 100)) : Number((realLivePrice * (1 + targetProfit / 100)).toFixed(2));
    const stopLoss = isKR ? Math.round(realLivePrice * (1 - stopLossPct / 100)) : Number((realLivePrice * (1 - stopLossPct / 100)).toFixed(2));

    const existingIdx = account.holdings.findIndex((h) => h.ticker === targetCandidate.ticker);
    if (existingIdx >= 0) {
      const current = account.holdings[existingIdx];
      const prevQty = current.quantity;
      const newQty = prevQty + quantity;
      let newAvgPrice = realLivePrice;
      if (isKR) {
        const prevTotalPurchase = current.totalPurchaseAmount;
        newAvgPrice = Math.round((prevTotalPurchase + totalCostKRW) / newQty);
      } else {
        const prevAvgUSD = current.averageBuyPrice;
        newAvgPrice = Number((((prevAvgUSD * prevQty) + (realLivePrice * quantity)) / newQty).toFixed(2));
      }
      const newTotalPurchase = current.totalPurchaseAmount + totalCostKRW;
      const totalEval = isKR ? Math.round(newQty * realLivePrice) : Math.round(newQty * realLivePrice * rate);
      account.holdings[existingIdx] = {
        ...current,
        quantity: newQty,
        averageBuyPrice: newAvgPrice,
        currentPrice: realLivePrice,
        totalPurchaseAmount: newTotalPurchase,
        totalEvaluationAmount: totalEval,
        evaluationProfit: totalEval - newTotalPurchase,
        profitRate: Number((((realLivePrice - newAvgPrice) / (newAvgPrice || 1)) * 100).toFixed(2)),
        lastUpdated: executedAt,
      };
    } else {
      account.holdings.push({
        ticker: targetCandidate.ticker,
        name: targetCandidate.name,
        exchange: targetCandidate.exchange,
        market: targetCandidate.market,
        currency: isKR ? 'KRW' : 'USD',
        quantity,
        averageBuyPrice: realLivePrice,
        currentPrice: realLivePrice,
        totalPurchaseAmount: totalCostKRW,
        totalEvaluationAmount: totalCostKRW,
        evaluationProfit: 0,
        profitRate: 0,
        allocationPercent: 0,
        aiVerdict: 'STRONG_BUY',
        aiTargetPrice: targetPrice,
        aiStopLoss: stopLoss,
        strategyTrack: 'VALUE_COMPOUNDING',
        buyTimestamp: Date.now(),
        aiActionNote: `[중장기 AI (Gemini)] 체결가: ${realLivePrice.toLocaleString()}${isKR ? '원' : '$'}, 목표가: ${targetPrice.toLocaleString()} (+${targetProfit}%)`,
        lastUpdated: executedAt,
      });
    }

    const orderRecord: OrderRecord = {
      id: orderId,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: usedModel,
      aiRequestTime: requestStartTime,
      aiResponseTime,
      executedAt,
      timestamp: executedAt,
      ticker: targetCandidate.ticker,
      name: targetCandidate.name,
      exchange: targetCandidate.exchange,
      market: targetCandidate.market,
      currency: isKR ? 'KRW' : 'USD',
      side: 'BUY',
      type: 'AI_OPTIMAL',
      price: realLivePrice,
      quantity,
      totalAmount: totalCostKRW,
      totalAmountUSD: totalCostUSD,
      fee: 0,
      status: 'COMPLETED',
      executedBy: 'AI_AGENT',
      strategyTrack: 'VALUE_COMPOUNDING',
      reasoning: `[중장기 AI 매수 체결] ${targetCandidate.name} ${quantity}주 (${(totalCostKRW / 100000000).toFixed(2)}억 원). 사유: ${aiResult.reason}`,
    };
    safeAddOrderToAccount(account, orderRecord);

    const decision: AIFundDecision = {
      id: `AI-DEC-LT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: usedModel,
      aiRequestTime: requestStartTime,
      aiResponseTime,
      rawAIResponseSummary: aiResult.reason,
      executedAt,
      timestamp: executedAt,
      action: 'BUY',
      ticker: targetCandidate.ticker,
      name: targetCandidate.name,
      market: targetCandidate.market,
      exchange: targetCandidate.exchange,
      currency: isKR ? 'KRW' : 'USD',
      price: realLivePrice,
      quantity,
      amountKRW: totalCostKRW,
      amountUSD: totalCostUSD,
      confidence: aiResult.confidence || 96,
      expectedProfitPercent: targetProfit,
      stopLossPercent: stopLossPct,
      riskRewardRatio: aiResult.riskRewardRatio || '1 : 3.5',
      macroRegime: '중장기 우량 가치주 편입',
      tradeCategory: 'VALUE_FUNDAMENTAL_COMPOUND',
      strategyTrack: 'VALUE_COMPOUNDING',
      rationales: aiResult.rationales,
      aiPersona: '벤자민-Q (중장기 가치투자)',
      executionStatus: 'COMPLETED',
    };

    safeAddDecision(decision, false);

    inMemoryState.liveThoughts.unshift({
      id: `TH-LT-BUY-${Date.now()}`,
      timestamp: executedAt,
      ticker: targetCandidate.ticker,
      stockName: targetCandidate.name,
      type: 'EXECUTE_BUY',
      message: `[중장기 AI 매수 완료 (${slotName} 회차, ${inMemoryState.quotaUsage.longTermCalls}/2회, ID: ${requestId})] ${targetCandidate.name} ${quantity}주 (${(totalCostKRW / 100000000).toFixed(2)}억 원) 자동 체결.`,
      score: 99,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return decision;
  }

  saveServerFundState();
  return null;
}

// -------------------------------------------------------------------------------------------------
// 3. MASTER 24H AUTONOMOUS ORCHESTRATOR
// -------------------------------------------------------------------------------------------------
export async function executeServerAutoTradeStep(aiClient: any, universe: StockItem[] = []): Promise<AIFundDecision | null> {
  const krSession = getMarketSessionStatus('KR');
  const usSession = getMarketSessionStatus('US');

  inMemoryState.marketStatusKR = krSession;
  inMemoryState.marketStatusUS = usSession;
  inMemoryState.lastBotTick = new Date().toISOString();

  // 1. Recalculate valuations with live market prices & Execute Hard Stop-Loss / Take-Profit Triggers (15s Real-Time Guard)
  const allHoldings = [
    ...inMemoryState.shortTermAccount.holdings,
    ...inMemoryState.longTermAccount.holdings,
  ];

  if (allHoldings.length > 0) {
    try {
      const holdingQuotes = await getLiveStockQuotes(
        allHoldings.map((h) => ({ ticker: h.ticker, market: h.market, name: h.name }))
      );
      
      const executedAt = new Date().toISOString();

      // Check Short-Term Account for Real-Time Stop-Loss / Take-Profit
      const stHoldings = [...inMemoryState.shortTermAccount.holdings];
      for (const h of stHoldings) {
        const quote = holdingQuotes[h.ticker];
        if (quote?.price && quote.price > 0) {
          h.currentPrice = quote.price;
          const isKR = h.market === 'KR' || h.currency === 'KRW';
          const rate = inMemoryState.shortTermAccount.exchangeRateUSD_KRW || 1400;
          
          // Hard trigger criteria: currentPrice <= aiStopLoss (Stop-Loss) or currentPrice >= aiTargetPrice (Take-Profit)
          const isStopLossTriggered = Boolean(h.aiStopLoss && h.currentPrice <= h.aiStopLoss);
          const isTakeProfitTriggered = Boolean(h.aiTargetPrice && h.currentPrice >= h.aiTargetPrice);

          if (isStopLossTriggered || isTakeProfitTriggered) {
            const reasonType = isStopLossTriggered ? '하드 손절(Stop-Loss)' : '목표가 익절(Take-Profit)';
            const sellPrice = h.currentPrice;
            const singleKRW = isKR ? sellPrice : sellPrice * rate;
            const totalKRW = Math.round(singleKRW * h.quantity);
            const profitRate = Number((((sellPrice - h.averageBuyPrice) / (h.averageBuyPrice || 1)) * 100).toFixed(2));
            
            // Execute automated instant liquidation (No AI API call needed)
            inMemoryState.shortTermAccount.cashKRW += totalKRW;
            inMemoryState.shortTermAccount.holdings = inMemoryState.shortTermAccount.holdings.filter((item) => item.ticker !== h.ticker);
            
            const orderRecord: OrderRecord = {
              id: `ORD-ST-GUARD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              executedAt,
              timestamp: executedAt,
              ticker: h.ticker,
              name: h.name,
              exchange: h.exchange,
              market: h.market,
              currency: isKR ? 'KRW' : 'USD',
              side: 'SELL',
              type: 'MARKET',
              price: sellPrice,
              quantity: h.quantity,
              totalAmount: totalKRW,
              fee: 0,
              status: 'COMPLETED',
              executedBy: 'AI_AGENT',
              strategyTrack: 'DAY_TRADE_MOMENTUM',
              reasoning: `[15초 실시간 리스크 가드 자동 체결] ${h.name} ${reasonType} 도달 (${h.quantity}주 @ ${isKR ? sellPrice.toLocaleString() + '원' : '$' + sellPrice.toFixed(2)}, 실현손익: ${profitRate}%)`,
            };
            safeAddOrderToAccount(inMemoryState.shortTermAccount, orderRecord);
            
            inMemoryState.liveThoughts.unshift({
              id: `TH-GUARD-ST-${Date.now().toString().slice(-6)}`,
              timestamp: executedAt,
              ticker: h.ticker,
              stockName: h.name,
              type: 'EXECUTE_SELL',
              message: `[단기 리스크 가드 자동 매도] ${h.name} ${reasonType} 기준가 도달로 즉시 전량 청산 완료 (수익률: ${profitRate}%).`,
              score: 99,
            });
            console.log(`[Risk Guard] Short-term ${h.name} ${reasonType} executed at ${sellPrice}`);
          }
        }
      }

      // Check Long-Term Account for Real-Time Stop-Loss / Take-Profit
      const ltHoldings = [...inMemoryState.longTermAccount.holdings];
      for (const h of ltHoldings) {
        const quote = holdingQuotes[h.ticker];
        if (quote?.price && quote.price > 0) {
          h.currentPrice = quote.price;
          const isKR = h.market === 'KR' || h.currency === 'KRW';
          const rate = inMemoryState.longTermAccount.exchangeRateUSD_KRW || 1400;
          
          const isStopLossTriggered = Boolean(h.aiStopLoss && h.currentPrice <= h.aiStopLoss);
          const isTakeProfitTriggered = Boolean(h.aiTargetPrice && h.currentPrice >= h.aiTargetPrice);

          if (isStopLossTriggered || isTakeProfitTriggered) {
            const reasonType = isStopLossTriggered ? '구조적 손절(Structural Stop-Loss)' : '적정가치 도달 익절(Intrinsic Target)';
            const sellPrice = h.currentPrice;
            const singleKRW = isKR ? sellPrice : sellPrice * rate;
            const totalKRW = Math.round(singleKRW * h.quantity);
            const profitRate = Number((((sellPrice - h.averageBuyPrice) / (h.averageBuyPrice || 1)) * 100).toFixed(2));
            
            // Execute automated instant liquidation (No AI API call needed)
            inMemoryState.longTermAccount.cashKRW += totalKRW;
            inMemoryState.longTermAccount.holdings = inMemoryState.longTermAccount.holdings.filter((item) => item.ticker !== h.ticker);
            
            const orderRecord: OrderRecord = {
              id: `ORD-LT-GUARD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              executedAt,
              timestamp: executedAt,
              ticker: h.ticker,
              name: h.name,
              exchange: h.exchange,
              market: h.market,
              currency: isKR ? 'KRW' : 'USD',
              side: 'SELL',
              type: 'MARKET',
              price: sellPrice,
              quantity: h.quantity,
              totalAmount: totalKRW,
              fee: 0,
              status: 'COMPLETED',
              executedBy: 'AI_AGENT',
              strategyTrack: 'VALUE_COMPOUNDING',
              reasoning: `[15초 실시간 리스크 가드 자동 체결] ${h.name} ${reasonType} 도달 (${h.quantity}주 @ ${isKR ? sellPrice.toLocaleString() + '원' : '$' + sellPrice.toFixed(2)}, 실현손익: ${profitRate}%)`,
            };
            safeAddOrderToAccount(inMemoryState.longTermAccount, orderRecord);
            
            inMemoryState.liveThoughts.unshift({
              id: `TH-GUARD-LT-${Date.now().toString().slice(-6)}`,
              timestamp: executedAt,
              ticker: h.ticker,
              stockName: h.name,
              type: 'EXECUTE_SELL',
              message: `[중장기 리스크 가드 자동 매도] ${h.name} ${reasonType} 기준가 도달로 가치 실현/손절 청산 완료 (수익률: ${profitRate}%).`,
              score: 99,
            });
            console.log(`[Risk Guard] Long-term ${h.name} ${reasonType} executed at ${sellPrice}`);
          }
        }
      }

      recalculateAllAccountValuationsSync();
    } catch (e) {
      console.warn('[Risk Guard] Tick evaluation failed:', e);
    }
  }

  // 2. Check and reset daily quota on date rollover
  checkAndResetDailyQuota();

  // 3. If auto bot is deactivated, do not run autonomous trades
  if (!inMemoryState.isAutoBotActive) {
    saveServerFundState();
    return null;
  }

  // 4. Strict Quota Ceiling: Day limit 20
  if (inMemoryState.quotaUsage.dailyApiCalls >= 20) {
    if (inMemoryState.liveThoughts.length === 0 || inMemoryState.liveThoughts.length % 6 === 0) {
      inMemoryState.liveThoughts.unshift({
        id: `TH-LIMIT-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        type: 'RISK_CHECK',
        message: `[AI 일일 한도 소진 (20/20회)] 오늘의 AI 분석 횟수를 모두 사용했습니다. 다음 분석은 내일 다시 시작됩니다.`,
        score: 99,
      });
      if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
    }
    saveServerFundState();
    return null;
  }

  // 5. Check AI Key availability
  if (!aiClient || !process.env.GEMINI_API_KEY) {
    if (inMemoryState.liveThoughts.length === 0 || inMemoryState.liveThoughts.length % 6 === 0) {
      inMemoryState.liveThoughts.unshift({
        id: `TH-NOAI-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        type: 'RISK_CHECK',
        message: `[AI 대기] Gemini API Key 미설정으로 AI 자동 분석이 대기 중입니다.`,
        score: 99,
      });
      if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
    }
    saveServerFundState();
    return null;
  }

  const now = Date.now();
  const { hour: kstHour } = getKstHourMinute();
  const todayStr = getKstDateStr();
  const executedSlots = inMemoryState.quotaUsage.executedSlots || [];

  // ----------------------------------------------------
  // Priority Check 1: Long-Term Strategy AI (Target 09:00 & 18:00, max 2/day)
  // ----------------------------------------------------
  const longTermCalls = inMemoryState.quotaUsage.longTermCalls || 0;
  const timeSinceLastLongTerm = now - (inMemoryState.quotaUsage.lastLongTermCallTime || 0);

  const is09SlotExecuted = executedSlots.includes(`${todayStr}-09:00`);
  const is18SlotExecuted = executedSlots.includes(`${todayStr}-18:00`);

  // Check 09:00 slot (run between 09:00 and 17:59 if not executed yet today)
  const is09SlotEligible = kstHour >= 9 && kstHour < 18 && !is09SlotExecuted && longTermCalls < 2;
  // Check 18:00 slot (run after 18:00 if not executed yet today)
  const is18SlotEligible = kstHour >= 18 && !is18SlotExecuted && longTermCalls < 2 && timeSinceLastLongTerm >= LONG_TERM_MIN_INTERVAL_MS;

  if ((is09SlotEligible || is18SlotEligible) && inMemoryState.quotaUsage.dailyApiCalls < 20) {
    const slotToRun = is18SlotEligible ? '18:00' : '09:00';
    try {
      console.log(`[AI Fund Worker] Executing Long-Term AI Strategy for slot ${slotToRun}...`);
      const dec = await executeLongTermAITradeStep(aiClient, universe, slotToRun);
      return dec;
    } catch (err: any) {
      console.error('[Long-term AI] Error:', err);
      return null;
    }
  }

  // ----------------------------------------------------
  // Priority Check 2: Short-Term Strategy AI (1 Hour interval, max 18/day, market open only)
  // ----------------------------------------------------
  const isMarketOpen = krSession.isOpen || usSession.isOpen;
  if (!isMarketOpen) {
    // If markets are closed, do NOT call AI, do NOT consume quota
    saveServerFundState();
    return null;
  }

  const shortTermCalls = inMemoryState.quotaUsage.shortTermCalls || 0;
  const timeSinceLastShortTerm = now - (inMemoryState.quotaUsage.lastShortTermCallTime || 0);

  // Reserve check: Make sure remaining calls can accommodate unexecuted long-term calls
  const reservedForLongTerm = Math.max(0, 2 - longTermCalls);
  const availableForShortTerm = 20 - inMemoryState.quotaUsage.dailyApiCalls - reservedForLongTerm;

  // Enforce 5-minute cooldown on failure or 1-hour interval on normal cycle
  const minRequiredInterval = inMemoryState.quotaUsage.lastShortTermFailed ? ERROR_COOLDOWN_MS : SHORT_TERM_INTERVAL_MS;

  if (shortTermCalls < 18 && availableForShortTerm > 0 && inMemoryState.quotaUsage.dailyApiCalls < 20) {
    if (timeSinceLastShortTerm >= minRequiredInterval) {
      try {
        console.log(`[AI Fund Worker] Executing Short-Term AI Strategy (Call ${shortTermCalls + 1}/18)...`);
        const dec = await executeShortTermAITradeStep(aiClient, universe);
        return dec;
      } catch (err: any) {
        console.error('[Short-term AI] Error:', err);
        return null;
      }
    } else {
      // Periodic heartbeat thought during waiting period
      const remainingMinutes = Math.ceil((minRequiredInterval - timeSinceLastShortTerm) / 60000);
      inMemoryState.quotaUsage.nextShortTermScheduled = `${remainingMinutes}분 후`;
      if (inMemoryState.liveThoughts.length % 6 === 0) {
        inMemoryState.liveThoughts.unshift({
          id: `TH-MON-${Date.now().toString().slice(-6)}`,
          timestamp: new Date().toISOString(),
          type: 'SCAN',
          message: `[실시간 시장 감시 중] 단기 AI 분석: ${shortTermCalls}/18회 | 중장기 AI: ${longTermCalls}/2회 | 남은 일일 한도: ${inMemoryState.quotaUsage.remainingCalls}회 (다음 단기 분석: ${remainingMinutes}분 후)`,
          score: 92,
        });
        if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
        saveServerFundState();
      }
    }
  }

  saveServerFundState();
  return null;
}

// -------------------------------------------------------------------------------------------------
// 4. MANUAL TRIGGER FOR USER-INITIATED AI RUN
// -------------------------------------------------------------------------------------------------
export async function executeManualAIScan(
  aiClient: any, 
  strategyTrack: 'DAY_TRADE_MOMENTUM' | 'VALUE_COMPOUNDING' = 'DAY_TRADE_MOMENTUM', 
  universe: StockItem[] = []
): Promise<AIFundDecision | null> {
  checkAndResetDailyQuota();

  inMemoryState.marketStatusKR = getMarketSessionStatus('KR');
  inMemoryState.marketStatusUS = getMarketSessionStatus('US');

  if (inMemoryState.quotaUsage.dailyApiCalls >= 20) {
    throw new Error('오늘의 AI 분석 횟수(20/20회)를 모두 사용했습니다. 다음 분석은 내일 다시 시작됩니다.');
  }

  if (strategyTrack === 'VALUE_COMPOUNDING') {
    if (inMemoryState.quotaUsage.longTermCalls >= 2) {
      throw new Error('오늘 중장기 가치투자 AI 분석 한도(2/2회)를 모두 사용했습니다.');
    }
    const { hour: kstHour } = getKstHourMinute();
    const slot = kstHour >= 18 ? '18:00' : '09:00';
    return await executeLongTermAITradeStep(aiClient, universe, slot);
  } else {
    if (inMemoryState.quotaUsage.shortTermCalls >= 18) {
      throw new Error('오늘 단기 트레이딩 AI 분석 한도(18/18회)를 모두 사용했습니다.');
    }
    return await executeShortTermAITradeStep(aiClient, universe);
  }
}
