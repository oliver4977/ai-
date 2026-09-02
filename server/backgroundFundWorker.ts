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
  DualAccountFundState 
} from '../src/types';
import { getLiveStockQuotes, getMarketSessionStatus, getMarketIndices, getRealMarketNews } from './marketService';

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
  lastLongTermSlot: '',
  currentDate: getKstDateStr(),
  isLimitReached: false,
  limitMessage: '',
  nextShortTermScheduled: '1시간 후 (시장 운영시간 중)',
  nextLongTermScheduled: '09:00 / 18:00 (하루 2회)',
};

export interface ServerFundState {
  account: SimulationAccount; // Master combined account (for UI compatibility)
  masterAccount: SimulationAccount;
  shortTermAccount: SimulationAccount; // 5억원 단기 전용 계좌
  longTermAccount: SimulationAccount; // 5억원 중장기 전용 계좌
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

// Memory Cache
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

// Cooldown constants
const SHORT_TERM_INTERVAL_MS = 3600000; // 1 Hour interval for Short-Term AI (최대 1시간 1회)
const LONG_TERM_MIN_INTERVAL_MS = 14400000; // 4 Hours interval minimum between 09:00 & 18:00 runs
const ERROR_COOLDOWN_MS = 300000; // 5 minutes cooldown on failure/429

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
    inMemoryState.quotaUsage.isLimitReached = false;
    inMemoryState.quotaUsage.limitMessage = '';

    inMemoryState.liveThoughts.unshift({
      id: `TH-QUOTA-RESET-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
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

        // Audit & tag any legacy fallback trades in existing data
        const tagFallbackOrder = (o: any) => {
          if (!o.aiProvider && (o.reasoning?.includes('퀀트') || o.executedBy === 'AI_AGENT')) {
            o.isFallbackGenerated = true;
            o.aiProvider = 'FALLBACK_QUANT_LEGACY';
          }
        };
        inMemoryState.shortTermAccount.orders?.forEach(tagFallbackOrder);
        inMemoryState.longTermAccount.orders?.forEach(tagFallbackOrder);
        inMemoryState.shortTermAccount.holdings?.forEach((h: any) => {
          if (h.ticker === 'AAPL' || h.aiActionNote?.includes('퀀트')) {
            h.isFallbackGenerated = true;
          }
        });
        inMemoryState.longTermAccount.holdings?.forEach((h: any) => {
          if (h.aiActionNote?.includes('퀀트')) {
            h.isFallbackGenerated = true;
          }
        });

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

// Synchronously recalculate totals across short-term, long-term, and master accounts
function recalculateAllAccountValuationsSync() {
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
  inMemoryState.shortTermAccount.totalAssetKRW = Math.round(inMemoryState.shortTermAccount.cashKRW + (inMemoryState.shortTermAccount.cashUSD || 0) * rate + shortHoldingsEval);
  inMemoryState.shortTermAccount.totalEvaluationProfitKRW = inMemoryState.shortTermAccount.totalAssetKRW - inMemoryState.shortTermAccount.initialCapitalKRW;
  inMemoryState.shortTermAccount.totalProfitRate = Number((((inMemoryState.shortTermAccount.totalAssetKRW - inMemoryState.shortTermAccount.initialCapitalKRW) / inMemoryState.shortTermAccount.initialCapitalKRW) * 100).toFixed(2));

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
  inMemoryState.longTermAccount.totalAssetKRW = Math.round(inMemoryState.longTermAccount.cashKRW + (inMemoryState.longTermAccount.cashUSD || 0) * rate + longHoldingsEval);
  inMemoryState.longTermAccount.totalEvaluationProfitKRW = inMemoryState.longTermAccount.totalAssetKRW - inMemoryState.longTermAccount.initialCapitalKRW;
  inMemoryState.longTermAccount.totalProfitRate = Number((((inMemoryState.longTermAccount.totalAssetKRW - inMemoryState.longTermAccount.initialCapitalKRW) / inMemoryState.longTermAccount.initialCapitalKRW) * 100).toFixed(2));

  // 3. Master account (Combined 10억)
  const masterInitial = inMemoryState.shortTermAccount.initialCapitalKRW + inMemoryState.longTermAccount.initialCapitalKRW;
  const masterCashKRW = inMemoryState.shortTermAccount.cashKRW + inMemoryState.longTermAccount.cashKRW;
  const masterCashUSD = (inMemoryState.shortTermAccount.cashUSD || 0) + (inMemoryState.longTermAccount.cashUSD || 0);
  const masterTotalAssetKRW = inMemoryState.shortTermAccount.totalAssetKRW + inMemoryState.longTermAccount.totalAssetKRW;
  const masterProfitKRW = masterTotalAssetKRW - masterInitial;
  const masterProfitRate = Number(((masterProfitKRW / (masterInitial || 1)) * 100).toFixed(2));

  // Combine holdings and orders
  const combinedHoldings = [...inMemoryState.shortTermAccount.holdings, ...inMemoryState.longTermAccount.holdings];
  combinedHoldings.forEach((h) => {
    h.allocationPercent = masterTotalAssetKRW > 0 ? Number(((h.totalEvaluationAmount / masterTotalAssetKRW) * 100).toFixed(1)) : 0;
  });

  const combinedOrders = [...inMemoryState.shortTermAccount.orders, ...inMemoryState.longTermAccount.orders].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

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

// Update live market prices for all holdings across short and long term accounts and recalculate totals
export function updateHoldingsMarketPrices(
  pricesMap: Record<string, number>,
  exchangeRateUSD_KRW?: number
): boolean {
  let changed = false;

  if (exchangeRateUSD_KRW && exchangeRateUSD_KRW > 0) {
    if (inMemoryState.account.exchangeRateUSD_KRW !== exchangeRateUSD_KRW) {
      inMemoryState.account.exchangeRateUSD_KRW = exchangeRateUSD_KRW;
      inMemoryState.masterAccount.exchangeRateUSD_KRW = exchangeRateUSD_KRW;
      inMemoryState.shortTermAccount.exchangeRateUSD_KRW = exchangeRateUSD_KRW;
      inMemoryState.longTermAccount.exchangeRateUSD_KRW = exchangeRateUSD_KRW;
      changed = true;
    }
  }

  // Update Short-term holdings
  inMemoryState.shortTermAccount.holdings.forEach((h) => {
    const livePrice = pricesMap[h.ticker];
    if (typeof livePrice === 'number' && livePrice > 0 && livePrice !== h.currentPrice) {
      h.currentPrice = livePrice;
      changed = true;
    }
  });

  // Update Long-term holdings
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

export interface ManualTradeRequest {
  ticker: string;
  name: string;
  exchange?: 'KOSPI' | 'KOSDAQ' | 'NASDAQ';
  market?: 'KR' | 'US';
  side: 'BUY' | 'SELL';
  type?: 'LIMIT' | 'MARKET' | 'AI_OPTIMAL';
  price: number;
  quantity: number;
  accountType?: 'SHORT_TERM' | 'LONG_TERM' | 'MASTER';
  executedBy?: 'USER' | 'AI_AGENT';
}

export interface TradeExecutionResult {
  success: boolean;
  rejected?: boolean;
  executionStatus: 'COMPLETED' | 'REJECTED_MARKET_CLOSED' | 'REJECTED_INSUFFICIENT_FUNDS' | 'REJECTED_INSUFFICIENT_QUANTITY' | 'ERROR';
  message: string;
  order?: OrderRecord;
  state?: ServerFundState;
}

export function executeManualTrade(req: ManualTradeRequest): TradeExecutionResult {
  const isKR = req.market === 'KR' || /^\d{6}$/.test(req.ticker);
  const marketType: 'KR' | 'US' = isKR ? 'KR' : 'US';
  const sessionInfo = getMarketSessionStatus(marketType);

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

  // 2. Select target account (defaults to short-term for fast trades or long-term for value)
  const targetAcc = (req.accountType === 'LONG_TERM') 
    ? inMemoryState.longTermAccount 
    : inMemoryState.shortTermAccount;

  const rate = targetAcc.exchangeRateUSD_KRW || 1400;
  const singlePriceKRW = isKR ? req.price : req.price * rate;
  const totalAmountKRW = Math.round(singlePriceKRW * req.quantity);
  const feeKRW = Math.round(totalAmountKRW * 0.00015);
  const nowTime = new Date().toLocaleString('ko-KR');

  if (req.side === 'BUY') {
    if (targetAcc.cashKRW < totalAmountKRW + feeKRW) {
      return {
        success: false,
        rejected: true,
        executionStatus: 'REJECTED_INSUFFICIENT_FUNDS',
        message: `주문 가능 현금 부족: 필요 금액 ${totalAmountKRW.toLocaleString()}원 (보유 현금: ${targetAcc.cashKRW.toLocaleString()}원)`,
      };
    }

    targetAcc.cashKRW -= (totalAmountKRW + feeKRW);
    const existingHolding = targetAcc.holdings.find(h => h.ticker === req.ticker);
    if (existingHolding) {
      const prevTotalCost = existingHolding.averageBuyPrice * existingHolding.quantity;
      const newTotalQty = existingHolding.quantity + req.quantity;
      const newAvgBuyPrice = (prevTotalCost + (req.price * req.quantity)) / newTotalQty;
      existingHolding.quantity = newTotalQty;
      existingHolding.averageBuyPrice = isKR ? Math.round(newAvgBuyPrice) : Number(newAvgBuyPrice.toFixed(2));
      existingHolding.currentPrice = req.price;
      existingHolding.lastUpdated = nowTime;
    } else {
      targetAcc.holdings.push({
        ticker: req.ticker,
        name: req.name,
        exchange: req.exchange || (isKR ? 'KOSPI' : 'NASDAQ'),
        market: marketType,
        currency: isKR ? 'KRW' : 'USD',
        quantity: req.quantity,
        averageBuyPrice: req.price,
        currentPrice: req.price,
        totalPurchaseAmount: totalAmountKRW,
        totalEvaluationAmount: totalAmountKRW,
        evaluationProfit: 0,
        profitRate: 0,
        allocationPercent: 0,
        aiVerdict: 'BUY',
        aiTargetPrice: isKR ? Math.round(req.price * 1.15) : Number((req.price * 1.15).toFixed(2)),
        aiStopLoss: isKR ? Math.round(req.price * 0.95) : Number((req.price * 0.95).toFixed(2)),
        aiActionNote: '사용자 직접 매수 체결',
        strategyTrack: (req.accountType === 'LONG_TERM') ? 'VALUE_COMPOUNDING' : 'DAY_TRADE_MOMENTUM',
        buyTimestamp: Date.now(),
        lastUpdated: nowTime,
      });
    }

    const orderRecord: OrderRecord = {
      id: `ORD-USR-${Date.now().toString().slice(-6)}`,
      timestamp: nowTime,
      ticker: req.ticker,
      name: req.name,
      exchange: req.exchange || (isKR ? 'KOSPI' : 'NASDAQ'),
      side: 'BUY',
      type: req.type || 'MARKET',
      price: req.price,
      quantity: req.quantity,
      totalAmount: totalAmountKRW,
      fee: feeKRW,
      status: 'COMPLETED',
      executedBy: req.executedBy || 'USER',
      strategyTrack: (req.accountType === 'LONG_TERM') ? 'VALUE_COMPOUNDING' : 'DAY_TRADE_MOMENTUM',
      reasoning: `정규장 실시간 직접 매수 체결 (${req.quantity}주 @ ${req.price.toLocaleString()})`,
    };
    targetAcc.orders.unshift(orderRecord);

    recalculateAllAccountValuationsSync();
    saveServerFundState();

    return {
      success: true,
      executionStatus: 'COMPLETED',
      message: `${req.name} ${req.quantity}주 매수 주문이 체결되었습니다.`,
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
    targetAcc.cashKRW += (totalAmountKRW - feeKRW);

    if (holding.quantity === req.quantity) {
      targetAcc.holdings.splice(existingHoldingIndex, 1);
    } else {
      holding.quantity -= req.quantity;
      holding.lastUpdated = nowTime;
    }

    const orderRecord: OrderRecord = {
      id: `ORD-USR-${Date.now().toString().slice(-6)}`,
      timestamp: nowTime,
      ticker: req.ticker,
      name: req.name,
      exchange: req.exchange || (isKR ? 'KOSPI' : 'NASDAQ'),
      side: 'SELL',
      type: req.type || 'MARKET',
      price: req.price,
      quantity: req.quantity,
      totalAmount: totalAmountKRW,
      fee: feeKRW,
      status: 'COMPLETED',
      executedBy: req.executedBy || 'USER',
      strategyTrack: (req.accountType === 'LONG_TERM') ? 'VALUE_COMPOUNDING' : 'DAY_TRADE_MOMENTUM',
      reasoning: `정규장 실시간 직접 매도 체결 (${req.quantity}주 @ ${req.price.toLocaleString()})`,
    };
    targetAcc.orders.unshift(orderRecord);

    recalculateAllAccountValuationsSync();
    saveServerFundState();

    return {
      success: true,
      executionStatus: 'COMPLETED',
      message: `${req.name} ${req.quantity}주 매도 주문이 체결되었습니다.`,
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
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      type: 'SCAN',
      message: `[계좌 초기화 완료] 단기 계좌(5억 원) 및 중장기 계좌(5억 원)의 모든 보유주식이 청산되고 총 ${cap === 0 ? '0원' : (cap / 100000000).toFixed(0) + '억 원'}으로 초기화되었습니다.`,
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

  // Filter universe to open markets with momentum focus
  const openUniverse = universe.filter((u) => {
    if (u.market === 'KR' && isKROpen) return true;
    if (u.market === 'US' && isUSOpen) return true;
    return false;
  });

  if (openUniverse.length === 0 && account.holdings.length === 0) {
    return null;
  }

  // Top 10 momentum candidates
  const candidateList = openUniverse.slice(0, 10);
  const candidateQuotes = await getLiveStockQuotes(
    candidateList.map((c) => ({ ticker: c.ticker, market: c.market, name: c.name }))
  );

  // Fetch real breaking news for top candidates
  const sampleTickersToNews = [
    ...account.holdings.slice(0, 3).map((h) => ({ ticker: h.ticker, name: h.name })),
    ...candidateList.slice(0, 3).map((c) => ({ ticker: c.ticker, name: c.name })),
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

  const candidateDataFormatted = candidateList.map((c) => {
    const q = candidateQuotes[c.ticker];
    return {
      ticker: c.ticker,
      name: c.name,
      market: c.market,
      exchange: c.exchange,
      price: q?.price || c.price,
      changePercent: q?.changePercent ?? c.changePercent,
      volume: q?.volume || c.volume,
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

  // Get recent 5 short-term decisions for AI memory
  const recentMemories = inMemoryState.shortTermDecisions.slice(0, 5).map((d) => ({
    time: d.timestamp,
    action: d.action,
    ticker: d.ticker,
    name: d.name,
    reason: d.rationales?.newsCatalyst || d.rationales?.technical || '단기 모멘텀',
  }));

  const systemInstruction = `당신은 5억 원의 가상 단기 트레이딩 자금을 운용하는 전문 단기 퀀트 AI 트레이더 [알파-Q (단기 트레이딩)]입니다.
당신은 실제 시장 데이터, 실시간 호가 및 체결강도, 5분/1시간 모멘텀, 당일 등락률, 거래량 급증, 최신 뉴스를 종합 분석하여 [BUY, SELL, HOLD] 중 최적의 행동을 결정합니다.
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

[AI 최근 단기 매매 기억 (Recent Memories)]
${recentMemories.length > 0 ? JSON.stringify(recentMemories, null, 2) : '최근 매매 기억 없음 (초기 상태)'}

[실시간 개장 시장 단기 매수 후보군 (${candidateDataFormatted.length}개)]
${JSON.stringify(candidateDataFormatted, null, 2)}

[의사결정 요구사항]
위 실시간 데이터와 단기 계좌 현황을 바탕으로 BUY, SELL, HOLD 결정을 JSON 형식으로 내리십시오.
`;

  let aiResult: any = null;
  const requestId = generateAIRequestId('REQ-ST');
  const requestStartTime = new Date().toISOString();
  let aiResponseTime: string = requestStartTime;
  let usedModel = 'gemini-3.7-flash';

  console.log(`[AI_REQUEST]\nrequestId: ${requestId}\nstrategy: short_term\ncandidates: ${candidateDataFormatted.map((c) => c.ticker).join(', ')}\ntime: ${requestStartTime}`);

  try {
    let response: any = null;
    try {
      usedModel = 'gemini-3.7-flash';
      response = await aiClient.models.generateContent({
        model: usedModel,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strategy: { type: Type.STRING, enum: ['short_term'] },
              action: { type: Type.STRING, enum: ['BUY', 'SELL', 'HOLD'] },
              symbol: { type: Type.STRING, description: '선택한 종목 티커. HOLD일 경우 null 또는 빈 문자열' },
              quantity: { type: Type.INTEGER, description: '권장 매매 수량 (1~5000)' },
              confidence: { type: Type.INTEGER, description: '신뢰도 (50~99)' },
              expectedProfitPercent: { type: Type.NUMBER, description: '단기 목표 수익률 (%)' },
              stopLossPercent: { type: Type.NUMBER, description: '단기 손절률 (%)' },
              riskRewardRatio: { type: Type.STRING, description: '손익비 (예: 1 : 2.5)' },
              reason: { type: Type.STRING, description: '핵심 단기 판단 사유' },
              rationales: {
                type: Type.OBJECT,
                properties: {
                  technical: { type: Type.STRING },
                  historicalData: { type: Type.STRING },
                  orderFlowImbalance: { type: Type.STRING },
                  newsCatalyst: { type: Type.STRING },
                  exitStrategy: { type: Type.STRING },
                },
                required: ['technical', 'historicalData', 'orderFlowImbalance', 'newsCatalyst', 'exitStrategy'],
              },
            },
            required: ['strategy', 'action', 'confidence', 'expectedProfitPercent', 'stopLossPercent', 'reason', 'rationales'],
          },
        },
      });
    } catch (primaryErr: any) {
      console.warn(`[Gemini Primary Model 3.7 Unavailable] Retrying with secondary Gemini model (gemini-3.1-flash-lite): ${primaryErr?.message}`);
      usedModel = 'gemini-3.1-flash-lite';
      response = await aiClient.models.generateContent({
        model: usedModel,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strategy: { type: Type.STRING, enum: ['short_term'] },
              action: { type: Type.STRING, enum: ['BUY', 'SELL', 'HOLD'] },
              symbol: { type: Type.STRING, description: '선택한 종목 티커. HOLD일 경우 null 또는 빈 문자열' },
              quantity: { type: Type.INTEGER, description: '권장 매매 수량 (1~5000)' },
              confidence: { type: Type.INTEGER, description: '신뢰도 (50~99)' },
              expectedProfitPercent: { type: Type.NUMBER, description: '단기 목표 수익률 (%)' },
              stopLossPercent: { type: Type.NUMBER, description: '단기 손절률 (%)' },
              riskRewardRatio: { type: Type.STRING, description: '손익비 (예: 1 : 2.5)' },
              reason: { type: Type.STRING, description: '핵심 단기 판단 사유' },
              rationales: {
                type: Type.OBJECT,
                properties: {
                  technical: { type: Type.STRING },
                  historicalData: { type: Type.STRING },
                  orderFlowImbalance: { type: Type.STRING },
                  newsCatalyst: { type: Type.STRING },
                  exitStrategy: { type: Type.STRING },
                },
                required: ['technical', 'historicalData', 'orderFlowImbalance', 'newsCatalyst', 'exitStrategy'],
              },
            },
            required: ['strategy', 'action', 'confidence', 'expectedProfitPercent', 'stopLossPercent', 'reason', 'rationales'],
          },
        },
      });
    }

    aiResponseTime = new Date().toISOString();
    const text = response?.text;
    if (!text) {
      throw new Error('Gemini API returned empty response content.');
    }

    aiResult = JSON.parse(text);
    if (!aiResult || !aiResult.action || !['BUY', 'SELL', 'HOLD'].includes(aiResult.action)) {
      throw new Error('Malformed AI response JSON: missing valid action.');
    }

    // Record successful API deduction ONLY on real Gemini success
    inMemoryState.quotaUsage.dailyApiCalls += 1;
    inMemoryState.quotaUsage.shortTermCalls += 1;

    console.log(`[GEMINI_RESPONSE]\nrequestId: ${requestId}\nsuccess: true\nmodel: ${usedModel}\naction: ${aiResult.action}\nsymbol: ${aiResult.symbol || 'NONE'}\nquantity: ${aiResult.quantity || 0}\nconfidence: ${aiResult.confidence}%\ntime: ${aiResponseTime}`);
  } catch (apiErr: any) {
    aiResponseTime = new Date().toISOString();
    console.warn(`[GEMINI_RESPONSE_FAIL]\nrequestId: ${requestId}\nsuccess: false\nerror: ${apiErr?.message || 'Unknown Gemini API Error'}\ntime: ${aiResponseTime}`);
    
    // STRICT USER MANDATE: On ANY AI failure (429, timeout, network, malformed JSON),
    // NEVER execute fallback buy/sell. Set cooldown and HOLD safely.
    inMemoryState.quotaUsage.lastShortTermCallTime = Date.now();
    inMemoryState.quotaUsage.remainingCalls = Math.max(0, 20 - inMemoryState.quotaUsage.dailyApiCalls);

    inMemoryState.liveThoughts.unshift({
      id: `TH-ERR-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      type: 'RISK_CHECK',
      message: `[단기 AI 호출 실패 - 자동매매 전면 차단 (ID: ${requestId})] ${apiErr?.message || 'API 응답 지연'} (가상 잔고 보존 및 HOLD 유지)`,
      score: 0,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return null;
  }

  inMemoryState.quotaUsage.lastShortTermCallTime = Date.now();
  inMemoryState.quotaUsage.remainingCalls = Math.max(0, 20 - inMemoryState.quotaUsage.dailyApiCalls);

  console.log(`[QUOTA_UPDATED]\nrequestId: ${requestId}\ndailyApiCalls: ${inMemoryState.quotaUsage.dailyApiCalls}/20\nshortTermCalls: ${inMemoryState.quotaUsage.shortTermCalls}/18\nremainingCalls: ${inMemoryState.quotaUsage.remainingCalls}`);

  const action = aiResult?.action || 'HOLD';
  const symbol = aiResult?.symbol ? String(aiResult.symbol).trim() : null;

  console.log(`[AI_DECISION]\nrequestId: ${requestId}\naction: ${action}\nsymbol: ${symbol || 'NONE'}\nreason: ${aiResult.reason || '관망'}\nconfidence: ${aiResult.confidence}%`);

  // 1. HOLD Decision
  if (action === 'HOLD' || !symbol) {
    const holdThought: AIFundLiveThought = {
      id: `TH-ST-HOLD-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
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

    let realSellPrice = holdingToSell.currentPrice;
    try {
      const liveQuotes = await getLiveStockQuotes([
        { ticker: holdingToSell.ticker, market: holdingToSell.market, name: holdingToSell.name },
      ]);
      if (liveQuotes[holdingToSell.ticker]?.price && liveQuotes[holdingToSell.ticker].price > 0) {
        realSellPrice = liveQuotes[holdingToSell.ticker].price;
      }
    } catch (e) {}

    const isKR = holdingToSell.market === 'KR' || holdingToSell.currency === 'KRW';
    const singleSellKRW = isKR ? realSellPrice : realSellPrice * rate;
    const sellAmountKRW = Math.round(holdingToSell.quantity * singleSellKRW);
    const finalProfitRate = Number((((realSellPrice - holdingToSell.averageBuyPrice) / (holdingToSell.averageBuyPrice || 1)) * 100).toFixed(2));
    const isProfit = finalProfitRate >= 0;

    const orderId = `ORD-ST-${Date.now().toString().slice(-6)}`;
    const nowTime = new Date().toLocaleString('ko-KR');

    console.log(`[ORDER_CREATED]\nrequestId: ${requestId}\norderId: ${orderId}\naction: SELL\nsymbol: ${holdingToSell.ticker}\nquantity: ${holdingToSell.quantity}\nprice: ${realSellPrice}`);
    console.log(`[ORDER_VALIDATED]\nrequestId: ${requestId}\norderId: ${orderId}\nstatus: VALID`);

    // Execute Sell in Short-term account
    account.holdings = account.holdings.filter((h) => h.ticker !== holdingToSell.ticker);
    account.cashKRW += sellAmountKRW;

    const orderRecord: OrderRecord = {
      id: orderId,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: 'gemini-3.7-flash',
      aiRequestTime: requestStartTime,
      aiResponseTime,
      timestamp: nowTime,
      ticker: holdingToSell.ticker,
      name: holdingToSell.name,
      exchange: holdingToSell.exchange,
      side: 'SELL',
      type: 'AI_OPTIMAL',
      price: realSellPrice,
      quantity: holdingToSell.quantity,
      totalAmount: sellAmountKRW,
      fee: Math.round(sellAmountKRW * 0.00015),
      status: 'COMPLETED',
      executedBy: 'AI_AGENT',
      strategyTrack: 'DAY_TRADE_MOMENTUM',
      reasoning: `[단기 AI 매도] ${finalProfitRate >= 0 ? '+' : ''}${finalProfitRate}% (${(sellAmountKRW / 100000000).toFixed(2)}억 회수). 사유: ${aiResult.reason}`,
    };
    account.orders.unshift(orderRecord);

    const decision: AIFundDecision = {
      id: `AI-DEC-ST-${Date.now().toString().slice(-6)}`,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: 'gemini-3.7-flash',
      aiRequestTime: requestStartTime,
      aiResponseTime,
      rawAIResponseSummary: aiResult.reason,
      timestamp: nowTime,
      action: 'SELL',
      ticker: holdingToSell.ticker,
      name: holdingToSell.name,
      market: holdingToSell.market,
      exchange: holdingToSell.exchange,
      price: realSellPrice,
      quantity: holdingToSell.quantity,
      amountKRW: sellAmountKRW,
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

    inMemoryState.shortTermDecisions.unshift(decision);
    inMemoryState.decisions.unshift(decision);
    if (inMemoryState.shortTermDecisions.length > 50) inMemoryState.shortTermDecisions.pop();
    if (inMemoryState.decisions.length > 50) inMemoryState.decisions.pop();

    inMemoryState.liveThoughts.unshift({
      id: `TH-ST-SELL-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      ticker: holdingToSell.ticker,
      stockName: holdingToSell.name,
      type: isProfit ? 'EXECUTE_SELL' : 'RISK_CHECK',
      message: `[단기 AI 매도 체결 (ID: ${requestId})] ${holdingToSell.name} ${holdingToSell.quantity}주 매도 (${finalProfitRate >= 0 ? '+' : ''}${finalProfitRate}%, ${(sellAmountKRW / 100000000).toFixed(2)}억 원 회수).`,
      score: aiResult.confidence || 95,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    console.log(`[TRADE_EXECUTED]\nrequestId: ${requestId}\norderId: ${orderId}\naction: SELL\nsymbol: ${holdingToSell.ticker}\nquantity: ${holdingToSell.quantity}\nstatus: COMPLETED`);

    recalculateAllAccountValuationsSync();
    console.log(`[PORTFOLIO_UPDATED]\nrequestId: ${requestId}\ncashKRW: ${account.cashKRW}\nholdingsCount: ${account.holdings.length}\ntotalAssetKRW: ${account.totalAssetKRW}`);
    saveServerFundState();
    return decision;
  }

  // 3. BUY Decision
  if (action === 'BUY') {
    const targetCandidate = candidateList.find((c) => c.ticker === symbol) || openUniverse.find((c) => c.ticker === symbol);
    if (!targetCandidate) {
      console.warn(`[ORDER_VALIDATED]\nrequestId: ${requestId}\nstatus: REJECTED\nreason: Target symbol ${symbol} candidate not found.`);
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
      inMemoryState.liveThoughts.unshift({
        id: `TH-ST-NOCASH-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toLocaleTimeString('ko-KR'),
        type: 'RISK_CHECK',
        message: `[단기 계좌 현금 부족] ${targetCandidate.name} 매수 시도하였으나 단기 가용현금(${account.cashKRW.toLocaleString()}원) 부족으로 보류.`,
        score: 80,
      });
      if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
      saveServerFundState();
      return null;
    }

    let realLivePrice = targetCandidate.price;
    try {
      const liveQuotes = await getLiveStockQuotes([
        { ticker: targetCandidate.ticker, market: targetCandidate.market, name: targetCandidate.name },
      ]);
      if (liveQuotes[targetCandidate.ticker]?.price && liveQuotes[targetCandidate.ticker].price > 0) {
        realLivePrice = liveQuotes[targetCandidate.ticker].price;
      }
    } catch (e) {}

    const isKR = targetCandidate.market === 'KR' || /^\d{6}$/.test(targetCandidate.ticker);
    const singlePriceKRW = isKR ? realLivePrice : realLivePrice * rate;

    // Short-term position sizing: ~40M to 80M KRW
    const desiredAllocKRW = 50000000;
    const allocateKRW = Math.min(desiredAllocKRW, account.cashKRW);
    const quantity = Math.max(1, Math.floor(allocateKRW / (singlePriceKRW || 100000)));
    const totalCostKRW = Math.round(quantity * singlePriceKRW);

    if (totalCostKRW > account.cashKRW) {
      console.warn(`[ORDER_VALIDATED]\nrequestId: ${requestId}\nstatus: REJECTED\nreason: Total cost exceeds cash.`);
      saveServerFundState();
      return null;
    }

    const orderId = `ORD-ST-${Date.now().toString().slice(-6)}`;
    const nowTime = new Date().toLocaleString('ko-KR');

    console.log(`[ORDER_CREATED]\nrequestId: ${requestId}\norderId: ${orderId}\naction: BUY\nsymbol: ${targetCandidate.ticker}\nquantity: ${quantity}\nprice: ${realLivePrice}\ntotalCostKRW: ${totalCostKRW}`);
    console.log(`[ORDER_VALIDATED]\nrequestId: ${requestId}\norderId: ${orderId}\nstatus: VALID`);

    account.cashKRW -= totalCostKRW;

    const targetProfit = aiResult.expectedProfitPercent || 6.0;
    const stopLossPct = aiResult.stopLossPercent || 2.5;
    const targetPrice = isKR ? Math.round(realLivePrice * (1 + targetProfit / 100)) : Number((realLivePrice * (1 + targetProfit / 100)).toFixed(2));
    const stopLoss = isKR ? Math.round(realLivePrice * (1 - stopLossPct / 100)) : Number((realLivePrice * (1 - stopLossPct / 100)).toFixed(2));

    const existingIdx = account.holdings.findIndex((h) => h.ticker === targetCandidate.ticker);
    if (existingIdx >= 0) {
      const current = account.holdings[existingIdx];
      const newQty = current.quantity + quantity;
      const newTotalPurchase = current.totalPurchaseAmount + totalCostKRW;
      const newAvgPrice = isKR ? Math.round(newTotalPurchase / newQty) : Number((newTotalPurchase / newQty / rate).toFixed(2));
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
        lastUpdated: new Date().toLocaleTimeString('ko-KR'),
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
        lastUpdated: new Date().toLocaleTimeString('ko-KR'),
      });
    }

    account.orders.unshift({
      id: orderId,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: usedModel,
      aiRequestTime: requestStartTime,
      aiResponseTime,
      timestamp: nowTime,
      ticker: targetCandidate.ticker,
      name: targetCandidate.name,
      exchange: targetCandidate.exchange,
      side: 'BUY',
      type: 'AI_OPTIMAL',
      price: realLivePrice,
      quantity,
      totalAmount: totalCostKRW,
      fee: Math.round(totalCostKRW * 0.00015),
      status: 'COMPLETED',
      executedBy: 'AI_AGENT',
      strategyTrack: 'DAY_TRADE_MOMENTUM',
      reasoning: `[단기 AI 매수 체결] ${targetCandidate.name} ${quantity}주 (${(totalCostKRW / 100000000).toFixed(2)}억 원). 사유: ${aiResult.reason}`,
    });

    const decision: AIFundDecision = {
      id: `AI-DEC-ST-${Date.now().toString().slice(-6)}`,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: usedModel,
      aiRequestTime: requestStartTime,
      aiResponseTime,
      rawAIResponseSummary: aiResult.reason,
      timestamp: nowTime,
      action: 'BUY',
      ticker: targetCandidate.ticker,
      name: targetCandidate.name,
      market: targetCandidate.market,
      exchange: targetCandidate.exchange,
      price: realLivePrice,
      quantity,
      amountKRW: totalCostKRW,
      confidence: aiResult.confidence || 94,
      expectedProfitPercent: targetProfit,
      stopLossPercent: stopLossPct,
      riskRewardRatio: aiResult.riskRewardRatio || '1 : 2.5',
      macroRegime: '단기 모멘텀 매수 진입',
      tradeCategory: 'HIGH_VOLATILITY_BREAKOUT',
      strategyTrack: 'DAY_TRADE_MOMENTUM',
      rationales: aiResult.rationales,
      aiPersona: '알파-Q (단기 트레이딩)',
      executionStatus: 'COMPLETED',
    };

    inMemoryState.shortTermDecisions.unshift(decision);
    inMemoryState.decisions.unshift(decision);
    if (inMemoryState.shortTermDecisions.length > 50) inMemoryState.shortTermDecisions.pop();
    if (inMemoryState.decisions.length > 50) inMemoryState.decisions.pop();

    inMemoryState.liveThoughts.unshift({
      id: `TH-ST-BUY-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      ticker: targetCandidate.ticker,
      stockName: targetCandidate.name,
      type: 'EXECUTE_BUY',
      message: `[단기 AI 매수 완료 (${inMemoryState.quotaUsage.shortTermCalls}/18회, ID: ${requestId})] ${targetCandidate.name} ${quantity}주 (${(totalCostKRW / 100000000).toFixed(2)}억 원) 자동 체결.`,
      score: 98,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    console.log(`[TRADE_EXECUTED]\nrequestId: ${requestId}\norderId: ${orderId}\naction: BUY\nsymbol: ${targetCandidate.ticker}\nquantity: ${quantity}\nstatus: COMPLETED`);

    recalculateAllAccountValuationsSync();
    console.log(`[PORTFOLIO_UPDATED]\nrequestId: ${requestId}\ncashKRW: ${account.cashKRW}\nholdingsCount: ${account.holdings.length}\ntotalAssetKRW: ${account.totalAssetKRW}`);
    saveServerFundState();
    return decision;
  }

  saveServerFundState();
  return null;
}

// -------------------------------------------------------------------------------------------------
// 2. LONG-TERM VALUE INVESTING AI ENGINE (하루 2회: 09:00 / 18:00, 일 최대 2회)
// -------------------------------------------------------------------------------------------------
async function executeLongTermAITradeStep(aiClient: any, universe: StockItem[] = [], slotName: string = '09:00'): Promise<AIFundDecision | null> {
  const account = inMemoryState.longTermAccount;
  const rate = account.exchangeRateUSD_KRW || 1400;

  // Filter top quality blue-chip / value candidates
  const blueChipUniverse = universe.filter((u) => {
    return u.marketCap !== '-' || (u.peRatio && u.peRatio > 0) || u.aiScore && u.aiScore >= 85;
  });

  const candidateList = (blueChipUniverse.length > 0 ? blueChipUniverse : universe).slice(0, 10);
  const candidateQuotes = await getLiveStockQuotes(
    candidateList.map((c) => ({ ticker: c.ticker, market: c.market, name: c.name }))
  );

  // Fetch real corporate news
  const sampleTickersToNews = [
    ...account.holdings.slice(0, 3).map((h) => ({ ticker: h.ticker, name: h.name })),
    ...candidateList.slice(0, 3).map((c) => ({ ticker: c.ticker, name: c.name })),
  ];

  const newsPromises = sampleTickersToNews.map(async (item) => {
    const newsItems = await getRealMarketNews(item.name || item.ticker, 2);
    return {
      ticker: item.ticker,
      name: item.name,
      headlines: newsItems.map((n) => `[${n.publisher}] ${n.title}`).join(' // ') || '기업 펀더멘털 양호',
    };
  });

  const newsResults = await Promise.all(newsPromises);
  const newsMap: Record<string, string> = {};
  newsResults.forEach((nr) => {
    newsMap[nr.ticker] = nr.headlines;
  });

  const candidateDataFormatted = candidateList.map((c) => {
    const q = candidateQuotes[c.ticker];
    return {
      ticker: c.ticker,
      name: c.name,
      market: c.market,
      exchange: c.exchange,
      price: q?.price || c.price,
      peRatio: c.peRatio || 'N/A',
      marketCap: c.marketCap || '우량 대형주',
      sector: c.sector || '주요 산업',
      news: newsMap[c.ticker] || '기업 실적 및 밸류에이션 추적',
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
    news: newsMap[h.ticker] || '장기 가치 보유주',
  }));

  const recentMemories = inMemoryState.longTermDecisions.slice(0, 5).map((d) => ({
    time: d.timestamp,
    action: d.action,
    ticker: d.ticker,
    name: d.name,
    reason: d.rationales?.newsCatalyst || d.rationales?.historicalData || '중장기 가치 복리',
  }));

  const systemInstruction = `당신은 5억 원의 가상 중장기 가치투자 자금을 운용하는 퀀트 가치투자 AI [벤자민-Q (중장기 가치투자)]입니다.
수개월~수년의 장기 투자 시계(Time-Horizon)를 기준으로 기업의 펀더멘털, 밸류에이션(P/E), 매출/이익 성장성, 해자(Moat), 산업 전망을 심층 분석하여 [BUY, SELL, HOLD]를 결정하십시오.
단기 변동성에 흔들리지 말고, 명확한 가치 저평가나 장기 성장 근거가 부족하면 반드시 [HOLD]를 선택하십시오.`;

  const userPrompt = `
[중장기 가치투자 계좌 현황 (${slotName} 정기 분석)]
- 총 자산: ${account.totalAssetKRW.toLocaleString()}원 (초기 자금: 500,000,000원)
- 가용 현금 (KRW): ${account.cashKRW.toLocaleString()}원
- 누적 수익률: ${account.totalProfitRate}%
- 현재 보유 종목 (${holdingsFormatted.length}개):
${holdingsFormatted.length > 0 ? JSON.stringify(holdingsFormatted, null, 2) : '현재 보유 주식 없음 (100% 현금 대기 중)'}

[AI 과거 중장기 투자 기억 (Past Value Rationale)]
${recentMemories.length > 0 ? JSON.stringify(recentMemories, null, 2) : '과거 가치투자 기록 없음 (초기 포트폴리오 구성 단계)'}

[중장기 우량 가치주 후보군 (${candidateDataFormatted.length}개)]
${JSON.stringify(candidateDataFormatted, null, 2)}

[의사결정 요구사항]
위 기업 데이터와 펀더멘털을 기반으로 중장기 BUY, SELL, HOLD 결정을 JSON 형식으로 내리십시오.
`;

  let aiResult: any = null;
  const requestId = generateAIRequestId('REQ-LT');
  const requestStartTime = new Date().toISOString();
  let aiResponseTime: string = requestStartTime;

  console.log(`[AI_REQUEST]\nrequestId: ${requestId}\nstrategy: long_term\nslot: ${slotName}\ncandidates: ${candidateDataFormatted.map((c) => c.ticker).join(', ')}\ntime: ${requestStartTime}`);

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strategy: { type: Type.STRING, enum: ['long_term'] },
            action: { type: Type.STRING, enum: ['BUY', 'SELL', 'HOLD'] },
            symbol: { type: Type.STRING, description: '선택한 종목 티커. HOLD일 경우 null 또는 빈 문자열' },
            quantity: { type: Type.INTEGER, description: '권장 매수/매도 수량' },
            confidence: { type: Type.INTEGER, description: '신뢰도 (50~99)' },
            expectedProfitPercent: { type: Type.NUMBER, description: '중장기 목표 기대 수익률 (%)' },
            stopLossPercent: { type: Type.NUMBER, description: '장기 리스크 관리 기준 (%)' },
            riskRewardRatio: { type: Type.STRING, description: '손익비 (예: 1 : 3.5)' },
            reason: { type: Type.STRING, description: '핵심 중장기 가치 분석 사유' },
            rationales: {
              type: Type.OBJECT,
              properties: {
                technical: { type: Type.STRING },
                historicalData: { type: Type.STRING },
                orderFlowImbalance: { type: Type.STRING },
                newsCatalyst: { type: Type.STRING },
                exitStrategy: { type: Type.STRING },
              },
              required: ['technical', 'historicalData', 'orderFlowImbalance', 'newsCatalyst', 'exitStrategy'],
            },
          },
          required: ['strategy', 'action', 'confidence', 'expectedProfitPercent', 'stopLossPercent', 'reason', 'rationales'],
        },
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

    // Record successful API deduction for long-term ONLY on real Gemini success
    inMemoryState.quotaUsage.dailyApiCalls += 1;
    inMemoryState.quotaUsage.longTermCalls += 1;

    console.log(`[AI_RESPONSE]\nrequestId: ${requestId}\nsuccess: true\nmodel: gemini-3.7-flash\naction: ${aiResult.action}\nsymbol: ${aiResult.symbol || 'NONE'}\ntime: ${aiResponseTime}`);
  } catch (apiErr: any) {
    aiResponseTime = new Date().toISOString();
    console.warn(`[AI_RESPONSE_FAIL]\nrequestId: ${requestId}\nsuccess: false\nerror: ${apiErr?.message || 'Unknown Gemini API Error'}\ntime: ${aiResponseTime}`);
    
    // STRICT USER MANDATE: On ANY AI failure, NEVER execute fallback buy/sell. Set cooldown and HOLD.
    inMemoryState.quotaUsage.lastLongTermCallTime = Date.now();
    inMemoryState.quotaUsage.remainingCalls = Math.max(0, 20 - inMemoryState.quotaUsage.dailyApiCalls);

    inMemoryState.liveThoughts.unshift({
      id: `TH-ERR-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      type: 'RISK_CHECK',
      message: `[중장기 AI 호출 실패 - 자동매매 전면 차단 (ID: ${requestId})] ${apiErr?.message || 'API 응답 지연'} (가상 잔고 보존 및 HOLD 유지)`,
      score: 0,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return null;
  }

  inMemoryState.quotaUsage.lastLongTermCallTime = Date.now();
  inMemoryState.quotaUsage.lastLongTermSlot = slotName;
  inMemoryState.quotaUsage.remainingCalls = Math.max(0, 20 - inMemoryState.quotaUsage.dailyApiCalls);

  const action = aiResult?.action || 'HOLD';
  const symbol = aiResult?.symbol ? String(aiResult.symbol).trim() : null;

  // 1. HOLD Decision
  if (action === 'HOLD' || !symbol) {
    const holdThought: AIFundLiveThought = {
      id: `TH-LT-HOLD-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
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

    let realSellPrice = holdingToSell.currentPrice;
    try {
      const liveQuotes = await getLiveStockQuotes([
        { ticker: holdingToSell.ticker, market: holdingToSell.market, name: holdingToSell.name },
      ]);
      if (liveQuotes[holdingToSell.ticker]?.price && liveQuotes[holdingToSell.ticker].price > 0) {
        realSellPrice = liveQuotes[holdingToSell.ticker].price;
      }
    } catch (e) {}

    const isKR = holdingToSell.market === 'KR' || holdingToSell.currency === 'KRW';
    const singleSellKRW = isKR ? realSellPrice : realSellPrice * rate;
    const sellAmountKRW = Math.round(holdingToSell.quantity * singleSellKRW);
    const finalProfitRate = Number((((realSellPrice - holdingToSell.averageBuyPrice) / (holdingToSell.averageBuyPrice || 1)) * 100).toFixed(2));
    const isProfit = finalProfitRate >= 0;

    console.log(`[ORDER]\nrequestId: ${requestId}\naction: SELL\nsymbol: ${holdingToSell.ticker}\nquantity: ${holdingToSell.quantity}\nprice: ${realSellPrice}`);

    account.holdings = account.holdings.filter((h) => h.ticker !== holdingToSell.ticker);
    account.cashKRW += sellAmountKRW;

    const orderId = `ORD-LT-${Date.now().toString().slice(-6)}`;
    const nowTime = new Date().toLocaleString('ko-KR');

    account.orders.unshift({
      id: orderId,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: 'gemini-3.7-flash',
      aiRequestTime: requestStartTime,
      aiResponseTime,
      timestamp: nowTime,
      ticker: holdingToSell.ticker,
      name: holdingToSell.name,
      exchange: holdingToSell.exchange,
      side: 'SELL',
      type: 'AI_OPTIMAL',
      price: realSellPrice,
      quantity: holdingToSell.quantity,
      totalAmount: sellAmountKRW,
      fee: Math.round(sellAmountKRW * 0.00015),
      status: 'COMPLETED',
      executedBy: 'AI_AGENT',
      strategyTrack: 'VALUE_COMPOUNDING',
      reasoning: `[중장기 AI 매도] ${finalProfitRate >= 0 ? '+' : ''}${finalProfitRate}% (${(sellAmountKRW / 100000000).toFixed(2)}억 회수). 사유: ${aiResult.reason}`,
    });

    const decision: AIFundDecision = {
      id: `AI-DEC-LT-${Date.now().toString().slice(-6)}`,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: 'gemini-3.7-flash',
      aiRequestTime: requestStartTime,
      aiResponseTime,
      rawAIResponseSummary: aiResult.reason,
      timestamp: nowTime,
      action: 'SELL',
      ticker: holdingToSell.ticker,
      name: holdingToSell.name,
      market: holdingToSell.market,
      exchange: holdingToSell.exchange,
      price: realSellPrice,
      quantity: holdingToSell.quantity,
      amountKRW: sellAmountKRW,
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

    inMemoryState.longTermDecisions.unshift(decision);
    inMemoryState.decisions.unshift(decision);
    if (inMemoryState.longTermDecisions.length > 50) inMemoryState.longTermDecisions.pop();
    if (inMemoryState.decisions.length > 50) inMemoryState.decisions.pop();

    inMemoryState.liveThoughts.unshift({
      id: `TH-LT-SELL-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      ticker: holdingToSell.ticker,
      stockName: holdingToSell.name,
      type: isProfit ? 'EXECUTE_SELL' : 'RISK_CHECK',
      message: `[중장기 AI 매도 완료 (${slotName} 회차, ID: ${requestId})] ${holdingToSell.name} ${holdingToSell.quantity}주 매도 (${finalProfitRate >= 0 ? '+' : ''}${finalProfitRate}%, ${(sellAmountKRW / 100000000).toFixed(2)}억 원 회수).`,
      score: aiResult.confidence || 95,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    console.log(`[TRADE_EXECUTION]\nrequestId: ${requestId}\naction: SELL\nsymbol: ${holdingToSell.ticker}\nquantity: ${holdingToSell.quantity}\nstatus: COMPLETED`);

    recalculateAllAccountValuationsSync();
    saveServerFundState();
    return decision;
  }

  // 3. BUY Decision
  if (action === 'BUY') {
    const targetCandidate = candidateList.find((c) => c.ticker === symbol) || universe.find((c) => c.ticker === symbol);
    if (!targetCandidate) {
      console.warn(`[Long-term AI] BUY ${symbol} candidate not found.`);
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
      inMemoryState.liveThoughts.unshift({
        id: `TH-LT-NOCASH-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toLocaleTimeString('ko-KR'),
        type: 'RISK_CHECK',
        message: `[중장기 계좌 현금 부족] ${targetCandidate.name} 매수 시도하였으나 가용현금(${account.cashKRW.toLocaleString()}원) 부족으로 보류.`,
        score: 80,
      });
      if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
      saveServerFundState();
      return null;
    }

    let realLivePrice = targetCandidate.price;
    try {
      const liveQuotes = await getLiveStockQuotes([
        { ticker: targetCandidate.ticker, market: targetCandidate.market, name: targetCandidate.name },
      ]);
      if (liveQuotes[targetCandidate.ticker]?.price && liveQuotes[targetCandidate.ticker].price > 0) {
        realLivePrice = liveQuotes[targetCandidate.ticker].price;
      }
    } catch (e) {}

    const isKR = targetCandidate.market === 'KR' || /^\d{6}$/.test(targetCandidate.ticker);
    const singlePriceKRW = isKR ? realLivePrice : realLivePrice * rate;

    // Long-term position sizing: ~80M to 150M KRW
    const desiredAllocKRW = 100000000;
    const allocateKRW = Math.min(desiredAllocKRW, account.cashKRW);
    const quantity = Math.max(1, Math.floor(allocateKRW / (singlePriceKRW || 100000)));
    const totalCostKRW = Math.round(quantity * singlePriceKRW);

    if (totalCostKRW > account.cashKRW) {
      saveServerFundState();
      return null;
    }

    console.log(`[ORDER]\nrequestId: ${requestId}\naction: BUY\nsymbol: ${targetCandidate.ticker}\nquantity: ${quantity}\nprice: ${realLivePrice}`);

    account.cashKRW -= totalCostKRW;

    const targetProfit = aiResult.expectedProfitPercent || 25.0;
    const stopLossPct = aiResult.stopLossPercent || 8.0;
    const targetPrice = isKR ? Math.round(realLivePrice * (1 + targetProfit / 100)) : Number((realLivePrice * (1 + targetProfit / 100)).toFixed(2));
    const stopLoss = isKR ? Math.round(realLivePrice * (1 - stopLossPct / 100)) : Number((realLivePrice * (1 - stopLossPct / 100)).toFixed(2));

    const existingIdx = account.holdings.findIndex((h) => h.ticker === targetCandidate.ticker);
    if (existingIdx >= 0) {
      const current = account.holdings[existingIdx];
      const newQty = current.quantity + quantity;
      const newTotalPurchase = current.totalPurchaseAmount + totalCostKRW;
      const newAvgPrice = isKR ? Math.round(newTotalPurchase / newQty) : Number((newTotalPurchase / newQty / rate).toFixed(2));
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
        lastUpdated: new Date().toLocaleTimeString('ko-KR'),
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
        lastUpdated: new Date().toLocaleTimeString('ko-KR'),
      });
    }

    const orderId = `ORD-LT-${Date.now().toString().slice(-6)}`;
    const nowTime = new Date().toLocaleString('ko-KR');

    account.orders.unshift({
      id: orderId,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: 'gemini-3.7-flash',
      aiRequestTime: requestStartTime,
      aiResponseTime,
      timestamp: nowTime,
      ticker: targetCandidate.ticker,
      name: targetCandidate.name,
      exchange: targetCandidate.exchange,
      side: 'BUY',
      type: 'AI_OPTIMAL',
      price: realLivePrice,
      quantity,
      totalAmount: totalCostKRW,
      fee: Math.round(totalCostKRW * 0.00015),
      status: 'COMPLETED',
      executedBy: 'AI_AGENT',
      strategyTrack: 'VALUE_COMPOUNDING',
      reasoning: `[중장기 AI 매수 체결] ${targetCandidate.name} ${quantity}주 (${(totalCostKRW / 100000000).toFixed(2)}억 원). 사유: ${aiResult.reason}`,
    });

    const decision: AIFundDecision = {
      id: `AI-DEC-LT-${Date.now().toString().slice(-6)}`,
      requestId,
      aiProvider: 'GEMINI',
      aiModel: 'gemini-3.7-flash',
      aiRequestTime: requestStartTime,
      aiResponseTime,
      rawAIResponseSummary: aiResult.reason,
      timestamp: nowTime,
      action: 'BUY',
      ticker: targetCandidate.ticker,
      name: targetCandidate.name,
      market: targetCandidate.market,
      exchange: targetCandidate.exchange,
      price: realLivePrice,
      quantity,
      amountKRW: totalCostKRW,
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

    inMemoryState.longTermDecisions.unshift(decision);
    inMemoryState.decisions.unshift(decision);
    if (inMemoryState.longTermDecisions.length > 50) inMemoryState.longTermDecisions.pop();
    if (inMemoryState.decisions.length > 50) inMemoryState.decisions.pop();

    inMemoryState.liveThoughts.unshift({
      id: `TH-LT-BUY-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      ticker: targetCandidate.ticker,
      stockName: targetCandidate.name,
      type: 'EXECUTE_BUY',
      message: `[중장기 AI 매수 완료 (${slotName} 회차, ${inMemoryState.quotaUsage.longTermCalls}/2회, ID: ${requestId})] ${targetCandidate.name} ${quantity}주 (${(totalCostKRW / 100000000).toFixed(2)}억 원) 자동 체결.`,
      score: 99,
    });
    if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();

    console.log(`[TRADE_EXECUTION]\nrequestId: ${requestId}\naction: BUY\nsymbol: ${targetCandidate.ticker}\nquantity: ${quantity}\nstatus: COMPLETED`);

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

  // 1. Recalculate valuations with live market prices
  const allHoldings = [
    ...inMemoryState.shortTermAccount.holdings,
    ...inMemoryState.longTermAccount.holdings,
  ];

  if (allHoldings.length > 0) {
    try {
      const holdingQuotes = await getLiveStockQuotes(
        allHoldings.map((h) => ({ ticker: h.ticker, market: h.market, name: h.name }))
      );
      inMemoryState.shortTermAccount.holdings.forEach((h) => {
        if (holdingQuotes[h.ticker]?.price && holdingQuotes[h.ticker].price > 0) {
          h.currentPrice = holdingQuotes[h.ticker].price;
        }
      });
      inMemoryState.longTermAccount.holdings.forEach((h) => {
        if (holdingQuotes[h.ticker]?.price && holdingQuotes[h.ticker].price > 0) {
          h.currentPrice = holdingQuotes[h.ticker].price;
        }
      });
      recalculateAllAccountValuationsSync();
    } catch (e) {}
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
        timestamp: new Date().toLocaleTimeString('ko-KR'),
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
        timestamp: new Date().toLocaleTimeString('ko-KR'),
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

  // ----------------------------------------------------
  // Priority Check 1: Long-Term Strategy AI (Target 09:00 & 18:00, max 2/day)
  // ----------------------------------------------------
  const longTermCalls = inMemoryState.quotaUsage.longTermCalls || 0;
  const lastLongTermSlot = inMemoryState.quotaUsage.lastLongTermSlot || '';
  const timeSinceLastLongTerm = now - (inMemoryState.quotaUsage.lastLongTermCallTime || 0);

  // Check 09:00 slot
  const is09SlotEligible = kstHour >= 9 && kstHour < 18 && longTermCalls === 0 && lastLongTermSlot !== '09:00' && lastLongTermSlot !== '18:00';
  // Check 18:00 slot
  const is18SlotEligible = kstHour >= 18 && longTermCalls < 2 && lastLongTermSlot !== '18:00' && timeSinceLastLongTerm >= LONG_TERM_MIN_INTERVAL_MS;

  if ((is09SlotEligible || is18SlotEligible) && inMemoryState.quotaUsage.dailyApiCalls < 20) {
    const slotToRun = is18SlotEligible ? '18:00' : '09:00';
    try {
      console.log(`[AI Fund Worker] Executing Long-Term AI Strategy for slot ${slotToRun}...`);
      const dec = await executeLongTermAITradeStep(aiClient, universe, slotToRun);
      return dec;
    } catch (err: any) {
      console.error('[Long-term AI] Error:', err);
      handleAIError(err, '중장기 AI');
      return null;
    }
  }

  // ----------------------------------------------------
  // Priority Check 2: Short-Term Strategy AI (1 Hour interval, max 18/day, market open only)
  // ----------------------------------------------------
  const isMarketOpen = krSession.isOpen || usSession.isOpen;
  if (!isMarketOpen) {
    // If markets are closed, do not call short-term AI
    saveServerFundState();
    return null;
  }

  const shortTermCalls = inMemoryState.quotaUsage.shortTermCalls || 0;
  const timeSinceLastShortTerm = now - (inMemoryState.quotaUsage.lastShortTermCallTime || 0);

  // Reserve check: Make sure remaining calls can accommodate unexecuted long-term calls
  const reservedForLongTerm = Math.max(0, 2 - longTermCalls);
  const availableForShortTerm = 20 - inMemoryState.quotaUsage.dailyApiCalls - reservedForLongTerm;

  if (shortTermCalls < 18 && availableForShortTerm > 0 && inMemoryState.quotaUsage.dailyApiCalls < 20) {
    if (timeSinceLastShortTerm >= SHORT_TERM_INTERVAL_MS) {
      try {
        console.log(`[AI Fund Worker] Executing Short-Term AI Strategy (Call ${shortTermCalls + 1}/18)...`);
        const dec = await executeShortTermAITradeStep(aiClient, universe);
        return dec;
      } catch (err: any) {
        console.error('[Short-term AI] Error:', err);
        handleAIError(err, '단기 AI');
        return null;
      }
    } else {
      // Periodic heartbeat thought during 1-hour interval
      const remainingMinutes = Math.ceil((SHORT_TERM_INTERVAL_MS - timeSinceLastShortTerm) / 60000);
      inMemoryState.quotaUsage.nextShortTermScheduled = `${remainingMinutes}분 후`;
      if (inMemoryState.liveThoughts.length % 6 === 0) {
        inMemoryState.liveThoughts.unshift({
          id: `TH-MON-${Date.now().toString().slice(-6)}`,
          timestamp: new Date().toLocaleTimeString('ko-KR'),
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

// Handle AI errors (429, timeout, network failure) gracefully without infinite loops or quota deduction
function handleAIError(err: any, strategyLabel: string) {
  let errorSummary = err.message || 'Gemini API 호출 중 지연 발생';
  const isQuotaExceeded = errorSummary.includes('429') || errorSummary.includes('RESOURCE_EXHAUSTED') || errorSummary.includes('Quota exceeded');
  
  if (isQuotaExceeded) {
    errorSummary = 'Google Gemini API 호출 한도(429 / Quota Exceeded)에 도달하여 자동매매를 안전하게 일시 정지(HOLD)합니다. 자산 잔고와 보유 종목은 안전하게 보존됩니다.';
    // Set a cooldown so we don't spam the API on every background tick
    if (strategyLabel.includes('단기')) {
      inMemoryState.quotaUsage.lastShortTermCallTime = Date.now();
    } else {
      inMemoryState.quotaUsage.lastLongTermCallTime = Date.now();
    }
  } else {
    if (strategyLabel.includes('단기')) {
      inMemoryState.quotaUsage.lastShortTermCallTime = Date.now();
    } else {
      inMemoryState.quotaUsage.lastLongTermCallTime = Date.now();
    }
  }

  inMemoryState.liveThoughts.unshift({
    id: `TH-ERR-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toLocaleTimeString('ko-KR'),
    type: 'RISK_CHECK',
    message: `[${strategyLabel} 리스크 관리] ${errorSummary}`,
    score: 0,
  });
  if (inMemoryState.liveThoughts.length > 40) inMemoryState.liveThoughts.pop();
  saveServerFundState();
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
