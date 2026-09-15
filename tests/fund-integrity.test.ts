import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fund-integrity-'));
process.env.FUND_STATE_FILE = path.join(directory, 'state.json');
const worker = await import('../server/backgroundFundWorker');
const originalFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new Error('Network forbidden in regression tests'); };
after(() => { globalThis.fetch = originalFetch; fs.rmSync(directory, { recursive: true }); });

test('paused automation does not evaluate or liquidate existing holdings', async () => {
  worker.resetServerFundState();
  const state = worker.getServerFundState();
  state.shortTermAccount.holdings.push({ ticker: 'TEST', market: 'US', quantity: 2, currentPrice: 10, averageBuyPrice: 20, aiStopLoss: 15 } as any);
  worker.updateServerAutoTradeStatus(false);
  const cash = state.shortTermAccount.cashKRW;
  assert.equal(await worker.executeServerAutoTradeStep(null), null);
  assert.equal(state.shortTermAccount.holdings.length, 1);
  assert.equal(state.shortTermAccount.cashKRW, cash);
  assert.equal(networkCalls, 0);
});

test('invalid quantities are rejected without price requests', async () => {
  for (const quantity of [NaN, Infinity, 0, -1, 1.5]) {
    const result = await worker.executeManualTrade({ ticker: 'TEST', name: 'TEST', market: 'US', side: 'BUY', quantity });
    assert.equal(result.executionStatus, 'ERROR');
  }
  assert.equal(networkCalls, 0);
});

test('concurrent account work is rejected and the lock is released', async () => {
  const request = { ticker: 'TEST', name: 'TEST', side: 'BUY' as const, quantity: 0 };
  const pending = worker.executeManualTrade(request);
  await assert.rejects(worker.executeManualTrade(request), /진행 중/);
  await pending;
  assert.equal((await worker.executeManualTrade(request)).executionStatus, 'ERROR');
});

test('manual scan cannot bypass the hourly schedule after a failure', async () => {
  worker.resetServerFundState();
  const quota = worker.getServerFundState().quotaUsage;
  quota.lastShortTermCallTime = Date.now() - 10 * 60_000;
  quota.lastShortTermFailed = true;
  await assert.rejects(worker.executeManualAIScan({}), /시간당 1회/);
  assert.equal(quota.dailyApiCalls, 0);
});

test('both strategies share a five-minute cooldown', async () => {
  worker.resetServerFundState();
  worker.getServerFundState().quotaUsage.lastShortTermCallTime = Date.now();
  await assert.rejects(worker.executeManualAIScan({}, 'VALUE_COMPOUNDING'), /5분 대기/);
});

test('atomic save round-trips and damaged files are never overwritten', () => {
  worker.resetServerFundState();
  worker.saveServerFundState();
  assert.equal(worker.loadServerFundState().shortTermAccount.cashKRW, 500000000);
  for (const invalid of ['{broken', '{}']) {
    fs.writeFileSync(process.env.FUND_STATE_FILE!, invalid);
    assert.throws(() => worker.loadServerFundState(), /원본을 보존/);
    assert.equal(fs.readFileSync(process.env.FUND_STATE_FILE!, 'utf8'), invalid);
  }
});
