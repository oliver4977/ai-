export interface CandleData {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20?: number;
  sma50?: number;
  sma120?: number;
  ema9?: number;
  ema21?: number;
  rsi14?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export type MarketType = 'KR' | 'US';
export type ExchangeCategory = 'KOSPI' | 'KOSDAQ' | 'NASDAQ';
export type RecommendationVerdict = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type PatternType = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface ChartPattern {
  name: string;
  type: PatternType;
  description: string;
  confidence: number;
  detectedIndex?: number;
}

export interface TechnicalIndicatorSignal {
  indicator: string;
  signal: string;
  status: PatternType;
  detail: string;
  value: string | number;
}

export interface AIAnalysisResult {
  ticker: string;
  name: string;
  market: MarketType;
  exchange: ExchangeCategory;
  currentPrice: number;
  currency: string;
  timestamp: string;
  verdict: RecommendationVerdict;
  verdictKr: string;
  confidenceScore: number; // 0 to 100
  riskLevel: RiskLevel;
  riskLevelKr: string;
  entryRange: [number, number];
  targetPrice: number;
  targetPrice2: number;
  stopLoss: number;
  expectedReturnPercent: number;
  riskRewardRatio: string;
  summary: string;
  keyPoints: string[];
  patterns: ChartPattern[];
  indicatorSignals: TechnicalIndicatorSignal[];
  timeframeOutlook: {
    shortTerm: string; // 1~5 days
    midTerm: string;   // 1~3 months
  };
  tradingStrategy: string;
  riskManagementTips: string[];
  supportLevels: number[];
  resistanceLevels: number[];
}

export interface StockItem {
  ticker: string;
  name: string;
  market: MarketType;
  exchange: ExchangeCategory;
  currency: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  peRatio?: number;
  week52High: number;
  week52Low: number;
  aiScore?: number;
  aiVerdict?: RecommendationVerdict;
  keyTag?: string;
  description?: string;
  providerTimestamp?: string;
  serverReceivedAt?: string;
  providerName?: string;
  marketState?: string;
  dataDelay?: 'REAL_TIME' | 'DELAYED' | 'EOD_CLOSE';
}

export type StrategyCategory = 
  | 'ALL' 
  | 'AI_TOP_PICK' 
  | 'GOLDEN_CROSS' 
  | 'OVERSOLD_REBOUND' 
  | 'BREAKOUT' 
  | 'BOLLINGER_SQUEEZE' 
  | 'TECH_GROWTH' 
  | 'DIVIDEND_VALUE';

export interface MarketIndexItem {
  symbol: string;
  name: string;
  exchange: ExchangeCategory | 'GLOBAL';
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState?: string;
  providerTimestamp?: string;
  serverReceivedAt?: string;
  providerName?: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  suggestedPrompts?: string[];
}

// ----------------------------------------------------
// AI Simulation & Securities Trading Types
// ----------------------------------------------------

export type StrategyTrackType = 'DAY_TRADE_MOMENTUM' | 'VALUE_COMPOUNDING';

export interface HoldingStock {
  ticker: string;
  name: string;
  exchange: ExchangeCategory;
  market: MarketType;
  currency: string;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  totalPurchaseAmount: number;
  totalEvaluationAmount: number;
  evaluationProfit: number;
  profitRate: number;
  allocationPercent: number;
  aiVerdict: RecommendationVerdict;
  aiTargetPrice: number;
  aiStopLoss: number;
  aiActionNote?: string;
  strategyTrack?: StrategyTrackType; // 'DAY_TRADE_MOMENTUM' (5억 단타) or 'VALUE_COMPOUNDING' (5억 중장기 가치)
  buyTimestamp?: number;
  lastUpdated: string;
}

export type OrderType = 'LIMIT' | 'MARKET' | 'AI_OPTIMAL';
export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'COMPLETED' | 'PENDING' | 'CANCELLED' | 'REJECTED_MARKET_CLOSED' | 'REJECTED_API_ERROR' | 'REJECTED_INSUFFICIENT_FUNDS' | 'REJECTED_INSUFFICIENT_QUANTITY';

export interface OrderRecord {
  id: string;
  requestId?: string;
  executedAt?: string; // Authoritative UTC ISO timestamp (e.g. "2026-09-02T10:01:25.123Z")
  timestamp: string; // ISO or formatted timestamp
  ticker: string;
  name: string;
  exchange: ExchangeCategory;
  market?: MarketType;
  currency?: 'KRW' | 'USD';
  side: OrderSide;
  type: OrderType;
  price: number;
  quantity: number;
  totalAmount: number; // KRW Total Amount
  totalAmountUSD?: number; // USD Total Amount for US stocks
  fee: number; // Virtual trade fee is strictly 0
  status: OrderStatus;
  executedBy: 'USER' | 'AI_AGENT';
  strategyTrack?: StrategyTrackType;
  reasoning?: string;
  aiProvider?: string;
  aiModel?: string;
  aiRequestTime?: string; // UTC ISO string when AI analysis began
  aiResponseTime?: string; // UTC ISO string when AI response was received
  isFallbackGenerated?: boolean;
}

export interface SimulationAccount {
  accountNumber: string;
  accountName: string;
  initialCapitalKRW: number;
  cashKRW: number;
  cashUSD: number;
  exchangeRateUSD_KRW: number;
  holdings: HoldingStock[];
  orders: OrderRecord[];
  totalAssetKRW: number;
  totalEvaluationProfitKRW: number;
  totalProfitRate: number;
  dailyProfitKRW: number;
  dailyProfitRate: number;
  aiAutoTradeEnabled: boolean;
  aiTradeFrequency: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
  maxPositionSizePercent: number;
  // 5:5 Barbell Strategy Configuration (5억 단타 모멘텀 + 5억 중장기 가치)
  barbellStrategy?: {
    enabled: boolean;
    dayTradeCapKRW: number; // 500,000,000 KRW
    valueCompoundingCapKRW: number; // 500,000,000 KRW
    dayTradeCurrentAllocKRW: number;
    valueCompoundingCurrentAllocKRW: number;
  };
}

export interface OrderBookLevel {
  price: number;
  size: number;
  orders: number;
  ratio: number;
}

export interface OrderBookData {
  ticker: string;
  bids: OrderBookLevel[]; // 매수호가 (Buy)
  asks: OrderBookLevel[]; // 매도호가 (Sell)
  totalBidSize: number;
  totalAskSize: number;
  currentPrice: number;
}

export interface AIExperimentMetric {
  aiCumulativeReturn: number;
  kospiBenchmarkReturn: number;
  nasdaqBenchmarkReturn: number;
  alphaOverKospi: number;
  alphaOverNasdaq: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  lastDecisionLog: {
    time: string;
    ticker: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reason: string;
  }[];
}

export interface AITradeRationale {
  marketAnalysis?: string; // 시장 및 섹터 동향 분석
  valuationOrMomentum?: string; // 가격 변동률 및 밸류에이션/모멘텀 분석
  technical?: string; // 기술적 지표 분석
  historicalData?: string; // 과거 매물대 및 지지저항
  orderFlowImbalance?: string; // 호가 및 거래량 흐름
  newsCatalyst?: string; // 실시간 뉴스 감정 및 기업 이슈
  riskManagement?: string; // 익절/손절 및 리스크 관리
  exitStrategy?: string; // 청산 전략
}

export interface AIFundDecision {
  id: string;
  requestId?: string;
  executedAt?: string; // Authoritative UTC ISO execution timestamp
  timestamp: string;
  action: 'BUY' | 'SELL' | 'SCALP' | 'HOLD';
  ticker: string;
  name: string;
  market: MarketType;
  exchange: ExchangeCategory;
  currency?: 'KRW' | 'USD';
  price: number;
  quantity: number;
  amountKRW: number;
  amountUSD?: number;
  confidence: number; // 0 to 100
  expectedProfitPercent: number;
  stopLossPercent: number;
  riskRewardRatio: string;
  macroRegime: string;
  rationales: AITradeRationale;
  aiPersona: string;
  executionStatus: 'COMPLETED' | 'PENDING' | 'REJECTED_MARKET_CLOSED' | 'REJECTED_API_ERROR' | 'REJECTED_INSUFFICIENT_FUNDS' | 'REJECTED_INSUFFICIENT_QUANTITY' | 'WAITING';
  tradeCategory: 'HIGH_VOLATILITY_BREAKOUT' | 'OFI_MOMENTUM' | 'OVERSOLD_REBOUND' | 'CATALYST_SURGE' | 'QUICK_SCALP_PROFIT' | 'VALUE_FUNDAMENTAL_COMPOUND';
  strategyTrack?: StrategyTrackType;
  aiProvider?: string;
  aiModel?: string;
  aiRequestTime?: string;
  aiResponseTime?: string;
  rawAIResponseSummary?: string;
  isFallbackGenerated?: boolean;
}

export interface AIFundLiveThought {
  id: string;
  timestamp: string;
  type: 'MARKET_SCAN' | 'SIGNAL_FOUND' | 'EXECUTE_BUY' | 'EXECUTE_SELL' | 'HOLD' | 'SYSTEM' | 'ERROR' | 'SCAN' | 'RISK_CHECK';
  message: string;
  track?: 'DAY_TRADE_MOMENTUM' | 'VALUE_COMPOUNDING';
  ticker?: string;
  stockName?: string;
  score?: number;
}

export interface ApiQuotaUsage {
  dailyLimit: number; // 20
  shortTermDailyLimit: number; // 18
  longTermDailyLimit: number; // 2
  dailyApiCalls: number; // total successful calls today (max 20)
  shortTermCalls: number; // short-term calls today (max 18)
  longTermCalls: number; // long-term calls today (max 2)
  remainingCalls: number; // 20 - dailyApiCalls
  lastShortTermCallTime?: number; // timestamp
  lastLongTermCallTime?: number; // timestamp
  lastShortTermFailed?: boolean;
  lastLongTermFailed?: boolean;
  lastLongTermSlot?: string; // '09:00' | '18:00'
  executedSlots?: string[]; // ['2025-02-27-09:00', '2025-02-27-18:00']
  currentDate: string; // 'YYYY-MM-DD'
  isLimitReached: boolean;
  limitMessage?: string;
  nextShortTermScheduled?: string;
  nextLongTermScheduled?: string;
}

export interface DualAccountFundState {
  masterAccount: SimulationAccount; // Total 10억
  shortTermAccount: SimulationAccount; // 5억 단기
  longTermAccount: SimulationAccount; // 5억 중장기
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

export type MarketConnectionStatus = 'LIVE' | 'DELAYED' | 'CLOSED' | 'DISCONNECTED';


