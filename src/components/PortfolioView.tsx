import React, { useState } from 'react';
import { 
  SimulationAccount, 
  HoldingStock, 
  OrderRecord, 
  StockItem,
  ExchangeCategory,
  ApiQuotaUsage
} from '../types';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieIcon, 
  History, 
  Bot, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Activity,
  Layers,
  Zap
} from 'lucide-react';

interface PortfolioViewProps {
  account: SimulationAccount;
  shortTermAccount?: SimulationAccount;
  longTermAccount?: SimulationAccount;
  quotaUsage?: ApiQuotaUsage;
  stocks: StockItem[];
  onSelectStock: (stock: StockItem) => void;
  onQuickSellAll: (ticker: string) => void;
  onQuickBuyMore: (ticker: string) => void;
  onOpenAIRebalanceModal: () => void;
  isAiRebalancing: boolean;
  onOpenResetModal?: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  account,
  shortTermAccount,
  longTermAccount,
  quotaUsage,
  stocks,
  onSelectStock,
  onQuickSellAll,
  onQuickBuyMore,
  onOpenAIRebalanceModal,
  isAiRebalancing,
  onOpenResetModal,
}) => {
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<'ALL' | 'SHORT_TERM' | 'LONG_TERM'>('ALL');
  const [activeSubTab, setActiveSubTab] = useState<'HOLDINGS' | 'ORDERS' | 'ALLOCATION'>('HOLDINGS');
  const [exchangeFilter, setExchangeFilter] = useState<'ALL' | 'KOSPI' | 'KOSDAQ' | 'NASDAQ'>('ALL');

  // Determine active displayed account
  const currentDisplayedAccount = 
    selectedAccountFilter === 'SHORT_TERM' && shortTermAccount
      ? shortTermAccount
      : selectedAccountFilter === 'LONG_TERM' && longTermAccount
      ? longTermAccount
      : account;

  const formatKRW = (val: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(val));
  };

  const isTotalProfit = currentDisplayedAccount.totalEvaluationProfitKRW >= 0;

  // Filter holdings
  const filteredHoldings = currentDisplayedAccount.holdings.filter((h) => {
    if (exchangeFilter === 'ALL') return true;
    return h.exchange === exchangeFilter;
  });

  // Calculate allocation metrics
  const totalHoldingsEvaluation = currentDisplayedAccount.holdings.reduce((sum, h) => sum + h.totalEvaluationAmount, 0);
  const kospiTotal = currentDisplayedAccount.holdings.filter(h => h.exchange === 'KOSPI').reduce((sum, h) => sum + h.totalEvaluationAmount, 0);
  const kosdaqTotal = currentDisplayedAccount.holdings.filter(h => h.exchange === 'KOSDAQ').reduce((sum, h) => sum + h.totalEvaluationAmount, 0);
  const nasdaqTotal = currentDisplayedAccount.holdings.filter(h => h.exchange === 'NASDAQ').reduce((sum, h) => sum + h.totalEvaluationAmount, 0);
  const cashTotal = currentDisplayedAccount.cashKRW + currentDisplayedAccount.cashUSD * currentDisplayedAccount.exchangeRateUSD_KRW;

  const totalAsset = currentDisplayedAccount.totalAssetKRW || 1;
  const kospiPct = Number(((kospiTotal / totalAsset) * 100).toFixed(1));
  const kosdaqPct = Number(((kosdaqTotal / totalAsset) * 100).toFixed(1));
  const nasdaqPct = Number(((nasdaqTotal / totalAsset) * 100).toFixed(1));
  const cashPct = Number(((cashTotal / totalAsset) * 100).toFixed(1));

  return (
    <div className="space-y-4 font-sans">
      {/* 0. Account Selector Pills (전체 10억 / 단기 5억 / 중장기 5억) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0e131d] border border-zinc-800 p-2.5 rounded-xl">
        <div className="flex items-center gap-1.5 bg-[#080b11] p-1 rounded-lg border border-zinc-750 text-xs font-semibold">
          <button
            onClick={() => setSelectedAccountFilter('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              selectedAccountFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            <span>통합 계좌 (10억원)</span>
          </button>

          <button
            onClick={() => setSelectedAccountFilter('SHORT_TERM')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              selectedAccountFilter === 'SHORT_TERM'
                ? 'bg-amber-600 text-white shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>단기 트레이딩 계좌 (5억원)</span>
            {shortTermAccount && (
              <span className="text-[10px] px-1 bg-black/30 rounded font-mono">
                {shortTermAccount.holdings.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedAccountFilter('LONG_TERM')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              selectedAccountFilter === 'LONG_TERM'
                ? 'bg-indigo-600 text-white shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
            <span>중장기 가치투자 계좌 (5억원)</span>
            {longTermAccount && (
              <span className="text-[10px] px-1 bg-black/30 rounded font-mono">
                {longTermAccount.holdings.length}
              </span>
            )}
          </button>
        </div>

        {quotaUsage && (
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="px-2.5 py-1 bg-[#080c14] border border-blue-500/20 rounded-lg text-cyan-300">
              ⚡ 단기 호출: {quotaUsage.shortTermCalls}/18회
            </span>
            <span className="px-2.5 py-1 bg-[#080c14] border border-indigo-500/20 rounded-lg text-indigo-300">
              💎 중장기 호출: {quotaUsage.longTermCalls}/2회
            </span>
          </div>
        )}
      </div>

      {/* 1. Account Financial Card (증권앱 종합잔고 헤더) */}
      <div className="bg-[#0e131d] border border-zinc-800 rounded-xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{currentDisplayedAccount.accountName}</span>
              <span className="text-xs text-zinc-400 font-mono">({currentDisplayedAccount.accountNumber})</span>
              <span className="px-2 py-0.5 bg-blue-900/40 text-blue-300 border border-blue-700/60 rounded text-[10px] font-bold">
                {selectedAccountFilter === 'SHORT_TERM' ? '단기 모멘텀 자율운용' : selectedAccountFilter === 'LONG_TERM' ? '중장기 밸류 자율운용' : 'AI 자율 통합운용'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              실제 한국거래소(KRX) & 미국 나스닥(NASDAQ) 실시간 시세 연동 모의투자 포트폴리오
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            {onOpenResetModal && (
              <button
                onClick={onOpenResetModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 rounded-lg text-xs font-semibold transition-all"
                title="보유 주식 전부 청산 및 계좌 자산(0원 / 10억 원) 초기화"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <span>계좌 초기화 (0원/10억)</span>
              </button>
            )}
            <button
              onClick={onOpenAIRebalanceModal}
              disabled={isAiRebalancing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-900/30 transition-all"
            >
              <Bot className="w-4 h-4" />
              <span>AI 포트폴리오 리밸런싱 진단</span>
              {isAiRebalancing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            </button>
          </div>
        </div>

        {/* Account Financial Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-4 font-mono">
          <div className="bg-[#080b11] p-3 rounded-lg border border-zinc-800">
            <div className="text-[11px] text-zinc-400 font-sans">총 평가금액</div>
            <div className="text-base sm:text-lg font-bold text-white tracking-tight mt-1">
              {formatKRW(currentDisplayedAccount.totalAssetKRW)}
              <span className="text-xs text-zinc-400 ml-0.5">원</span>
            </div>
          </div>

          <div className="bg-[#080b11] p-3 rounded-lg border border-zinc-800">
            <div className="text-[11px] text-zinc-400 font-sans">총 평가손익</div>
            <div className={`text-base sm:text-lg font-bold tracking-tight mt-1 ${isTotalProfit ? 'text-red-400' : 'text-blue-400'}`}>
              {isTotalProfit ? '+' : ''}{formatKRW(currentDisplayedAccount.totalEvaluationProfitKRW)}원
            </div>
          </div>

          <div className="bg-[#080b11] p-3 rounded-lg border border-zinc-800">
            <div className="text-[11px] text-zinc-400 font-sans">총 수익률</div>
            <div className={`text-base sm:text-lg font-bold tracking-tight mt-1 flex items-center gap-1 ${isTotalProfit ? 'text-red-400' : 'text-blue-400'}`}>
              {isTotalProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{isTotalProfit ? '+' : ''}{currentDisplayedAccount.totalProfitRate}%</span>
            </div>
          </div>

          <div className="bg-[#080b11] p-3 rounded-lg border border-zinc-800">
            <div className="text-[11px] text-zinc-400 font-sans">원화 예수금 (KRW)</div>
            <div className="text-sm sm:text-base font-bold text-zinc-200 mt-1">
              {formatKRW(currentDisplayedAccount.cashKRW)}원
            </div>
          </div>

          <div className="bg-[#080b11] p-3 rounded-lg border border-zinc-800">
            <div className="text-[11px] text-zinc-400 font-sans">외화 예수금 (USD)</div>
            <div className="text-sm sm:text-base font-bold text-zinc-200 mt-1">
              ${currentDisplayedAccount.cashUSD.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#080b11] p-3 rounded-lg border border-zinc-800">
            <div className="text-[11px] text-zinc-400 font-sans">적용 환율 (USD/KRW)</div>
            <div className="text-sm sm:text-base font-bold text-zinc-300 mt-1">
              {currentDisplayedAccount.exchangeRateUSD_KRW.toFixed(1)}원
            </div>
          </div>
        </div>

        {/* Visual Asset Allocation Bar */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
            <span>자산 배분 비중</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> 코스피 {kospiPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-500" /> 코스닥 {kosdaqPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> 나스닥 {nasdaqPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 현금 {cashPct}%
              </span>
            </div>
          </div>

          {/* Allocation Progress Bar */}
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden flex">
            <div style={{ width: `${kospiPct}%` }} className="bg-blue-500 transition-all" title={`KOSPI ${kospiPct}%`} />
            <div style={{ width: `${kosdaqPct}%` }} className="bg-cyan-500 transition-all" title={`KOSDAQ ${kosdaqPct}%`} />
            <div style={{ width: `${nasdaqPct}%` }} className="bg-purple-500 transition-all" title={`NASDAQ ${nasdaqPct}%`} />
            <div style={{ width: `${cashPct}%` }} className="bg-emerald-500 transition-all" title={`CASH ${cashPct}%`} />
          </div>
        </div>
      </div>

      {/* 2. Sub Tabs: [보유종목 잔고 (Holdings)] / [체결/주문내역 (Orders)] */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#0e131d] border border-zinc-800 p-2.5 rounded-xl">
        <div className="flex items-center gap-1 bg-[#080b11] border border-zinc-750 p-0.5 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('HOLDINGS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              activeSubTab === 'HOLDINGS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>보유종목 잔고 ({currentDisplayedAccount.holdings.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ORDERS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              activeSubTab === 'ORDERS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>주문/체결 이력 ({currentDisplayedAccount.orders.length})</span>
          </button>
        </div>

        {/* Exchange Filter: [전체] [코스피] [코스닥] [나스닥] */}
        {activeSubTab === 'HOLDINGS' && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-zinc-400 mr-1 text-[11px]">시장 필터:</span>
            {(['ALL', 'KOSPI', 'KOSDAQ', 'NASDAQ'] as const).map((ex) => (
              <button
                key={ex}
                onClick={() => setExchangeFilter(ex)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  exchangeFilter === ex
                    ? 'bg-zinc-750 text-white border border-zinc-600'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                {ex === 'ALL' ? '전체' : ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Holdings Table Content */}
      {activeSubTab === 'HOLDINGS' ? (
        <div className="bg-[#0e131d] border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#090d14] text-zinc-400 font-semibold border-b border-zinc-800 text-[11px]">
                <tr>
                  <th className="py-3 px-4">종목명 / 티커</th>
                  <th className="py-3 px-3 text-right">보유수량</th>
                  <th className="py-3 px-3 text-right">평균매입가</th>
                  <th className="py-3 px-3 text-right">현재가</th>
                  <th className="py-3 px-3 text-right">평가금액</th>
                  <th className="py-3 px-3 text-right">평가손익 (수익률)</th>
                  <th className="py-3 px-3 text-right">비중(%)</th>
                  <th className="py-3 px-4">AI 퀀트 진단 / 목표가</th>
                  <th className="py-3 px-4 text-center">빠른 매매</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850 font-mono">
                {filteredHoldings.length > 0 ? (
                  filteredHoldings.map((h) => {
                    const isProfit = h.evaluationProfit >= 0;
                    const stockObj = stocks.find((s) => s.ticker === h.ticker) || {
                      ticker: h.ticker,
                      name: h.name,
                      market: h.market,
                      exchange: h.exchange,
                      currency: h.currency,
                      sector: '주식',
                      price: h.currentPrice,
                      change: 0,
                      changePercent: 0,
                      volume: 0,
                      marketCap: '-',
                      week52High: 0,
                      week52Low: 0,
                      aiScore: 85,
                      aiVerdict: h.aiVerdict,
                      keyTag: h.aiActionNote,
                      description: '',
                    };

                    return (
                      <tr
                        key={h.ticker}
                        className="hover:bg-zinc-850/60 transition-colors group cursor-pointer"
                        onClick={() => onSelectStock(stockObj)}
                      >
                        {/* Name & Ticker */}
                        <td className="py-3 px-4 font-sans">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white text-xs group-hover:text-blue-400 transition-colors">
                              {h.name}
                            </span>
                            <span className="text-[10px] px-1 py-0.2 bg-zinc-800 text-zinc-300 rounded font-mono">
                              {h.exchange}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                              h.strategyTrack === 'VALUE_COMPOUNDING'
                                ? 'bg-blue-950 text-blue-300 border border-blue-700/60'
                                : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                            }`}>
                              {h.strategyTrack === 'VALUE_COMPOUNDING' ? '💎 5억 가치' : '⚡ 5억 단타'}
                            </span>
                            {h.isFallbackGenerated && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-red-950/80 text-red-300 border border-red-800">
                                ⚠️ 과거 Fallback 매수분
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{h.ticker}</div>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-3 text-right font-bold text-zinc-100">
                          {h.quantity.toLocaleString()}주
                        </td>

                        {/* Avg Buy Price */}
                        <td className="py-3 px-3 text-right text-zinc-300">
                          {h.currency === 'KRW' ? `${formatKRW(h.averageBuyPrice)}원` : `$${h.averageBuyPrice.toFixed(2)}`}
                        </td>

                        {/* Current Price */}
                        <td className="py-3 px-3 text-right font-bold text-zinc-100">
                          {h.currency === 'KRW' ? `${formatKRW(h.currentPrice)}원` : `$${h.currentPrice.toFixed(2)}`}
                        </td>

                        {/* Evaluation Amount */}
                        <td className="py-3 px-3 text-right font-bold text-white">
                          {formatKRW(h.totalEvaluationAmount)}원
                        </td>

                        {/* Profit & Rate */}
                        <td className={`py-3 px-3 text-right font-bold ${isProfit ? 'text-red-400' : 'text-blue-400'}`}>
                          <div>{isProfit ? '+' : ''}{formatKRW(h.evaluationProfit)}원</div>
                          <div className="text-[10px] font-semibold">({isProfit ? '+' : ''}{h.profitRate}%)</div>
                        </td>

                        {/* Allocation % */}
                        <td className="py-3 px-3 text-right text-zinc-300">
                          <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-[11px] font-semibold">
                            {h.allocationPercent}%
                          </span>
                        </td>

                        {/* AI Verdict */}
                        <td className="py-3 px-4 font-sans max-w-xs">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                h.aiVerdict === 'STRONG_BUY'
                                  ? 'bg-red-950/80 text-red-300 border border-red-800'
                                  : 'bg-blue-950/80 text-blue-300 border border-blue-800'
                              }`}
                            >
                              {h.aiVerdict === 'STRONG_BUY' ? '강력 매수' : '보유 유지'}
                            </span>
                            <span className="text-[11px] text-zinc-300 truncate" title={h.aiActionNote}>
                              {h.aiActionNote}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            목표: {h.currency === 'KRW' ? `${formatKRW(h.aiTargetPrice)}원` : `$${h.aiTargetPrice}`} / 손절: {h.currency === 'KRW' ? `${formatKRW(h.aiStopLoss)}원` : `$${h.aiStopLoss}`}
                          </div>
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onQuickBuyMore(h.ticker)}
                              className="px-2 py-1 bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-800/80 rounded text-[10px] font-bold transition-colors"
                              title="추가 매수"
                            >
                              + 매수
                            </button>
                            <button
                              onClick={() => onQuickSellAll(h.ticker)}
                              className="px-2 py-1 bg-blue-950/70 hover:bg-blue-900/80 text-blue-300 border border-blue-800/80 rounded text-[10px] font-bold transition-colors"
                              title="전량 매도"
                            >
                              - 전량매도
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-500 font-sans">
                      현재 보유 중인 종목이 없습니다. 차트/호가주문 화면에서 매수를 진행해보세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Orders & Trade History Table */
        <div className="bg-[#0e131d] border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#090d14] text-zinc-400 font-semibold border-b border-zinc-800 text-[11px]">
                <tr>
                  <th className="py-3 px-4">체결일시</th>
                  <th className="py-3 px-3">주문ID</th>
                  <th className="py-3 px-4">종목명 / 티커</th>
                  <th className="py-3 px-3">구분</th>
                  <th className="py-3 px-3">주문유형</th>
                  <th className="py-3 px-3 text-right">체결단가</th>
                  <th className="py-3 px-3 text-right">체결수량</th>
                  <th className="py-3 px-3 text-right">총 체결금액</th>
                  <th className="py-3 px-3 text-center">실행 주체</th>
                  <th className="py-3 px-4">AI 투자 사유 (Reasoning)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850 font-mono">
                {currentDisplayedAccount.orders.length > 0 ? (
                  currentDisplayedAccount.orders.map((ord) => {
                    const isBuy = ord.side === 'BUY';
                    return (
                      <tr key={ord.id} className="hover:bg-zinc-850/60 transition-colors">
                        <td className="py-3 px-4 text-zinc-400 text-[11px]">{ord.timestamp}</td>
                        <td className="py-3 px-3 text-zinc-500 text-[10px]">
                          <div>{ord.id}</div>
                          {ord.requestId && <div className="text-[9px] text-zinc-600 font-mono">{ord.requestId}</div>}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-bold text-white">{ord.name}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">({ord.ticker})</span>
                            {ord.isFallbackGenerated && (
                              <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-red-950/80 text-red-300 border border-red-800">
                                ⚠️ Fallback 과거기록
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isBuy ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-blue-950 text-blue-400 border border-blue-800'
                            }`}
                          >
                            {isBuy ? '매수' : '매도'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-300 text-[11px]">{ord.type}</td>
                        <td className="py-3 px-3 text-right font-bold text-zinc-100">
                          {ord.ticker.length === 6 ? `${formatKRW(ord.price)}원` : `$${ord.price.toFixed(2)}`}
                        </td>
                        <td className="py-3 px-3 text-right text-zinc-200 font-bold">{ord.quantity}주</td>
                        <td className="py-3 px-3 text-right font-bold text-white">{formatKRW(ord.totalAmount)}원</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              ord.executedBy === 'AI_AGENT'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {ord.executedBy === 'AI_AGENT' ? 'AI 봇' : '사용자'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans text-zinc-300 text-xs max-w-sm">
                          {ord.reasoning || '-'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-500 font-sans">
                      체결된 주문 내역이 없습니다. (초기 원화 예수금 10억 원 가용 상태)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
