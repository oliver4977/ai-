import React from 'react';
import { 
  X, 
  Layers, 
  Database, 
  Cpu, 
  LineChart, 
  Bot, 
  CheckCircle2, 
  Compass,
  Target
} from 'lucide-react';

interface SystemArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemArchitectureModal: React.FC<SystemArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0e121a] border border-white/[0.1] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl relative text-slate-100 font-sans">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6 border-b border-zinc-800 pb-4">
          <div className="text-[10px] text-blue-400 font-mono uppercase tracking-wider">Toss Securities OpenAPI Architecture</div>
          <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
            토스증권 OpenAPI 기반 AI 퀀트 자율투자 터미널 시스템 설계
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            토스증권 공식 REST & WebSocket 데이터 파이프라인과 Gemini AI 자율 운용 엔진
          </p>
        </div>

        {/* Architecture Pipeline Stages */}
        <div className="space-y-3.5 text-xs">
          {/* Stage 1: Data Ingestion & OHLCV Pipeline */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-4">
            <div className="flex items-center gap-2 font-semibold text-white text-xs mb-2">
              <span className="font-mono text-blue-400 font-bold">[01]</span>
              <span>토스증권 OpenAPI 데이터 파이프라인 (Data Ingestion Layer)</span>
            </div>
            <p className="text-zinc-300 leading-relaxed text-xs">
              토스증권(Toss Securities) Open API OAuth2 Client Credentials 인증을 기반으로 국내 주식(KOSPI/KOSDAQ) 및 해외 주식(NASDAQ/NYSE)의 실시간 체결가, 호가, OHLCV 시계열 캔들을 틱 단위로 동기화합니다.
            </p>
            <div className="grid sm:grid-cols-3 gap-2 mt-2.5 text-xs text-zinc-400 font-mono">
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-[11px]">
                <span className="text-zinc-200">Endpoint:</span> https://openapi.tossinvest.com
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-[11px]">
                <span className="text-zinc-200">Auth:</span> OAuth 2.0 Client Credentials
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-[11px]">
                <span className="text-zinc-200">Coverage:</span> 국내/해외 단일 통합 API
              </div>
            </div>
          </div>

          {/* Stage 2: Technical Indicators Engine */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-4">
            <div className="flex items-center gap-2 font-semibold text-white text-xs mb-2">
              <span className="font-mono text-zinc-400 font-bold">[02]</span>
              <span>퀀트 기술 지표 연산 엔진 (Technical Indicator Engine)</span>
            </div>
            <p className="text-zinc-300 leading-relaxed text-xs">
              시계열 데이터에서 추세, 모멘텀, 변동성, 수급 지표 및 주요 피봇 매물대 지지/저항 라인을 수식화하여 병렬 연산합니다.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2.5 text-xs text-zinc-400 font-mono">
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-[11px]">
                <span className="text-zinc-200">Trend:</span> SMA(20,50,120), EMA(9,21)
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-[11px]">
                <span className="text-zinc-200">Momentum:</span> RSI(14), MACD(12,26,9)
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-[11px]">
                <span className="text-zinc-200">Volatility:</span> BB(20,2), ATR, Squeeze
              </div>
              <div className="bg-zinc-900 p-2 rounded border border-zinc-800 text-[11px]">
                <span className="text-zinc-200">Levels:</span> Pivot S/R & Volume Profile
              </div>
            </div>
          </div>

          {/* Stage 3: Algorithmic Pattern Recognition */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-4">
            <div className="flex items-center gap-2 font-semibold text-white text-xs mb-2">
              <span className="font-mono text-zinc-400 font-bold">[03]</span>
              <span>차트 포메이션 & 캔들 형태 인식 (Pattern Recognition Layer)</span>
            </div>
            <p className="text-zinc-300 leading-relaxed text-xs">
              골든크로스, 상승 장악형, 망치형 바닥, W자 다중 바닥(Double Bottom), 주요 저항선 대량 거래량 돌파 등의 반등 포메이션을 신뢰도 점수와 함께 알고리즘적으로 검출합니다.
            </p>
          </div>

          {/* Stage 4: Gemini AI Deep Reasoning & Scoring Engine */}
          <div className="bg-zinc-900/60 border border-zinc-700/80 rounded-lg p-4">
            <div className="flex items-center gap-2 font-semibold text-white text-xs mb-2">
              <span className="font-mono text-zinc-300 font-bold">[04]</span>
              <span>Gemini 2.5 Flash 추론 & 포지션 시나리오 생성 (LLM Reasoning Layer)</span>
            </div>
            <p className="text-zinc-300 leading-relaxed text-xs">
              정량화된 기술적 데이터(지표값, 패턴, 매물대, 거래량)를 Gemini 모델의 구조화된 프롬프트로 전달하여 기관급 분석 리포트를 생성합니다:
            </p>
            <div className="grid sm:grid-cols-2 gap-2 mt-2.5 text-xs font-mono">
              <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 space-y-0.5">
                <div className="font-semibold text-zinc-200 text-xs">
                  Verdict & Quant Score
                </div>
                <p className="text-zinc-400 text-[11px] font-sans">강력 매수 / 매수 / 관망 판정 및 0~100 신뢰도 스코어</p>
              </div>
              <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 space-y-0.5">
                <div className="font-semibold text-zinc-200 text-xs">
                  Risk / Reward Target Matrix
                </div>
                <p className="text-zinc-400 text-[11px] font-sans">적정 분할 매수가, 1차/2차 목표가, 엄격한 손절 기준선 도출</p>
              </div>
            </div>
          </div>

          {/* Stage 5: High-Performance Canvas & Interactive UI */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-4">
            <div className="flex items-center gap-2 font-semibold text-white text-xs mb-2">
              <span className="font-mono text-zinc-400 font-bold">[05]</span>
              <span>고성능 캔버스 시각화 & 대시보드 인터랙션 (Visualization Layer)</span>
            </div>
            <p className="text-zinc-300 leading-relaxed text-xs">
              HTML5 Canvas 하드웨어 가속 기반으로 60FPS 이상의 부드러운 차트 탐색을 지원하며, 퀀트 스크리너, 포트폴리오 관심종목 추적, 실시간 질의응답을 유기적으로 연동합니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3.5 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 font-mono">AlphaChart Architecture Specification</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-md text-xs transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

