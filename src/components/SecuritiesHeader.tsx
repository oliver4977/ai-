import React, { useState, useEffect, useRef } from 'react';
import { 
  ExchangeCategory, 
  StockItem, 
  MarketIndexItem,
  SimulationAccount,
  ApiQuotaUsage,
  MarketConnectionStatus
} from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Bot, 
  Layers, 
  RefreshCw, 
  Radio, 
  Wallet, 
  FlaskConical, 
  BarChart3, 
  SlidersHorizontal,
  ChevronRight,
  Flame,
  Zap,
  Activity,
  Gauge
} from 'lucide-react';

interface SecuritiesHeaderProps {
  currentExchange: ExchangeCategory;
  onSelectExchange: (exchange: ExchangeCategory) => void;
  activeView: 'TRADE' | 'PORTFOLIO' | 'EXPERIMENT' | 'SCREENER';
  onSelectView: (view: 'TRADE' | 'PORTFOLIO' | 'EXPERIMENT' | 'SCREENER') => void;
  stocks: StockItem[];
  selectedStock: StockItem;
  onSelectStock: (stock: StockItem) => void;
  account: SimulationAccount;
  shortTermAccount?: SimulationAccount;
  longTermAccount?: SimulationAccount;
  quotaUsage?: ApiQuotaUsage;
  indices: MarketIndexItem[];
  lastSyncTime: string;
  isLiveStreaming: boolean;
  onToggleLiveStream: () => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
  onOpenArchitectureModal: () => void;
  onOpenChat: () => void;
  isAiAnalyzing: boolean;
  wsStatus?: MarketConnectionStatus;
  marketStatusKR?: { isOpen: boolean; statusText: string };
  marketStatusUS?: { isOpen: boolean; statusText: string };
}

export const SecuritiesHeader: React.FC<SecuritiesHeaderProps> = ({
  currentExchange,
  onSelectExchange,
  activeView,
  onSelectView,
  stocks,
  selectedStock,
  onSelectStock,
  account,
  shortTermAccount,
  longTermAccount,
  quotaUsage,
  indices,
  lastSyncTime,
  isLiveStreaming,
  onToggleLiveStream,
  onRefreshAll,
  isRefreshing,
  onOpenArchitectureModal,
  onOpenChat,
  isAiAnalyzing,
  wsStatus = 'LIVE',
  marketStatusKR,
  marketStatusUS,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<StockItem[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter local & server search
  useEffect(() => {
    if (!searchQuery.trim()) {
      // If search query is empty, show top stocks from the current exchange
      const currentExchangeList = stocks.filter((s) => s.exchange === currentExchange).slice(0, 15);
      setSearchResults(currentExchangeList);
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    const localFiltered = stocks.filter(
      (s) =>
        s.ticker.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q)
    );
    setSearchResults(localFiltered);

    const timer = setTimeout(async () => {
      if (q.length >= 2) {
        setIsSearchingServer(true);
        try {
          const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              const serverFormatted: StockItem[] = data.results.map((r: any) => ({
                ticker: r.ticker,
                name: r.name,
                market: r.market,
                exchange: r.exchange === 'KOSDAQ' ? 'KOSDAQ' : r.market === 'KR' ? 'KOSPI' : 'NASDAQ',
                currency: r.market === 'KR' ? 'KRW' : 'USD',
                sector: r.sector || '글로벌 증시',
                price: 0,
                change: 0,
                changePercent: 0,
                volume: 0,
                marketCap: '-',
                week52High: 0,
                week52Low: 0,
                aiScore: 85,
                aiVerdict: 'BUY',
                keyTag: '실시간 검색 종목',
                description: `${r.name} (${r.ticker}) 종목의 실시간 데이터 연동 중`,
              }));

              const merged = [...localFiltered];
              serverFormatted.forEach((item) => {
                if (!merged.some((m) => m.ticker === item.ticker)) {
                  merged.push(item);
                }
              });
              setSearchResults(merged);
            }
          }
        } catch (err) {
          console.error('Server search error:', err);
        } finally {
          setIsSearchingServer(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, stocks, currentExchange]);

  // Click outside to close search
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatKRW = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(num));
  };

  const getExchangeIndices = () => {
    return indices.filter(
      (idx) => idx.exchange === 'KOSPI' || idx.exchange === 'KOSDAQ' || idx.exchange === 'NASDAQ'
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-[#090d14] border-b border-zinc-800/90 shadow-md">
      {/* 1. Real-time Market Indices Ribbon (KOSPI / KOSDAQ / NASDAQ Priority) */}
      <div className="bg-[#05070a] border-b border-zinc-850 px-3 sm:px-6 py-1.5 flex items-center justify-between text-xs overflow-x-auto scrollbar-none font-mono">
        <div className="flex items-center gap-4 sm:gap-6 min-w-max">
          {/* Live WebSocket Status indicator */}
          <button
            onClick={onToggleLiveStream}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold border transition-all ${
              wsStatus === 'LIVE'
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900/60 shadow-xs'
                : wsStatus === 'CLOSED'
                ? 'bg-amber-950/70 text-amber-300 border-amber-750 hover:bg-amber-900/60'
                : 'bg-rose-950/70 text-rose-300 border-rose-800 hover:bg-rose-900/60'
            }`}
            title={
              currentExchange === 'NASDAQ'
                ? marketStatusUS?.statusText || '미국 증시 실시간 시세 연동 중'
                : marketStatusKR?.statusText || '국내 증시 실시간 시세 연동 중'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wsStatus === 'LIVE'
                  ? 'bg-emerald-400 animate-pulse'
                  : wsStatus === 'CLOSED'
                  ? 'bg-amber-400'
                  : 'bg-rose-500 animate-ping'
              }`}
            />
            <span>
              {wsStatus === 'LIVE'
                ? 'WS 실시간 LIVE'
                : wsStatus === 'CLOSED'
                ? '장마감 (종가유지)'
                : '재연결 중...'}
            </span>
          </button>

          {/* 3 Core Indices: KOSPI, KOSDAQ, NASDAQ */}
          {indices.map((idx) => {
            const isUp = idx.change >= 0;
            const isCurrentExchange = idx.exchange === currentExchange;
            return (
              <button
                key={idx.symbol}
                onClick={() => {
                  if (idx.exchange === 'KOSPI' || idx.exchange === 'KOSDAQ' || idx.exchange === 'NASDAQ') {
                    onSelectExchange(idx.exchange);
                  }
                }}
                className={`flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-zinc-800/60 transition-colors ${
                  isCurrentExchange ? 'bg-zinc-800/80 ring-1 ring-zinc-600' : ''
                }`}
              >
                <span className="font-semibold text-zinc-300 text-[11px]">{idx.name}</span>
                <span className="text-zinc-100 font-bold">
                  {idx.price > 0 ? idx.price.toLocaleString() : '로딩중...'}
                </span>
                <span
                  className={`flex items-center text-[11px] font-semibold ${
                    isUp ? 'text-red-400' : 'text-blue-400'
                  }`}
                >
                  {isUp ? '+' : ''}
                  {idx.changePercent}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Sync Controls & AI Quota */}
        <div className="flex items-center gap-3 text-zinc-400 text-[11px] ml-4 min-w-max">
          {quotaUsage && (
            <div 
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono ${
                quotaUsage.isLimitReached
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800/80'
                  : 'bg-blue-950/60 text-cyan-300 border-blue-800/60'
              }`}
              title={`단기 AI: ${quotaUsage.shortTermCalls}/18회 | 중장기 AI: ${quotaUsage.longTermCalls}/2회`}
            >
              <Bot className="w-3 h-3 text-cyan-400" />
              <span>오늘 AI 분석: <strong className="text-white">{quotaUsage.dailyApiCalls}</strong> / {quotaUsage.dailyLimit}</span>
              <span className="text-zinc-500">|</span>
              <span>남은: <strong className={quotaUsage.remainingCalls === 0 ? 'text-rose-400' : 'text-emerald-400'}>{quotaUsage.remainingCalls}회</strong></span>
            </div>
          )}
          <span className="hidden sm:inline text-zinc-500">동기화: {lastSyncTime || '방금 전'}</span>
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-1 hover:text-zinc-200 transition-colors p-1 rounded hover:bg-zinc-800"
            title="시장 시세 즉시 새로고침"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden md:inline">새로고침</span>
          </button>
        </div>
      </div>

      {/* 2. Main Navigation Bar & Market Selector */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Platform Identity */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 via-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/15">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white tracking-tight text-sm">토스증권 MTS PRO</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-blue-900/60 text-blue-300 border border-blue-700/60 rounded font-semibold">
                  Toss OpenAPI
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono hidden sm:block">토스증권 API 기반 10억 AI 자율투자</p>
            </div>
          </div>

          {/* Core Exchange Tabs: [코스피 KOSPI] [코스닥 KOSDAQ] [나스닥 NASDAQ] */}
          <div className="flex items-center bg-[#0e131d] border border-zinc-750 p-0.5 rounded-lg">
            {(['KOSPI', 'KOSDAQ', 'NASDAQ'] as ExchangeCategory[]).map((exch) => {
              const isActive = currentExchange === exch;
              return (
                <button
                  key={exch}
                  onClick={() => onSelectExchange(exch)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  {exch === 'KOSPI' ? '코스피 KOSPI' : exch === 'KOSDAQ' ? '코스닥 KOSDAQ' : '나스닥 NASDAQ'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-xs sm:max-w-sm relative" ref={searchRef}>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="종목명, 티커 검색 (삼성전자, NVDA, 알테오젠...)"
              className="w-full pl-8 pr-3 py-1.5 bg-[#0e131d] border border-zinc-750 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all font-sans"
            />
          </div>

          {/* Search Dropdown */}
          {isSearchOpen && (searchQuery.trim().length > 0 || searchResults.length > 0) && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#0e131d] border border-zinc-750 rounded-lg shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-zinc-800/70">
              {searchResults.length > 0 ? (
                searchResults.map((stk) => {
                  const isSelected = stk.ticker === selectedStock.ticker;
                  const isUp = stk.change >= 0;
                  return (
                    <button
                      key={stk.ticker}
                      onClick={() => {
                        onSelectStock(stk);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-zinc-800/80 transition-colors ${
                        isSelected ? 'bg-blue-950/40 border-l-2 border-blue-500' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white text-xs">{stk.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">{stk.ticker}</span>
                          <span className="text-[9px] px-1 py-0.2 bg-zinc-800 text-zinc-300 rounded font-mono">
                            {stk.exchange}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">{stk.sector}</p>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-xs font-semibold text-zinc-100">
                          {stk.price > 0
                            ? stk.currency === 'KRW'
                              ? `${formatKRW(stk.price)}원`
                              : `$${stk.price}`
                            : '-'}
                        </div>
                        <div className={`text-[10px] font-semibold ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                          {isUp ? '+' : ''}
                          {stk.changePercent}%
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-zinc-500">
                  {isSearchingServer ? '실시간 거래소 검색 중...' : '일치하는 종목이 없습니다.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* View Switchers (Securities MTS Style) */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-[#0e131d] border border-zinc-750 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => onSelectView('TRADE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeView === 'TRADE'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>차트 / 호가주문</span>
            </button>

            <button
              onClick={() => onSelectView('SCREENER')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeView === 'SCREENER'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>전종목 둘러보기</span>
              <span className="text-[10px] px-1 bg-zinc-800 text-zinc-300 rounded font-mono">
                {stocks.length}
              </span>
            </button>

            <button
              onClick={() => onSelectView('PORTFOLIO')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeView === 'PORTFOLIO'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <span>내 자산 / 보유종목</span>
              {account.holdings.length > 0 && (
                <span className="text-[10px] px-1 bg-amber-500/20 text-amber-300 rounded font-mono">
                  {account.holdings.length}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectView('EXPERIMENT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeView === 'EXPERIMENT'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>10억 AI 자율펀드</span>
              {account.aiAutoTradeEnabled && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="오토파일럿 상시 가동 중" />
              )}
            </button>
          </div>

          {/* AI Chat Assistant Toggle */}
          <button
            onClick={onOpenChat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-900/30 transition-all"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">AI 퀀트 상담</span>
          </button>
        </div>
      </div>
    </header>
  );
};
