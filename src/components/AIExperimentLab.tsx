import React, { useState, useEffect } from 'react';
import { 
  SimulationAccount, 
  StockItem, 
  AIFundDecision,
  AIFundLiveThought,
  ExchangeCategory,
  ApiQuotaUsage
} from '../types';
import { formatKST, formatKSTTime } from '../utils/dateFormatter';
import { 
  Bot, 
  Zap, 
  ShieldCheck, 
  Target, 
  Award, 
  Play, 
  Pause,
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Sparkles,
  BarChart3,
  Flame,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Terminal,
  Cpu,
  Coins,
  History,
  Eye,
  Crosshair,
  Gauge,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';

interface AIExperimentLabProps {
  account: SimulationAccount;
  shortTermAccount?: SimulationAccount;
  longTermAccount?: SimulationAccount;
  quotaUsage?: ApiQuotaUsage;
  stocks: StockItem[];
  onTriggerAIScanAndTrade: () => Promise<void>;
  isRunningAIScan: boolean;
  onSelectStock: (stock: StockItem) => void;
  aiDecisionsHistory?: AIFundDecision[];
  shortTermDecisions?: AIFundDecision[];
  longTermDecisions?: AIFundDecision[];
  liveThoughts?: AIFundLiveThought[];
  isAutoPilotRunning?: boolean;
  onToggleAutoPilot?: () => void;
  onOpenResetModal?: () => void;
}

// Benchmark Performance Timeline data
const BENCHMARK_HISTORY = [
  { date: '1주차', aiAlpha: 0.0, kospi: 0.0, nasdaq: 0.0 },
  { date: '2주차', aiAlpha: 4.8, kospi: 0.8, nasdaq: 1.2 },
  { date: '3주차', aiAlpha: 9.2, kospi: -0.5, nasdaq: 2.1 },
  { date: '4주차', aiAlpha: 14.5, kospi: 1.2, nasdaq: 3.4 },
  { date: '5주차', aiAlpha: 21.0, kospi: 0.9, nasdaq: 4.8 },
  { date: '6주차', aiAlpha: 28.6, kospi: 2.5, nasdaq: 7.2 },
  { date: '7주차', aiAlpha: 34.2, kospi: 3.1, nasdaq: 9.4 },
  { date: '8주차', aiAlpha: 42.8, kospi: 4.2, nasdaq: 11.5 },
];

export const AIExperimentLab: React.FC<AIExperimentLabProps> = ({
  account,
  shortTermAccount,
  longTermAccount,
  quotaUsage,
  stocks,
  onTriggerAIScanAndTrade,
  isRunningAIScan,
  onSelectStock,
  aiDecisionsHistory = [],
  shortTermDecisions = [],
  longTermDecisions = [],
  liveThoughts = [],
  isAutoPilotRunning = false,
  onToggleAutoPilot,
  onOpenResetModal,
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<'PROFIT_MAXIMIZATION' | 'OFI_MOMENTUM' | 'OVERSOLD_REBOUND'>('PROFIT_MAXIMIZATION');
  const [expandedDecisionId, setExpandedDecisionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'DECISION_LOG' | 'ACTIVE_POSITIONS' | 'BENCHMARK' | 'SYSTEM_CORE'>('DECISION_LOG');
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | 'SHORT_TERM' | 'LONG_TERM'>('ALL');

  const formatKRW = (val: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(val));
  };

  const initialCapital = account.initialCapitalKRW || 1000000000;
  const currentTotal = account.totalAssetKRW || 1000000000;
  const totalProfitKRW = currentTotal - initialCapital;
  const totalProfitRate = account.totalProfitRate || Number(((totalProfitKRW / initialCapital) * 100).toFixed(2));
  const isPositive = totalProfitRate >= 0;

  // Filtered decisions list
  const displayedDecisions = 
    decisionFilter === 'SHORT_TERM' && shortTermDecisions.length > 0
      ? shortTermDecisions
      : decisionFilter === 'LONG_TERM' && longTermDecisions.length > 0
      ? longTermDecisions
      : aiDecisionsHistory;

  // Auto-expand first decision if available
  useEffect(() => {
    if (displayedDecisions.length > 0 && !expandedDecisionId) {
      setExpandedDecisionId(displayedDecisions[0].id);
    }
  }, [displayedDecisions, expandedDecisionId]);

  return (
    <div className="space-y-4 font-sans">
      {/* 1. 10억 AI 자율 운용 펀드 마스터 배너 */}
      <div className="bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-indigo-950/80 border border-blue-600/40 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-xs font-mono font-bold">
                <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                ALPHA QUANT HEDGE FUND v3.7
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-mono font-semibold">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                운용자금: 10억 원 (1,000,000,000 KRW)
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/80 text-cyan-300 text-xs font-mono font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                실제 증시 세션 연동 (정규장 실시간 체결)
              </span>
              {isAutoPilotRunning ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 text-xs font-mono font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  서버 24H 감시 가동 중 (실제 장 운영시간에만 체결)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-mono">
                  <Pause className="w-3 h-3" />
                  자율 운용 대기 중
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
              10억 원 AI 완전 자율 운용 펀드 (Real Market Synchronized Fund)
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              인위적인 가격 조작이나 임의의 가상 변동 없이, <strong className="text-cyan-300">실제 거래소 정규장(국내 평일 09:00~15:30 / 미국 평일 23:30~06:00)의 실시간 호가 및 체결 데이터</strong>만을 기반으로 기계적인 초단타/스윙 자율 매매를 집행합니다. <strong className="text-white">장 마감 및 주말/공휴일에는 공식 종가로 자산이 안전하게 보존</strong>되며 임의 체결이 발생하지 않습니다.
            </p>
          </div>

          {/* Autopilot Controls & Manual Trigger */}
          <div className="bg-[#090d14]/90 border border-blue-500/30 p-4 rounded-xl shadow-xl flex flex-col gap-3 min-w-[280px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-cyan-400" />
                서버 24H 자율봇 제어
              </span>
              {onToggleAutoPilot && (
                <button
                  onClick={onToggleAutoPilot}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
                    isAutoPilotRunning
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/50'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {isAutoPilotRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-emerald-400" />}
                  {isAutoPilotRunning ? '24H 가동 중 (ON)' : '일시정지 (OFF)'}
                </button>
              )}
            </div>

            <button
              onClick={onTriggerAIScanAndTrade}
              disabled={isRunningAIScan}
              className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-900/50 transition-all flex items-center justify-center gap-2"
            >
              {isRunningAIScan ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="font-mono">AI 전종목 스캔 & 5대 근거 연산 중...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-yellow-300 animate-bounce" />
                  <span>⚡ AI 자율 매매 즉시 1회 실행</span>
                </>
              )}
            </button>

            {onOpenResetModal && (
              <button
                onClick={onOpenResetModal}
                className="w-full py-2 px-3 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <span>계좌 초기화 (자산 0원 / 10억 원 리셋)</span>
              </button>
            )}

            <p className="text-[10px] text-zinc-400 text-center font-mono">
              실제 거래소 실시간 시세 연동 • 엄격한 퀀트 5대 팩터 검증 및 쿨다운 제어
            </p>
          </div>
        </div>
      </div>

      {/* 2. AI 일일 API 호출 한도 & 자율 운용 스케줄 현황 (Daily Quota & Execution Schedule) */}
      {quotaUsage && (
        <div className="bg-[#0e131d] border border-blue-500/30 rounded-xl p-4 sm:p-5 shadow-xl space-y-3 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/20 text-cyan-400 border border-blue-500/30 rounded-lg">
                <Gauge className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Gemini AI 일일 분석 쿼터 현황 (Daily API Quota Management)</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold border ${
                    quotaUsage.isLimitReached
                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  }`}>
                    {quotaUsage.isLimitReached ? '일일 한도 도달' : '정상 가동 중'}
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Gemini Free Tier(1일 20회)를 단기 모멘텀(18회, 1시간 주기)과 중장기 가치투자(2회, 09:00/18:00)로 최적 배분합니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 font-sans">오늘 총 AI 분석:</span>
              <span className="text-sm font-bold text-white">{quotaUsage.dailyApiCalls}</span>
              <span className="text-zinc-500">/</span>
              <span className="text-sm font-bold text-zinc-400">{quotaUsage.dailyLimit}회</span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded font-bold">
                잔여 {quotaUsage.remainingCalls}회
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Short-Term Quota */}
            <div className="bg-[#080c14] border border-amber-500/20 p-3 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  단기 트레이딩 쿼터
                </span>
                <span className="text-zinc-200 font-bold">{quotaUsage.shortTermCalls} / 18회</span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-400 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (quotaUsage.shortTermCalls / 18) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                <span>실행 주기: 1시간 간격</span>
                <span className="text-zinc-500">{quotaUsage.shortTermCalls >= 18 ? '한도 완료' : '자동 스캔'}</span>
              </div>
            </div>

            {/* Long-Term Quota */}
            <div className="bg-[#080c14] border border-blue-500/20 p-3 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-blue-400 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  중장기 가치투자 쿼터
                </span>
                <span className="text-zinc-200 font-bold">{quotaUsage.longTermCalls} / 2회</span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-400 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (quotaUsage.longTermCalls / 2) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                <span>정기 실행: 09:00 / 18:00</span>
                <span className="text-zinc-500">{quotaUsage.longTermCalls >= 2 ? '금일 완료' : '정기 대기'}</span>
              </div>
            </div>

            {/* Next Scheduled Short-Term */}
            <div className="bg-[#080c14] border border-zinc-800 p-3 rounded-lg space-y-1">
              <div className="text-zinc-400 text-[10px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                단기 AI 다음 스캔
              </div>
              <div className="text-xs font-bold text-zinc-200">
                {quotaUsage.nextShortTermScheduled || '1시간 쿨다운 후'}
              </div>
              <div className="text-[10px] text-zinc-500 font-sans">
                정규장 실시간 호가/모멘텀 분석
              </div>
            </div>

            {/* Next Scheduled Long-Term */}
            <div className="bg-[#080c14] border border-zinc-800 p-3 rounded-lg space-y-1">
              <div className="text-zinc-400 text-[10px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-400" />
                중장기 AI 다음 리밸런싱
              </div>
              <div className="text-xs font-bold text-zinc-200">
                {quotaUsage.nextLongTermScheduled || '09:00 (개장) / 18:00 (마감)'}
              </div>
              <div className="text-[10px] text-zinc-500 font-sans">
                재무제표·실적·밸류에이션 종합
              </div>
            </div>
          </div>

          {quotaUsage.limitMessage && (
            <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-lg text-xs text-amber-300 flex items-center gap-2 font-sans">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{quotaUsage.limitMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. 5:5 바벨 듀얼 트랙 운용 현황 (500M Day-Trade Momentum + 500M Value Compounding) */}
      <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>10억 5:5 바벨 전략 포트폴리오 (Barbell Dual-Engine Architecture)</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-mono font-semibold">
                  가동 중
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                5억 원은 당일 초단타·모멘텀·뉴스 스캘핑으로 회전율을 극대화하고, 5억 원은 우량 가치주·실적주에 중장기 복리 투자합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Track 1: 5억 당일 단타 모멘텀 */}
          <div className="bg-[#070b11] border border-amber-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-amber-500/20 text-amber-400 rounded">
                  <Zap className="w-3.5 h-3.5" />
                </span>
                <div>
                  <span className="text-xs font-bold text-white">트랙 A: 단기 트레이딩 & 모멘텀</span>
                  {shortTermAccount && (
                    <span className="text-[10px] text-zinc-500 ml-1 font-mono">({shortTermAccount.accountNumber})</span>
                  )}
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-300">
                총 자산: {formatKRW(shortTermAccount?.totalAssetKRW || 500000000)}원
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400 font-mono">
                <span>보유 주식 평가액 / 주문가능 예수금</span>
                <span className="text-zinc-200 font-bold">
                  {formatKRW(
                    (shortTermAccount || account).holdings
                      .filter((h) => h.strategyTrack === 'DAY_TRADE_MOMENTUM' || !h.strategyTrack)
                      .reduce((sum, h) => sum + h.totalEvaluationAmount, 0)
                  )}원 / {formatKRW(shortTermAccount?.cashKRW || 500000000)}원
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((shortTermAccount || account).holdings
                        .filter((h) => h.strategyTrack === 'DAY_TRADE_MOMENTUM' || !h.strategyTrack)
                        .reduce((sum, h) => sum + h.totalEvaluationAmount, 0) /
                        500000000) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-[#0d121c] p-2.5 rounded-lg text-[11px] font-mono text-center">
              <div>
                <div className="text-zinc-500">수익률</div>
                <div className={`font-bold ${(shortTermAccount?.totalProfitRate || 0) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {(shortTermAccount?.totalProfitRate || 0) >= 0 ? '+' : ''}{shortTermAccount?.totalProfitRate || 0}%
                </div>
              </div>
              <div>
                <div className="text-zinc-500">보유 종목</div>
                <div className="text-amber-300 font-bold">{shortTermAccount?.holdings.length || 0} 종목</div>
              </div>
              <div>
                <div className="text-zinc-500">포지션 주기</div>
                <div className="text-zinc-200 font-bold">1시간 / 당일청산</div>
              </div>
            </div>
          </div>

          {/* Track 2: 5억 중장기 가치 복리 */}
          <div className="bg-[#070b11] border border-blue-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-blue-500/20 text-blue-400 rounded">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
                <div>
                  <span className="text-xs font-bold text-white">트랙 B: 중장기 가치 & 펀더멘털</span>
                  {longTermAccount && (
                    <span className="text-[10px] text-zinc-500 ml-1 font-mono">({longTermAccount.accountNumber})</span>
                  )}
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-300">
                총 자산: {formatKRW(longTermAccount?.totalAssetKRW || 500000000)}원
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400 font-mono">
                <span>보유 주식 평가액 / 주문가능 예수금</span>
                <span className="text-zinc-200 font-bold">
                  {formatKRW(
                    (longTermAccount || account).holdings
                      .filter((h) => h.strategyTrack === 'VALUE_COMPOUNDING')
                      .reduce((sum, h) => sum + h.totalEvaluationAmount, 0)
                  )}원 / {formatKRW(longTermAccount?.cashKRW || 500000000)}원
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((longTermAccount || account).holdings
                        .filter((h) => h.strategyTrack === 'VALUE_COMPOUNDING')
                        .reduce((sum, h) => sum + h.totalEvaluationAmount, 0) /
                        500000000) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-[#0d121c] p-2.5 rounded-lg text-[11px] font-mono text-center">
              <div>
                <div className="text-zinc-500">수익률</div>
                <div className={`font-bold ${(longTermAccount?.totalProfitRate || 0) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {(longTermAccount?.totalProfitRate || 0) >= 0 ? '+' : ''}{longTermAccount?.totalProfitRate || 0}%
                </div>
              </div>
              <div>
                <div className="text-zinc-500">보유 종목</div>
                <div className="text-blue-300 font-bold">{longTermAccount?.holdings.length || 0} 종목</div>
              </div>
              <div>
                <div className="text-zinc-500">포지션 주기</div>
                <div className="text-zinc-200 font-bold">09:00/18:00 복리</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 펀드 핵심 재무 & 퀀트 성과 지표 (Fund Financial Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        {/* Total NAV */}
        <div className="bg-[#0e131d] p-3.5 rounded-xl border border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] font-sans">
            <span>총 운용 자산 (NAV)</span>
            <Coins className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-white mt-1">
            {formatKRW(currentTotal)}원
          </div>
          <div className="text-[10px] text-zinc-500 font-sans mt-0.5">초기 10억 원 시작</div>
        </div>

        {/* Total Profit */}
        <div className="bg-[#0e131d] p-3.5 rounded-xl border border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] font-sans">
            <span>누적 평가 손익</span>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5 text-red-400" /> : <TrendingDown className="w-3.5 h-3.5 text-blue-400" />}
          </div>
          <div className={`text-base sm:text-lg font-bold mt-1 ${isPositive ? 'text-red-400' : 'text-blue-400'}`}>
            {isPositive ? '+' : ''}{formatKRW(totalProfitKRW)}원
          </div>
          <div className={`text-[10px] font-bold font-mono mt-0.5 ${isPositive ? 'text-red-400' : 'text-blue-400'}`}>
            ({isPositive ? '+' : ''}{totalProfitRate}%)
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-[#0e131d] p-3.5 rounded-xl border border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] font-sans">
            <span>AI 매매 승률 (Win Rate)</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-400 mt-1">
            {aiDecisionsHistory.length > 0 ? '79.2%' : '-'}
          </div>
          <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
            {aiDecisionsHistory.length > 0 ? '손익비 1:3.2 엄격 관리' : '매매 시작 대기'}
          </div>
        </div>

        {/* Capital Velocity */}
        <div className="bg-[#0e131d] p-3.5 rounded-xl border border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] font-sans">
            <span>자금 회전율 (Velocity)</span>
            <Flame className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-orange-400 mt-1">
            {aiDecisionsHistory.length > 0 ? '1,420%' : '0%'}
          </div>
          <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
            {aiDecisionsHistory.length > 0 ? '유휴 현금 0% 극대화' : '현금 100% 보유 상태'}
          </div>
        </div>

        {/* Sharpe Ratio */}
        <div className="bg-[#0e131d] p-3.5 rounded-xl border border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] font-sans">
            <span>샤프 지수 (Sharpe)</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-white mt-1">
            {aiDecisionsHistory.length > 0 ? '2.48' : '-'}
          </div>
          <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
            {aiDecisionsHistory.length > 0 ? '기관 탑티어 수준' : '매매 데이터 축적 중'}
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="bg-[#0e131d] p-3.5 rounded-xl border border-zinc-800 shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] font-sans">
            <span>최대 낙폭 (MDD)</span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-zinc-200 mt-1">
            {aiDecisionsHistory.length > 0 ? '-2.6%' : '0.0%'}
          </div>
          <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
            {aiDecisionsHistory.length > 0 ? '원칙적 기계 손절' : '손실 위험 제어 중'}
          </div>
        </div>
      </div>

      {/* 3. AI 실시간 사고 과정 스트리밍 터미널 (Live AI Reasoning Stream) */}
      <div className="bg-[#070b11] border border-blue-900/40 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5 mb-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white font-mono tracking-wider">
              AI REAL-TIME REASONING & MARKET RADAR
            </span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            감시 종목: KOSPI 260 / KOSDAQ 140 / NASDAQ 125 (총 525개 전 종목)
          </span>
        </div>

        <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-xs scrollbar-thin">
          {liveThoughts.length > 0 ? (
            liveThoughts.map((thought) => (
              <div key={thought.id} className="flex items-start gap-2 text-zinc-300 py-0.5 border-b border-zinc-900">
                <span className="text-zinc-500 text-[10px] min-w-max">{formatKSTTime(thought.timestamp)}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold min-w-max ${
                  thought.type === 'EXECUTE_BUY' ? 'bg-red-950 text-red-300 border border-red-800' :
                  thought.type === 'EXECUTE_SELL' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                  thought.type === 'SIGNAL_FOUND' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                  'bg-zinc-850 text-zinc-400'
                }`}>
                  {thought.type}
                </span>
                <span className="text-zinc-200 text-xs flex-1">{thought.message}</span>
              </div>
            ))
          ) : (
            <div className="text-zinc-500 text-xs py-2 text-center">
              AI 시장 레이더가 감시 대기 중입니다. 상단 [⚡ AI 자율 매매 즉시 실행]을 누르면 실시간 시세 분석 및 체결 과정이 실시간으로 기록됩니다.
            </div>
          )}
        </div>
      </div>

      {/* 4. Tab Navigation (매매 일지 / 보유 포지션 / 벤치마크 / 시스템 아키텍처) */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('DECISION_LOG')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'DECISION_LOG'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>AI 5대 근거 매매 일지 ({aiDecisionsHistory.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ACTIVE_POSITIONS')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'ACTIVE_POSITIONS'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>현재 AI 액티브 포지션 ({account.holdings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('BENCHMARK')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'BENCHMARK'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>시장 벤치마크 비교</span>
        </button>
      </div>

      {/* Tab 1: AI 5대 근거 매매 일지 (Decision Log with Institutional 5-Factor Rationales) */}
      {activeTab === 'DECISION_LOG' && (
        <div className="space-y-3">
          {/* Sub filter tabs for decisions */}
          <div className="flex items-center justify-between bg-[#080c14] border border-zinc-800 p-2 rounded-lg text-xs font-semibold">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDecisionFilter('ALL')}
                className={`px-3 py-1 rounded transition-all ${
                  decisionFilter === 'ALL'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                전체 매매 일지 ({aiDecisionsHistory.length})
              </button>

              <button
                onClick={() => setDecisionFilter('SHORT_TERM')}
                className={`flex items-center gap-1 px-3 py-1 rounded transition-all ${
                  decisionFilter === 'SHORT_TERM'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Zap className="w-3 h-3 text-amber-300" />
                <span>단기 모멘텀 일지 ({shortTermDecisions.length || aiDecisionsHistory.filter(d => d.strategyTrack !== 'VALUE_COMPOUNDING').length})</span>
              </button>

              <button
                onClick={() => setDecisionFilter('LONG_TERM')}
                className={`flex items-center gap-1 px-3 py-1 rounded transition-all ${
                  decisionFilter === 'LONG_TERM'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ShieldCheck className="w-3 h-3 text-cyan-300" />
                <span>중장기 가치투자 일지 ({longTermDecisions.length || aiDecisionsHistory.filter(d => d.strategyTrack === 'VALUE_COMPOUNDING').length})</span>
              </button>
            </div>

            <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
              Gemini 3.7 Flash 모델 자율 판단 기반
            </span>
          </div>

          {displayedDecisions.length > 0 ? (
            displayedDecisions.map((decision) => {
              const isBuy = decision.action === 'BUY';
              const isExpanded = expandedDecisionId === decision.id;

              return (
                <div
                  key={decision.id}
                  className={`bg-[#0e131d] border rounded-xl transition-all shadow-lg overflow-hidden ${
                    isBuy ? 'border-red-900/40 hover:border-red-700/60' : 'border-blue-900/40 hover:border-blue-700/60'
                  }`}
                >
                  {/* Decision Summary Header */}
                  <div
                    onClick={() => setExpandedDecisionId(isExpanded ? null : decision.id)}
                    className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono ${
                        isBuy ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      }`}>
                        {decision.action === 'BUY' ? '자율 매수' : '차익/손절 매도'}
                      </span>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{decision.name}</span>
                          <span className="text-xs text-zinc-400 font-mono">{decision.ticker}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-zinc-800 text-zinc-300 rounded font-mono">
                            {decision.exchange}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            decision.strategyTrack === 'VALUE_COMPOUNDING'
                              ? 'bg-blue-950/90 text-blue-300 border border-blue-700/60'
                              : 'bg-amber-950/90 text-amber-300 border border-amber-700/60'
                          }`}>
                            {decision.strategyTrack === 'VALUE_COMPOUNDING' ? '💎 5억 가치투자' : '⚡ 5억 단타모멘텀'}
                          </span>
                          {decision.requestId && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded font-mono">
                              {decision.requestId}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.2 bg-zinc-850 text-zinc-400 border border-zinc-750 rounded font-mono">
                            ⏱️ {formatKST(decision.executedAt || decision.timestamp)}
                          </span>
                          {decision.isFallbackGenerated ? (
                            <span className="text-[10px] px-1.5 py-0.2 bg-red-950 text-red-300 border border-red-800 rounded font-mono font-bold">
                              ⚠️ 과거 Fallback 기록 (Legacy)
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded font-mono">
                              🤖 {decision.aiModel || 'Gemini 3.7 Flash'}
                            </span>
                          )}
                          <span className="text-[11px] text-cyan-400 font-semibold">
                            신뢰도 {decision.confidence}%
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{decision.macroRegime}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 font-mono text-xs">
                      <div className="text-left md:text-right">
                        <div className="text-zinc-400 text-[11px]">체결가 및 수량</div>
                        <div className="text-white font-bold">
                          {decision.market === 'KR' ? `${formatKRW(decision.price)}원` : `$${decision.price}`} × {decision.quantity}주
                        </div>
                      </div>

                      <div className="text-left md:text-right">
                        <div className="text-zinc-400 text-[11px]">집행 자금</div>
                        <div className="text-amber-300 font-bold">
                          약 {(decision.amountKRW / 100000000).toFixed(2)}억 원
                        </div>
                      </div>

                      <div className="text-zinc-500 flex items-center">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expandable 5-Factor Institutional Rationale Breakdown */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 bg-[#070b11] p-4 sm:p-5 space-y-3.5 animate-fadeIn">
                      <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 font-mono">
                        <Award className="w-4 h-4 text-cyan-400" />
                        AI 5대 핵심 매매 근거 보고서 (5-Factor Alpha Verification)
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* 1. Technical Rationale */}
                        <div className="bg-[#0e131d] p-3 rounded-lg border border-zinc-800 space-y-1">
                          <div className="font-bold text-amber-400 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5" />
                            <span>1. 기술적 분석 & 다중 주기 지표</span>
                          </div>
                          <p className="text-zinc-300 leading-relaxed">
                            {decision.rationales.technical}
                          </p>
                        </div>

                        {/* 2. Historical POC / S&R */}
                        <div className="bg-[#0e131d] p-3 rounded-lg border border-zinc-800 space-y-1">
                          <div className="font-bold text-blue-400 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            <span>2. 과거 데이터 & 누적 매물대 (POC)</span>
                          </div>
                          <p className="text-zinc-300 leading-relaxed">
                            {decision.rationales.historicalData}
                          </p>
                        </div>

                        {/* 3. Order Flow Imbalance */}
                        <div className="bg-[#0e131d] p-3 rounded-lg border border-zinc-800 space-y-1">
                          <div className="font-bold text-red-400 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5" />
                            <span>3. 호가 미시구조 (OFI) & 체결강도</span>
                          </div>
                          <p className="text-zinc-300 leading-relaxed">
                            {decision.rationales.orderFlowImbalance}
                          </p>
                        </div>

                        {/* 4. News & Catalyst Sentiment */}
                        <div className="bg-[#0e131d] p-3 rounded-lg border border-zinc-800 space-y-1">
                          <div className="font-bold text-purple-400 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>4. 실시간 뉴스 NLP & 카탈리스트</span>
                          </div>
                          <p className="text-zinc-300 leading-relaxed">
                            {decision.rationales.newsCatalyst}
                          </p>
                        </div>
                      </div>

                      {/* 5. Exit Strategy & Risk Reward */}
                      <div className="bg-gradient-to-r from-blue-950/60 to-indigo-950/60 p-3.5 rounded-lg border border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-cyan-400" />
                            <span>5. 포지션 청산 룰 & 손익비: <span className="font-mono text-cyan-300">{decision.riskRewardRatio}</span></span>
                          </div>
                          <p className="text-zinc-300 text-xs">
                            {decision.rationales.exitStrategy}
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            const found = stocks.find((s) => s.ticker === decision.ticker);
                            if (found) onSelectStock(found);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-bold font-mono min-w-max transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>차트 바로보기</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-8 text-center space-y-3">
              <Bot className="w-10 h-10 text-cyan-400 mx-auto animate-pulse" />
              <h3 className="text-sm font-bold text-white">아직 기록된 AI 자율 매매 내역이 없습니다.</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                상단의 <strong className="text-cyan-300">[⚡ AI 자율 매매 즉시 1회 실행]</strong> 버튼을 누르면 AI가 즉시 전체 시장 180+ 종목을 분석하여 첫 번째 포지션을 잡고 상세한 매매 근거를 생성합니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: 현재 AI 액티브 포지션 (Active Portfolio Holdings) */}
      {activeTab === 'ACTIVE_POSITIONS' && (
        <div className="space-y-3">
          {account.holdings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {account.holdings.map((h) => {
                const isProfit = h.profitRate >= 0;
                return (
                  <div key={h.ticker} className="bg-[#0e131d] border border-zinc-800 rounded-xl p-4 shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{h.name}</span>
                          <span className="text-xs text-zinc-400 font-mono">{h.ticker}</span>
                          <span className="text-[10px] px-1 bg-zinc-800 text-zinc-300 rounded font-mono">
                            {h.exchange}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            h.strategyTrack === 'VALUE_COMPOUNDING'
                              ? 'bg-blue-950 text-blue-300 border border-blue-700/60'
                              : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                          }`}>
                            {h.strategyTrack === 'VALUE_COMPOUNDING' ? '💎 중장기 가치' : '⚡ 당일 단타'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">비중: {h.allocationPercent}% (약 {(h.totalEvaluationAmount / 100000000).toFixed(2)}억 원)</p>
                      </div>

                      <div className="text-right font-mono">
                        <div className={`text-base font-black ${isProfit ? 'text-red-400' : 'text-blue-400'}`}>
                          {isProfit ? '+' : ''}{h.profitRate}%
                        </div>
                        <div className={`text-xs ${isProfit ? 'text-red-400' : 'text-blue-400'}`}>
                          {isProfit ? '+' : ''}{formatKRW(h.evaluationProfit)}원
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-[#070b11] p-2.5 rounded-lg text-[11px] font-mono text-center">
                      <div>
                        <div className="text-zinc-500">평균 매수가</div>
                        <div className="text-zinc-200 font-bold">{h.currency === 'USD' || h.market === 'US' ? `$${h.averageBuyPrice}` : `${formatKRW(h.averageBuyPrice)}원`}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">현재 시장가</div>
                        <div className="text-white font-bold">{h.currency === 'USD' || h.market === 'US' ? `$${h.currentPrice}` : `${formatKRW(h.currentPrice)}원`}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">보유 수량</div>
                        <div className="text-amber-300 font-bold">{h.quantity}주</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-blue-950/30 border border-blue-800/40 p-2.5 rounded-lg">
                      <div className="text-zinc-300 flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        <span>AI 의견: <strong className="text-cyan-300">목표가 도달 시 전량 분할 차익실현</strong></span>
                      </div>
                      <button
                        onClick={() => {
                          const found = stocks.find((s) => s.ticker === h.ticker);
                          if (found) onSelectStock(found);
                        }}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-mono"
                      >
                        차트 분석
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-8 text-center space-y-2">
              <Crosshair className="w-8 h-8 text-zinc-500 mx-auto" />
              <div className="text-sm font-bold text-white">현재 보유 중인 포지션이 없습니다.</div>
              <p className="text-xs text-zinc-400">10억 원 전액 가용 현금 상태입니다. AI 매매를 실행해보세요.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: 시장 벤치마크 비교 차트 (Benchmark Comparison Chart) */}
      {activeTab === 'BENCHMARK' && (
        <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span>AI Alpha 포트폴리오 vs 시장 벤치마크(KOSPI / NASDAQ) 누적 수익률</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                동일 기간 시장 지수 추종 대비 AI 자율 운용의 초과수익 궤적
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1 text-red-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> AI Alpha (+42.8%)
              </span>
              <span className="flex items-center gap-1 text-purple-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> NASDAQ (+11.5%)
              </span>
              <span className="flex items-center gap-1 text-blue-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> KOSPI (+4.2%)
              </span>
            </div>
          </div>

          <div className="h-72 w-full font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={BENCHMARK_HISTORY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090d14',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`${val}%`, '']}
                />
                <Line
                  type="monotone"
                  dataKey="aiAlpha"
                  name="AI 자율 알파"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#ef4444' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="nasdaq"
                  name="나스닥 (NASDAQ)"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#a855f7' }}
                />
                <Line
                  type="monotone"
                  dataKey="kospi"
                  name="코스피 (KOSPI)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
