import React, { useState, useEffect, useRef } from 'react';
import { 
  Bookmark, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus
} from 'lucide-react';
import { StockItem } from '../types';

interface WatchlistPanelProps {
  watchlist: StockItem[];
  selectedStock: StockItem;
  onSelectStock: (stock: StockItem) => void;
  onRemoveFromWatchlist: (ticker: string) => void;
}

export const WatchlistPanel: React.FC<WatchlistPanelProps> = ({
  watchlist,
  selectedStock,
  onSelectStock,
  onRemoveFromWatchlist,
}) => {
  const [flashMap, setFlashMap] = useState<Record<string, 'UP' | 'DOWN'>>({});
  const prevPriceMap = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const newFlashes: Record<string, 'UP' | 'DOWN'> = {};
    let hasChanges = false;

    watchlist.forEach((stock) => {
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
  }, [watchlist]);

  return (
    <div className="bg-[#0e121a] border border-white/[0.08] rounded-xl p-4 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
          <h3 className="font-semibold text-xs text-zinc-200 uppercase tracking-wider">포트폴리오 관심종목 ({watchlist.length})</h3>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>LIVE</span>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-500 font-sans">
          등록된 관심종목이 없습니다.
        </div>
      ) : (
        <div className="mt-2 divide-y divide-zinc-800/40">
          {watchlist.map((stock) => {
            const isSelected = selectedStock.ticker === stock.ticker;
            const isPositive = stock.changePercent >= 0;
            const flash = flashMap[stock.ticker];

            return (
              <div
                key={stock.ticker}
                onClick={() => onSelectStock(stock)}
                className={`py-2 px-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors duration-200 ${
                  flash === 'UP'
                    ? 'bg-red-950/40 border border-red-800/60 text-red-300'
                    : flash === 'DOWN'
                    ? 'bg-blue-950/40 border border-blue-800/60 text-blue-300'
                    : isSelected
                    ? 'bg-zinc-800/80 text-white border border-zinc-700/60'
                    : 'hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="text-left">
                    <div className="font-medium text-xs text-zinc-200 flex items-center gap-1.5">
                      <span>{stock.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">({stock.ticker})</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5 font-mono">
                      <span>{stock.sector}</span>
                      {stock.aiScore && (
                        <span className="text-zinc-400">· Q-Score {stock.aiScore}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={`font-mono text-xs font-semibold tabular-nums transition-colors duration-200 px-1 py-0.2 rounded ${
                        flash === 'UP'
                          ? 'bg-red-900/70 text-red-200'
                          : flash === 'DOWN'
                          ? 'bg-blue-900/70 text-blue-200'
                          : 'text-zinc-200'
                      }`}
                    >
                      {stock.currency === 'KRW'
                        ? `${Math.round(stock.price).toLocaleString()}원`
                        : `$${stock.price.toFixed(2)}`}
                    </div>
                    <div className={`font-mono text-[10px] font-medium flex items-center justify-end ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isPositive ? '+' : ''}{stock.changePercent}%
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromWatchlist(stock.ticker);
                    }}
                    className="p-1 text-zinc-600 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                    title="제거"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

