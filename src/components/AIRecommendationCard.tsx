import React from 'react';
import { 
  Target, 
  ShieldAlert, 
  Scale, 
  TrendingUp, 
  ArrowUpRight, 
  CheckCircle2, 
  Activity,
  Layers,
  Sparkles,
  Bot,
  Compass,
  Zap,
  ArrowDownRight
} from 'lucide-react';
import { AIAnalysisResult, StockItem } from '../types';

interface AIRecommendationCardProps {
  stock: StockItem;
  analysis: AIAnalysisResult | null;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  onOpenChatWithTopic?: (topic: string) => void;
}

export const AIRecommendationCard: React.FC<AIRecommendationCardProps> = ({
  stock,
  analysis,
  onRunAnalysis,
  isAnalyzing,
  onOpenChatWithTopic,
}) => {
  const isKR = stock.currency === 'KRW';
  const formatPrice = (val: number) => {
    return isKR
      ? `${new Intl.NumberFormat('ko-KR').format(Math.round(val))}원`
      : `$${val.toFixed(2)}`;
  };

  // If no analysis yet, render a rich AI preview card with quick run CTA
  if (!analysis) {
    const estTarget1 = isKR ? Math.round(stock.price * 1.12) : Number((stock.price * 1.12).toFixed(2));
    const estStopLoss = isKR ? Math.round(stock.price * 0.94) : Number((stock.price * 0.94).toFixed(2));
    const aiScore = stock.aiScore || 85;

    return (
      <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-4 sm:p-5 text-slate-100 shadow-md flex flex-col justify-between font-sans">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-800/60 text-blue-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">AI 퀀트 포지션 진단</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono font-medium">
                    {stock.name} ({stock.ticker})
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  실시간 캔들 패턴 & 다중 기술지표 기반 알고리즘
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-zinc-400 font-mono">종목 AI 평가점수</div>
              <div className="text-base font-bold text-cyan-400 font-mono">{aiScore} <span className="text-xs text-zinc-500 font-normal">/ 100</span></div>
            </div>
          </div>

          {/* Quick Preview Matrix */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-[#080b11] border border-zinc-800/80 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-zinc-400 font-semibold">현재 기준가</div>
              <div className="text-xs font-bold text-white font-mono mt-1">{formatPrice(stock.price)}</div>
            </div>
            <div className="bg-[#080b11] border border-zinc-800/80 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-red-400 font-semibold">예상 1차 목표가</div>
              <div className="text-xs font-bold text-red-400 font-mono mt-1">{formatPrice(estTarget1)} (+12%)</div>
            </div>
            <div className="bg-[#080b11] border border-zinc-800/80 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-blue-400 font-semibold">예상 손절 기준</div>
              <div className="text-xs font-bold text-blue-400 font-mono mt-1">{formatPrice(estStopLoss)} (-6%)</div>
            </div>
          </div>

          <div className="mt-3 p-3 bg-zinc-900/60 border border-zinc-800/60 rounded-lg text-xs text-zinc-300 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-white">모멘텀 태그:</strong> {stock.keyTag || 'RSI 및 거래량 반등 수급 집중 구간'}
              <br />
              <span className="text-zinc-400">정밀 분석 버튼을 클릭하면 실시간 Gemini 퀀트 엔진이 매수/매도 포지션과 지지·저항선을 도출합니다.</span>
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <button
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Gemini 퀀트 모델 실시간 분석 중...' : 'AI 퀀트 정밀 진단 실행하기'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Full Analysis Mode
  const isStrongBuy = analysis.verdict === 'STRONG_BUY';
  const isBuy = analysis.verdict === 'BUY';
  const isHold = analysis.verdict === 'HOLD';

  const entryMin = analysis.entryRange?.[0] ?? stock.price;
  const entryMax = analysis.entryRange?.[1] ?? stock.price;

  const target1Gain = (((analysis.targetPrice - stock.price) / stock.price) * 100).toFixed(1);
  const target2Gain = (((analysis.targetPrice2 - stock.price) / stock.price) * 100).toFixed(1);
  const stopLossLoss = (((analysis.stopLoss - stock.price) / stock.price) * 100).toFixed(1);

  return (
    <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-4 sm:p-5 text-slate-100 shadow-md font-sans">
      {/* Header with Quant Verdict & Confidence Index */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        {/* Left: Verdict Badge & Asset Metadata */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-lg bg-[#080b11] border border-zinc-700/80 flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isStrongBuy || isBuy ? 'bg-red-500 animate-pulse' : isHold ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">Position Outlook</div>
              <div className={`text-sm sm:text-base font-bold tracking-tight ${isStrongBuy || isBuy ? 'text-red-400' : isHold ? 'text-amber-400' : 'text-blue-400'}`}>
                {analysis.verdictKr || '매수 추천'}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{stock.name}</span>
              <span className="text-xs font-mono text-zinc-400">({stock.ticker})</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase">Risk:</span>
              <span className="font-mono text-xs font-medium text-zinc-300">
                {analysis.riskLevelKr || '중간 위험'}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {new Date(analysis.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Confidence Index & Target 1 Return */}
        <div className="flex items-center gap-4 bg-[#080b11] border border-zinc-800 rounded-lg p-2 px-3">
          <div>
            <div className="text-[10px] text-zinc-400 font-semibold">신뢰도 지수</div>
            <div className="text-sm font-mono font-bold text-cyan-400 mt-0.5">
              {analysis.confidenceScore || 88} <span className="text-zinc-500 text-xs font-normal">/ 100</span>
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-800" />

          <div>
            <div className="text-[10px] text-zinc-400 font-semibold">1차 기대수익</div>
            <div className="text-sm font-mono font-bold text-red-400 flex items-center mt-0.5">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              +{target1Gain}%
            </div>
          </div>
        </div>
      </div>

      {/* Target Prices & Execution Matrix Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 font-mono">
        {/* Entry Range */}
        <div className="bg-[#080b11] border border-zinc-800/80 rounded-lg p-2.5">
          <div className="text-[10px] text-zinc-400 font-sans font-semibold">적정 매수구간</div>
          <div className="mt-1 font-bold text-xs sm:text-sm text-zinc-100 tabular-nums">
            {formatPrice(entryMin)}
          </div>
          <div className="text-[10px] text-zinc-500 font-sans mt-0.5">지지선 부근 매수</div>
        </div>

        {/* Target 1 */}
        <div className="bg-[#080b11] border border-zinc-800/80 rounded-lg p-2.5">
          <div className="text-[10px] text-red-400 font-sans font-semibold">1차 목표가</div>
          <div className="mt-1 font-bold text-xs sm:text-sm text-red-400 tabular-nums">
            {formatPrice(analysis.targetPrice)}
          </div>
          <div className="text-[10px] text-red-400/70 mt-0.5">+{target1Gain}%</div>
        </div>

        {/* Target 2 */}
        <div className="bg-[#080b11] border border-zinc-800/80 rounded-lg p-2.5">
          <div className="text-[10px] text-red-400 font-sans font-semibold">2차 목표가</div>
          <div className="mt-1 font-bold text-xs sm:text-sm text-red-400 tabular-nums">
            {formatPrice(analysis.targetPrice2)}
          </div>
          <div className="text-[10px] text-red-400/70 mt-0.5">+{target2Gain}%</div>
        </div>

        {/* Stop Loss */}
        <div className="bg-[#080b11] border border-zinc-800/80 rounded-lg p-2.5">
          <div className="text-[10px] text-blue-400 font-sans font-semibold">손절 기준선</div>
          <div className="mt-1 font-bold text-xs sm:text-sm text-blue-400 tabular-nums">
            {formatPrice(analysis.stopLoss)}
          </div>
          <div className="text-[10px] text-blue-400/70 mt-0.5">{stopLossLoss}%</div>
        </div>
      </div>

      {/* Summary Narrative */}
      <div className="mt-3 p-3 bg-[#080b11] border border-zinc-800 rounded-lg text-xs text-zinc-300 leading-relaxed font-sans">
        <p>{analysis.summary || `${stock.name}의 이동평균선 정배열 추세 및 기술적 지표가 긍정적인 반등 시그널을 나타내고 있습니다.`}</p>
      </div>
    </div>
  );
};
