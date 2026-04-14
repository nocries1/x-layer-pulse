import { config } from '../config/index.js';
import type { WhaleEvent } from '../observer/index.js';

export interface SafetyResult {
  ok: boolean;
  reasons: string[];
}

export function check(event: WhaleEvent): SafetyResult {
  const reasons: string[] = [];
  const minMcap = config.STRATEGY_MODE === 'demo' ? 10_000 : 100_000;

  if (event.side === 'sell') reasons.push('side=sell');
  if (event.marketCapUsd && event.marketCapUsd < minMcap) {
    reasons.push(`mcap ${event.marketCapUsd} < min ${minMcap}`);
  }
  if (event.riskScore !== null && event.riskScore > 70) reasons.push(`risk ${event.riskScore} > 70`);
  if (event.amountUsd < config.MIN_SIGNAL_USD) reasons.push(`amount ${event.amountUsd} < min ${config.MIN_SIGNAL_USD}`);
  if (!event.tokenAddress) reasons.push('missing tokenAddress');

  return { ok: reasons.length === 0, reasons };
}
