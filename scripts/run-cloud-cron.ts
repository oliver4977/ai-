/**
 * Cloud Scheduled AI Execution Script for GitHub Actions
 * Runs autonomously even when the local computer is powered off.
 */
import { GoogleGenAI } from '@google/genai';
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
    console.warn('⚠️ WARNING: GEMINI_API_KEY is not configured in GitHub Secrets.');
    console.warn('Please add GEMINI_API_KEY to Repository Settings -> Secrets and variables -> Actions.');
    process.exit(0);
  }

  const aiClient = new GoogleGenAI({ apiKey });

  try {
    console.log('🔍 Executing AI Autonomous Scan & Decision Pipeline...');
    const decision = await executeServerAutoTradeStep(aiClient);

    if (decision) {
      console.log('✅ [AI DECISION EXECUTED]');
      console.log(`- Action: ${decision.action}`);
      console.log(`- Ticker: ${decision.ticker} (${decision.name})`);
      console.log(`- Price: ${decision.price}`);
      console.log(`- Quantity: ${decision.quantity}`);
      console.log(`- Reason: ${decision.rawAIResponseSummary || decision.rationales?.technical || '자동 AI 판단'}`);
    } else {
      console.log('ℹ️ Market conditions evaluated. AI decided to HOLD or market is closed.');
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
