import React, { useState } from 'react';
import { RefreshCw, X, AlertTriangle, CheckCircle2, DollarSign, Trash2 } from 'lucide-react';

interface AccountResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: (initialCapitalKRW: number) => Promise<void>;
  currentCapital: number;
}

export const AccountResetModal: React.FC<AccountResetModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
  currentCapital,
}) => {
  const [selectedOption, setSelectedOption] = useState<'zero' | '1b' | '100m' | 'custom'>('1b');
  const [customAmountText, setCustomAmountText] = useState('100000000');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleExecuteReset = async () => {
    let targetAmount = 1000000000;
    if (selectedOption === 'zero') {
      targetAmount = 0;
    } else if (selectedOption === '1b') {
      targetAmount = 1000000000;
    } else if (selectedOption === '100m') {
      targetAmount = 100000000;
    } else if (selectedOption === 'custom') {
      const parsed = parseInt(customAmountText.replace(/,/g, ''), 10);
      targetAmount = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }

    setIsSubmitting(true);
    try {
      await onConfirmReset(targetAmount);
      onClose();
    } catch (e) {
      console.error('Reset execution failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f141c] border border-zinc-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#141b24]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">모의투자 시뮬레이션 계좌 초기화</h3>
              <p className="text-[11px] text-zinc-400">보유 주식을 전량 삭제하고 새 시뮬레이션을 시작합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <div className="leading-relaxed text-[11px]">
              <strong>초기화 시 주의사항:</strong> 현재 보유 중인 모든 주식 포트폴리오와 체결 내역 및 AI 매매일지가 즉시 삭제되며 영구히 리셋됩니다.
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">초기 시뮬레이션 자산 설정</label>
            
            {/* Option 1: Zero assets */}
            <div
              onClick={() => setSelectedOption('zero')}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                selectedOption === 'zero'
                  ? 'bg-red-500/10 border-red-500/50 text-white'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedOption === 'zero' ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">자산 0원 완전 초기화</div>
                  <div className="text-[10px] text-zinc-400">보유주식 전부 삭제 + 예수금 0원 (자산 0원)</div>
                </div>
              </div>
              <div className="text-xs font-mono font-bold text-red-400">0 KRW</div>
            </div>

            {/* Option 2: 1 Billion KRW standard */}
            <div
              onClick={() => setSelectedOption('1b')}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                selectedOption === '1b'
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-white'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedOption === '1b' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">기본 10억 원 펀드 리셋 (권장)</div>
                  <div className="text-[10px] text-zinc-400">보유주식 전부 삭제 + 현금 1,000,000,000원 충전</div>
                </div>
              </div>
              <div className="text-xs font-mono font-bold text-cyan-400">1,000,000,000 KRW</div>
            </div>

            {/* Option 3: 100 Million KRW */}
            <div
              onClick={() => setSelectedOption('100m')}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                selectedOption === '100m'
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedOption === '100m' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">실전형 1억 원 리셋</div>
                  <div className="text-[10px] text-zinc-400">보유주식 전부 삭제 + 현금 100,000,000원 충전</div>
                </div>
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400">100,000,000 KRW</div>
            </div>

            {/* Option 4: Custom amount */}
            <div
              onClick={() => setSelectedOption('custom')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                selectedOption === 'custom'
                  ? 'bg-purple-500/10 border-purple-500/50 text-white'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-white">사용자 직접 입력 금액 리셋</div>
                <span className="text-[10px] text-purple-400 font-mono font-bold">자유 설정</span>
              </div>
              {selectedOption === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    value={customAmountText}
                    onChange={(e) => setCustomAmountText(e.target.value)}
                    placeholder="초기 예수금 입력 (원)"
                    className="w-full bg-[#090d14] border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-xs text-zinc-400 font-bold whitespace-nowrap">원</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-800 bg-[#141b24]">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-750 rounded-xl transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleExecuteReset}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-lg shadow-red-950/40 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
            <span>{isSubmitting ? '초기화 진행 중...' : '확인 및 계좌 초기화'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
