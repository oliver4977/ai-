import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Search, 
  Layers, 
  Bot,
  Terminal,
  Activity,
  Globe,
  SlidersHorizontal,
  ChevronRight,
  RefreshCw,
  Radio,
  ExternalLink
} from 'lucide-react';
import { StockItem, MarketType, MarketIndexItem } from '../types';

interface NavbarProps {
  currentMarket: MarketType | 'ALL';
  onSelectMarket: (market: MarketType | 'ALL') => void;
  stocks: StockItem[];
  selectedStock: StockItem;
  onSelectStock: (stock: StockItem) => void;
  onOpenArchitectureModal: () => void;
  onOpenChat: () => void;
  isAiAnalyzing: boolean;
  indices?: MarketIndexItem[];
  lastSyncTime?: string;
  isLiveStreaming?: boolean;
  onToggleLiveStream?: () => void;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMarket,
  onSelectMarket,
  stocks,
  selectedStock,
  onSelectStock,
  onOpenArchitectureModal,
  onOpenChat,
  isAiAnalyzing,
  indices = [],
  lastSyncTime,
  isLiveStreaming = true,
  onToggleLiveStream,
  onRefreshAll,
  isRefreshing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [liveSearchResults, setLiveSearchResults] = useState<any[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);

  // Keyboard shortcut (⌘K or Ctrl+K) to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        const searchInput = document.getElementById('navbar-search-input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced live market search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setLiveSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLive(true);
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setLiveSearchResults(data.results || []);
        }
      } catch (err) {
        console.error('Live search error:', err);
      } finally {
        setIsSearchingLive(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredLocalStocks = stocks.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="sticky top-0 z-40 bg-[#090b10]/95 backdrop-blur-md border-b border-white/[0.08] text-slate-300">
      {/* Financial Market Index Strip (Real Live Market Indices) */}
      <div className="bg-[#06080c] border-b border-white/[0.05] px-4 py-1.5 text-xs text-slate-400 overflow-x-auto flex items-center justify-between gap-6 whitespace-nowrap scrollbar-none">
        <div className="flex items-center gap-5 text-[11px] font-mono tabular-nums">
          {indices.length > 0 ? (
            indices.map((idx) => {
              const isUp = idx.change >= 0;
              return (
                <div key={idx.symbol} className="flex items-center gap-1.5">
                  <span className="text-zinc-500 font-sans font-semibold">{idx.name}</span>
                  <span className="text-zinc-200 font-medium">{idx.price.toLocaleString()}</span>
                  <span className={`text-[10px] ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isUp ? '+' : ''}{idx.changePercent}%
                  </span>
                </div>
              );
            })
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-sans font-semibold">KOSPI</span>
                <span className="text-zinc-200 font-medium">2,684.20</span>
                <span className="text-[10px] text-emerald-400">+0.82%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-sans font-semibold">KOSDAQ</span>
                <span className="text-zinc-200 font-medium">782.45</span>
                <span className="text-[10px] text-emerald-400">+1.14%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-sans font-semibold">S&P 500</span>
                <span className="text-zinc-200 font-medium">5,892.10</span>
                <span className="text-[10px] text-emerald-400">+0.45%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-sans font-semibold">NASDAQ</span>
                <span className="text-zinc-200 font-medium">18,540.30</span>
                <span className="text-[10px] text-emerald-400">+0.78%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-sans font-semibold">USD/KRW</span>
                <span className="text-zinc-200 font-medium">1,378.50</span>
                <span className="text-[10px] text-zinc-400">-2.10</span>
              </div>
            </>
          )}
        </div>

        {/* Live sync controls */}
        <div className="flex items-center gap-3 text-[11px] shrink-0 font-mono">
          {lastSyncTime && (
            <span className="text-zinc-500 text-[10px] hidden lg:inline">
              Sync: {lastSyncTime}
            </span>
          )}

          {onRefreshAll && (
            <button
              onClick={onRefreshAll}
              disabled={isRefreshing}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="실시간 시세 수동 동기화"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          )}

          <button
            onClick={onToggleLiveStream}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider transition-colors ${
              isLiveStreaming
                ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                : 'text-zinc-500 bg-zinc-900 border border-zinc-800'
            }`}
            title="실시간 시세 스트림 On/Off"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`}></span>
            <span>{isLiveStreaming ? 'LIVE FEED ON' : 'STREAM PAUSED'}</span>
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand & Terminal Identifier */}
        <div className="flex items-center gap-3 select-none">
          <div className="w-7 h-7 bg-zinc-900 border border-zinc-700/60 rounded-md flex items-center justify-center text-zinc-200 shadow-sm">
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-tight text-white font-sans">ALPHA TERMINAL</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono hidden sm:inline">Quant Analytics</span>
          </div>
        </div>

        {/* Minimal Search Bar with Real-time Ticker Lookup */}
        <div className="relative flex-1 max-w-sm hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              id="navbar-search-input"
              type="text"
              placeholder="Search ticker, company, sector..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-9 pr-14 py-1.5 bg-zinc-900/70 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors font-sans"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-mono text-zinc-500 bg-zinc-800/80 border border-zinc-700/50 rounded pointer-events-none">
              ⌘K
            </kbd>
          </div>

          {/* Autocomplete Dropdown */}
          {isSearchOpen && searchQuery.trim().length > 0 && (
            <>
              <div 
                className="fixed inset-0 z-20" 
                onClick={() => setIsSearchOpen(false)}
              />
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#0e121a] border border-zinc-800 rounded-lg shadow-2xl z-30 max-h-80 overflow-y-auto py-1 divide-y divide-zinc-800/60">
                {/* Local Universe Matches */}
                {filteredLocalStocks.length > 0 && (
                  <div>
                    <div className="px-3 py-1 text-[10px] text-zinc-500 font-mono uppercase">퀀트 유니버스 종목</div>
                    {filteredLocalStocks.map((stock) => (
                      <button
                        key={stock.ticker}
                        onClick={() => {
                          onSelectStock(stock);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {stock.market}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100">{stock.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{stock.ticker} · {stock.sector}</div>
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-xs font-medium text-zinc-200">
                            {stock.price.toLocaleString()} {stock.currency}
                          </div>
                          <div className={`text-[10px] font-medium ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent}%
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Global Live Ticker Search Results */}
                {liveSearchResults.length > 0 && (
                  <div>
                    <div className="px-3 py-1 text-[10px] text-zinc-500 font-mono uppercase flex items-center justify-between">
                      <span>글로벌 실시간 검색 결과</span>
                      {isSearchingLive && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                    </div>
                    {liveSearchResults.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const isKR = item.market === 'KR';
                          const newStock: StockItem = {
                            ticker: item.ticker,
                            name: item.name,
                            market: isKR ? 'KR' : 'US',
                            exchange: isKR ? (item.symbol?.includes('.KQ') ? 'KOSDAQ' : 'KOSPI') : 'NASDAQ',
                            currency: isKR ? 'KRW' : 'USD',
                            sector: item.sector || (isKR ? '국내 주식' : '해외 주식'),
                            price: isKR ? 50000 : 100,
                            change: 0,
                            changePercent: 0,
                            volume: 1000000,
                            marketCap: '-',
                            week52High: isKR ? 70000 : 150,
                            week52Low: isKR ? 30000 : 80,
                            description: `${item.exchange} 상장 종목`,
                          };
                          onSelectStock(newStock);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {item.market}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100">{item.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{item.ticker} · {item.exchange}</div>
                          </div>
                        </div>
                        <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1">
                          차트 로드 <ChevronRight className="w-3 h-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {filteredLocalStocks.length === 0 && liveSearchResults.length === 0 && (
                  <div className="px-4 py-3 text-xs text-zinc-500 text-center font-mono">
                    {isSearchingLive ? '실시간 거래소 검색 중...' : '검색 결과가 없습니다.'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Action Controls & Market Filters */}
        <div className="flex items-center gap-2">
          {/* Market selector tabs */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-0.5 rounded-lg flex items-center text-xs">
            <button
              onClick={() => onSelectMarket('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                currentMarket === 'ALL'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => onSelectMarket('KR')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                currentMarket === 'KR'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              국내 (KRX)
            </button>
            <button
              onClick={() => onSelectMarket('US')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                currentMarket === 'US'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              미국 (US)
            </button>
          </div>

          {/* Architecture Blueprint Button */}
          <button
            onClick={onOpenArchitectureModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-lg text-xs font-medium transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">시스템 설계</span>
          </button>

          {/* Assistant Drawer Toggle */}
          <button
            onClick={onOpenChat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-zinc-900" />
            <span className="hidden sm:inline">차트 상담</span>
          </button>
        </div>
      </div>
    </header>
  );
};

