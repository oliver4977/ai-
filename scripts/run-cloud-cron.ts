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
 * Toss's current market-data group has a low per-second request limit.
 * Fetch in small sequential batches so a cloud run does not create a burst
 * of dozens of simultaneous quote requests. The worker immediately reuses
 * these 4-second in-memory quotes, so it does not need to request them again.
 */
async function buildLiveCandidateUniverse() {
  const stocks = INITIAL_STOCKS.map((stock) => ({
    ticker: stock.ticker,
    market: stock.market,
    name: stock.name,
  }));

  const mergedQuotes: Record<string, any> = {};
  const BATCH_SIZE = 5;

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const batch = stocks.slice(i, i + BATCH_SIZE);
    const batchQuotes = await getLiveStockQuotes(batch);
    Object.assign(mergedQuotes, batchQuotes);

    // Keep a small gap between provider request bursts.
    if (i + BATCH_SIZE < stocks.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  const liveUniverse = INITIAL_STOCKS
    .map((stock) => {
      const quote = mergedQuotes[stock.ticker];
      if (!quote || typeof quote.price !== 'number' || !Number.isFinite(quote.price) || quote.price <= 0) {
        return null;
      }

      return {
        ...stock,
        // Candidate prices and momentum now come from the live provider.
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
    // The catalog supplies only identity/metadata. All price/momentum fields
    // used by the cloud worker are refreshed from live providers first.
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
    // Never manufacture a trade or state change after an execution error.
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
