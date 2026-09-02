import React from 'react';
import { SimulationAccount, ApiQuotaUsage } from '../types';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Bot, 
  Sparkles, 
  ShieldAlert, 
  Zap, 
  DollarSign,
  ArrowUpRight,
  Settings,
  RefreshCw,
  Layers,
  ShieldCheck
} from 'lucide-react';

interface AccountSummaryBarProps {
  account: SimulationAccount;
  shortTermAccount?: SimulationAccount;
  longTermAccount?: SimulationAccount;
  quotaUsage?: ApiQuotaUsage;
  onToggleAutoTrade: () => void;
  onResetAccount: () => void;
  onOpenPortfolioView: () => void;
}

export const AccountSummaryBar: React.FC<AccountSummaryBarProps> = ({
  account,
  shortTermAccount,
  longTermAccount,
  quotaUsage,
  onToggleAutoTrade,
  onResetAccount,
  onOpenPortfolioView,
}) => {
  const formatKRW = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(num));
  };

  const isProfit = account.totalEvaluationProfitKRW >= 0;
  const isDailyProfit = account.dailyProfitKRW >= 0;

  const stProfit = (shortTermAccount?.totalEvaluationProfitKRW ?? 0) >= 0;
  const ltProfit = (longTermAccount?.totalEvaluationProfitKRW ?? 0) >= 0;

  return (
    <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-3 sm:p-4 shadow-lg text-xs font-sans space-y-2.5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: Account ID & AI Mode Status */}
        <div className="flex items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">{account.accountName}</span>
                <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                  {account.accountNumber}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] px-1.5 py-0.2 bg-blue-900/40 text-blue-300 border border-blue-800/50 rounded font-mono font-semibold">
                  10억 바벨 분할 운용
                </span>
                <span className="text-[10px] text-zinc-400">실제 거래소 세션 연동 (장 마감 시 종가 고정)</span>
              </div>
            </div>
          </div>

          {/* AI Trading Bot Mode Toggle Pill & Barbell Strategy */}
          <div className="flex items-center gap-2 bg-[#080b11] border border-zinc-750 px-2.5 py-1.5 rounded-lg flex-wrap">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  account.aiAutoTradeEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                }`}
              />
              <span className="text-[11px] font-semibold text-zinc-200">서버 24H 자율매매</span>
            </div>
            <button
              onClick={onToggleAutoTrade}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                account.aiAutoTradeEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-750'
              }`}
            >
              {account.aiAutoTradeEnabled ? '24H 가동 중 (ON)' : '일시정지 (OFF)'}
            </button>
          </div>
        </div>

        {/* Center/Right: Key Account Metrics (MTS Format) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 font-mono bg-[#090d14] p-2.5 rounded-lg border border-zinc-800/80">
          {/* Total Assets */}
          <div>
            <div className="text-[10px] text-zinc-400">총 평가금액</div>
            <div className="text-sm font-bold text-white tracking-tight">
              {formatKRW(account.totalAssetKRW)}
              <span className="text-[10px] font-normal text-zinc-400 ml-0.5">원</span>
            </div>
          </div>

          {/* Total Profit / Rate */}
          <div>
            <div className="text-[10px] text-zinc-400">총 평가손익</div>
            <div className={`text-sm font-bold flex items-center gap-1 ${isProfit ? 'text-red-400' : 'text-blue-400'}`}>
              <span>{isProfit ? '+' : ''}{formatKRW(account.totalEvaluationProfitKRW)}원</span>
              <span className="text-[11px] font-semibold">({isProfit ? '+' : ''}{account.totalProfitRate}%)</span>
            </div>
          </div>

          {/* D+2 Cash Balance */}
          <div>
            <div className="text-[10px] text-zinc-400">주문가능 예수금</div>
            <div className="text-xs font-semibold text-zinc-200">
              {formatKRW(account.cashKRW)}
              <span className="text-[10px] text-zinc-400 ml-0.5">원</span>
              <span className="text-[10px] text-zinc-500 ml-1.5 font-sans hidden xl:inline">
                (${account.cashUSD.toLocaleString()})
              </span>
            </div>
          </div>

          {/* Daily PnL */}
          <div>
            <div className="text-[10px] text-zinc-400">당일 손익</div>
            <div className={`text-xs font-semibold ${isDailyProfit ? 'text-red-400' : 'text-blue-400'}`}>
              {isDailyProfit ? '+' : ''}{formatKRW(account.dailyProfitKRW)}원
              <span className="text-[10px] ml-1">({isDailyProfit ? '+' : ''}{account.dailyProfitRate}%)</span>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2 self-end lg:self-center">
          <button
            onClick={onOpenPortfolioView}
            className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-semibold transition-colors border border-zinc-700"
          >
            <span>보유종목 ({account.holdings.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
          <button
            onClick={onResetAccount}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition-colors border border-zinc-750"
            title="모의투자 계좌 초기화 (자산 0원 / 10억 원 선택)"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">초기화</span>
          </button>
        </div>
      </div>

      {/* Dual Account Mini Banner: 5억 단기 vs 5억 중장기 */}
      {shortTermAccount && longTermAccount && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80 font-mono text-[11px]">
          {/* Short-Term Account Pill */}
          <div className="flex items-center justify-between bg-[#080c14] border border-amber-500/20 px-3 py-1.5 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="p-0.5 bg-amber-500/20 text-amber-400 rounded">
                <Zap className="w-3 h-3" />
              </span>
              <div>
                <span className="font-bold text-amber-300">단기 트레이딩 계좌</span>
                <span className="text-zinc-500 text-[10px] ml-1.5">({shortTermAccount.accountNumber})</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-200 font-bold">{formatKRW(shortTermAccount.totalAssetKRW)}원</span>
              <span className={`font-semibold ${stProfit ? 'text-red-400' : 'text-blue-400'}`}>
                {stProfit ? '+' : ''}{shortTermAccount.totalProfitRate}%
              </span>
              <span className="text-[10px] text-zinc-400">({shortTermAccount.holdings.length}종목)</span>
            </div>
          </div>

          {/* Long-Term Account Pill */}
          <div className="flex items-center justify-between bg-[#080c14] border border-blue-500/20 px-3 py-1.5 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="p-0.5 bg-blue-500/20 text-blue-400 rounded">
                <ShieldCheck className="w-3 h-3" />
              </span>
              <div>
                <span className="font-bold text-blue-300">중장기 가치투자 계좌</span>
                <span className="text-zinc-500 text-[10px] ml-1.5">({longTermAccount.accountNumber})</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-200 font-bold">{formatKRW(longTermAccount.totalAssetKRW)}원</span>
              <span className={`font-semibold ${ltProfit ? 'text-red-400' : 'text-blue-400'}`}>
                {ltProfit ? '+' : ''}{longTermAccount.totalProfitRate}%
              </span>
              <span className="text-[10px] text-zinc-400">({longTermAccount.holdings.length}종목)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
