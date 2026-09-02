import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StockItem, ExchangeCategory } from '../types';
import { 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Bot, 
  Sparkles, 
  Search, 
  ArrowRight,
  Filter,
  BarChart2,
  CheckCircle2,
  LayoutGrid,
  List,
  Zap,
  Award,
  SlidersHorizontal,
  ChevronRight,
  Star,
  Activity
} from 'lucide-react';

interface MarketScreenerViewProps {
  currentExchange: ExchangeCategory;
  onSelectExchange: (exchange: ExchangeCategory) => void;
  stocks: StockItem[];
  selectedStock: StockItem;
  onSelectStock: (stock: StockItem) => void;
  onQuickBuy: (stock: StockItem) => void;
}

export const MarketScreenerView: React.FC<MarketScreenerViewProps> = ({
  currentExchange,
  onSelectExchange,
  stocks,
  selectedStock,
  onSelectStock,
  onQuickBuy,
}) => {
  const [filterCategory, setFilterCategory] = useState<
    'ALL' | 'AI_TOP' | 'GAINERS' | 'LOSERS' | 'VOLUME' | 'SEMICON' | 'BIO' | 'BATTERY' | 'BIGTECH'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [sortBy, setSortBy] = useState<'AI_SCORE' | 'CHANGE' | 'VOLUME' | 'DEFAULT'>('DEFAULT');

  // Real-time tick change flash tracking
  const [flashMap, setFlashMap] = useState<Record<string, 'UP' | 'DOWN'>>({});
  const prevPriceMap = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const newFlashes: Record<string, 'UP' | 'DOWN'> = {};
    let hasChanges = false;

    stocks.forEach((stock) => {
      const prevPrice = prevPriceMap.current.get(stock.ticker);
      if (prevPrice !== undefined && prevPrice !== stock.price) {
        newFlashes[stock.ticker] = stock.price > prevPrice ? 'UP' : 'DOWN';
        hasChanges = true;
      }
      prevPriceMap.current.set(stock.ticker, stock.price);
    });

    if (hasChanges) {
      setFlashMap((prev) => ({ ...prev, ...newFlashes }));
      const timer = setTimeout(() => {
        setFlashMap({});
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [stocks]);

  const formatPrice = (stock: StockItem) => {
    return stock.currency === 'KRW'
      ? `${new Intl.NumberFormat('ko-KR').format(Math.round(stock.price))}원`
      : `$${stock.price.toFixed(2)}`;
  };

  const formatKRW = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(num));
  };

  // 1. Filter by exchange
  const exchangeStocks = useMemo(() => {
    return stocks.filter((s) => s.exchange === currentExchange);
  }, [stocks, currentExchange]);

  // 2. Apply theme & text filters
  const filteredStocks = useMemo(() => {
    return exchangeStocks.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          s.name.toLowerCase().includes(q) ||
          s.ticker.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q) ||
          (s.keyTag && s.keyTag.toLowerCase().includes(q));
        if (!match) return false;
      }

      if (filterCategory === 'AI_TOP') return (s.aiScore || 0) >= 90;
      if (filterCategory === 'GAINERS') return s.changePercent > 0;
      if (filterCategory === 'LOSERS') return s.changePercent < 0;
      if (filterCategory === 'VOLUME') return s.volume > 1000000;
      if (filterCategory === 'SEMICON')
        return s.sector.includes('반도체') || s.sector.includes('HBM') || s.sector.includes('IP') || s.sector.includes('장비');
      if (filterCategory === 'BIO')
        return s.sector.includes('바이오') || s.sector.includes('제약') || s.sector.includes('의료') || s.sector.includes('신약');
      if (filterCategory === 'BATTERY')
        return s.sector.includes('2차전지') || s.sector.includes('배터리') || s.sector.includes('에너지');
      if (filterCategory === 'BIGTECH')
        return s.sector.includes('IT') || s.sector.includes('클라우드') || s.sector.includes('AI') || s.sector.includes('플랫폼');

      return true;
    });
  }, [exchangeStocks, searchQuery, filterCategory]);

  // 3. Sorting
  const sortedStocks = useMemo(() => {
    const list = [...filteredStocks];
    if (sortBy === 'AI_SCORE') {
      list.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
    } else if (sortBy === 'CHANGE') {
      list.sort((a, b) => b.changePercent - a.changePercent);
    } else if (sortBy === 'VOLUME') {
      list.sort((a, b) => b.volume - a.volume);
    }
    return list;
  }, [filteredStocks, sortBy]);

  const exchangeCounts = {
    KOSPI: stocks.filter((s) => s.exchange === 'KOSPI').length,
    KOSDAQ: stocks.filter((s) => s.exchange === 'KOSDAQ').length,
    NASDAQ: stocks.filter((s) => s.exchange === 'NASDAQ').length,
  };

  return (
    <div className="space-y-4 font-sans animate-fadeIn">
      {/* 1. Top Market & Exchange Explorer Header */}
      <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/40 rounded-lg">
                <BarChart2 className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                전종목 탐색기 & 실시간 시장 스크리너
              </h2>
              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-xs font-mono rounded">
                총 {stocks.length}개 상장사
              </span>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-950/80 border border-emerald-700/60 rounded-full text-emerald-300 text-[10px] font-mono shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">HTS 실시간 틱 체결 중</span>
              </div>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              국내 코스피/코스닥 및 미국 나스닥 전종목 실시간 틱 시세 변동, AI 퀀트 모멘텀 진단, 원클릭 매매 연동
            </p>
          </div>

          {/* Search Input Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="종목명, 티커, 섹터 검색 (예: 삼성전자, NVDA, 바이오)"
              className="w-full pl-9 pr-3 py-2 bg-[#080b11] border border-zinc-750 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 font-sans"
            />
          </div>
        </div>

        {/* Exchange Selector Bar */}
        <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center bg-[#080b11] border border-zinc-750 p-1 rounded-xl">
            {(['KOSPI', 'KOSDAQ', 'NASDAQ'] as ExchangeCategory[]).map((ex) => {
              const isCurrent = currentExchange === ex;
              return (
                <button
                  key={ex}
                  onClick={() => onSelectExchange(ex)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50 scale-[1.02]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <span>{ex === 'KOSPI' ? '코스피 (KOSPI)' : ex === 'KOSDAQ' ? '코스닥 (KOSDAQ)' : '나스닥 (NASDAQ)'}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isCurrent ? 'bg-blue-800/80 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {exchangeCounts[ex]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View Mode & Sort Controls */}
          <div className="flex items-center gap-2">
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#080b11] border border-zinc-750 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
            >
              <option value="DEFAULT">기본 정렬</option>
              <option value="AI_SCORE">✨ AI 추천점수순</option>
              <option value="CHANGE">🔥 등락률(급등)순</option>
              <option value="VOLUME">⚡ 거래량순</option>
            </select>

            {/* Grid / List View Toggle */}
            <div className="flex items-center bg-[#080b11] border border-zinc-750 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'GRID' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="카드 그리드 뷰"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('LIST')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'LIST' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="테이블 리스트 뷰"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Fast Category Filter Chips */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 text-xs">
          {[
            { id: 'ALL', label: '전체 종목', icon: null },
            { id: 'AI_TOP', label: '✨ AI 강력추천 (90점+)', icon: Sparkles },
            { id: 'GAINERS', label: '🔥 실시간 급등주', icon: Flame },
            { id: 'LOSERS', label: ' 과매도 반등후보', icon: TrendingDown },
            { id: 'VOLUME', label: '⚡ 거래량 폭발', icon: Zap },
            { id: 'SEMICON', label: '반도체 & HBM', icon: null },
            { id: 'BIO', label: '바이오 & 헬스케어', icon: null },
            { id: 'BATTERY', label: '2차전지 & 친환경', icon: null },
            { id: 'BIGTECH', label: 'AI 빅테크 & 클라우드', icon: null },
          ].map((cat) => {
            const isCatActive = filterCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                  isCatActive
                    ? 'bg-zinc-800 text-white font-bold ring-1 ring-zinc-600'
                    : 'bg-[#080b11] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                {cat.icon && <cat.icon className="w-3 h-3 text-cyan-400" />}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Stock Items Presentation (GRID or LIST) */}
      {sortedStocks.length === 0 ? (
        <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-sm text-zinc-400 font-semibold">검색 및 필터 조건에 일치하는 종목이 없습니다.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterCategory('ALL');
            }}
            className="mt-3 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
          >
            필터 초기화
          </button>
        </div>
      ) : viewMode === 'GRID' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {sortedStocks.map((stk, idx) => {
            const isSelected = stk.ticker === selectedStock.ticker;
            const isUp = stk.change >= 0;
            const flash = flashMap[stk.ticker];

            return (
              <div
                key={stk.ticker}
                onClick={() => onSelectStock(stk)}
                className={`border rounded-xl p-4 transition-all duration-300 cursor-pointer relative group flex flex-col justify-between hover:border-blue-500/70 hover:shadow-xl ${
                  flash === 'UP'
                    ? 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-950/50'
                    : flash === 'DOWN'
                    ? 'bg-blue-950/40 border-blue-500/80 shadow-lg shadow-blue-950/50'
                    : isSelected
                    ? 'border-blue-500 ring-1 ring-blue-500/40 bg-blue-950/20'
                    : 'bg-[#0e131d] border-zinc-800 hover:bg-zinc-900/40'
                }`}
              >
                <div>
                  {/* Header info */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-500 font-bold">#{idx + 1}</span>
                        <h4 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">
                          {stk.name}
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-400">({stk.ticker})</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">{stk.sector}</p>
                    </div>

                    {/* AI Score Badge */}
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          (stk.aiScore || 0) >= 92
                            ? 'bg-red-950/80 text-red-300 border border-red-800/80'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-800/80'
                        }`}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>AI {stk.aiScore}점</span>
                      </span>
                    </div>
                  </div>

                  {/* Price & Change */}
                  <div className="flex items-baseline justify-between mt-3 font-mono">
                    <div
                      className={`text-lg font-bold transition-colors duration-200 px-1.5 py-0.5 rounded ${
                        flash === 'UP'
                          ? 'text-red-300 bg-red-900/60'
                          : flash === 'DOWN'
                          ? 'text-blue-300 bg-blue-900/60'
                          : 'text-white'
                      }`}
                    >
                      {formatPrice(stk)}
                    </div>
                    <div
                      className={`text-xs font-bold transition-colors duration-200 ${
                        isUp ? 'text-red-400' : 'text-blue-400'
                      }`}
                    >
                      {isUp ? '▲ +' : '▼ '}
                      {stk.change.toLocaleString()} ({isUp ? '+' : ''}
                      {stk.changePercent}%)
                    </div>
                  </div>

                  {/* Key investment thesis tag */}
                  <div className="mt-3 p-2 bg-[#080b11] border border-zinc-800/80 rounded-lg text-xs text-zinc-300">
                    <div className="text-[10px] text-zinc-500 font-semibold mb-0.5">핵심 모멘텀</div>
                    <p className="leading-snug line-clamp-1">{stk.keyTag}</p>
                  </div>
                </div>

                {/* Action row */}
                <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 font-mono">시총 {stk.marketCap}</span>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onQuickBuy(stk)}
                      className="px-2.5 py-1 bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-800/80 rounded text-[11px] font-bold transition-colors"
                    >
                      + 빠른 매수
                    </button>
                    <button
                      onClick={() => onSelectStock(stk)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <span>차트/주문</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-[#0e131d] border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#080b11] border-b border-zinc-800 text-zinc-400 font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">순위</th>
                  <th className="py-3 px-4">종목명 / 티커</th>
                  <th className="py-3 px-4">업종/섹터</th>
                  <th className="py-3 px-4 text-right">현재가</th>
                  <th className="py-3 px-4 text-right">전일대비(등락률)</th>
                  <th className="py-3 px-4 text-right">시가총액</th>
                  <th className="py-3 px-4 text-center">AI 점수</th>
                  <th className="py-3 px-4 text-center">원클릭 매매</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 font-mono">
                {sortedStocks.map((stk, idx) => {
                  const isSelected = stk.ticker === selectedStock.ticker;
                  const isUp = stk.change >= 0;
                  const flash = flashMap[stk.ticker];

                  return (
                    <tr
                      key={stk.ticker}
                      onClick={() => onSelectStock(stk)}
                      className={`cursor-pointer transition-colors duration-300 ${
                        flash === 'UP'
                          ? 'bg-red-950/40 text-red-300'
                          : flash === 'DOWN'
                          ? 'bg-blue-950/40 text-blue-300'
                          : isSelected
                          ? 'bg-blue-950/30'
                          : 'hover:bg-zinc-800/60'
                      }`}
                    >
                      <td className="py-3 px-4 text-center text-zinc-500 font-bold">{idx + 1}</td>
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{stk.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">{stk.ticker}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono line-clamp-1">{stk.keyTag}</p>
                      </td>
                      <td className="py-3 px-4 text-zinc-300 font-sans text-xs">{stk.sector}</td>
                      <td className="py-3 px-4 text-right font-bold text-xs">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded transition-colors duration-200 ${
                            flash === 'UP'
                              ? 'bg-red-900/80 text-red-200'
                              : flash === 'DOWN'
                              ? 'bg-blue-900/80 text-blue-200'
                              : 'text-white'
                          }`}
                        >
                          {formatPrice(stk)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        <span className={`text-xs ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                          {isUp ? '▲ +' : '▼ '}
                          {stk.change.toLocaleString()} ({isUp ? '+' : ''}
                          {stk.changePercent}%)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-400 text-xs">{stk.marketCap}</td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            (stk.aiScore || 0) >= 92
                              ? 'bg-red-950/80 text-red-300 border border-red-800/80'
                              : 'bg-blue-950/80 text-blue-300 border border-blue-800/80'
                          }`}
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>{stk.aiScore}점</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-sans" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onQuickBuy(stk)}
                            className="px-2 py-1 bg-red-950 text-red-300 border border-red-800 hover:bg-red-900 rounded text-[11px] font-bold transition-colors"
                          >
                            매수
                          </button>
                          <button
                            onClick={() => onSelectStock(stk)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold transition-colors flex items-center gap-0.5"
                          >
                            <span>차트/주문</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

