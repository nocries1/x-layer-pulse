import { executeSwap } from '../skills/swap.js';
import { getXLayerAddress } from '../skills/onchainos.js';
import { config, chainName } from '../config/index.js';
import { check } from './safety.js';
import type { Decision } from '../reasoner/index.js';
import type { WhaleEvent } from '../observer/index.js';

export interface ExecutionResult {
  executed: boolean;
  reason: string;
  txHash?: string;
  tokenSymbol?: string;
}

export async function execute(decision: Decision, event: WhaleEvent): Promise<ExecutionResult> {
  if (decision.action !== 'copy') {
    return { executed: false, reason: `decision=${decision.action}` };
  }
  const safety = check(event);
  if (!safety.ok) return { executed: false, reason: `safety: ${safety.reasons.join('; ')}` };

  // Mainnet hard-disabled inside the autonomous loop. The single proof tx
  // goes through `npm run swap:once`.
  if (config.NETWORK !== 'testnet') {
    return {
      executed: false,
      reason: 'autonomous executor disabled on mainnet (use swap:once for proof tx)',
      tokenSymbol: event.tokenSymbol,
    };
  }

  try {
    const wallet = await getXLayerAddress();
    // COPY_SIZE_USDC USDC → target token
    const amount = String(BigInt(Math.round(config.COPY_SIZE_USDC * 1_000_000)));
    const result = await executeSwap({
      from: 'usdc',
      to: event.tokenAddress,
      amount,
      chain: chainName(),
      wallet,
      slippagePct: config.MAX_SLIPPAGE_PCT,
    });
    return { executed: true, reason: 'copied', txHash: result.txHash, tokenSymbol: event.tokenSymbol };
  } catch (err) {
    return { executed: false, reason: `swap failed: ${(err as Error).message}`, tokenSymbol: event.tokenSymbol };
  }
}
