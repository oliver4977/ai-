import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  RefreshCw,
  User,
  MessageSquare
} from 'lucide-react';
import { StockItem, AIAnalysisResult, ChatMessage } from '../types';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  stock?: StockItem;
  selectedStock?: StockItem;
  analysis?: AIAnalysisResult | null;
  latestAnalysis?: AIAnalysisResult | null;
}

const DEFAULT_SUGGESTIONS = [
  '현재가에서 지금 바로 진입해도 괜찮을까요?',
  '손절 기준가와 1차/2차 목표가 설정 근거가 무엇인가요?',
  'RSI 및 MACD 보조지표 상태를 쉽게 설명해주세요.',
  '향후 예상되는 단기/중기 차트 시나리오는?',
];

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  isOpen,
  onClose,
  stock: propStock,
  selectedStock,
  analysis: propAnalysis,
  latestAnalysis,
}) => {
  const stock = propStock || selectedStock || {
    ticker: '005930',
    name: '삼성전자',
    market: 'KR' as const,
    exchange: 'KOSPI' as const,
    currency: 'KRW' as const,
    price: 56000,
    change: 0,
    changePercent: 0,
    volume: 1000000,
    sector: 'IT',
    week52High: 85000,
    week52Low: 50000,
    aiScore: 88,
  };

  const analysis = propAnalysis || latestAnalysis || null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with greeting whenever stock changes
  useEffect(() => {
    if (!stock) return;
    setMessages([
      {
        id: '1',
        sender: 'ai',
        text: `**${stock.name} (${stock.ticker})** 퀀트 차트 분석 세션입니다. 현재가 **${(stock.price || 0).toLocaleString()} ${stock.currency || 'KRW'}** 기준, 기술적 지표와 포지션 시나리오에 대해 질의하실 수 있습니다.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedPrompts: DEFAULT_SUGGESTIONS,
      },
    ]);
  }, [stock?.ticker, stock?.name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const technicalSummary = analysis
        ? `[종목: ${stock.name} (${stock.ticker}), 현재가: ${stock.price} ${stock.currency}]
- AI 의견: ${analysis.verdictKr} (신뢰도: ${analysis.confidenceScore}점)
- 목표가: 1차 ${analysis.targetPrice}, 2차 ${analysis.targetPrice2}
- 손절가: ${analysis.stopLoss} (적정 진입가: ${analysis.entryRange?.[0]} ~ ${analysis.entryRange?.[1]})
- 지표 진단: ${JSON.stringify(analysis.indicatorSignals || [])}
- 감지 패턴: ${JSON.stringify(analysis.patterns || [])}
- 요약: ${analysis.summary}`
        : `[종목: ${stock.name} (${stock.ticker}), 현재가: ${stock.price} ${stock.currency}, 변동률: ${stock.changePercent}%]`;

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: stock.ticker,
          name: stock.name,
          market: stock.market,
          currentPrice: stock.price,
          currency: stock.currency,
          technicalSummary,
          userMessage: textToSend,
          chatHistory: messages,
        }),
      });

      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.reply || '답변을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `${stock.name}에 대한 분석 답변입니다. 현재 차트는 ${analysis?.verdictKr || '매수 관점'}을 유지하고 있으며, 지지선(${analysis?.stopLoss ? analysis.stopLoss.toLocaleString() : '기준가'})을 리스크 관리 기준으로 설정하시기를 권장합니다.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[#0e121a] border-l border-white/[0.08] shadow-2xl flex flex-col text-slate-100 font-sans">
      {/* Header */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-4 h-4 text-zinc-400" />
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
              <span>{stock.name}</span>
              <span className="font-mono text-zinc-500">({stock.ticker})</span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">Quant Research Chat</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-zinc-500 font-mono">
              <span>{msg.sender === 'ai' ? 'QUANT-AI' : 'INVESTOR'}</span>
              <span>· {msg.timestamp}</span>
            </div>

            <div
              className={`p-3 rounded-lg max-w-[90%] leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'bg-zinc-900/60 border border-zinc-800 text-zinc-200'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Suggestions */}
              {msg.suggestedPrompts && (
                <div className="mt-2.5 pt-2 border-t border-zinc-800/80 space-y-1">
                  <div className="text-[10px] text-zinc-500 font-mono">Suggested Questions:</div>
                  {msg.suggestedPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(p)}
                      className="w-full text-left text-[11px] p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 text-zinc-300 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-400 text-xs p-2.5 bg-zinc-900/40 border border-zinc-800 rounded-lg max-w-[80%]">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
            <span className="text-xs font-mono">Analyzing chart data...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/90">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="차트나 매매 전략에 대해 질문하세요..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-sans"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-md disabled:opacity-40 disabled:pointer-events-none transition-colors font-semibold"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

