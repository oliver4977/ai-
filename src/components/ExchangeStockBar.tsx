import React, { useState, useMemo } from 'react';
import { StockItem, ExchangeCategory } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  Search, 
  SlidersHorizontal, 
  Check, 
  ArrowUpDown, 
  Layers, 
  Building2, 
  Globe2, 
  ChevronRight,
  X
} from 'lucide-react';
import { formatKRW } from '../utils/technicalAnalysis';

interface ExchangeStockBarProps {
  currentExchange: ExchangeCategory;
  onSelectExchange: (exchange: ExchangeCategory) => void;
  stocks: StockItem[];
  selectedStock: StockItem;
  onSelectStock: (stock: StockItem) => void;
}

type SortFilter = 'DEFAULT' | 'CHANGE_DESC' | 'CHANGE_ASC' | 'VOLUME_DESC' | 'AI_SCORE';

export const ExchangeStockBar: React.FC<ExchangeStockBarProps> = ({
  currentExchange,
  onSelectExchange,
  stocks,
  selectedStock,
  onSelectStock,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortFilter>('DEFAULT');
  const [modalSearch, setModalSearch] = useState('');
  const [modalExchangeFilter, setModalExchangeFilter] = useState<ExchangeCategory | 'ALL'>(currentExchange);

  // Filter stocks by current exchange
  const exchangeStocks = useMemo(() => {
    return stocks.filter((s) => s.exchange === currentExchange);
  }, [stocks, currentExchange]);

  // Counts for each exchange
  const counts = useMemo(() => {
    return {
      KOSPI: stocks.filter((s) => s.exchange === 'KOSPI').length,
      KOSDAQ: stocks.filter((s) => s.exchange === 'KOSDAQ').length,
      NASDAQ: stocks.filter((s) => s.exchange === 'NASDAQ').length,
    };
  }, [stocks]);

  // Sort and filter stocks for the modal
  const filteredModalStocks = useMemo(() => {
    let list = stocks;
    if (modalExchangeFilter !== 'ALL') {
      list = list.filter((s) => s.exchange === modalExchangeFilter);
    }
    if (modalSearch.trim()) {
      const q = modalSearch.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.ticker.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q) ||
          (s.keyTag && s.keyTag.toLowerCase().includes(q))
      );
    }

    const sorted = [...list];
    if (sortBy === 'CHANGE_DESC') {
      sorted.sort((a, b) => b.changePercent - a.changePercent);
    } else if (sortBy === 'CHANGE_ASC') {
      sorted.sort((a, b) => a.changePercent - b.changePercent);
    } else if (sortBy === 'VOLUME_DESC') {
      sorted.sort((a, b) => b.volume - a.volume);
    } else if (sortBy === 'AI_SCORE') {
      sorted.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
    }
    return sorted;
  }, [stocks, modalExchangeFilter, modalSearch, sortBy]);

  return (
    <div className="bg-[#0b101b] border border-zinc-800 rounded-xl p-3 shadow-lg">
      {/* Header Row: Exchange Tabs + Count Info + Explorer Button */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-zinc-800/80">
        {/* Exchange Selector Buttons */}
        <div className="flex items-center gap-1.5 bg-[#070a10] p-1 rounded-lg border border-zinc-800">
          {(['KOSPI', 'KOSDAQ', 'NASDAQ'] as ExchangeCategory[]).map((ex) => {
            const isActive = currentExchange === ex;
            const count = counts[ex] || 0;
            return (
              <button
                key={ex}
                onClick={() => {
                  onSelectExchange(ex);
                  setModalExchangeFilter(ex);
                  const first = stocks.find((s) => s.exchange === ex);
                  if (first && first.ticker !== selectedStock.ticker) {
                    onSelectStock(first);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  isActive
                    ? ex === 'KOSPI'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                      : ex === 'KOSDAQ'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                      : 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <span>{ex === 'KOSPI' ? '코스피 KOSPI' : ex === 'KOSDAQ' ? '코스닥 KOSDAQ' : '나스닥 NASDAQ'}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                    isActive ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Current Exchange Badge & Explorer Trigger */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-300 font-semibold">{currentExchange}</span>
            <span>상장 종목 {exchangeStocks.length}개 실시간 연동 중</span>
          </div>

          <button
            onClick={() => {
              setModalExchangeFilter(currentExchange);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 hover:from-blue-800/60 hover:to-indigo-800/60 border border-blue-600/50 hover:border-blue-500 rounded-lg text-xs font-bold text-blue-200 transition-all shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentExchange} 전체 종목 ({exchangeStocks.length}개) 탐색기</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Stock Chips (토스/키움 스타일 퀵 캐러셀) */}
      <div className="pt-2.5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-700">
        {exchangeStocks.map((stock) => {
          const isSelected = stock.ticker === selectedStock.ticker;
          const isUp = stock.change >= 0;

          return (
            <button
              key={stock.ticker}
              onClick={() => onSelectStock(stock)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-blue-950/70 border-blue-500 ring-1 ring-blue-500/50 shadow-md shadow-blue-900/20'
                  : 'bg-[#0f1422] border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-800/50'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${isSelected ? 'text-blue-300' : 'text-zinc-200'}`}>
                    {stock.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">{stock.ticker}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 font-mono">
                  <span className="text-[11px] font-semibold text-zinc-100">
                    {stock.currency === 'KRW' ? `${formatKRW(stock.price)}원` : `$${stock.price.toFixed(2)}`}
                  </span>
                  <span
                    className={`text-[10px] font-bold flex items-center ${
                      isUp ? 'text-red-400' : 'text-blue-400'
                    }`}
                  >
                    {isUp ? '+' : ''}
                    {stock.changePercent}%
                  </span>
                </div>
              </div>

              {stock.aiScore && (
                <div className="flex flex-col items-end pl-1 border-l border-zinc-800">
                  <span className="text-[9px] text-zinc-400">AI</span>
                  <span
                    className={`text-[10px] font-bold font-mono ${
                      stock.aiScore >= 90
                        ? 'text-emerald-400'
                        : stock.aiScore >= 80
                        ? 'text-blue-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {stock.aiScore}점
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Stock Explorer Modal (토스/키움 MTS 전체 종목 리스트 모달) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-[#0b101b] border border-zinc-750 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-[#070a10]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>전체 상장 종목 탐색기</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-700/50">
                      총 {stocks.length}개 종목
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    코스피, 코스닥, 나스닥 전 종목 실시간 시세 및 AI 분석 리포트 원클릭 조회
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="p-4 border-b border-zinc-800/80 bg-[#090d16] flex flex-wrap items-center justify-between gap-3">
              {/* Market Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#05070a] p-1 rounded-lg border border-zinc-800">
                {(['ALL', 'KOSPI', 'KOSDAQ', 'NASDAQ'] as const).map((tab) => {
                  const isActive = modalExchangeFilter === tab;
                  const count =
                    tab === 'ALL'
                      ? stocks.length
                      : stocks.filter((s) => s.exchange === tab).length;
                  return (
                    <button
                      key={tab}
                      onClick={() => setModalExchangeFilter(tab)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {tab === 'ALL'
                        ? `전체 (${count})`
                        : tab === 'KOSPI'
                        ? `코스피 (${count})`
                        : tab === 'KOSDAQ'
                        ? `코스닥 (${count})`
                        : `나스닥 (${count})`}
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="flex-1 max-w-xs relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="종목명, 티커, 섹터 검색..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#05070a] border border-zinc-750 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Sort Dropdown / Buttons */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-zinc-400 flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3" /> 정렬:
                </span>
                <button
                  onClick={() => setSortBy('DEFAULT')}
                  className={`px-2 py-1 rounded text-xs ${
                    sortBy === 'DEFAULT' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  기본
                </button>
                <button
                  onClick={() => setSortBy('CHANGE_DESC')}
                  className={`px-2 py-1 rounded text-xs ${
                    sortBy === 'CHANGE_DESC' ? 'bg-red-900/60 text-red-300 font-bold border border-red-700/60' : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  급등순 🔥
                </button>
                <button
                  onClick={() => setSortBy('VOLUME_DESC')}
                  className={`px-2 py-1 rounded text-xs ${
                    sortBy === 'VOLUME_DESC' ? 'bg-blue-900/60 text-blue-300 font-bold border border-blue-700/60' : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  거래량순
                </button>
                <button
                  onClick={() => setSortBy('AI_SCORE')}
                  className={`px-2 py-1 rounded text-xs ${
                    sortBy === 'AI_SCORE' ? 'bg-emerald-900/60 text-emerald-300 font-bold border border-emerald-700/60' : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  AI 최고점순 ✨
                </button>
              </div>
            </div>

            {/* Stock List Grid / Table */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-zinc-850">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredModalStocks.map((stk) => {
                  const isCurrent = stk.ticker === selectedStock.ticker;
                  const isUp = stk.change >= 0;

                  return (
                    <div
                      key={stk.ticker}
                      onClick={() => {
                        onSelectStock(stk);
                        if (stk.exchange) onSelectExchange(stk.exchange);
                        setIsModalOpen(false);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-blue-950/60 border-blue-500 ring-1 ring-blue-500/50 shadow-md shadow-blue-900/30'
                          : 'bg-[#0e1320] border-zinc-800/80 hover:border-zinc-650 hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm">{stk.name}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">{stk.ticker}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold font-mono ${
                                stk.exchange === 'KOSPI'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : stk.exchange === 'KOSDAQ'
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {stk.exchange}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">{stk.sector}</p>
                        </div>

                        {stk.aiScore && (
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                stk.aiVerdict === 'STRONG_BUY'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                  : stk.aiVerdict === 'BUY'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-700/60'
                                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                              }`}
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              {stk.aiVerdict === 'STRONG_BUY' ? '강력매수' : stk.aiVerdict === 'BUY' ? '매수의견' : '중립'} {stk.aiScore}점
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Price and change row */}
                      <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between font-mono">
                        <div>
                          <div className="text-sm font-bold text-white">
                            {stk.currency === 'KRW' ? `${formatKRW(stk.price)}원` : `$${stk.price.toFixed(2)}`}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            거래량 {stk.volume.toLocaleString()}
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`text-xs font-bold flex items-center justify-end gap-1 ${
                              isUp ? 'text-red-400' : 'text-blue-400'
                            }`}
                          >
                            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{isUp ? '+' : ''}{stk.changePercent}%</span>
                          </div>
                          <div className={`text-[10px] ${isUp ? 'text-red-400/80' : 'text-blue-400/80'}`}>
                            {isUp ? '+' : ''}
                            {stk.currency === 'KRW' ? `${stk.change.toLocaleString()}원` : `$${stk.change.toFixed(2)}`}
                          </div>
                        </div>
                      </div>

                      {/* Key Tag */}
                      {stk.keyTag && (
                        <div className="mt-2 text-[10px] text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded truncate border border-zinc-800">
                          💡 {stk.keyTag}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredModalStocks.length === 0 && (
                <div className="py-12 text-center text-zinc-500 text-sm">
                  검색 조건에 일치하는 종목이 없습니다.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-zinc-800 bg-[#070a10] flex items-center justify-between text-xs text-zinc-400">
              <span>종목 카드를 클릭하면 메인 차트 및 10호가 주문창으로 즉시 이동합니다.</span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
