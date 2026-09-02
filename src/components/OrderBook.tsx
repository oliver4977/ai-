import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StockItem } from '../types';
import { Layers, Activity, TrendingUp, TrendingDown, ArrowUpRight, BarChart2 } from 'lucide-react';

interface OrderBookProps {
  stock: StockItem;
  onSelectPrice: (price: number) => void;
}

interface OrderBookRow {
  price: number;
  size: number;
  orders: number;
  ratio: number;
  changeFromClose: number;
  changePercent: number;
}

export const OrderBook: React.FC<OrderBookProps> = ({ stock, onSelectPrice }) => {
  const [activeTab, setActiveTab] = useState<'ORDERBOOK' | 'TICKS'>('ORDERBOOK');
  const [ticks, setTicks] = useState<{ time: string; price: number; volume: number; isBuy: boolean }[]>([]);

  const isKR = stock.market === 'KR';
  const price = stock.price || (isKR ? 271000 : 217.56);
  const prevClose = isKR 
    ? Math.round(price - stock.change) 
    : Number((price - stock.change).toFixed(2));

  // Determine tick unit based on KRX/US rules
  const tickUnit = useMemo(() => {
    if (!isKR) return price > 100 ? 0.1 : 0.01;
    if (price >= 500000) return 1000;
    if (price >= 200000) return 500;
    if (price >= 50000) return 100;
    if (price >= 20000) return 50;
    if (price >= 5000) return 10;
    return 5;
  }, [price, isKR]);

  // Generate realistic 10-level Asks and Bids around current price deterministically from actual volume
  const { asks, bids, totalAskSize, totalBidSize, buyStrength } = useMemo(() => {
    const askRows: OrderBookRow[] = [];
    const bidRows: OrderBookRow[] = [];
    let sumAsks = 0;
    let sumBids = 0;

    const baseDepth = Math.max(500, Math.floor((stock.volume || 1000000) / 800));

    // 10 Asks (Sell) - from high to low
    for (let i = 10; i >= 1; i--) {
      const askPrice = isKR ? price + i * tickUnit : Number((price + i * tickUnit).toFixed(2));
      const size = Math.floor(baseDepth * (1 + (11 - i) * 0.12));
      const orders = Math.max(2, Math.floor(size / 150));
      sumAsks += size;
      const diff = askPrice - prevClose;
      const pct = prevClose ? Number(((diff / prevClose) * 100).toFixed(2)) : 0;
      askRows.push({
        price: askPrice,
        size,
        orders,
        ratio: 0,
        changeFromClose: diff,
        changePercent: pct,
      });
    }

    // 10 Bids (Buy) - from near to low
    for (let i = 1; i <= 10; i++) {
      const bidPrice = isKR ? price - i * tickUnit : Number((price - i * tickUnit).toFixed(2));
      const size = Math.floor(baseDepth * (1 + (11 - i) * 0.15));
      const orders = Math.max(2, Math.floor(size / 140));
      sumBids += size;
      const diff = bidPrice - prevClose;
      const pct = prevClose ? Number(((diff / prevClose) * 100).toFixed(2)) : 0;
      bidRows.push({
        price: bidPrice,
        size,
        orders,
        ratio: 0,
        changeFromClose: diff,
        changePercent: pct,
      });
    }

    const total = sumAsks + sumBids || 1;
    askRows.forEach((r) => (r.ratio = Number(((r.size / total) * 100).toFixed(1))));
    bidRows.forEach((r) => (r.ratio = Number(((r.size / total) * 100).toFixed(1))));

    const strength = Number(((sumBids / total) * 200).toFixed(1)); // Approx buy strength

    return {
      asks: askRows,
      bids: bidRows,
      totalAskSize: sumAsks,
      totalBidSize: sumBids,
      buyStrength: strength,
    };
  }, [price, prevClose, tickUnit, isKR, stock.volume]);

  // Record real tick flow when live price updates
  const prevPriceRef = useRef(price);
  useEffect(() => {
    const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isBuy = price >= prevPriceRef.current;
    const tickVol = Math.max(10, Math.floor((stock.volume || 500000) / 5000));
    
    setTicks((prev) => [
      { time: nowStr, price, volume: tickVol, isBuy },
      ...prev.slice(0, 19),
    ]);
    prevPriceRef.current = price;
  }, [price, stock.volume]);

  const formatPrice = (val: number) => {
    return isKR ? new Intl.NumberFormat('ko-KR').format(Math.round(val)) : `$${val.toFixed(2)}`;
  };

  return (
    <div className="bg-[#0e131d] border border-zinc-800 rounded-xl overflow-hidden shadow-lg flex flex-col font-sans">
      {/* Orderbook Header & Tab */}
      <div className="bg-[#090d14] border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-bold text-white text-xs">10단계 호가창</span>
          <span className="text-[10px] text-zinc-400 font-mono">단위: {isKR ? `${tickUnit}원` : `$${tickUnit}`}</span>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-[#05070a] border border-zinc-750 p-0.5 rounded text-[11px] font-mono">
          <button
            onClick={() => setActiveTab('ORDERBOOK')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === 'ORDERBOOK' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            호가 (10)
          </button>
          <button
            onClick={() => setActiveTab('TICKS')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === 'TICKS' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            실시간 체결
          </button>
        </div>
      </div>

      {activeTab === 'ORDERBOOK' ? (
        <div className="flex-1 p-2 font-mono text-xs flex flex-col justify-between">
          {/* 1. Asks (매도 10호가: 위에서 아래로) */}
          <div className="space-y-0.5">
            {asks.slice(-5).map((row, i) => {
              const isUp = row.changeFromClose >= 0;
              return (
                <button
                  key={`ask-${row.price}-${i}`}
                  onClick={() => onSelectPrice(row.price)}
                  className="w-full grid grid-cols-12 py-1 px-1.5 rounded hover:bg-blue-950/40 text-left items-center group transition-colors relative overflow-hidden"
                >
                  {/* Visual Ask depth bar */}
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-blue-950/60 pointer-events-none group-hover:bg-blue-900/50"
                    style={{ width: `${Math.min(row.ratio * 8, 100)}%` }}
                  />

                  {/* Left: Orders count */}
                  <span className="col-span-2 text-[10px] text-zinc-400 relative z-10">
                    {row.orders}건
                  </span>

                  {/* Price */}
                  <span className={`col-span-5 font-bold relative z-10 ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                    {formatPrice(row.price)}
                    <span className="text-[10px] font-normal ml-1 opacity-75">
                      ({isUp ? '+' : ''}{row.changePercent}%)
                    </span>
                  </span>

                  {/* Ask Size */}
                  <span className="col-span-5 text-right font-semibold text-blue-300 relative z-10">
                    {row.size.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Current Center Market Price Bar */}
          <div className="my-1.5 py-1.5 px-2 bg-[#05070a] border-y border-zinc-750 flex items-center justify-between rounded font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400">현재가</span>
              <span className={`text-sm font-bold ${stock.change >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {formatPrice(price)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className={stock.change >= 0 ? 'text-red-400' : 'text-blue-400'}>
                {stock.change >= 0 ? '▲ +' : '▼ '}
                {isKR ? `${stock.change.toLocaleString()}원` : `$${stock.change}`}
              </span>
              <span className={`font-bold ${stock.change >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                ({stock.change >= 0 ? '+' : ''}{stock.changePercent}%)
              </span>
            </div>
          </div>

          {/* 2. Bids (매수 10호가: 위에서 아래로) */}
          <div className="space-y-0.5">
            {bids.slice(0, 5).map((row, i) => {
              const isUp = row.changeFromClose >= 0;
              return (
                <button
                  key={`bid-${row.price}-${i}`}
                  onClick={() => onSelectPrice(row.price)}
                  className="w-full grid grid-cols-12 py-1 px-1.5 rounded hover:bg-red-950/40 text-left items-center group transition-colors relative overflow-hidden"
                >
                  {/* Visual Bid depth bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-red-950/60 pointer-events-none group-hover:bg-red-900/50"
                    style={{ width: `${Math.min(row.ratio * 8, 100)}%` }}
                  />

                  {/* Left: Orders count */}
                  <span className="col-span-2 text-[10px] text-zinc-400 relative z-10">
                    {row.orders}건
                  </span>

                  {/* Price */}
                  <span className={`col-span-5 font-bold relative z-10 ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                    {formatPrice(row.price)}
                    <span className="text-[10px] font-normal ml-1 opacity-75">
                      ({isUp ? '+' : ''}{row.changePercent}%)
                    </span>
                  </span>

                  {/* Bid Size */}
                  <span className="col-span-5 text-right font-semibold text-red-300 relative z-10">
                    {row.size.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom Total Asks vs Total Bids Ratio & Buy Strength */}
          <div className="mt-2 pt-2 border-t border-zinc-800 grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[#05070a] p-1.5 rounded border border-blue-950/80">
              <div className="text-[10px] text-zinc-400">총 매도잔량</div>
              <div className="font-bold text-blue-400">{totalAskSize.toLocaleString()}주</div>
            </div>
            <div className="bg-[#05070a] p-1.5 rounded border border-red-950/80 text-right">
              <div className="text-[10px] text-zinc-400">총 매수잔량</div>
              <div className="font-bold text-red-400">{totalBidSize.toLocaleString()}주</div>
            </div>
          </div>
        </div>
      ) : (
        /* Real-time Ticks stream */
        <div className="p-2 space-y-1 font-mono text-xs max-h-72 overflow-y-auto divide-y divide-zinc-800/40">
          <div className="grid grid-cols-12 py-1 px-1 text-[10px] text-zinc-400 font-sans border-b border-zinc-800">
            <span className="col-span-4">시간</span>
            <span className="col-span-4 text-center">체결가</span>
            <span className="col-span-4 text-right">체결량</span>
          </div>
          {ticks.map((tick, i) => (
            <div
              key={i}
              className={`grid grid-cols-12 py-1 px-1 items-center ${
                tick.isBuy ? 'text-red-400' : 'text-blue-400'
              }`}
            >
              <span className="col-span-4 text-[10px] text-zinc-400">{tick.time}</span>
              <span className="col-span-4 text-center font-bold">{formatPrice(tick.price)}</span>
              <span className="col-span-4 text-right font-semibold">
                {tick.isBuy ? '+' : '-'}{tick.volume}주
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
