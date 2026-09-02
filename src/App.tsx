import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  StockItem, 
  CandleData, 
  AIAnalysisResult, 
  ExchangeCategory,
  SimulationAccount,
  HoldingStock,
  OrderRecord,
  OrderSide,
  OrderType,
  MarketIndexItem,
  AIFundDecision,
  AIFundLiveThought,
  ApiQuotaUsage,
  DualAccountFundState,
  MarketConnectionStatus
} from './types';
import { generateStockCandles, INITIAL_SIMULATION_ACCOUNT } from './data/mockStocks';
import { FULL_EXPANDED_STOCK_DATABASE } from './data/fullStockUniverse';
import { INITIAL_AI_DECISIONS, INITIAL_AI_THOUGHTS } from './data/aiTradeDefaults';
import { 
  enrichCandleData,
  findSupportResistanceLevels, 
  detectChartPatterns, 
  generateIndicatorSignals 
} from './utils/technicalAnalysis';

import { SecuritiesHeader } from './components/SecuritiesHeader';
import { AccountSummaryBar } from './components/AccountSummaryBar';
import { ExchangeStockBar } from './components/ExchangeStockBar';
import { StockHeader } from './components/StockHeader';
import { InteractiveChart } from './components/InteractiveChart';
import { OrderBook } from './components/OrderBook';
import { TradeExecutionPanel } from './components/TradeExecutionPanel';
import { PortfolioView } from './components/PortfolioView';
import { AIExperimentLab } from './components/AIExperimentLab';
import { MarketScreenerView } from './components/MarketScreenerView';
import { AIRecommendationCard } from './components/AIRecommendationCard';
import { AITechnicalBreakdown } from './components/AITechnicalBreakdown';
import { AIChatDrawer } from './components/AIChatDrawer';
import { CustomStockModal } from './components/CustomStockModal';
import { SystemArchitectureModal } from './components/SystemArchitectureModal';
import { AccountResetModal } from './components/AccountResetModal';

import { 
  TrendingUp, 
  Sparkles, 
  Zap, 
  Bot, 
  Layers, 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle,
  BarChart3,
  Radio,
  SlidersHorizontal
} from 'lucide-react';

export default function App() {
  // 1. Navigation & Market Categorization (KOSPI, KOSDAQ, NASDAQ)
  const [currentExchange, setCurrentExchange] = useState<ExchangeCategory>('KOSPI');
  const [activeView, setActiveView] = useState<'TRADE' | 'PORTFOLIO' | 'EXPERIMENT' | 'SCREENER'>('TRADE');

  // 2. Stock Universe & Selection
  const [stocks, setStocks] = useState<StockItem[]>(FULL_EXPANDED_STOCK_DATABASE);
  const [selectedStock, setSelectedStock] = useState<StockItem>(FULL_EXPANDED_STOCK_DATABASE[0]); // Default: 삼성전자 (005930)
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '1H' | '15m'>('1D');
  const [targetPriceFromOrderBook, setTargetPriceFromOrderBook] = useState<number | null>(null);

  // 3. Real-time Market Feeds & WebSocket State
  const [indices, setIndices] = useState<MarketIndexItem[]>([]);
  const [candles, setCandles] = useState<CandleData[]>(() => 
    generateStockCandles(FULL_EXPANDED_STOCK_DATABASE[0], 90, '1D')
  );
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [wsStatus, setWsStatus] = useState<MarketConnectionStatus>('LIVE');
  const [marketStatusKR, setMarketStatusKR] = useState<{ isOpen: boolean; statusText: string }>({
    isOpen: true,
    statusText: '국내 정규장 실시간 연동 중',
  });
  const [marketStatusUS, setMarketStatusUS] = useState<{ isOpen: boolean; statusText: string }>({
    isOpen: true,
    statusText: '미국 정규장/프리마켓 실시간 연동 중',
  });

  // 4. AI Investor Simulation Account State (Persisted in localStorage, 10억 원 기본)
  const [account, setAccount] = useState<SimulationAccount>(() => {
    try {
      const saved = localStorage.getItem('ai_investor_simulation_account_v3');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Account load error:', e);
    }
    return INITIAL_SIMULATION_ACCOUNT;
  });

  // 5. AI Analysis state
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isRunningAIScan, setIsRunningAIScan] = useState<boolean>(false);

  // AI 10억 Fund Decisions History & Live Thought State (초기 매매일지 없음, 순수 10억 원으로 시작)
  const [aiDecisions, setAiDecisions] = useState<AIFundDecision[]>(() => {
    try {
      const saved = localStorage.getItem('ai_fund_decisions_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_AI_DECISIONS;
  });

  const [shortTermAccount, setShortTermAccount] = useState<SimulationAccount | undefined>(undefined);
  const [longTermAccount, setLongTermAccount] = useState<SimulationAccount | undefined>(undefined);
  const [quotaUsage, setQuotaUsage] = useState<ApiQuotaUsage | undefined>(undefined);
  const [shortTermDecisions, setShortTermDecisions] = useState<AIFundDecision[]>([]);
  const [longTermDecisions, setLongTermDecisions] = useState<AIFundDecision[]>([]);

  const [liveThoughts, setLiveThoughts] = useState<AIFundLiveThought[]>(() => INITIAL_AI_THOUGHTS);

  // Toast notification for AI trades
  const [aiTradeToast, setAiTradeToast] = useState<{
    open: boolean;
    title: string;
    message: string;
    isBuy: boolean;
  } | null>(null);

  // Reset Modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  // ----------------------------------------------------
  // Server-Authoritative 24H Fund Synchronization
  // ----------------------------------------------------
  const syncWithServerFundState = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/fund/state');
      if (res.ok) {
        const data = await res.json();
        if (data && data.state) {
          const serverState: DualAccountFundState = data.state;
          if (serverState.masterAccount) {
            setAccount(serverState.masterAccount);
          } else if ((serverState as any).account) {
            setAccount((serverState as any).account);
          }
          if (serverState.shortTermAccount) {
            setShortTermAccount(serverState.shortTermAccount);
          }
          if (serverState.longTermAccount) {
            setLongTermAccount(serverState.longTermAccount);
          }
          if (serverState.quotaUsage) {
            setQuotaUsage(serverState.quotaUsage);
          }
          if (Array.isArray(serverState.decisions)) {
            setAiDecisions(serverState.decisions);
          }
          if (Array.isArray(serverState.shortTermDecisions)) {
            setShortTermDecisions(serverState.shortTermDecisions);
          }
          if (Array.isArray(serverState.longTermDecisions)) {
            setLongTermDecisions(serverState.longTermDecisions);
          }
          if (Array.isArray(serverState.liveThoughts) && serverState.liveThoughts.length > 0) {
            setLiveThoughts(serverState.liveThoughts);
          }
        }
      }
    } catch (e) {
      console.warn('Server fund sync warning:', e);
    }
  }, []);

  // Initial and periodic sync every 10 seconds (picks up trades executed while offline!)
  useEffect(() => {
    syncWithServerFundState();
    const interval = setInterval(syncWithServerFundState, 10000);
    return () => clearInterval(interval);
  }, [syncWithServerFundState]);

  // Persist AI decisions
  useEffect(() => {
    try {
      localStorage.setItem('ai_fund_decisions_v3', JSON.stringify(aiDecisions));
    } catch (e) {
      console.error(e);
    }
  }, [aiDecisions]);

  // 6. Watchlist state
  const [watchlist, setWatchlist] = useState<StockItem[]>(() => {
    try {
      const saved = localStorage.getItem('alphachart_watchlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return Array.from(new Map(parsed.map((s: StockItem) => [s.ticker, s])).values());
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [FULL_EXPANDED_STOCK_DATABASE[0], FULL_EXPANDED_STOCK_DATABASE[1], FULL_EXPANDED_STOCK_DATABASE[8]];
  });

  // 7. Modals & Drawers
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [isArchModalOpen, setIsArchModalOpen] = useState<boolean>(false);

  // Persist account to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ai_investor_simulation_account_v3', JSON.stringify(account));
    } catch (e) {
      console.error('Account save error:', e);
    }
  }, [account]);

  // Persist watchlist
  useEffect(() => {
    try {
      localStorage.setItem('alphachart_watchlist', JSON.stringify(watchlist));
    } catch (e) {
      console.error(e);
    }
  }, [watchlist]);

  // Ref for stocks to keep fetchStockQuotes stable without re-triggering loops
  const stocksRef = React.useRef(stocks);
  useEffect(() => {
    stocksRef.current = stocks;
  }, [stocks]);

  const selectedStockRef = React.useRef(selectedStock);
  useEffect(() => {
    selectedStockRef.current = selectedStock;
  }, [selectedStock]);

  const accountRef = React.useRef(account);
  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  const watchlistRef = React.useRef(watchlist);
  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);

  // Helper function to recalculate single account with live quotes & exchange rate
  const recalculateAccountWithQuotes = useCallback(
    (acc: SimulationAccount, quoteMap: Record<string, any>, exchangeRate: number): SimulationAccount => {
      let totalHoldingEvaluationKRW = 0;
      let totalHoldingPurchaseKRW = 0;

      const updatedHoldings: HoldingStock[] = acc.holdings.map((h) => {
        const live = quoteMap[h.ticker];
        const currentPrice = live && live.price > 0 ? live.price : h.currentPrice;
        const isKR = h.market === 'KR' || h.currency === 'KRW';

        const evalKRW = isKR
          ? currentPrice * h.quantity
          : currentPrice * h.quantity * exchangeRate;

        const purchaseKRW = isKR
          ? h.averageBuyPrice * h.quantity
          : h.averageBuyPrice * h.quantity * exchangeRate;

        const profitKRW = evalKRW - purchaseKRW;
        const profitRate = purchaseKRW > 0 ? Number(((profitKRW / purchaseKRW) * 100).toFixed(2)) : 0;

        totalHoldingEvaluationKRW += evalKRW;
        totalHoldingPurchaseKRW += purchaseKRW;

        return {
          ...h,
          currentPrice,
          totalEvaluationAmount: Math.round(evalKRW),
          totalPurchaseAmount: Math.round(purchaseKRW),
          evaluationProfit: Math.round(profitKRW),
          profitRate,
        };
      });

      const cashTotalKRW = acc.cashKRW + (acc.cashUSD || 0) * exchangeRate;
      const totalAssetKRW = Math.round(cashTotalKRW + totalHoldingEvaluationKRW);
      const totalProfitKRW = Math.round(totalAssetKRW - acc.initialCapitalKRW);
      const totalProfitRate = acc.initialCapitalKRW > 0 ? Number(((totalProfitKRW / acc.initialCapitalKRW) * 100).toFixed(2)) : 0;

      // Update allocation percentages
      updatedHoldings.forEach((h) => {
        h.allocationPercent = totalAssetKRW > 0 ? Number(((h.totalEvaluationAmount / totalAssetKRW) * 100).toFixed(1)) : 0;
      });

      return {
        ...acc,
        exchangeRateUSD_KRW: exchangeRate,
        holdings: updatedHoldings,
        totalAssetKRW,
        totalEvaluationProfitKRW: totalProfitKRW,
        totalProfitRate,
      };
    },
    []
  );

  // Fetch 3 Market Indices (KOSPI, KOSDAQ, NASDAQ) - Fallback
  const fetchMarketIndices = useCallback(async () => {
    try {
      const res = await fetch('/api/market/indices');
      if (res.ok) {
        const data = await res.json();
        if (data.indices && Array.isArray(data.indices)) {
          setIndices(data.indices);
          setLastSyncTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch market indices:', err);
    }
  }, []);

  // Fetch Live Stock Quotes & Recalculate Portfolio Holdings - Fallback
  const fetchStockQuotes = useCallback(async () => {
    try {
      const currentStocks = stocksRef.current;
      const currentSelected = selectedStockRef.current;
      const currentAccount = accountRef.current;
      const currentWatchlist = watchlistRef.current;

      const allUniverseTickers = currentStocks.map((s) => s.ticker);
      const watchlistTickers = currentWatchlist.map((w) => w.ticker);
      const holdingTickers = currentAccount.holdings.map((h) => h.ticker);
      const uniqueTickers = Array.from(
        new Set([currentSelected.ticker, ...allUniverseTickers, ...watchlistTickers, ...holdingTickers])
      );

      const res = await fetch(`/api/market/quotes?tickers=${encodeURIComponent(uniqueTickers.join(','))}`);
      if (res.ok) {
        const data = await res.json();
        const quotes: Record<string, any> = data.quotes || {};
        const quoteList: any[] = Array.isArray(data.quoteList) 
          ? data.quoteList 
          : Object.values(quotes);

        if (quoteList.length > 0) {
          const quotesByTicker = quotes && Object.keys(quotes).length > 0 
            ? quotes 
            : quoteList.reduce((acc, q) => ({ ...acc, [q.ticker]: q }), {});

          // 1. Update stock database for all stocks in the screener
          setStocks((prev) =>
            prev.map((s) => {
              const live = quotesByTicker[s.ticker];
              if (live && live.price > 0) {
                return {
                  ...s,
                  price: live.price,
                  change: live.change,
                  changePercent: live.changePercent,
                  volume: live.volume || s.volume,
                  week52High: live.week52High || s.week52High,
                  week52Low: live.week52Low || s.week52Low,
                };
              }
              return s;
            })
          );

          // 2. Update selected stock
          setSelectedStock((current) => {
            const live = quotesByTicker[current.ticker];
            if (live && live.price > 0) {
              return {
                ...current,
                price: live.price,
                change: live.change,
                changePercent: live.changePercent,
                volume: live.volume || current.volume,
                week52High: live.week52High || current.week52High,
                week52Low: live.week52Low || current.week52Low,
              };
            }
            return current;
          });

          // 3. Update watchlist
          setWatchlist((prev) =>
            prev.map((s) => {
              const live = quotesByTicker[s.ticker];
              if (live && live.price > 0) {
                return {
                  ...s,
                  price: live.price,
                  change: live.change,
                  changePercent: live.changePercent,
                };
              }
              return s;
            })
          );

          // 4. Recalculate Accounts
          const exchangeRate = currentAccount.exchangeRateUSD_KRW || 1395;
          setAccount((prevAcc) => recalculateAccountWithQuotes(prevAcc, quotesByTicker, exchangeRate));
          setShortTermAccount((prevShort) => prevShort ? recalculateAccountWithQuotes(prevShort, quotesByTicker, exchangeRate) : undefined);
          setLongTermAccount((prevLong) => prevLong ? recalculateAccountWithQuotes(prevLong, quotesByTicker, exchangeRate) : undefined);

          setLastSyncTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch stock quotes:', err);
    }
  }, [recalculateAccountWithQuotes]);

  // WebSocket Live Stream Connection
  const wsRef = React.useRef<WebSocket | null>(null);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      if (!isLiveStreaming) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/market`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setWsStatus('LIVE');

          // Subscribe immediately to priority tickers
          const currentSelected = selectedStockRef.current.ticker;
          const holdingTickers = accountRef.current.holdings.map((h) => h.ticker);
          const watchlistTickers = watchlistRef.current.map((w) => w.ticker);
          const subTickers = Array.from(new Set([currentSelected, ...holdingTickers, ...watchlistTickers]));
          ws.send(JSON.stringify({ type: 'SUBSCRIBE', tickers: subTickers }));
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const message = JSON.parse(event.data);

            if (message.type === 'INIT_STATE' || message.type === 'PRICE_UPDATE') {
              const data = message.data;
              if (!data) return;

              const quotes: Record<string, any> = data.quotes || {};
              const liveIndices: MarketIndexItem[] = data.indices || [];
              const exchangeRate = data.exchangeRateUSD_KRW || 1395;

              if (liveIndices.length > 0) {
                setIndices(liveIndices);
              }
              if (data.marketStatusKR) setMarketStatusKR(data.marketStatusKR);
              if (data.marketStatusUS) setMarketStatusUS(data.marketStatusUS);

              const quoteKeys = Object.keys(quotes);

              if (quoteKeys.length > 0) {
                // 1. Update stock universe
                setStocks((prev) =>
                  prev.map((s) => {
                    const live = quotes[s.ticker];
                    if (live && live.price > 0) {
                      return {
                        ...s,
                        price: live.price,
                        change: live.change,
                        changePercent: live.changePercent,
                        volume: live.volume || s.volume,
                        week52High: live.week52High || s.week52High,
                        week52Low: live.week52Low || s.week52Low,
                      };
                    }
                    return s;
                  })
                );

                // 2. Update selected stock
                setSelectedStock((current) => {
                  const live = quotes[current.ticker];
                  if (live && live.price > 0) {
                    return {
                      ...current,
                      price: live.price,
                      change: live.change,
                      changePercent: live.changePercent,
                      volume: live.volume || current.volume,
                      week52High: live.week52High || current.week52High,
                      week52Low: live.week52Low || current.week52Low,
                    };
                  }
                  return current;
                });

                // 3. Update watchlist
                setWatchlist((prev) =>
                  prev.map((s) => {
                    const live = quotes[s.ticker];
                    if (live && live.price > 0) {
                      return {
                        ...s,
                        price: live.price,
                        change: live.change,
                        changePercent: live.changePercent,
                      };
                    }
                    return s;
                  })
                );

                // 4. Update latest candle close for active chart
                const selectedQuote = quotes[selectedStockRef.current.ticker];
                if (selectedQuote && selectedQuote.price > 0) {
                  setCandles((prevCandles) => {
                    if (prevCandles.length === 0) return prevCandles;
                    const updated = [...prevCandles];
                    const lastIdx = updated.length - 1;
                    const last = updated[lastIdx];
                    if (last && last.close !== selectedQuote.price) {
                      updated[lastIdx] = {
                        ...last,
                        close: selectedQuote.price,
                        high: Math.max(last.high, selectedQuote.price),
                        low: Math.min(last.low, selectedQuote.price),
                        volume: selectedQuote.volume || last.volume,
                      };
                      return enrichCandleData(updated);
                    }
                    return prevCandles;
                  });
                }

                // 5. Recalculate Master, Short-Term, Long-Term Accounts in Real-time
                setAccount((prevAcc) => recalculateAccountWithQuotes(prevAcc, quotes, exchangeRate));
                setShortTermAccount((prevShort) => prevShort ? recalculateAccountWithQuotes(prevShort, quotes, exchangeRate) : undefined);
                setLongTermAccount((prevLong) => prevLong ? recalculateAccountWithQuotes(prevLong, quotes, exchangeRate) : undefined);

                setLastSyncTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
              }
            } else if (message.type === 'PORTFOLIO_UPDATE' && message.data?.fundState) {
              const serverState: DualAccountFundState = message.data.fundState;
              if (serverState.masterAccount) setAccount(serverState.masterAccount);
              if (serverState.shortTermAccount) setShortTermAccount(serverState.shortTermAccount);
              if (serverState.longTermAccount) setLongTermAccount(serverState.longTermAccount);
              if (serverState.quotaUsage) setQuotaUsage(serverState.quotaUsage);
              if (Array.isArray(serverState.decisions)) setAiDecisions(serverState.decisions);
              if (Array.isArray(serverState.shortTermDecisions)) setShortTermDecisions(serverState.shortTermDecisions);
              if (Array.isArray(serverState.longTermDecisions)) setLongTermDecisions(serverState.longTermDecisions);
              if (Array.isArray(serverState.liveThoughts)) setLiveThoughts(serverState.liveThoughts);
            }
          } catch (e) {
            console.warn('WS Message parse error:', e);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setWsStatus('DISCONNECTED');
          if (isLiveStreaming) {
            reconnectTimer = setTimeout(connectWebSocket, 2500);
          }
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setWsStatus('DISCONNECTED');
        };
      } catch (err) {
        console.warn('WebSocket connection error:', err);
        if (isMounted && isLiveStreaming) {
          reconnectTimer = setTimeout(connectWebSocket, 3000);
        }
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [isLiveStreaming, recalculateAccountWithQuotes]);

  // Subscribe new stock ticker when selectedStock changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SUBSCRIBE', tickers: [selectedStock.ticker] }));
    }
  }, [selectedStock.ticker]);

  // Fetch real candles for the selected stock
  const fetchCandles = useCallback(async (stock: StockItem, tf: '1D' | '1W' | '1M' | '1H' | '15m') => {
    setIsLoadingCandles(true);
    try {
      const res = await fetch(
        `/api/market/candles?ticker=${encodeURIComponent(stock.ticker)}&market=${stock.market}&timeframe=${tf}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.candles && Array.isArray(data.candles) && data.candles.length > 0) {
          const enriched = enrichCandleData(data.candles);
          setCandles(enriched);
          if (data.currentPrice && data.currentPrice > 0) {
            setSelectedStock((prev) => ({
              ...prev,
              price: data.currentPrice,
              change: data.change ?? prev.change,
              changePercent: data.changePercent ?? prev.changePercent,
            }));

            // Sync with stocks universe so Screener view matches instantly
            setStocks((prev) =>
              prev.map((s) =>
                s.ticker === stock.ticker
                  ? {
                      ...s,
                      price: data.currentPrice,
                      change: data.change ?? s.change,
                      changePercent: data.changePercent ?? s.changePercent,
                    }
                  : s
              )
            );

            // Sync watchlist
            setWatchlist((prev) =>
              prev.map((s) =>
                s.ticker === stock.ticker
                  ? {
                      ...s,
                      price: data.currentPrice,
                      change: data.change ?? s.change,
                      changePercent: data.changePercent ?? s.changePercent,
                    }
                  : s
              )
            );
          }
          setIsLoadingCandles(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Real candle fetch failed, using fallback candles:', err);
    }

    const fallback = generateStockCandles(stock, 90, tf);
    setCandles(fallback);
    setIsLoadingCandles(false);
  }, []);

  // Sync candles on selectedStock or timeframe change
  useEffect(() => {
    fetchCandles(selectedStock, timeframe);
  }, [selectedStock.ticker, timeframe, fetchCandles]);

  // Initial load fallback
  useEffect(() => {
    fetchMarketIndices();
    fetchStockQuotes();
  }, [fetchMarketIndices, fetchStockQuotes]);

  // Manual full refresh
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchMarketIndices(), fetchStockQuotes(), fetchCandles(selectedStock, timeframe)]);
    setIsRefreshing(false);
  };

  // Run AI Technical & Quant Analysis
  const runAiAnalysis = useCallback(async () => {
    if (candles.length === 0) return;
    setIsAiAnalyzing(true);

    try {
      const sr = findSupportResistanceLevels(candles);
      const patterns = detectChartPatterns(candles);
      const signals = generateIndicatorSignals(candles);

      const recentCandles = candles.slice(-20).map((c) => ({
        date: c.date,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        rsi: c.rsi14,
        macd: c.macd,
      }));

      const payload = {
        ticker: selectedStock.ticker,
        name: selectedStock.name,
        market: selectedStock.market,
        currentPrice: selectedStock.price,
        currency: selectedStock.currency,
        timeframe,
        candlesSummary: recentCandles,
        technicalSignals: signals,
        detectedPatterns: patterns,
        supports: sr.supports,
        resistances: sr.resistances,
      };

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setAiAnalysis(data.analysis);
        }
      }
    } catch (err) {
      console.error('AI Analysis failed:', err);
    } finally {
      setIsAiAnalyzing(false);
    }
  }, [candles, selectedStock, timeframe]);

  // Execute Simulation Order (매수 / 매도 / AI 자동주문)
  const handleExecuteOrder = useCallback(
    async (params: {
      ticker: string;
      name: string;
      side: OrderSide;
      type: OrderType;
      price: number;
      quantity: number;
      executedBy: 'USER' | 'AI_AGENT';
      reasoning?: string;
      accountType?: 'SHORT_TERM' | 'LONG_TERM' | 'MASTER';
    }) => {
      const stockObj = stocks.find((s) => s.ticker === params.ticker) || selectedStock;

      try {
        const res = await fetch('/api/trade/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: params.ticker,
            name: params.name,
            exchange: stockObj.exchange,
            market: stockObj.market,
            side: params.side,
            type: params.type,
            price: params.price,
            quantity: params.quantity,
            accountType: params.accountType || 'SHORT_TERM',
            executedBy: params.executedBy,
          }),
        });

        const data = await res.json();

        if (data.rejected || !data.success) {
          setAiTradeToast({
            open: true,
            title: data.executionStatus === 'REJECTED_MARKET_CLOSED' ? '주문 체결 거부 (정규장 마감)' : '주문 체결 실패',
            message: data.message || data.error || '주문을 체결할 수 없습니다.',
            isBuy: false,
          });
          setTimeout(() => setAiTradeToast(null), 5000);
          return;
        }

        if (data.state) {
          const serverState: DualAccountFundState = data.state;
          if (serverState.masterAccount) setAccount(serverState.masterAccount);
          if (serverState.shortTermAccount) setShortTermAccount(serverState.shortTermAccount);
          if (serverState.longTermAccount) setLongTermAccount(serverState.longTermAccount);
          if (Array.isArray(serverState.decisions)) setAiDecisions(serverState.decisions);
        }

        setAiTradeToast({
          open: true,
          title: `${params.name} ${params.side === 'BUY' ? '매수' : '매도'} 체결 완료`,
          message: data.message || `${params.quantity}주 @ ${params.price.toLocaleString()} 체결되었습니다.`,
          isBuy: params.side === 'BUY',
        });
        setTimeout(() => setAiTradeToast(null), 4000);
      } catch (err: any) {
        console.error('Trade order API call failed:', err);
      }
    },
    [stocks, selectedStock]
  );

  // Quick sell all
  const handleQuickSellAll = useCallback(
    (ticker: string) => {
      const holding = account.holdings.find((h) => h.ticker === ticker);
      if (!holding) return;
      handleExecuteOrder({
        ticker: holding.ticker,
        name: holding.name,
        side: 'SELL',
        type: 'MARKET',
        price: holding.currentPrice,
        quantity: holding.quantity,
        executedBy: 'USER',
        reasoning: '사용자 원클릭 전량 매도',
      });
    },
    [account.holdings, handleExecuteOrder]
  );

  // Quick buy more
  const handleQuickBuyMore = useCallback(
    (ticker: string) => {
      const holding = account.holdings.find((h) => h.ticker === ticker);
      if (!holding) return;
      handleExecuteOrder({
        ticker: holding.ticker,
        name: holding.name,
        side: 'BUY',
        type: 'MARKET',
        price: holding.currentPrice,
        quantity: 10,
        executedBy: 'USER',
        reasoning: '사용자 추가 매수 (10주)',
      });
    },
    [account.holdings, handleExecuteOrder]
  );

  // AI Autonomous Scan & Simulation Execution Step (On-Demand)
  const handleTriggerAIScanAndTrade = useCallback(async () => {
    if (isRunningAIScan) return;
    setIsRunningAIScan(true);

    try {
      // Stream an initial thought
      const scanThought: AIFundLiveThought = {
        id: `TH-${Date.now()}-0`,
        timestamp: new Date().toLocaleTimeString('ko-KR'),
        type: 'SCAN',
        message: '전 종목 180+ 호가 불균형(OFI) & 6개월 누적 매물대(POC) 실시간 스캔 착수...',
        score: 95,
      };
      setLiveThoughts((prev) => [scanThought, ...prev.slice(0, 20)]);

      const response = await fetch('/api/ai/autopilot/scan-and-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account,
          stocks,
          strategyMode: 'PROFIT_MAXIMIZATION',
        }),
      });

      if (!response.ok) {
        console.warn('AI Autopilot scan returned status:', response.status);
        return;
      }

      const data = await response.json();
      if (!data || !data.success) {
        if (data?.error) {
          console.warn('AI Autopilot scan notice:', data.error);
        }
        return;
      }

      if (data.isMarketClosed) {
        if (Array.isArray(data.thoughts) && data.thoughts.length > 0) {
          setLiveThoughts((prev) => [...data.thoughts, ...prev.slice(0, 20)]);
        }
        setAiTradeToast({
          open: true,
          title: `🕒 증시 정규장 마감 상태`,
          message: data.message || '현재 장 마감 상태입니다. 실제 장 개장 시 실시간 체결이 진행됩니다.',
          isBuy: false,
        });
        setTimeout(() => {
          setAiTradeToast(null);
        }, 5000);
        return;
      }

      // Sync updated server-authoritative state
      if (data.state) {
        const sState = data.state;
        if (sState.masterAccount) setAccount(sState.masterAccount);
        if (sState.shortTermAccount) setShortTermAccount(sState.shortTermAccount);
        if (sState.longTermAccount) setLongTermAccount(sState.longTermAccount);
        if (sState.quotaUsage) setQuotaUsage(sState.quotaUsage);
        if (Array.isArray(sState.decisions)) setAiDecisions(sState.decisions);
        if (Array.isArray(sState.shortTermDecisions)) setShortTermDecisions(sState.shortTermDecisions);
        if (Array.isArray(sState.longTermDecisions)) setLongTermDecisions(sState.longTermDecisions);
        if (Array.isArray(sState.liveThoughts)) setLiveThoughts(sState.liveThoughts);
      }

      if (data.decision) {
        const dec: AIFundDecision = data.decision;

        // Show Toast for AI Trade
        setAiTradeToast({
          open: true,
          title: dec.action === 'BUY' ? `🤖 AI 자율 매수 체결: ${dec.name}` : `🤖 AI 자율 매도 체결: ${dec.name}`,
          message: `${dec.quantity}주 @ ${dec.market === 'KR' ? dec.price.toLocaleString() + '원' : '$' + dec.price} (약 ${(dec.amountKRW / 100000000).toFixed(2)}억 원) | 신뢰도 ${dec.confidence}%`,
          isBuy: dec.action === 'BUY',
        });

        setTimeout(() => {
          setAiTradeToast(null);
        }, 5000);
      }
    } catch (error) {
      console.warn('AI Autopilot scan notice:', error);
    } finally {
      setIsRunningAIScan(false);
    }
  }, [account, stocks, isRunningAIScan]);

  // Open Reset Account Modal
  const handleResetAccount = () => {
    setIsResetModalOpen(true);
  };

  // Execute full reset with custom or 0 capital
  const handleConfirmResetAccount = async (targetCapitalKRW: number = 1000000000) => {
    try {
      await fetch('/api/ai/fund/reset', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialCapital: targetCapitalKRW })
      });
      await syncWithServerFundState();
    } catch (e) {
      console.error('Server reset error:', e);
    }

    const newAccount: SimulationAccount = {
      ...INITIAL_SIMULATION_ACCOUNT,
      initialCapitalKRW: targetCapitalKRW,
      cashKRW: targetCapitalKRW,
      cashUSD: 0,
      holdings: [],
      orders: [],
      totalAssetKRW: targetCapitalKRW,
      totalEvaluationProfitKRW: 0,
      totalProfitRate: 0,
      dailyProfitKRW: 0,
      dailyProfitRate: 0,
    };

    setAccount(newAccount);
    setAiDecisions([]);
    setLiveThoughts([
      {
        id: `TH-RESET-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('ko-KR'),
        type: 'SCAN',
        message: `[시뮬레이션 초기화] 보유 주식이 전량 삭제되고 총 자산이 ${targetCapitalKRW === 0 ? '0원' : (targetCapitalKRW / 100000000).toFixed(0) + '억 원'}으로 새롭게 설정되었습니다.`,
        score: 99,
      }
    ]);

    try {
      localStorage.setItem('ai_investor_simulation_account_v3', JSON.stringify(newAccount));
      localStorage.removeItem('ai_fund_decisions_v3');
      localStorage.removeItem('ai_fund_decisions_v2');
    } catch (e) {
      console.error('Account reset storage error:', e);
    }

    setAiTradeToast({
      open: true,
      title: '🔄 모의투자 계좌 초기화 완료',
      message: `보유 주식이 전량 청산되고 자산이 ${targetCapitalKRW.toLocaleString()}원으로 초기화되었습니다.`,
      isBuy: true,
    });
    setTimeout(() => {
      setAiTradeToast(null);
    }, 4000);
  };

  // Toggle AI Auto Trade (Syncs with server 24H background worker)
  const handleToggleAutoTrade = async () => {
    const nextVal = !account.aiAutoTradeEnabled;
    setAccount((prev) => ({
      ...prev,
      aiAutoTradeEnabled: nextVal,
    }));
    try {
      await fetch('/api/ai/fund/toggle-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextVal }),
      });
    } catch (e) {
      console.error('Toggle bot error:', e);
    }
  };

  // Toggle Watchlist
  const handleToggleWatchlist = (stock: StockItem) => {
    setWatchlist((prev) => {
      const exists = prev.some((s) => s.ticker === stock.ticker);
      if (exists) {
        return prev.filter((s) => s.ticker !== stock.ticker);
      }
      return [...prev, stock];
    });
  };

  const isWatchlisted = watchlist.some((s) => s.ticker === selectedStock.ticker);
  const technicalAnalysis = useMemo(() => {
    return {
      sr: findSupportResistanceLevels(candles),
      patterns: detectChartPatterns(candles),
      signals: generateIndicatorSignals(candles),
    };
  }, [candles]);

  return (
    <div className="min-h-screen bg-[#05070a] text-zinc-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Master Securities Header (KOSPI, KOSDAQ, NASDAQ Tabs + Real Market Feeds) */}
      <SecuritiesHeader
        currentExchange={currentExchange}
        onSelectExchange={(ex) => {
          setCurrentExchange(ex);
          const firstInExchange = stocks.find((s) => s.exchange === ex);
          if (firstInExchange) setSelectedStock(firstInExchange);
        }}
        activeView={activeView}
        onSelectView={setActiveView}
        stocks={stocks}
        selectedStock={selectedStock}
        onSelectStock={(stk) => {
          setSelectedStock(stk);
          if (stk.exchange) setCurrentExchange(stk.exchange);
        }}
        account={account}
        shortTermAccount={shortTermAccount}
        longTermAccount={longTermAccount}
        quotaUsage={quotaUsage}
        indices={indices}
        lastSyncTime={lastSyncTime}
        isLiveStreaming={isLiveStreaming}
        onToggleLiveStream={() => setIsLiveStreaming((prev) => !prev)}
        onRefreshAll={handleRefreshAll}
        isRefreshing={isRefreshing}
        onOpenArchitectureModal={() => setIsArchModalOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        isAiAnalyzing={isAiAnalyzing}
        wsStatus={wsStatus}
        marketStatusKR={marketStatusKR}
        marketStatusUS={marketStatusUS}
      />

      {/* 2. Main Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* View 1: TRADE (차트 / 10호가 / 실시간 매매창) */}
        {activeView === 'TRADE' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Account Summary Strip */}
            <AccountSummaryBar
              account={account}
              shortTermAccount={shortTermAccount}
              longTermAccount={longTermAccount}
              quotaUsage={quotaUsage}
              onToggleAutoTrade={handleToggleAutoTrade}
              onResetAccount={handleResetAccount}
              onOpenPortfolioView={() => setActiveView('PORTFOLIO')}
            />

            {/* Exchange Stock Bar: [KOSPI] [KOSDAQ] [NASDAQ] Live Stock Carousel */}
            <ExchangeStockBar
              currentExchange={currentExchange}
              onSelectExchange={setCurrentExchange}
              stocks={stocks}
              selectedStock={selectedStock}
              onSelectStock={(stk) => {
                setSelectedStock(stk);
                if (stk.exchange) setCurrentExchange(stk.exchange);
              }}
            />

            {/* Stock Header */}
            <StockHeader
              stock={selectedStock}
              onRunAiAnalysis={runAiAnalysis}
              isAiAnalyzing={isAiAnalyzing}
              isWatchlisted={isWatchlisted}
              onToggleWatchlist={() => handleToggleWatchlist(selectedStock)}
              onOpenCustomStockModal={() => setIsCustomModalOpen(true)}
            />

            {/* Trading Desk Grid: [Left 8-cols: Candlestick Chart] + [Right 4-cols: 10-level OrderBook & Order Execution] */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Candlestick Chart */}
              <div className="lg:col-span-8 space-y-4">
                <InteractiveChart
                  candles={candles}
                  stock={selectedStock}
                  timeframe={timeframe}
                  onChangeTimeframe={setTimeframe}
                  supportLevels={technicalAnalysis.sr.supports}
                  resistanceLevels={technicalAnalysis.sr.resistances}
                  patterns={technicalAnalysis.patterns}
                />

                {/* AI Recommendation & Technical Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AIRecommendationCard
                    stock={selectedStock}
                    analysis={aiAnalysis}
                    onRunAnalysis={runAiAnalysis}
                    isAnalyzing={isAiAnalyzing}
                  />
                  <AITechnicalBreakdown
                    stock={selectedStock}
                    analysis={aiAnalysis}
                    signals={technicalAnalysis.signals}
                    patterns={technicalAnalysis.patterns}
                    supports={technicalAnalysis.sr.supports}
                    resistances={technicalAnalysis.sr.resistances}
                  />
                </div>
              </div>

              {/* Right Column: 10-level OrderBook & Instant Order Execution */}
              <div className="lg:col-span-4 space-y-4">
                {/* 10-level Order Book */}
                <OrderBook
                  stock={selectedStock}
                  onSelectPrice={(p) => setTargetPriceFromOrderBook(p)}
                />

                {/* Order Execution Panel */}
                <TradeExecutionPanel
                  stock={selectedStock}
                  account={account}
                  targetPriceInput={targetPriceFromOrderBook}
                  aiAnalysis={aiAnalysis}
                  onExecuteOrder={handleExecuteOrder}
                />
              </div>
            </div>
          </div>
        )}

        {/* View 2: SCREENER (전종목 둘러보기 / 시장 스크리너 180+ 종목) */}
        {activeView === 'SCREENER' && (
          <div className="animate-fadeIn">
            <MarketScreenerView
              currentExchange={currentExchange}
              onSelectExchange={setCurrentExchange}
              stocks={stocks}
              selectedStock={selectedStock}
              onSelectStock={(stk) => {
                setSelectedStock(stk);
                if (stk.exchange) setCurrentExchange(stk.exchange);
                setActiveView('TRADE');
              }}
              onQuickBuy={(stk) => {
                setSelectedStock(stk);
                if (stk.exchange) setCurrentExchange(stk.exchange);
                setActiveView('TRADE');
              }}
            />
          </div>
        )}

        {/* View 3: PORTFOLIO (보유자산 종합 잔고 & 체결내역) */}
        {activeView === 'PORTFOLIO' && (
          <div className="animate-fadeIn">
            <PortfolioView
              account={account}
              shortTermAccount={shortTermAccount}
              longTermAccount={longTermAccount}
              quotaUsage={quotaUsage}
              stocks={stocks}
              onSelectStock={(stk) => {
                setSelectedStock(stk);
                if (stk.exchange) setCurrentExchange(stk.exchange);
                setActiveView('TRADE');
              }}
              onQuickSellAll={handleQuickSellAll}
              onQuickBuyMore={handleQuickBuyMore}
              onOpenAIRebalanceModal={() => setIsChatOpen(true)}
              onOpenResetModal={() => setIsResetModalOpen(true)}
              isAiRebalancing={false}
            />
          </div>
        )}

        {/* View 4: EXPERIMENT (10억 AI 자율 운용 펀드 & 퀀트 실험실) */}
        {activeView === 'EXPERIMENT' && (
          <div className="animate-fadeIn">
            <AIExperimentLab
              account={account}
              shortTermAccount={shortTermAccount}
              longTermAccount={longTermAccount}
              quotaUsage={quotaUsage}
              stocks={stocks}
              onTriggerAIScanAndTrade={handleTriggerAIScanAndTrade}
              isRunningAIScan={isRunningAIScan}
              aiDecisionsHistory={aiDecisions}
              shortTermDecisions={shortTermDecisions}
              longTermDecisions={longTermDecisions}
              liveThoughts={liveThoughts}
              isAutoPilotRunning={account.aiAutoTradeEnabled}
              onToggleAutoPilot={handleToggleAutoTrade}
              onOpenResetModal={() => setIsResetModalOpen(true)}
              onSelectStock={(stk) => {
                setSelectedStock(stk);
                if (stk.exchange) setCurrentExchange(stk.exchange);
                setActiveView('TRADE');
              }}
            />
          </div>
        )}
      </main>

      {/* Real-time AI Trade Notification Toast */}
      {aiTradeToast && aiTradeToast.open && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce transition-all">
          <div className={`p-4 rounded-xl shadow-2xl border flex items-start gap-3 max-w-sm ${
            aiTradeToast.isBuy
              ? 'bg-[#0f172a] border-red-500/60 text-white'
              : 'bg-[#0f172a] border-blue-500/60 text-white'
          }`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              aiTradeToast.isBuy ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-xs font-bold text-cyan-300 font-mono">
                {aiTradeToast.title}
              </div>
              <div className="text-[11px] text-zinc-300 font-sans">
                {aiTradeToast.message}
              </div>
            </div>
            <button
              onClick={() => setAiTradeToast(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs font-mono ml-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* AI Assistant Chat Drawer */}
      <AIChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        selectedStock={selectedStock}
        latestAnalysis={aiAnalysis}
      />

      {/* Custom Stock Modal */}
      <CustomStockModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onAddStock={(newStock) => {
          setStocks((prev) => [newStock, ...prev.filter((s) => s.ticker !== newStock.ticker)]);
          setSelectedStock(newStock);
          if (newStock.exchange) setCurrentExchange(newStock.exchange);
        }}
      />

      {/* Architecture Modal */}
      <SystemArchitectureModal
        isOpen={isArchModalOpen}
        onClose={() => setIsArchModalOpen(false)}
      />

      {/* Account Reset Modal */}
      <AccountResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirmReset={handleConfirmResetAccount}
        currentCapital={account.totalAssetKRW}
      />
    </div>
  );
}
