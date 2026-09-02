import React, { useState, useEffect } from 'react';
import { 
  StockItem, 
  SimulationAccount, 
  OrderSide, 
  OrderType, 
  AIAnalysisResult 
} from '../types';
import { 
  ShoppingBag, 
  DollarSign, 
  Bot, 
  Zap, 
  ShieldAlert, 
  ArrowRight,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface TradeExecutionPanelProps {
  stock: StockItem;
  account: SimulationAccount;
  targetPriceInput: number | null;
  aiAnalysis: AIAnalysisResult | null;
  onExecuteOrder: (params: {
    ticker: string;
    name: string;
    side: OrderSide;
    type: OrderType;
    price: number;
    quantity: number;
    executedBy: 'USER' | 'AI_AGENT';
    reasoning?: string;
  }) => void;
}

export const TradeExecutionPanel: React.FC<TradeExecutionPanelProps> = ({
  stock,
  account,
  targetPriceInput,
  aiAnalysis,
  onExecuteOrder,
}) => {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [price, setPrice] = useState<number>(stock.price || 100000);
  const [quantity, setQuantity] = useState<number>(10);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const isKR = stock.market === 'KR';

  // Sync price if stock changes or external price clicked from OrderBook
  useEffect(() => {
    if (targetPriceInput && targetPriceInput > 0) {
      setPrice(targetPriceInput);
    } else if (stock.price > 0) {
      setPrice(stock.price);
    }
  }, [stock.ticker, stock.price, targetPriceInput]);

  // Find if user already holds this stock
  const currentHolding = account.holdings.find((h) => h.ticker === stock.ticker);
  const holdingQty = currentHolding ? currentHolding.quantity : 0;

  // Max buyable quantity based on cash
  const availableCash = isKR ? account.cashKRW : account.cashUSD * account.exchangeRateUSD_KRW;
  const unitPriceKRW = isKR ? price : price * account.exchangeRateUSD_KRW;
  const maxBuyQty = unitPriceKRW > 0 ? Math.floor(availableCash / unitPriceKRW) : 0;

  const totalAmountKRW = isKR ? price * quantity : price * quantity * account.exchangeRateUSD_KRW;

  const handleSetRatio = (ratio: number) => {
    if (side === 'BUY') {
      const targetQty = Math.floor(maxBuyQty * ratio);
      setQuantity(Math.max(1, targetQty));
    } else {
      const targetQty = Math.floor(holdingQty * ratio);
      setQuantity(Math.max(1, targetQty));
    }
  };

  const handleOrderSubmit = () => {
    if (quantity <= 0) return;
    if (side === 'BUY' && quantity > maxBuyQty) {
      setExecutionMessage('주문가능 예수금이 부족합니다.');
      return;
    }
    if (side === 'SELL' && quantity > holdingQty) {
      setExecutionMessage(`보유 수량(${holdingQty}주)을 초과하여 매도할 수 없습니다.`);
      return;
    }

    onExecuteOrder({
      ticker: stock.ticker,
      name: stock.name,
      side,
      type: orderType,
      price: orderType === 'MARKET' ? stock.price : price,
      quantity,
      executedBy: 'USER',
      reasoning: '사용자 직접 주문 체결',
    });

    setExecutionMessage(`${stock.name} ${quantity}주 ${side === 'BUY' ? '매수' : '매도'} 체결 완료`);
    setTimeout(() => setExecutionMessage(null), 3000);
  };

  // AI Optimal Order (AI 추천 전략에 따른 원클릭 매매)
  const handleAiOptimalOrder = () => {
    if (!aiAnalysis) return;
    const optimalPrice = aiAnalysis.entryRange ? aiAnalysis.entryRange[0] || stock.price : stock.price;
    const isAiBuy = aiAnalysis.verdict === 'STRONG_BUY' || aiAnalysis.verdict === 'BUY';
    const targetSide: OrderSide = isAiBuy ? 'BUY' : 'SELL';

    const aiQty = isAiBuy ? Math.max(1, Math.floor(maxBuyQty * 0.25)) : Math.max(1, holdingQty);

    onExecuteOrder({
      ticker: stock.ticker,
      name: stock.name,
      side: targetSide,
      type: 'AI_OPTIMAL',
      price: optimalPrice,
      quantity: aiQty,
      executedBy: 'AI_AGENT',
      reasoning: `AI 퀀트 판정: ${aiAnalysis.verdictKr} (${aiAnalysis.tradingStrategy.slice(0, 40)}...)`,
    });

    setExecutionMessage(`AI 퀀트 추천 주문이 즉시 체결되었습니다 (${aiQty}주 ${targetSide})`);
    setTimeout(() => setExecutionMessage(null), 3500);
  };

  const formatCurrency = (val: number) => {
    return isKR ? `${new Intl.NumberFormat('ko-KR').format(Math.round(val))}원` : `$${val.toFixed(2)}`;
  };

  return (
    <div className="bg-[#0e131d] border border-zinc-800 rounded-xl overflow-hidden shadow-lg flex flex-col font-sans">
      {/* Side Tabs: [매수 (빨간색)] / [매도 (파란색)] */}
      <div className="grid grid-cols-2 text-xs font-bold border-b border-zinc-800">
        <button
          onClick={() => setSide('BUY')}
          className={`py-2.5 flex items-center justify-center gap-1.5 transition-all ${
            side === 'BUY'
              ? 'bg-red-950/70 text-red-300 border-b-2 border-red-500 shadow-inner'
              : 'bg-[#090d14] text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>매수 (BUY)</span>
        </button>
        <button
          onClick={() => setSide('SELL')}
          className={`py-2.5 flex items-center justify-center gap-1.5 transition-all ${
            side === 'SELL'
              ? 'bg-blue-950/70 text-blue-300 border-b-2 border-blue-500 shadow-inner'
              : 'bg-[#090d14] text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>매도 (SELL)</span>
          {holdingQty > 0 && (
            <span className="text-[10px] px-1 bg-blue-500/20 text-blue-300 rounded font-mono">
              {holdingQty}주
            </span>
          )}
        </button>
      </div>

      <div className="p-3 space-y-3 flex-1 flex flex-col justify-between">
        {/* Order Type Selector */}
        <div className="flex items-center gap-1 bg-[#05070a] border border-zinc-750 p-0.5 rounded-lg text-xs font-medium">
          <button
            onClick={() => setOrderType('LIMIT')}
            className={`flex-1 py-1 rounded text-center transition-colors ${
              orderType === 'LIMIT' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            지정가
          </button>
          <button
            onClick={() => {
              setOrderType('MARKET');
              setPrice(stock.price);
            }}
            className={`flex-1 py-1 rounded text-center transition-colors ${
              orderType === 'MARKET' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            시장가
          </button>
          <button
            onClick={() => setOrderType('AI_OPTIMAL')}
            className={`flex-1 py-1 rounded text-center transition-colors flex items-center justify-center gap-1 ${
              orderType === 'AI_OPTIMAL' ? 'bg-indigo-900/60 text-indigo-200 font-bold border border-indigo-700/60' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>AI 최적가</span>
          </button>
        </div>

        {/* Price Input */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">주문단가</span>
            <button
              onClick={() => setPrice(stock.price)}
              className="text-[10px] text-blue-400 hover:underline font-mono"
            >
              현재가 적용
            </button>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              disabled={orderType === 'MARKET'}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="flex-1 bg-[#05070a] border border-zinc-750 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <span className="text-xs text-zinc-400 font-mono px-1">{stock.currency}</span>
          </div>
        </div>

        {/* Quantity Input & Ratio Pills */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">주문수량</span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {side === 'BUY' ? `최대 매수가능: ${maxBuyQty}주` : `보유잔고: ${holdingQty}주`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="flex-1 bg-[#05070a] border border-zinc-750 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-zinc-400 px-1">주</span>
          </div>

          {/* Quick ratio percentage buttons */}
          <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
            {[0.1, 0.25, 0.5, 1.0].map((r) => (
              <button
                key={r}
                onClick={() => handleSetRatio(r)}
                className="py-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-750 transition-colors font-semibold"
              >
                {r * 100}%
              </button>
            ))}
          </div>
        </div>

        {/* Order Estimation Summary */}
        <div className="bg-[#05070a] p-2.5 rounded-lg border border-zinc-800 space-y-1 text-[11px] font-mono">
          <div className="flex items-center justify-between text-zinc-400">
            <span>총 주문금액</span>
            <span className="font-bold text-white text-xs">
              {new Intl.NumberFormat('ko-KR').format(Math.round(totalAmountKRW))}원
            </span>
          </div>
          <div className="flex items-center justify-between text-zinc-400 text-[10px]">
            <span>수수료 및 증권거래세 (0.015%)</span>
            <span>{new Intl.NumberFormat('ko-KR').format(Math.round(totalAmountKRW * 0.00015))}원</span>
          </div>
        </div>

        {/* Feedback message if any */}
        {executionMessage && (
          <div className="p-2 bg-emerald-950/70 border border-emerald-700/60 rounded-lg text-emerald-300 text-[11px] flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{executionMessage}</span>
          </div>
        )}

        {/* Main Action Buttons */}
        <div className="space-y-1.5 pt-1">
          <button
            onClick={handleOrderSubmit}
            className={`w-full py-2.5 rounded-lg text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-1.5 ${
              side === 'BUY'
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/50'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/50'
            }`}
          >
            <span>{side === 'BUY' ? '현금 매수 주문 (BUY)' : '보유주식 매도 주문 (SELL)'}</span>
          </button>

          {/* AI Recommended Quick Trade */}
          {aiAnalysis && (
            <button
              onClick={handleAiOptimalOrder}
              className="w-full py-2 bg-gradient-to-r from-indigo-900/60 via-purple-900/60 to-blue-900/60 hover:from-indigo-800/80 hover:to-blue-800/80 text-indigo-200 border border-indigo-700/60 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI 퀀트 추천 포지션 실행 ({aiAnalysis.verdictKr})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
