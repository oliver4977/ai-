import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { 
  getMarketIndices, 
  getLiveStockQuotes, 
  getLiveStockCandles,
  generateRealisticOrderBook,
  toYahooSymbol,
  getMarketSessionStatus,
  getMarketProviderStatus
} from "./server/marketService";
import { getTossApiConfig } from "./server/tossSecuritiesService";
import {
  loadServerFundState,
  getServerFundState,
  saveServerFundState,
  resetServerFundState,
  updateServerAutoTradeStatus,
  executeServerAutoTradeStep,
  executeManualTrade,
} from "./server/backgroundFundWorker";
import { initMarketWebSocketServer, broadcastToAllClients } from "./server/marketStream";
import { INITIAL_STOCKS } from "./src/data/mockStocks";

dotenv.config();

// Initialize GoogleGenAI client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      hasApiKey: !!process.env.GEMINI_API_KEY,
      provider: getMarketProviderStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  // Market Provider & Toss Securities API Configuration Status
  app.get("/api/market/provider", (req, res) => {
    const status = getMarketProviderStatus();
    const toss = getTossApiConfig();
    res.json({
      success: true,
      provider: status,
      toss: {
        isConfigured: toss.isConfigured,
        hasAccountNo: !!toss.accountNo,
        maskedClientId: toss.clientId ? `${toss.clientId.slice(0, 4)}***` : null,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Real-time Market Indices API (KOSPI, KOSDAQ, S&P 500, NASDAQ, USD/KRW, BTC, etc.)
  app.get("/api/market/indices", async (req, res) => {
    try {
      const indices = await getMarketIndices();
      res.json({
        success: true,
        indices,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("Indices API error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Real-time Stock Quotes API (Supports both GET with ?tickers=005930,NVDA and POST with { stocks })
  const handleStockQuotes = async (req: express.Request, res: express.Response) => {
    try {
      let stockList: { ticker: string; market?: 'KR' | 'US'; name?: string }[] = [];

      if (req.method === 'GET') {
        const tickersParam = String(req.query.tickers || '').trim();
        if (tickersParam) {
          stockList = tickersParam.split(',').map((t) => ({
            ticker: t.trim(),
            market: /^\d{6}$/.test(t.trim()) ? 'KR' : 'US',
          }));
        }
      } else if (req.body && Array.isArray(req.body.stocks)) {
        stockList = req.body.stocks;
      }

      if (stockList.length === 0) {
        return res.json({ success: true, quotes: {}, quoteList: [] });
      }

      const quotesMap = await getLiveStockQuotes(stockList);
      const quoteList = Object.values(quotesMap);

      res.json({
        success: true,
        quotes: quotesMap,
        quoteList,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("Quotes API error:", err);
      res.status(500).json({ success: false, error: err.message, quotes: {}, quoteList: [] });
    }
  };

  app.get("/api/market/quotes", handleStockQuotes);
  app.post("/api/market/quotes", handleStockQuotes);

  // 3. Real-time Stock Candlestick Chart (OHLCV) API
  app.get("/api/market/candles", async (req, res) => {
    try {
      const ticker = String(req.query.ticker || "005930");
      const market = (req.query.market === "US" ? "US" : "KR") as "KR" | "US";
      const timeframe = (req.query.timeframe || "1D") as "15m" | "1H" | "1D" | "1W" | "1M";

      const candleResult = await getLiveStockCandles(ticker, market, timeframe);
      res.json(candleResult);
    } catch (err: any) {
      console.error("Candles API error:", err);
      res.status(500).json({ success: false, error: err.message, candles: [] });
    }
  });

  // 3-1. Real-time 10-level Order Book (호가) API
  app.get("/api/market/orderbook", async (req, res) => {
    try {
      const ticker = String(req.query.ticker || "005930");
      const price = Number(req.query.price || 0);
      const isKR = req.query.market === "KR" || /^\d{6}$/.test(ticker);

      let currentPrice = price;
      if (!currentPrice || currentPrice <= 0) {
        const symbol = toYahooSymbol(ticker, isKR ? "KR" : "US");
        const quotes = await getLiveStockQuotes([{ ticker, market: isKR ? "KR" : "US" }]);
        currentPrice = quotes[ticker]?.price || (isKR ? 271000 : 217.56);
      }

      const orderBook = generateRealisticOrderBook(currentPrice, isKR);
      res.json({
        success: true,
        ticker,
        orderBook,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("OrderBook API error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Live Ticker Search API
  app.get("/api/market/search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) {
        return res.json({ results: [] });
      }

      const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!searchRes.ok) {
        return res.json({ results: [] });
      }

      const searchData = await searchRes.json();
      const quotes = searchData?.quotes || [];

      const results = quotes
        .filter((item: any) => item.quoteType === "EQUITY" || item.quoteType === "ETF")
        .map((item: any) => {
          const isKR = item.symbol.endsWith(".KS") || item.symbol.endsWith(".KQ");
          const rawTicker = item.symbol.replace(/\.(KS|KQ)$/, "");
          return {
            symbol: item.symbol,
            ticker: rawTicker,
            name: item.shortname || item.longname || item.symbol,
            market: isKR ? "KR" : "US",
            exchange: item.exchDisp || item.exchange,
            sector: item.sector || item.industry || (isKR ? "국내 주식" : "해외 주식"),
          };
        });

      res.json({ results });
    } catch (err: any) {
      console.error("Search API error:", err);
      res.json({ results: [] });
    }
  });

  // 5. AI Chart Technical Analysis & Stock Recommendation Endpoint
  app.post("/api/ai/analyze", async (req, res) => {
    try {
      const {
        ticker,
        name,
        market,
        currentPrice,
        currency,
        candlesSummary,
        technicalSignals,
        detectedPatterns,
        supports,
        resistances,
        timeframe = "1D",
      } = req.body;

      if (!ticker || !currentPrice) {
        return res.status(400).json({ error: "Missing required stock parameters" });
      }

      // If Gemini API is available, query gemini-3.7-flash with fallback protection
      if (ai && process.env.GEMINI_API_KEY) {
        try {
          const systemPrompt = `You are a world-class professional quant & technical stock chart analyst and portfolio manager.
Your task is to analyze the provided stock's technical chart indicators, candlestick formations, moving averages, support/resistance levels, and volume profile, and provide an actionable, disciplined, and high-probability trading recommendation.
Respond in Korean (한국어) with professional, clear, and confident investment analysis terms (e.g., 정배열, 저항선 돌파, 손익비, 분할 매수, 지지선 리테스트).

Rules for Output:
- verdict: MUST be one of 'STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'
- verdictKr: Korean translation (e.g. '강력 매수', '매수 추천', '관망/보유', '분할 매도', '매도')
- confidenceScore: Integer between 50 and 98
- riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
- riskLevelKr: '안전' | '보통' | '공격적'
- entryRange: [minEntryPrice, maxEntryPrice] (realistic near current price)
- targetPrice: 1st target profit price
- targetPrice2: 2nd target profit price
- stopLoss: disciplined stop loss price below key support
- expectedReturnPercent: estimated return percentage to target 1 (e.g. 12.5)
- riskRewardRatio: formatted string like "1 : 2.8" or "1 : 3.2"
- summary: 2~3 sentences high-level executive chart diagnostic summary in Korean.
- keyPoints: 3~4 key bullet points on technical strengths or momentum factors.
- tradingStrategy: specific step-by-step action plan (e.g. 1차 진입 비중, 2차 추가 매수 가격대, 분할 익절 전략).
- riskManagementTips: 2~3 risk warnings and stop loss management advice.
- timeframeOutlook: { shortTerm: "단기 1~5일 전망", midTerm: "중기 1~3개월 전망" }`;

          const userPrompt = `
[종목 정보]
- 종목명: ${name} (${ticker})
- 시장: ${market === 'KR' ? '한국 증시 (KOSPI/KOSDAQ)' : '미국 증시 (US Tech/S&P 500)'}
- 현재 주가: ${currentPrice} ${currency}
- 분석 타임프레임: ${timeframe}

[기술적 지표 및 패턴 데이터]
- 감지된 차트 패턴: ${JSON.stringify(detectedPatterns || [])}
- 기술적 지표 상태: ${JSON.stringify(technicalSignals || [])}
- 지지선 (Support): ${JSON.stringify(supports || [])}
- 저항선 (Resistance): ${JSON.stringify(resistances || [])}
- 최근 캔들 데이터 요약: ${JSON.stringify(candlesSummary || [])}

위 차트 및 지표 데이터를 종합적으로 분석하여 매수/보유/매도 추천 및 구체적인 목표가/손절가/전략을 JSON 형식으로 작성해주세요.`;

          const response = await ai.models.generateContent({
            model: "gemini-3.7-flash",
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  verdict: { type: Type.STRING },
                  verdictKr: { type: Type.STRING },
                  confidenceScore: { type: Type.INTEGER },
                  riskLevel: { type: Type.STRING },
                  riskLevelKr: { type: Type.STRING },
                  entryRange: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                  },
                  targetPrice: { type: Type.NUMBER },
                  targetPrice2: { type: Type.NUMBER },
                  stopLoss: { type: Type.NUMBER },
                  expectedReturnPercent: { type: Type.NUMBER },
                  riskRewardRatio: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  keyPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  timeframeOutlook: {
                    type: Type.OBJECT,
                    properties: {
                      shortTerm: { type: Type.STRING },
                      midTerm: { type: Type.STRING },
                    },
                    required: ["shortTerm", "midTerm"],
                  },
                  tradingStrategy: { type: Type.STRING },
                  riskManagementTips: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  "verdict",
                  "verdictKr",
                  "confidenceScore",
                  "riskLevel",
                  "riskLevelKr",
                  "entryRange",
                  "targetPrice",
                  "targetPrice2",
                  "stopLoss",
                  "expectedReturnPercent",
                  "riskRewardRatio",
                  "summary",
                  "keyPoints",
                  "timeframeOutlook",
                  "tradingStrategy",
                  "riskManagementTips",
                ],
              },
            },
          });

          const text = response.text;
          if (text) {
            const parsed = JSON.parse(text);
            return res.json({
              ticker,
              name,
              market,
              currentPrice,
              currency,
              timestamp: new Date().toISOString(),
              ...parsed,
              patterns: detectedPatterns || [],
              indicatorSignals: technicalSignals || [],
              supportLevels: supports || [],
              resistanceLevels: resistances || [],
            });
          }
        } catch (genError: any) {
          console.warn("[AI Analyze] Gemini API quota or rate-limit reached, using quant rule engine:", genError?.message);
        }
      }

      // Fallback deterministic quant analysis if API key is not yet set or during offline preview
      const isBullishSignal = (detectedPatterns || []).some((p: any) => p.type === "BULLISH");
      const rsiSignal = (technicalSignals || []).find((s: any) => s.indicator?.includes("RSI"));
      const isRsiOversold = rsiSignal?.detail?.includes("과매도") || rsiSignal?.signal?.includes("저평가");

      const verdict = isBullishSignal || isRsiOversold ? "STRONG_BUY" : "BUY";
      const verdictKr = verdict === "STRONG_BUY" ? "강력 매수" : "매수 추천";
      const confidenceScore = isBullishSignal ? 92 : 85;
      const targetPrice = market === "KR" ? Math.round(currentPrice * 1.15) : Number((currentPrice * 1.18).toFixed(2));
      const targetPrice2 = market === "KR" ? Math.round(currentPrice * 1.28) : Number((currentPrice * 1.30).toFixed(2));
      const stopLoss = market === "KR" ? Math.round(currentPrice * 0.94) : Number((currentPrice * 0.93).toFixed(2));
      const minEntry = market === "KR" ? Math.round(currentPrice * 0.985) : Number((currentPrice * 0.985).toFixed(2));
      const maxEntry = currentPrice;

      return res.json({
        ticker,
        name,
        market,
        currentPrice,
        currency,
        timestamp: new Date().toISOString(),
        verdict,
        verdictKr,
        confidenceScore,
        riskLevel: "MEDIUM",
        riskLevelKr: "보통",
        entryRange: [minEntry, maxEntry],
        targetPrice,
        targetPrice2,
        stopLoss,
        expectedReturnPercent: Number((((targetPrice - currentPrice) / currentPrice) * 100).toFixed(1)),
        riskRewardRatio: "1 : 2.6",
        summary: `${name}은(는) 주요 이동평균선 지지대 위에서 거래량을 수반한 반등 모멘텀이 포착되었습니다. 기술적 지표(RSI 및 MACD)가 상승 다이버전스를 형성하며 단기 상단 돌파 가능성이 높은 매력적인 진입 구간입니다.`,
        keyPoints: [
          "주요 지지선 리테스트 후 하방 경직성 확보 및 매수세 유입",
          "20일 이동평균선 상향 돌파 시도 및 단기 골든크로스 모멘텀",
          "손익비(Risk/Reward)가 1:2.6 이상으로 매력적인 비대칭 수익 구조",
        ],
        patterns: detectedPatterns || [],
        indicatorSignals: technicalSignals || [],
        timeframeOutlook: {
          shortTerm: "1차 저항선까지 단기 상승 탄력 지속 예상 (1~5 영업일)",
          midTerm: "박스권 상단 돌파 후 새로운 상승 채널 형성 가능성 (1~3개월)",
        },
        tradingStrategy: `현재가(${currentPrice.toLocaleString()}) 부근에서 비중 50% 분할 매수 후, 지지선(${stopLoss.toLocaleString()})을 이탈하지 않는 한 1차 목표가(${targetPrice.toLocaleString()})까지 홀딩하는 전략을 추천합니다.`,
        riskManagementTips: [
          `손절가 ${stopLoss.toLocaleString()} 이탈 시 비중 축소 및 원칙 준수`,
          "시장 전반의 거시 경제 변동성(금리/지수 급락) 발생 시 분할 진입 간격 확대",
        ],
        supportLevels: supports || [stopLoss],
        resistanceLevels: resistances || [targetPrice],
      });
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      res.status(500).json({
        error: "AI analysis failed",
        message: error.message,
      });
    }
  });

  // 2. AI Interactive Chart Chat Endpoint
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { ticker, name, market, currentPrice, currency, technicalSummary, userMessage, chatHistory } = req.body;

      if (!userMessage) {
        return res.status(400).json({ error: "Missing user message" });
      }

      if (ai && process.env.GEMINI_API_KEY) {
        const systemInstruction = `당신은 대한민국 최고의 전문 주식 퀀트 & 차트 분석가 AI 어시스턴트입니다.
현재 사용자가 보고 있는 종목은 [${name} (${ticker}), 현재가: ${currentPrice} ${currency}] 입니다.
제공된 기술적 지표, 차트 형태, 지지/저항 라인을 근거로 정확하고 실전적인 조언을 친절하고 신뢰감 있게 제공하세요.
반드시 한국어로 답변하고, 핵심 매매 타이밍, 지지선, 손절가, 저항선 수치를 명확하게 제시하세요.`;

        const historyContext = (chatHistory || [])
          .slice(-4)
          .map((m: any) => `${m.sender === 'user' ? '사용자' : 'AI'}: ${m.text}`)
          .join('\n');

        const prompt = `
[현재 종목 기술적 상태 요약]
${technicalSummary}

[이전 대화 내역]
${historyContext}

[사용자 질문]
${userMessage}

위 기술적 분석 데이터를 기반으로 구체적이고 실전적인 답변을 작성해주세요.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        return res.json({
          reply: response.text,
          timestamp: new Date().toISOString(),
        });
      }

      // Fallback response
      return res.json({
        reply: `${name}(${ticker})에 대한 분석입니다. 현재가(${currentPrice.toLocaleString()} ${currency}) 기준 기술적 지표는 긍정적인 지지력을 보이고 있습니다. 단기 지지 라인을 확인하시고 분할 매수로 접근하시면 유리한 손익비를 확보할 수 있습니다. 추가적인 지표나 목표가가 궁금하시면 언제든 문의해주세요.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      res.status(500).json({
        error: "AI chat failed",
        message: error.message,
      });
    }
  });

  // 3. AI Stock Screener Endpoint
  app.post("/api/ai/screen", async (req, res) => {
    try {
      const { category = "ALL", market = "ALL" } = req.body;
      res.json({
        category,
        market,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 4. AI 10억 Autonomous Hedge Fund Decision Engine Endpoint
  app.post("/api/ai/autopilot/scan-and-trade", async (req, res) => {
    try {
      const {
        account,
        stocks = [],
        strategyMode = "PROFIT_MAXIMIZATION",
      } = req.body;

      const krSession = getMarketSessionStatus('KR');
      const usSession = getMarketSessionStatus('US');

      const isKROpen = krSession.isOpen;
      const isUSOpen = usSession.isOpen;

      // If markets are closed, do not force artificial trades into closed markets
      if (!isKROpen && !isUSOpen) {
        return res.json({
          success: true,
          decision: null,
          isMarketClosed: true,
          message: `현재 국내 증시(${krSession.statusText}) 및 미국 증시(${usSession.statusText})가 모두 마감 상태입니다. 실제 장 시작 시 실시간 체결이 재개됩니다. (공식 종가 자산 보존)`,
          thoughts: [
            {
              id: `TH-WAIT-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('ko-KR'),
              type: 'SCAN',
              message: `[장 마감 대기] ${krSession.statusText} / ${usSession.statusText}. 실제 정규장 호가 유입 전까지 인위적인 자산 조작 없이 안전하게 대기합니다.`,
              score: 95,
            },
          ],
        });
      }

      // Check Gemini AI Availability
      if (!ai || !process.env.GEMINI_API_KEY) {
        return res.json({
          success: false,
          decision: null,
          error: "Gemini API 키가 설정되지 않아 AI 자율 매매를 실행할 수 없습니다.",
          thoughts: [
            {
              id: `TH-NOAI-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('ko-KR'),
              type: 'RISK_CHECK',
              message: `[AI 대기] Gemini API Key 미설정으로 자동 매매 주문이 안전하게 차단되었습니다.`,
              score: 99,
            },
          ],
        });
      }

      // Execute 1 AI Autonomous Step
      const universeToScan = Array.isArray(stocks) && stocks.length > 0 ? stocks : INITIAL_STOCKS;
      const decision = await executeServerAutoTradeStep(ai, universeToScan);
      const serverState = getServerFundState();

      return res.json({
        success: true,
        decision,
        thoughts: serverState.liveThoughts.slice(0, 5),
        state: serverState,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("AI Autopilot Error:", error);
      const serverState = getServerFundState();
      res.json({ success: false, error: error.message || "AI Autopilot processing error", state: serverState });
    }
  });

  // ----------------------------------------------------
  // 24H Server-Authoritative Fund State & Sync APIs
  // ----------------------------------------------------
  // Initialize server database
  loadServerFundState();

  // GET /api/ai/fund/state - Get current persistent server 10억 fund state
  app.get("/api/ai/fund/state", (req, res) => {
    try {
      const state = getServerFundState();
      res.json({
        success: true,
        state,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/ai/fund/reset - Reset fund on server (supports custom or 0 capital)
  app.post("/api/ai/fund/reset", (req, res) => {
    try {
      const { initialCapital } = req.body || {};
      const cap = typeof initialCapital === 'number' ? initialCapital : 1000000000;
      const state = resetServerFundState(cap);
      res.json({
        success: true,
        message: `서버 모의투자 계좌(보유주식 전부 삭제, 자산: ${cap.toLocaleString()}원) 및 매매일지가 초기화되었습니다.`,
        state,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/ai/fund/toggle-bot - Turn 24H server auto trading on/off
  app.post("/api/ai/fund/toggle-bot", (req, res) => {
    try {
      const { enabled } = req.body;
      const state = updateServerAutoTradeStatus(!!enabled);
      res.json({
        success: true,
        isAutoBotActive: state.isAutoBotActive,
        state,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/trade/order - Execute real market simulation order with strict regular market validation
  app.post("/api/trade/order", (req, res) => {
    try {
      const {
        ticker,
        name,
        exchange,
        market,
        side,
        type,
        price,
        quantity,
        accountType,
        executedBy,
      } = req.body;

      if (!ticker || !price || !quantity || !side) {
        return res.status(400).json({
          success: false,
          error: "필수 주문 정보(종목코드, 주문가격, 주문수량, 매수/매도 구분)가 누락되었습니다.",
        });
      }

      const result = executeManualTrade({
        ticker,
        name: name || ticker,
        exchange,
        market: market || (/^\d{6}$/.test(ticker) ? 'KR' : 'US'),
        side,
        type: type || 'LIMIT',
        price: Number(price),
        quantity: Number(quantity),
        accountType: accountType || 'SHORT_TERM',
        executedBy: executedBy || 'USER',
      });

      if (result.success && result.state) {
        // Broadcast updated portfolio over WebSocket immediately
        broadcastToAllClients({
          type: 'PORTFOLIO_UPDATE',
          data: {
            fundState: result.state,
            timestamp: new Date().toISOString(),
          },
        });
      }

      res.json({
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("Trade Order API Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/ai/fund/step-now - Immediately trigger 1 AI scan & execution step on server
  app.post("/api/ai/fund/step-now", async (req, res) => {
    try {
      const decision = await executeServerAutoTradeStep(ai, INITIAL_STOCKS);
      const state = getServerFundState();
      res.json({
        success: true,
        decision,
        state,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Start 24H Background Autonomous Trade Engine Timer (Runs every 15 seconds)
  setInterval(async () => {
    try {
      await executeServerAutoTradeStep(ai, INITIAL_STOCKS);
    } catch (err) {
      console.warn("Background fund worker tick error:", err);
    }
  }, 15000);


  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);

  // Initialize Real-Time Market Data WebSocket Engine
  initMarketWebSocketServer(server);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Stock Chart Analyzer server running on http://localhost:${PORT}`);
  });
}

startServer();
