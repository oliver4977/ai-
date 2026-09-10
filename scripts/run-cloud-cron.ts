/**
 * Cloud Scheduled AI Execution Script for GitHub Actions.
 * The laptop does not need to be running: GitHub Actions is the execution host.
 */
import { GoogleGenAI } from '@google/genai';
import { INITIAL_STOCKS } from '../src/data/mockStocks';
import { getLiveStockQuotes, getMarketSessionStatus } from '../server/marketService';
import {
  executeServerAutoTradeStep,
  loadServerFundState,
  getServerFundState,
} from '../server/backgroundFundWorker';

function getKstNow(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());
}

/**
 * The stock catalog is only a candidate universe (names/tickers/sectors).
 * Before the worker sees it, replace price/change/volume fields with the
 * freshest provider quote available. This prevents the static catalog from
 * influencing candidate ranking with stale demo prices.
 */
async function buildLiveCandidateUniverse() {
  const quotes = await getLiveStockQuotes(
    INITIAL_STOCKS.map((stock) => ({
      ticker: stock.ticker,
      market: stock.market,
      name: stock.name,
    }))
  );

  const liveUniverse = INITIAL_STOCKS
    .map((stock) => {
      const quote = quotes[stock.ticker];
      if (!quote || typeof quote.price !== 'number' || !Number.isFinite(quote.price) || quote.price <= 0) {
        return null;
      }

      return {
        ...stock,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        marketCap: quote.marketCap || stock.marketCap,
      };
    })
    .filter((stock): stock is NonNullable<typeof stock> => stock !== null);

  console.log(`📡 Live candidate quotes verified: ${liveUniverse.length}/${INITIAL_STOCKS.length}`);
  return liveUniverse;
}

async function main() {
  console.log('====================================================');
  console.log('🚀 [GitHub Actions Cloud Worker] AI Fund Cron Starting');
  console.log(`⏰ Current UTC Time: ${new Date().toISOString()}`);
  console.log(`🇰🇷 KST Time: ${getKstNow()}`);
  console.log('====================================================');

  loadServerFundState();
  const stateBefore = getServerFundState();

  console.log(
    `📊 Prior State: Cash ${stateBefore.masterAccount?.cashKRW?.toLocaleString() || 0} KRW | Daily Calls: ${stateBefore.quotaUsage?.dailyApiCalls || 0}/20`
  );

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ FATAL: GEMINI_API_KEY is not configured in GitHub Secrets.');
    process.exit(1);
  }

  console.log('🔑 GEMINI_API_KEY detected successfully.');
  console.log(`🇰🇷 KR session: ${JSON.stringify(getMarketSessionStatus('KR'))}`);
  console.log(`🇺🇸 US session: ${JSON.stringify(getMarketSessionStatus('US'))}`);

  const aiClient = new GoogleGenAI({ apiKey });

  try {
    // Only live-provider data is passed into the autonomous worker.
    // The worker still re-fetches and verifies the execution price immediately
    // before every simulated BUY/SELL, so this is not a trade-price fallback.
    const liveUniverse = await buildLiveCandidateUniverse();

    if (liveUniverse.length === 0) {
      console.log('🛑 No verified live quotes are available. Skipping AI call and trade safely.');
      return;
    }

    console.log('🔍 Executing AI Autonomous Scan & Decision Pipeline...');
    const decision = await executeServerAutoTradeStep(aiClient, liveUniverse);

    if (decision) {
      console.log('✅ [AI DECISION EXECUTED]');
      console.log(`- Action: ${decision.action}`);
      console.log(`- Ticker: ${decision.ticker} (${decision.name})`);
      console.log(`- Price: ${decision.price}`);
      console.log(`- Quantity: ${decision.quantity}`);
      console.log(`- Reason: ${decision.rawAIResponseSummary || '자동 AI 판단'}`);
    } else {
      console.log('ℹ️ No trade executed: market/session, interval, quota, live-data, or AI HOLD guard prevented execution.');
    }

    const stateAfter = getServerFundState();
    console.log('====================================================');
    console.log(`💰 Updated Master Cash: ${stateAfter.masterAccount?.cashKRW?.toLocaleString()} KRW`);
    console.log(`📈 Daily AI Quota Used: ${stateAfter.quotaUsage?.dailyApiCalls}/20`);
    console.log('🎉 Cloud execution completed.');
    console.log('====================================================');
  } catch (err: any) {
    console.error('❌ Error during AI Cron Execution:', err?.message || err);
    // Do not manufacture a trade or state change after an execution error.
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
