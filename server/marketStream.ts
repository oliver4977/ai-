import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  getMarketIndices,
  getLiveStockQuotes,
  getMarketSessionStatus,
  MarketIndexItem,
  LiveQuoteItem,
} from './marketService';
import {
  getServerFundState,
  updateHoldingsMarketPrices,
  ServerFundState,
} from './backgroundFundWorker';
import { FULL_EXPANDED_STOCK_DATABASE } from '../src/data/fullStockUniverse';

interface ClientSubscription {
  ws: WebSocket;
  isAlive: boolean;
  subscribedTickers: Set<string>;
}

const activeClients: Map<WebSocket, ClientSubscription> = new Map();
let wss: WebSocketServer | null = null;
let broadcastIntervalId: NodeJS.Timeout | null = null;
let heartbeatIntervalId: NodeJS.Timeout | null = null;

// High priority default tickers to always keep fresh in real-time
const CORE_WATCH_TICKERS = [
  '005930', // 삼성전자
  '000660', // SK하이닉스
  '373220', // LG에너지솔루션
  '200710', // 에이비엘바이오 (KOSDAQ)
  '247540', // 에코프로비엠 (KOSDAQ)
  '086520', // 에코프로 (KOSDAQ)
  'NVDA',   // 엔비디아
  'TSLA',   // 테슬라
  'AAPL',   // 애플
  'MSFT',   // 마이크로소프트
  'AMZN',   // 아마존
  'GOOGL',  // 구글
];

let globalQuoteCache: Record<string, LiveQuoteItem> = {};
let globalIndicesCache: MarketIndexItem[] = [];
let rotationIndex = 0;

export function initMarketWebSocketServer(server: http.Server) {
  wss = new WebSocketServer({ server, path: '/ws/market' });

  wss.on('connection', (ws: WebSocket, req) => {
    const subscription: ClientSubscription = {
      ws,
      isAlive: true,
      subscribedTickers: new Set(CORE_WATCH_TICKERS),
    };
    activeClients.set(ws, subscription);

    // Heartbeat ping-pong
    ws.on('pong', () => {
      subscription.isAlive = true;
    });

    // Handle incoming client messages (e.g. ticker subscription, ping)
    ws.on('message', (messageRaw: string) => {
      try {
        const msg = JSON.parse(messageRaw.toString());
        if (msg.type === 'SUBSCRIBE' && Array.isArray(msg.tickers)) {
          msg.tickers.forEach((t: string) => {
            if (t && typeof t === 'string') subscription.subscribedTickers.add(t);
          });
        } else if (msg.type === 'UNSUBSCRIBE' && Array.isArray(msg.tickers)) {
          msg.tickers.forEach((t: string) => {
            subscription.subscribedTickers.delete(t);
          });
        } else if (msg.type === 'PING') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        }
      } catch (err) {
        // Ignore invalid message format
      }
    });

    ws.on('close', () => {
      activeClients.delete(ws);
    });

    ws.on('error', () => {
      activeClients.delete(ws);
    });

    // Send immediate INIT_STATE with currently cached quotes, indices & portfolio
    const currentFundState = getServerFundState();
    const initPayload = {
      type: 'INIT_STATE',
      data: {
        quotes: globalQuoteCache,
        indices: globalIndicesCache,
        marketStatusKR: getMarketSessionStatus('KR'),
        marketStatusUS: getMarketSessionStatus('US'),
        fundState: currentFundState,
        timestamp: new Date().toISOString(),
      },
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(initPayload));
    }
  });

  // Start background tick loop
  startMarketDataStreamingLoop();

  // Heartbeat check every 20 seconds to prune dead connections
  heartbeatIntervalId = setInterval(() => {
    activeClients.forEach((sub, ws) => {
      if (!sub.isAlive) {
        activeClients.delete(ws);
        return ws.terminate();
      }
      sub.isAlive = false;
      ws.ping();
    });
  }, 20000);

  console.log('✅ Real-Time Market WebSocket Server initialized at /ws/market');
}

// Broadcast JSON payload to all active open clients
export function broadcastToAllClients(payload: any) {
  if (!wss || activeClients.size === 0) return;
  const jsonStr = JSON.stringify(payload);
  activeClients.forEach((sub, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(jsonStr);
    }
  });
}

// Main real-time market data streaming loop (runs every 2 seconds)
function startMarketDataStreamingLoop() {
  if (broadcastIntervalId) clearInterval(broadcastIntervalId);

  let isFetching = false;

  broadcastIntervalId = setInterval(async () => {
    if (isFetching) return;
    isFetching = true;

    try {
      // 1. Collect all subscribed tickers + active holdings tickers + core tickers
      const fundState = getServerFundState();
      const holdingTickers = [
        ...(fundState.shortTermAccount?.holdings || []).map((h) => h.ticker),
        ...(fundState.longTermAccount?.holdings || []).map((h) => h.ticker),
      ];

      const allActiveTickerSet = new Set<string>([...CORE_WATCH_TICKERS, ...holdingTickers]);
      activeClients.forEach((sub) => {
        sub.subscribedTickers.forEach((t) => allActiveTickerSet.add(t));
      });

      // 2. Also select a rotating batch of 8 universe stocks so all stocks stay updated
      const universeSize = FULL_EXPANDED_STOCK_DATABASE.length;
      const rotatingBatchSize = 8;
      const rotatingTickers: { ticker: string; market?: 'KR' | 'US'; name?: string }[] = [];

      for (let i = 0; i < rotatingBatchSize; i++) {
        const idx = (rotationIndex + i) % universeSize;
        const item = FULL_EXPANDED_STOCK_DATABASE[idx];
        if (item) {
          allActiveTickerSet.add(item.ticker);
          rotatingTickers.push({ ticker: item.ticker, market: item.market, name: item.name });
        }
      }
      rotationIndex = (rotationIndex + rotatingBatchSize) % universeSize;

      // 3. Build stocks array to fetch
      const tickersToFetch: { ticker: string; market?: 'KR' | 'US'; name?: string }[] = Array.from(
        allActiveTickerSet
      ).map((t) => {
        const found = FULL_EXPANDED_STOCK_DATABASE.find((s) => s.ticker === t);
        return {
          ticker: t,
          market: found ? found.market : /^\d{6}$/.test(t) ? 'KR' : 'US',
          name: found?.name,
        };
      });

      // 4. Fetch real quotes and indices in parallel from live market provider
      const [indicesResult, quotesResult] = await Promise.allSettled([
        getMarketIndices(),
        getLiveStockQuotes(tickersToFetch),
      ]);

      let updatedIndices = globalIndicesCache;
      if (indicesResult.status === 'fulfilled' && indicesResult.value.length > 0) {
        updatedIndices = indicesResult.value;
        globalIndicesCache = updatedIndices;
      }

      let updatedQuotes = globalQuoteCache;
      if (quotesResult.status === 'fulfilled') {
        updatedQuotes = { ...globalQuoteCache, ...quotesResult.value };
        globalQuoteCache = updatedQuotes;
      }

      // 5. Extract latest USD/KRW exchange rate from indices
      const usdKrwItem = updatedIndices.find((idx) => idx.symbol === 'KRW=X' || idx.name.includes('환율'));
      const liveUsdKrw = usdKrwItem && usdKrwItem.price > 1000 ? usdKrwItem.price : undefined;

      // 6. Extract raw numeric price map for all fetched stocks
      const pricesMap: Record<string, number> = {};
      Object.entries(updatedQuotes).forEach(([ticker, quote]) => {
        if (quote && typeof quote.price === 'number' && quote.price > 0) {
          pricesMap[ticker] = quote.price;
        }
      });

      // 7. Update holdings market prices and auto-recalculate fund portfolio valuations
      const portfolioValuationChanged = updateHoldingsMarketPrices(pricesMap, liveUsdKrw);
      const latestFundState = getServerFundState();

      // 8. Broadcast real-time PRICE_UPDATE to all WebSocket clients
      const priceUpdatePayload = {
        type: 'PRICE_UPDATE',
        data: {
          quotes: updatedQuotes,
          indices: updatedIndices,
          marketStatusKR: getMarketSessionStatus('KR'),
          marketStatusUS: getMarketSessionStatus('US'),
          exchangeRateUSD_KRW: liveUsdKrw || latestFundState.account.exchangeRateUSD_KRW,
          timestamp: new Date().toISOString(),
        },
      };

      broadcastToAllClients(priceUpdatePayload);

      // 9. If portfolio valuation or holdings changed, also broadcast PORTFOLIO_UPDATE
      if (portfolioValuationChanged) {
        broadcastToAllClients({
          type: 'PORTFOLIO_UPDATE',
          data: {
            fundState: latestFundState,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      console.warn('Market streaming loop tick warning:', err);
    } finally {
      isFetching = false;
    }
  }, 2000);
}
