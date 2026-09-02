import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { StockItem, MarketType } from '../types';

interface CustomStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStock: (stock: StockItem) => void;
}

export const CustomStockModal: React.FC<CustomStockModalProps> = ({
  isOpen,
  onClose,
  onAddStock,
}) => {
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [market, setMarket] = useState<MarketType>('KR');
  const [sector, setSector] = useState('IT / 기술주');
  const [price, setPrice] = useState('');
  const [keyTag, setKeyTag] = useState('신규 등록 차트 분석 대상');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || !name.trim() || !price) return;

    const numPrice = parseFloat(price.replace(/,/g, ''));
    if (isNaN(numPrice) || numPrice <= 0) return;

    const newStock: StockItem = {
      ticker: ticker.trim().toUpperCase(),
      name: name.trim(),
      market,
      exchange: market === 'KR' ? 'KOSPI' : 'NASDAQ',
      currency: market === 'KR' ? 'KRW' : 'USD',
      sector: sector.trim(),
      price: numPrice,
      change: market === 'KR' ? Math.round(numPrice * 0.02) : Number((numPrice * 0.02).toFixed(2)),
      changePercent: 2.0,
      volume: 1200000,
      marketCap: market === 'KR' ? '1조 5,000억' : '$10.5B',
      week52High: market === 'KR' ? Math.round(numPrice * 1.3) : Number((numPrice * 1.3).toFixed(2)),
      week52Low: market === 'KR' ? Math.round(numPrice * 0.75) : Number((numPrice * 0.75).toFixed(2)),
      aiScore: 88,
      aiVerdict: 'BUY',
      keyTag: keyTag.trim() || '신규 기술적 분석 종목',
      description: `${name}에 대한 사용자 맞춤형 실시간 차트 및 AI 기술적 분석 세션입니다.`,
    };

    onAddStock(newStock);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-[#0e121a] border border-white/[0.1] rounded-xl w-full max-w-md p-5 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4 border-b border-zinc-800 pb-3">
          <div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Custom Instrument</div>
            <h3 className="text-sm font-semibold text-white">커스텀 종목 직접 추가</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">상장 시장</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMarket('KR')}
                className={`py-1.5 rounded-md border text-xs font-mono transition-colors ${
                  market === 'KR'
                    ? 'bg-zinc-100 text-zinc-950 font-bold border-white'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                국내 증시 (KRW)
              </button>
              <button
                type="button"
                onClick={() => setMarket('US')}
                className={`py-1.5 rounded-md border text-xs font-mono transition-colors ${
                  market === 'US'
                    ? 'bg-zinc-100 text-zinc-950 font-bold border-white'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                미국 증시 (USD)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">종목명</label>
              <input
                type="text"
                placeholder="예: 카카오뱅크, TSLA"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">티커 코드</label>
              <input
                type="text"
                placeholder={market === 'KR' ? '예: 323410' : '예: TSLA'}
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">현재 주가</label>
              <input
                type="text"
                placeholder={market === 'KR' ? '예: 25000' : '예: 250.5'}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">업종 / 섹터</label>
              <input
                type="text"
                placeholder="예: IT / 반도체"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">핵심 테마 / 태그</label>
            <input
              type="text"
              placeholder="예: 20일선 돌파 & 실적 턴어라운드"
              value={keyTag}
              onChange={(e) => setKeyTag(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-md transition-colors"
            >
              종목 등록 및 정밀 분석 시작
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

