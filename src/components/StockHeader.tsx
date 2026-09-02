import React from 'react';
import { 
  Bookmark, 
  BookmarkCheck, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  RefreshCw,
  Sparkles,
  Activity,
  Compass,
  Zap
} from 'lucide-react';
import { StockItem } from '../types';

interface StockHeaderProps {
  stock: StockItem;
  onRunAiAnalysis: () => void;
  isAiAnalyzing: boolean;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
  onOpenCustomStockModal: () => void;
}

export const StockHeader: React.FC<StockHeaderProps> = ({
  stock,
  onRunAiAnalysis,
  isAiAnalyzing,
  isWatchlisted,
  onToggleWatchlist,
  onOpenCustomStockModal,
}) => {
  const isPositive = stock.changePercent >= 0;

  // 52-week range calculation
  const rangeSpan = stock.week52High - stock.week52Low;
  const currentPosPercent = Math.min(
    100,
    Math.max(0, ((stock.price - stock.week52Low) / (rangeSpan || 1)) * 100)
  );

  const formatPrice = (val: number) => {
    return stock.currency === 'KRW'
      ? `${new Intl.NumberFormat('ko-KR').format(Math.round(val))}원`
      : `$${val.toFixed(2)}`;
  };

  return (
    <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-4 sm:p-5 text-slate-100 shadow-md relative overflow-hidden font-sans">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
        {/* Left: Stock Identification & Price */}
        <div className="flex flex-wrap items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/80 flex items-center justify-center font-mono font-bold text-sm text-zinc-100 shadow-inner">
            {stock.ticker.slice(0, 4)}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-800/80">
                {stock.exchange || (stock.market === 'KR' ? 'KOSPI' : 'NASDAQ')}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {stock.ticker}
              </span>
              <span className="text-zinc-600 text-xs">•</span>
              <span className="text-xs text-zinc-400 font-medium">
                {stock.sector}
              </span>
            </div>

            <div className="flex items-center gap-2.5 mt-1 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {stock.name}
              </h1>
              {stock.keyTag && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                  {stock.keyTag}
                </span>
              )}
            </div>

            {/* Price & Change (Korean MTS Style: Red = Up, Blue = Down) */}
            <div className="flex items-baseline gap-3 mt-1.5 flex-wrap font-mono">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums flex items-center gap-2">
                <span>{formatPrice(stock.price)}</span>
                <span 
                  className={`inline-block w-2 h-2 rounded-full ${stock.dataDelay === 'REALTIME' ? 'bg-emerald-400 animate-pulse' : stock.marketState === 'REGULAR' ? 'bg-amber-400' : 'bg-zinc-500'}`} 
                  title={stock.dataDelay === 'REALTIME' ? '실시간 체결 시세 연동 중' : '지연/종가 시세 연동 중'} 
                />
              </span>

              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all duration-300 ${
                  isPositive
                    ? 'bg-red-950/70 text-red-400 border border-red-800/70'
                    : 'bg-blue-950/70 text-blue-400 border border-blue-800/70'
                }`}
              >
                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>
                  {isPositive ? '+' : ''}{stock.change.toLocaleString()} ({isPositive ? '+' : ''}{stock.changePercent}%)
                </span>
              </div>

              <span className="text-[11px] text-zinc-400 font-sans">
                거래량 {stock.volume.toLocaleString()}주
              </span>

              {/* Real-time Data Source Badge */}
              <div className="flex items-center gap-1.5 ml-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-sans font-medium border ${
                  stock.marketState === 'REGULAR'
                    ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {stock.marketState === 'REGULAR' ? '정규장 (체결 가능)' : stock.marketState === 'PRE' ? '프리마켓' : stock.marketState === 'POST' ? '애프터마켓' : '장 마감'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-400 border border-zinc-750 font-sans">
                  {stock.providerName || 'Yahoo v8'}{stock.dataDelay === 'DELAYED' ? ' (15~20분 지연)' : stock.dataDelay === 'EOD_CLOSE' ? ' (공식 종가)' : ' (실시간)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: 52-Week Range & AI Analysis Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* 52-Week Range meter */}
          <div className="bg-[#080b11] border border-zinc-800 rounded-lg p-2.5 min-w-[200px] text-xs font-mono">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-sans mb-1">
              <span>52주 최저</span>
              <span>52주 최고</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-200">
              <span>{formatPrice(stock.week52Low)}</span>
              <span>{formatPrice(stock.week52High)}</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-1.5 relative overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 via-amber-400 to-red-500 h-full rounded-full"
                style={{ width: `${currentPosPercent}%` }}
              />
            </div>
          </div>

          {/* AI Run & Watchlist actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleWatchlist}
              className={`p-2.5 rounded-lg border transition-colors ${
                isWatchlisted
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
              title={isWatchlisted ? '관심종목 해제' : '관심종목 등록'}
            >
              {isWatchlisted ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>

            <button
              onClick={onRunAiAnalysis}
              disabled={isAiAnalyzing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-900/30 transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAiAnalyzing ? 'AI 정밀 분석 중...' : 'AI 퀀트 정밀 진단'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
