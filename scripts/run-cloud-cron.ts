/**
 * Cloud Scheduled AI Execution Script for GitHub Actions
 * Runs autonomously even when the local computer is powered off.
 */
import { GoogleGenAI } from '@google/genai';
import { INITIAL_STOCKS } from '../src/data/mockStocks';
import {
  executeServerAutoTradeStep,
  loadServerFundState,
  saveServerFundState,
  getServerFundState
} from '../server/backgroundFundWorker';

async function main() {
  console.log('====================================================');
  console.log('🚀 [GitHub Actions Cloud Worker] AI Fund Cron Starting');
  console.log(`⏰ Current UTC Time: ${new Date().toISOString()}`);
  console.log(`🇰🇷 KST Time: ${new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString()}`);
  console.log('====================================================');

  // Load persistent state
  loadServerFundState();
  const stateBefore = getServerFundState();

  console.log(`📊 Prior State: Cash ${stateBefore.masterAccount?.cashKRW?.toLocaleString() || 0} KRW | Daily Calls: ${stateBefore.quotaUsage?.dailyApiCalls || 0}/20`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ FATAL: GEMINI_API_KEY is not configured in GitHub Secrets!');
    console.error('Please ensure the secret name is exactly "GEMINI_API_KEY" in Repository Settings -> Secrets and variables -> Actions.');
    process.exit(1);
  }

  const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '***';
  console.log(`🔑 GEMINI_API_KEY detected successfully: ${maskedKey}`);

  const aiClient = new GoogleGenAI({ apiKey });

  try {
    console.log(`📚 AI candidate universe loaded: ${INITIAL_STOCKS.length} stocks`);
    console.log('🔍 Executing AI Autonomous Scan & Decision Pipeline...');

    // The worker defaults to an empty universe when no universe is supplied.
    // Passing INITIAL_STOCKS is required for cloud autonomous scanning.
    // Candidate prices are still resolved through getLiveStockQuotes before an AI decision/trade.
    const decision = await executeServerAutoTradeStep(aiClient, INITIAL_STOCKS);

    if (decision) {
      console.log('✅ [AI DECISION EXECUTED]');
      console.log(`- Action: ${decision.action}`);
      console.log(`- Ticker: ${decision.ticker} (${decision.name})`);
      console.log(`- Price: ${decision.price}`);
      console.log(`- Quantity: ${decision.quantity}`);
      console.log(`- Reason: ${decision.rawAIResponseSummary || decision.rationales?.technical || '자동 AI 판단'}`);
    } else {
      console.log('ℹ️ No AI trade executed: market closed, interval/quota guard active, no valid live quote, or AI returned HOLD.');
    }

    const stateAfter = getServerFundState();
    console.log('====================================================');
    console.log(`💰 Updated Master Cash: ${stateAfter.masterAccount?.cashKRW?.toLocaleString()} KRW`);
    console.log(`📈 Daily AI Quota Used: ${stateAfter.quotaUsage?.dailyApiCalls}/20`);
    console.log('🎉 AI Execution Completed Successfully.');
    console.log('====================================================');
  } catch (err: any) {
    console.error('❌ Error during AI Cron Execution:', err?.message || err);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
