import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  CandleData, 
  StockItem, 
  ChartPattern 
} from '../types';
import { 
  BarChart2, 
  Eye, 
  EyeOff, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2,
  TrendingUp,
  Activity,
  Layers
} from 'lucide-react';

interface InteractiveChartProps {
  candles: CandleData[];
  stock: StockItem;
  timeframe: '1D' | '1W' | '1M' | '1H' | '15m';
  onChangeTimeframe: (tf: '1D' | '1W' | '1M' | '1H' | '15m') => void;
  supportLevels?: number[];
  resistanceLevels?: number[];
  patterns?: ChartPattern[];
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  candles,
  stock,
  timeframe,
  onChangeTimeframe,
  supportLevels = [],
  resistanceLevels = [],
  patterns = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Indicator visibility toggles
  const [showSMA, setShowSMA] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [showSRLevels, setShowSRLevels] = useState(true);

  // Hover state
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Visible window range for zoom/pan
  const [viewCount, setViewCount] = useState<number>(60);

  const displayCandles = useMemo(() => {
    if (candles.length <= viewCount) return candles;
    return candles.slice(candles.length - viewCount);
  }, [candles, viewCount]);

  const activeCandle = hoverIndex !== null && hoverIndex < displayCandles.length
    ? displayCandles[hoverIndex]
    : displayCandles[displayCandles.length - 1];

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || displayCandles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = container.clientWidth;
    const totalHeight = 560;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalHeight}px`;

    ctx.scale(dpr, dpr);

    // Layout partitioning
    const rightMargin = 65; // Price scale
    const bottomMargin = 26; // Time scale
    const topMargin = 12;

    const availableWidth = width - rightMargin;
    const mainChartHeight = showRSI && showMACD 
      ? totalHeight * 0.54 
      : (showRSI || showMACD ? totalHeight * 0.68 : totalHeight - bottomMargin - topMargin);

    const rsiHeight = showRSI ? (showMACD ? totalHeight * 0.18 : totalHeight * 0.24) : 0;
    const macdHeight = showMACD ? (showRSI ? totalHeight * 0.18 : totalHeight * 0.24) : 0;

    const mainY = topMargin;
    const rsiY = mainY + mainChartHeight + 10;
    const macdY = rsiY + (showRSI ? rsiHeight + 10 : 0);

    // Clear background
    ctx.fillStyle = '#0a0d14'; // Institutional dark canvas
    ctx.fillRect(0, 0, width, totalHeight);

    // Grid lines styling
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#181e2b'; // Muted dark grid line

    // Compute Price Bounds for Main Chart
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    displayCandles.forEach((c) => {
      minPrice = Math.min(minPrice, c.low);
      maxPrice = Math.max(maxPrice, c.high);
      maxVolume = Math.max(maxVolume, c.volume);

      if (showSMA) {
        if (c.sma20) { minPrice = Math.min(minPrice, c.sma20); maxPrice = Math.max(maxPrice, c.sma20); }
        if (c.sma50) { minPrice = Math.min(minPrice, c.sma50); maxPrice = Math.max(maxPrice, c.sma50); }
        if (c.sma120) { minPrice = Math.min(minPrice, c.sma120); maxPrice = Math.max(maxPrice, c.sma120); }
      }
      if (showBollinger && c.bollinger) {
        minPrice = Math.min(minPrice, c.bollinger.lower);
        maxPrice = Math.max(maxPrice, c.bollinger.upper);
      }
    });

    // Add padding to price range
    const pricePadding = (maxPrice - minPrice) * 0.08 || maxPrice * 0.05;
    minPrice = Math.max(0, minPrice - pricePadding);
    maxPrice = maxPrice + pricePadding;
    const priceRange = maxPrice - minPrice || 1;

    const priceToY = (price: number) => {
      return mainY + mainChartHeight - ((price - minPrice) / priceRange) * mainChartHeight;
    };

    const candleCount = displayCandles.length;
    const candleWidth = Math.max(2, (availableWidth / candleCount) * 0.68);
    const stepX = availableWidth / candleCount;

    const getX = (index: number) => {
      return index * stepX + stepX / 2;
    };

    // Draw Main Chart Horizontal Grid Lines & Price Labels
    const gridSteps = 5;
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';

    for (let i = 0; i <= gridSteps; i++) {
      const p = minPrice + (priceRange / gridSteps) * i;
      const y = priceToY(p);

      ctx.beginPath();
      ctx.strokeStyle = '#1e293b';
      ctx.moveTo(0, y);
      ctx.lineTo(availableWidth, y);
      ctx.stroke();

      // Right axis price label
      ctx.fillText(
        stock.market === 'KR' ? Math.round(p).toLocaleString() : p.toFixed(2),
        availableWidth + 6,
        y + 3
      );
    }

    // Draw Support & Resistance Lines if enabled
    if (showSRLevels) {
      ctx.setLineDash([4, 4]);
      resistanceLevels.forEach((r) => {
        const ry = priceToY(r);
        if (ry >= mainY && ry <= mainY + mainChartHeight) {
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)'; // rose-500
          ctx.beginPath();
          ctx.moveTo(0, ry);
          ctx.lineTo(availableWidth, ry);
          ctx.stroke();
          ctx.fillStyle = '#f43f5e';
          ctx.fillText(`저항 ${r.toLocaleString()}`, availableWidth + 6, ry + 3);
        }
      });

      supportLevels.forEach((s) => {
        const sy = priceToY(s);
        if (sy >= mainY && sy <= mainY + mainChartHeight) {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)'; // emerald-500
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(availableWidth, sy);
          ctx.stroke();
          ctx.fillStyle = '#10b981';
          ctx.fillText(`지지 ${s.toLocaleString()}`, availableWidth + 6, sy + 3);
        }
      });
      ctx.setLineDash([]);
    }

    // 1. Draw Bollinger Bands Area & Lines
    if (showBollinger) {
      // Fill band area
      ctx.beginPath();
      let hasStarted = false;
      for (let i = 0; i < candleCount; i++) {
        const b = displayCandles[i].bollinger;
        if (b) {
          const x = getX(i);
          const yUpper = priceToY(b.upper);
          if (!hasStarted) {
            ctx.moveTo(x, yUpper);
            hasStarted = true;
          } else {
            ctx.lineTo(x, yUpper);
          }
        }
      }
      for (let i = candleCount - 1; i >= 0; i--) {
        const b = displayCandles[i].bollinger;
        if (b) {
          const x = getX(i);
          const yLower = priceToY(b.lower);
          ctx.lineTo(x, yLower);
        }
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.06)'; // sky blue fill
      ctx.fill();

      // Draw Upper and Lower lines
      const drawBollingerLine = (key: 'upper' | 'lower' | 'middle', strokeColor: string) => {
        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        let started = false;
        for (let i = 0; i < candleCount; i++) {
          const b = displayCandles[i].bollinger;
          if (b && b[key] !== undefined) {
            const x = getX(i);
            const y = priceToY(b[key]);
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.stroke();
      };

      drawBollingerLine('upper', 'rgba(56, 189, 248, 0.5)');
      drawBollingerLine('lower', 'rgba(56, 189, 248, 0.5)');
    }

    // 2. Draw Volume Bars at bottom of main chart
    const volumeHeightMax = mainChartHeight * 0.22;
    displayCandles.forEach((c, i) => {
      const x = getX(i);
      const isUp = c.close >= c.open;
      const volH = maxVolume > 0 ? (c.volume / maxVolume) * volumeHeightMax : 0;
      const volY = mainY + mainChartHeight - volH;

      ctx.fillStyle = isUp ? 'rgba(244, 63, 94, 0.28)' : 'rgba(59, 130, 246, 0.28)';
      ctx.fillRect(x - candleWidth / 2, volY, candleWidth, volH);
    });

    // 3. Draw Candlesticks (Wick & Body)
    displayCandles.forEach((c, i) => {
      const x = getX(i);
      const isUp = c.close >= c.open;
      const color = isUp ? '#f43f5e' : '#3b82f6'; // KR stock standard: Up=Red/Rose, Down=Blue

      const yOpen = priceToY(c.open);
      const yClose = priceToY(c.close);
      const yHigh = priceToY(c.high);
      const yLow = priceToY(c.low);

      // Upper & Lower Wicks
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Candle Body
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));

      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // 4. Draw Simple Moving Averages (SMA 20, 50, 120)
    if (showSMA) {
      const drawSMA = (key: 'sma20' | 'sma50' | 'sma120', color: string) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        let started = false;

        for (let i = 0; i < candleCount; i++) {
          const val = displayCandles[i][key];
          if (val !== undefined) {
            const x = getX(i);
            const y = priceToY(val);
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.stroke();
      };

      drawSMA('sma20', '#facc15');  // yellow-400
      drawSMA('sma50', '#38bdf8');  // sky-400
      drawSMA('sma120', '#a855f7'); // purple-500
    }

    // 5. Draw Sub-panel 1: RSI (14)
    if (showRSI) {
      // Sub-panel border & background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, rsiY, availableWidth, rsiHeight);

      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(0, rsiY, availableWidth, rsiHeight);

      // 70 & 30 Lines
      const rsiToY = (v: number) => rsiY + rsiHeight - (v / 100) * rsiHeight;
      const y70 = rsiToY(70);
      const y30 = rsiToY(30);

      // Overbought / Oversold zones
      ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
      ctx.fillRect(0, rsiY, availableWidth, y70 - rsiY);

      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.fillRect(0, y30, availableWidth, rsiY + rsiHeight - y30);

      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, y70);
      ctx.lineTo(availableWidth, y70);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, y30);
      ctx.lineTo(availableWidth, y30);
      ctx.stroke();
      ctx.setLineDash([]);

      // RSI Label & Value
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText('RSI (14)', 8, rsiY + 12);
      ctx.fillText('70', availableWidth + 6, y70 + 3);
      ctx.fillText('30', availableWidth + 6, y30 + 3);

      // Plot RSI Line
      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8'; // sky blue
      ctx.lineWidth = 1.5;
      let started = false;
      for (let i = 0; i < candleCount; i++) {
        const val = displayCandles[i].rsi14;
        if (val !== undefined) {
          const x = getX(i);
          const y = rsiToY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    }

    // 6. Draw Sub-panel 2: MACD
    if (showMACD) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, macdY, availableWidth, macdHeight);

      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(0, macdY, availableWidth, macdHeight);

      // Find MACD bounds
      let maxMacd = 1;
      displayCandles.forEach((c) => {
        if (c.macd) {
          maxMacd = Math.max(maxMacd, Math.abs(c.macd.macd), Math.abs(c.macd.signal), Math.abs(c.macd.histogram));
        }
      });
      maxMacd = maxMacd * 1.2;

      const macdValToY = (v: number) => macdY + macdHeight / 2 - (v / maxMacd) * (macdHeight / 2);
      const zeroY = macdValToY(0);

      // Zero line
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(availableWidth, zeroY);
      ctx.stroke();

      // MACD Histogram bars
      displayCandles.forEach((c, i) => {
        if (c.macd) {
          const x = getX(i);
          const hist = c.macd.histogram;
          const hY = macdValToY(hist);
          const barH = Math.abs(zeroY - hY);
          const barTop = Math.min(zeroY, hY);
          ctx.fillStyle = hist >= 0 ? '#f43f5e' : '#3b82f6';
          ctx.fillRect(x - candleWidth / 2, barTop, candleWidth, Math.max(1, barH));
        }
      });

      // MACD Line
      ctx.beginPath();
      ctx.strokeStyle = '#facc15'; // yellow
      ctx.lineWidth = 1.2;
      let startedMacd = false;
      displayCandles.forEach((c, i) => {
        if (c.macd) {
          const x = getX(i);
          const y = macdValToY(c.macd.macd);
          if (!startedMacd) { ctx.moveTo(x, y); startedMacd = true; }
          else { ctx.lineTo(x, y); }
        }
      });
      ctx.stroke();

      // Signal Line
      ctx.beginPath();
      ctx.strokeStyle = '#f43f5e'; // red
      ctx.lineWidth = 1.2;
      let startedSig = false;
      displayCandles.forEach((c, i) => {
        if (c.macd) {
          const x = getX(i);
          const y = macdValToY(c.macd.signal);
          if (!startedSig) { ctx.moveTo(x, y); startedSig = true; }
          else { ctx.lineTo(x, y); }
        }
      });
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText('MACD (12, 26, 9)', 8, macdY + 12);
    }

    // 7. Draw Bottom Time Axis Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    const timeStep = Math.max(1, Math.floor(candleCount / 6));
    for (let i = 0; i < candleCount; i += timeStep) {
      const c = displayCandles[i];
      const x = getX(i);
      ctx.fillText(c.date.slice(5), x, totalHeight - 6);
    }

    // 7.5. Draw Live Current Price Horizontal Line with pulsing badge
    const livePrice = stock.price > 0 ? stock.price : (displayCandles.length > 0 ? displayCandles[displayCandles.length - 1].close : 0);
    if (livePrice > 0) {
      const liveY = priceToY(livePrice);
      if (liveY >= mainY && liveY <= mainY + mainChartHeight) {
        const isUp = stock.changePercent >= 0;
        const color = isUp ? '#f43f5e' : '#3b82f6';

        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, liveY);
        ctx.lineTo(availableWidth, liveY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Badge on right axis
        ctx.fillStyle = color;
        ctx.fillRect(availableWidth, liveY - 10, rightMargin, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(
          stock.market === 'KR' ? Math.round(livePrice).toLocaleString() : livePrice.toFixed(2),
          availableWidth + 4,
          liveY + 4
        );
      }
    }

    // 8. Crosshair & Dynamic Cursor
    if (mousePos && hoverIndex !== null && hoverIndex < candleCount) {
      const x = getX(hoverIndex);
      const c = displayCandles[hoverIndex];

      // Vertical line
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, totalHeight - bottomMargin);
      ctx.stroke();

      // Horizontal line in main chart
      if (mousePos.y >= mainY && mousePos.y <= mainY + mainChartHeight) {
        ctx.beginPath();
        ctx.moveTo(0, mousePos.y);
        ctx.lineTo(availableWidth, mousePos.y);
        ctx.stroke();

        // Target price on right scale
        const hoverPrice = maxPrice - ((mousePos.y - mainY) / mainChartHeight) * priceRange;
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(availableWidth, mousePos.y - 9, rightMargin, 18);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(
          stock.market === 'KR' ? Math.round(hoverPrice).toLocaleString() : hoverPrice.toFixed(2),
          availableWidth + 4,
          mousePos.y + 3
        );
      }
      ctx.setLineDash([]);
    }

  }, [
    displayCandles,
    showSMA,
    showBollinger,
    showRSI,
    showMACD,
    showSRLevels,
    mousePos,
    hoverIndex,
    supportLevels,
    resistanceLevels,
    stock,
  ]);

  // Mouse event handlers for crosshair & inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || displayCandles.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const availableWidth = rect.width - 65;
    const stepX = availableWidth / displayCandles.length;
    const index = Math.min(displayCandles.length - 1, Math.max(0, Math.floor(x / stepX)));

    setMousePos({ x, y });
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    setHoverIndex(null);
  };

  const zoomIn = () => setViewCount((prev) => Math.max(20, prev - 15));
  const zoomOut = () => setViewCount((prev) => Math.min(candles.length, prev + 15));
  const resetZoom = () => setViewCount(60);

  const priceDiff = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const priceDiffPercent = activeCandle && activeCandle.open > 0 ? (priceDiff / activeCandle.open) * 100 : 0;

  return (
    <div className="bg-[#0e121a] border border-white/[0.08] rounded-xl p-4 text-slate-100 shadow-sm flex flex-col gap-3">
      {/* Top Toolbar: Timeframe & Indicators & OHLCV Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        {/* Timeframe Buttons */}
        <div className="flex items-center gap-0.5 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 text-xs">
          {(['1D', '1W', '1M', '1H', '15m'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => onChangeTimeframe(tf)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-zinc-100 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tf === '1D' ? '1D' : tf === '1W' ? '1W' : tf === '1M' ? '1M' : tf === '1H' ? '60m' : '15m'}
            </button>
          ))}
        </div>

        {/* Indicator Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            onClick={() => setShowSMA(!showSMA)}
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-mono text-xs transition-colors ${
              showSMA
                ? 'bg-zinc-800 text-amber-300 border-zinc-700'
                : 'bg-zinc-900/70 text-zinc-400 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            SMA (20/50/120)
          </button>

          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-mono text-xs transition-colors ${
              showBollinger
                ? 'bg-zinc-800 text-sky-300 border-zinc-700'
                : 'bg-zinc-900/70 text-zinc-400 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            Bollinger
          </button>

          <button
            onClick={() => setShowRSI(!showRSI)}
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-mono text-xs transition-colors ${
              showRSI
                ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                : 'bg-zinc-900/70 text-zinc-400 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            RSI 14
          </button>

          <button
            onClick={() => setShowMACD(!showMACD)}
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-mono text-xs transition-colors ${
              showMACD
                ? 'bg-zinc-800 text-purple-300 border-zinc-700'
                : 'bg-zinc-900/70 text-zinc-400 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            MACD
          </button>

          <button
            onClick={() => setShowSRLevels(!showSRLevels)}
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-mono text-xs transition-colors ${
              showSRLevels
                ? 'bg-zinc-800 text-emerald-300 border-zinc-700'
                : 'bg-zinc-900/70 text-zinc-400 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            S/R Lines
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={zoomIn}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800"
            title="확대 (Zoom In)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={zoomOut}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800"
            title="축소 (Zoom Out)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetZoom}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800"
            title="초기화"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Real-time OHLCV & Indicators Values Header */}
      {activeCandle && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3 text-zinc-300 flex-wrap tabular-nums">
            <span className="text-zinc-400 font-semibold">{activeCandle.date}</span>
            <span>O: <strong className="text-zinc-100 font-medium">{activeCandle.open.toLocaleString()}</strong></span>
            <span>H: <strong className="text-rose-400 font-medium">{activeCandle.high.toLocaleString()}</strong></span>
            <span>L: <strong className="text-blue-400 font-medium">{activeCandle.low.toLocaleString()}</strong></span>
            <span>C: <strong className={`font-medium ${priceDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{activeCandle.close.toLocaleString()}</strong></span>
            <span className={priceDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              ({priceDiff >= 0 ? '+' : ''}{priceDiffPercent.toFixed(2)}%)
            </span>
            <span>Vol: <strong className="text-zinc-300 font-medium">{activeCandle.volume.toLocaleString()}</strong></span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
            {showSMA && activeCandle.sma20 && (
              <span className="text-amber-300">MA20: {activeCandle.sma20.toLocaleString()}</span>
            )}
            {showSMA && activeCandle.sma50 && (
              <span className="text-sky-300">MA50: {activeCandle.sma50.toLocaleString()}</span>
            )}
            {showRSI && activeCandle.rsi14 !== undefined && (
              <span className="text-zinc-300">RSI: {activeCandle.rsi14.toFixed(1)}</span>
            )}
            {showMACD && activeCandle.macd && (
              <span className="text-purple-300">MACD: {activeCandle.macd.macd.toFixed(2)}</span>
            )}
          </div>
        </div>
      )}

      {/* Main Canvas Chart Area */}
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg bg-[#0a0d14] border border-zinc-800/80">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="cursor-crosshair block w-full"
        />
      </div>

      {/* Detected Patterns Tags */}
      {patterns.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
          <span className="text-[10px] text-zinc-500 uppercase font-mono font-semibold tracking-wider flex items-center gap-1">
            <Activity className="w-3 h-3 text-zinc-400" />
            Detected Formations:
          </span>
          {patterns.map((p, idx) => (
            <span
              key={idx}
              className={`px-2 py-0.5 rounded font-mono text-[10px] border ${
                p.type === 'BULLISH'
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                  : p.type === 'BEARISH'
                  ? 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800'
              }`}
            >
              {p.name} ({p.confidence}%)
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
