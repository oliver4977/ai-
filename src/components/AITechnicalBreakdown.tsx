import React, { useState } from 'react';
import { 
  Activity, 
  Layers, 
  Compass, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  CheckCircle2,
  Sparkles,
  BarChart2
} from 'lucide-react';
import { AIAnalysisResult, StockItem, TechnicalIndicatorSignal, ChartPattern } from '../types';

interface AITechnicalBreakdownProps {
  stock: StockItem;
  analysis?: AIAnalysisResult | null;
  signals?: TechnicalIndicatorSignal[];
  patterns?: ChartPattern[];
  supports?: number[];
  resistances?: number[];
}

export const AITechnicalBreakdown: React.FC<AITechnicalBreakdownProps> = ({ 
  stock,
  analysis,
  signals = [],
  patterns = [],
  supports = [],
  resistances = []
}) => {
  const [activeTab, setActiveTab] = useState<'indicators' | 'patterns' | 'strategy' | 'support_resistance'>('indicators');

  const activeSignals = (analysis?.indicatorSignals && analysis.indicatorSignals.length > 0)
    ? analysis.indicatorSignals
    : signals;

  const activePatterns = (analysis?.patterns && analysis.patterns.length > 0)
    ? analysis.patterns
    : patterns;

  const activeSupports = (analysis?.supportLevels && analysis.supportLevels.length > 0)
    ? analysis.supportLevels
    : supports;

  const activeResistances = (analysis?.resistanceLevels && analysis.resistanceLevels.length > 0)
    ? analysis.resistanceLevels
    : resistances;

  const isKR = stock.currency === 'KRW';
  const formatPrice = (val: number) => {
    return isKR
      ? `${new Intl.NumberFormat('ko-KR').format(Math.round(val))}원`
      : `$${val.toFixed(2)}`;
  };

  return (
    <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-4 sm:p-5 text-slate-100 shadow-md font-sans">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-[#080b11] p-1 rounded-lg border border-zinc-800 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('indicators')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'indicators'
              ? 'bg-blue-600 text-white font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>지표별 시그널 ({activeSignals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('patterns')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'patterns'
              ? 'bg-blue-600 text-white font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>차트 패턴 ({activePatterns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('support_resistance')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'support_resistance'
              ? 'bg-blue-600 text-white font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>지지 & 저항대</span>
        </button>

        <button
          onClick={() => setActiveTab('strategy')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
            activeTab === 'strategy'
              ? 'bg-blue-600 text-white font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>매매 전략 가이드</span>
        </button>
      </div>

      {/* Tab 1: Technical Indicators */}
      {activeTab === 'indicators' && (
        <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
          {activeSignals.length === 0 ? (
            <div className="sm:col-span-2 p-6 text-center text-xs text-zinc-500 bg-[#080b11] rounded-lg">
              캔들 데이터 수신 중이거나 지표 계산 중입니다.
            </div>
          ) : (
            activeSignals.map((item, idx) => {
              const isBullish = item.status === 'BULLISH';
              const isBearish = item.status === 'BEARISH';

              return (
                <div
                  key={idx}
                  className="bg-[#080b11] border border-zinc-800/80 rounded-lg p-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-semibold text-xs text-white">{item.indicator}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isBullish
                            ? 'bg-red-950/70 text-red-400 border border-red-800/60'
                            : isBearish
                            ? 'bg-blue-950/70 text-blue-400 border border-blue-800/60'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {isBullish ? (
                          <TrendingUp className="w-3 h-3 text-red-400" />
                        ) : isBearish ? (
                          <TrendingDown className="w-3 h-3 text-blue-400" />
                        ) : (
                          <Minus className="w-3 h-3 text-zinc-400" />
                        )}
                        {item.signal}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">{item.detail}</p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-zinc-800 text-[10px] font-mono text-zinc-400 flex items-center justify-between">
                    <span className="uppercase">지표 측정값</span>
                    <span className="text-zinc-200 font-bold">{item.value}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Chart Patterns */}
      {activeTab === 'patterns' && (
        <div className="mt-4 space-y-2">
          {activePatterns.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400 bg-[#080b11] rounded-lg">
              현재 선택된 타임프레임에서 포착된 특이 캔들 패턴이 없거나 안정적인 횡보 추세입니다.
            </div>
          ) : (
            activePatterns.map((pat, idx) => (
              <div
                key={idx}
                className="bg-[#080b11] border border-zinc-800/80 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-white">{pat.name}</h4>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        pat.type === 'BULLISH'
                          ? 'bg-red-950/70 text-red-400 border border-red-800/60'
                          : pat.type === 'BEARISH'
                          ? 'bg-blue-950/70 text-blue-400 border border-blue-800/60'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {pat.type === 'BULLISH' ? '상승 반전' : pat.type === 'BEARISH' ? '하락 반전' : '추세 지속'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{pat.description}</p>
                </div>

                <div className="sm:text-right shrink-0 bg-zinc-900 px-3 py-1.5 rounded border border-zinc-800">
                  <div className="text-[10px] text-zinc-400 font-mono">패턴 신뢰도</div>
                  <div className="text-xs font-mono font-bold text-cyan-400">{pat.confidence}%</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Support & Resistance */}
      {activeTab === 'support_resistance' && (
        <div className="mt-4 space-y-3 font-mono">
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Resistances (저항선) */}
            <div className="bg-[#080b11] border border-zinc-800 rounded-lg p-3">
              <div className="text-xs font-bold text-red-400 mb-2 flex items-center justify-between font-sans">
                <span>주요 매도 저항선</span>
                <span className="text-[10px] text-zinc-500 font-normal">상향 돌파 시 추가상승</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {activeResistances.length > 0 ? (
                  activeResistances.map((lvl, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 rounded bg-zinc-900/60 border border-zinc-800">
                      <span className="text-zinc-400 text-[11px] font-sans">저항선 {i + 1}</span>
                      <span className="text-red-400 font-bold">{formatPrice(lvl)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500 text-xs py-2">저항선 계산 중</div>
                )}
              </div>
            </div>

            {/* Supports (지지선) */}
            <div className="bg-[#080b11] border border-zinc-800 rounded-lg p-3">
              <div className="text-xs font-bold text-blue-400 mb-2 flex items-center justify-between font-sans">
                <span>주요 매수 지지선</span>
                <span className="text-[10px] text-zinc-500 font-normal">분할 매수 및 손절 기준</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {activeSupports.length > 0 ? (
                  activeSupports.map((lvl, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 rounded bg-zinc-900/60 border border-zinc-800">
                      <span className="text-zinc-400 text-[11px] font-sans">지지선 {i + 1}</span>
                      <span className="text-blue-400 font-bold">{formatPrice(lvl)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500 text-xs py-2">지지선 계산 중</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Strategy */}
      {activeTab === 'strategy' && (
        <div className="mt-4 space-y-3 font-sans">
          <div className="bg-[#080b11] border border-zinc-800 rounded-lg p-3.5">
            <div className="text-xs font-bold text-white mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{stock.name} 퀀트 포지션 운용 가이드</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {analysis?.tradingStrategy || 
                `현재 주가는 지지선 대비 안정적인 위치에 있으며, 20일 이동평균선 지지 여부를 확인하며 분할 매수로 접근하는 전략이 권장됩니다. RSI가 40~50 구간에서 반등할 시 모멘텀 매수가 유효합니다.`}
            </p>
          </div>

          {analysis?.riskManagementTips && analysis.riskManagementTips.length > 0 && (
            <div className="bg-[#080b11] border border-zinc-800 rounded-lg p-3">
              <div className="text-xs font-bold text-zinc-300 mb-1.5">리스크 관리 체크포인트</div>
              <ul className="space-y-1 text-xs text-zinc-400">
                {analysis.riskManagementTips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-zinc-600 mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
