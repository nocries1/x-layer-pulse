// okx-dex-swap skill wrapper.
import { runCliOrThrow } from './cli.js';

export interface SwapExecuteResult {
  txHash: string;
  fromTokenAmount?: string;
  toTokenAmount?: string;
  status?: string;
}

export async function executeSwap(params: {
  from: string;        // token symbol or contract address
  to: string;
  amount: string;      // minimal units
  chain: string;
  wallet: string;
  slippagePct?: number;
  mevProtection?: boolean;
}): Promise<SwapExecuteResult> {
  const args = [
    'swap', 'execute',
    '--from', params.from,
    '--to', params.to,
    '--amount', params.amount,
    '--chain', params.chain,
    '--wallet', params.wallet,
  ];
  if (params.slippagePct !== undefined) args.push('--slippage', String(params.slippagePct));
  if (params.mevProtection) args.push('--mev-protection');
  return runCliOrThrow<SwapExecuteResult>(args);
}
