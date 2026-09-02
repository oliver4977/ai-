import React, { useState, useMemo } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  SlidersHorizontal,
  ChevronRight,
  Activity
} from 'lucide-react';
import { StockItem, StrategyCategory, MarketType } from '../types';

interface StockScreenerProps {
  stocks: StockItem[];
  selectedStock: StockItem;
  onSelectStock: (stock: StockItem) => void;
  marketFilter: MarketType | 'ALL';
}

const CATEGORIES: { id: StrategyCategory; label: string; desc: string }[] = [
  { id: 'ALL', label: '전체 유니버스', desc: '모든 스크리닝 대상 종목' },
  { id: 'AI_TOP_PICK', label: '퀀트 톱픽', desc: '퀀트 스코어 90점 이상 최우선 종목' },
  { id: 'GOLDEN_CROSS', label: '골든크로스', desc: '단기 이평선 상향 돌파 추세 반전' },
  { id: 'OVERSOLD_REBOUND', label: '과매도 반등', desc: 'RSI 저평가 구간 바닥 다지기' },
  { id: 'BREAKOUT', label: '저항선 돌파', desc: '주요 매물대 대량 거래량 돌파' },
  { id: 'BOLLINGER_SQUEEZE', label: '볼린저 스퀴즈', desc: '변동성 분출 직전 수렴 국면' },
  { id: 'TECH_GROWTH', label: '빅테크 성장', desc: '글로벌 AI 및 반도체 혁신 주도주' },
];

export const StockScreener: React.FC<StockScreenerProps> = ({
  stocks,
  selectedStock,
  onSelectStock,
  marketFilter,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<StrategyCategory>('AI_TOP_PICK');
  const [sortBy, setSortBy] = useState<'score' | 'change' | 'volume'>('score');

  const filteredStocks = useMemo(() => {
    let result = stocks.filter((s) => {
      if (marketFilter !== 'ALL' && s.market !== marketFilter) return false;

      if (selectedCategory === 'AI_TOP_PICK') return (s.aiScore || 0) >= 90;
      if (selectedCategory === 'GOLDEN_CROSS') return s.keyTag?.includes('골든') || s.keyTag?.includes('돌파') || s.changePercent > 2;
      if (selectedCategory === 'OVERSOLD_REBOUND') return s.keyTag?.includes('과매도') || s.keyTag?.includes('바닥') || s.changePercent < 0;
      if (selectedCategory === 'BREAKOUT') return s.keyTag?.includes('돌파') || s.keyTag?.includes('신고가');
      if (selectedCategory === 'BOLLINGER_SQUEEZE') return s.keyTag?.includes('밴드') || s.keyTag?.includes('수렴');
      if (selectedCategory === 'TECH_GROWTH') return s.sector.includes('AI') || s.sector.includes('반도체');
      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'score') return (b.aiScore || 0) - (a.aiScore || 0);
      if (sortBy === 'change') return b.changePercent - a.changePercent;
      if (sortBy === 'volume') return b.volume - a.volume;
      return 0;
    });

    return result;
  }, [stocks, marketFilter, selectedCategory, sortBy]);

  return (
    <div className="bg-[#0e121a] border border-white/[0.08] rounded-xl p-5 text-slate-100 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Quant Strategy Scanner</span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white mt-0.5">전략별 종목 스크리닝 & 발굴</h2>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 text-xs">
          <span className="text-[10px] text-zinc-500 uppercase px-2 font-mono">Sort</span>
          <button
            onClick={() => setSortBy('score')}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
              sortBy === 'score' ? 'bg-zinc-100 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            점수순
          </button>
          <button
            onClick={() => setSortBy('change')}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
              sortBy === 'change' ? 'bg-zinc-100 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            등락률순
          </button>
          <button
            onClick={() => setSortBy('volume')}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
              sortBy === 'volume' ? 'bg-zinc-100 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            거래량순
          </button>
        </div>
      </div>

      {/* Strategy Category Filter Chips */}
      <div className="flex items-center gap-1.5 py-3 overflow-x-auto scrollbar-none border-b border-zinc-800/80 text-xs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-zinc-100 text-zinc-950 font-bold shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Stock Cards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        {filteredStocks.map((stock) => {
          const isSelected = selectedStock.ticker === stock.ticker;
          const isPositive = stock.changePercent >= 0;

          return (
            <div
              key={stock.ticker}
              onClick={() => onSelectStock(stock)}
              className={`p-3.5 rounded-lg border transition-colors cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-zinc-800/90 border-zinc-500 shadow-sm'
                  : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900/80 hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {stock.market}
                    </span>
                    <h3 className="font-semibold text-xs text-white">
                      {stock.name}
                    </h3>
                  </div>

                  {/* AI Score Badge */}
                  <div className="font-mono text-xs text-zinc-300 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700">
                    <span className="text-zinc-500 text-[10px]">Q:</span> {stock.aiScore || 88}
                  </div>
                </div>

                <div className="text-xs text-zinc-400 mt-1 flex items-center justify-between font-mono">
                  <span className="text-[10px] text-zinc-500">{stock.ticker} · {stock.sector}</span>
                </div>

                {/* Price & Change */}
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-sm font-bold font-mono text-white tabular-nums">
                    {stock.price.toLocaleString()} <span className="text-[10px] text-zinc-500 font-normal">{stock.currency}</span>
                  </span>
                  <span className={`flex items-center text-xs font-mono font-medium ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {isPositive ? '+' : ''}{stock.changePercent}%
                  </span>
                </div>

                {/* Key Technical Tag */}
                {stock.keyTag && (
                  <div className="mt-2 text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 truncate font-mono">
                    {stock.keyTag}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px]">
                <span className="text-zinc-500 font-mono">Vol {(stock.volume / 10000).toFixed(0)}만</span>
                <span className="text-zinc-300 font-medium flex items-center gap-0.5">
                  Select <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

