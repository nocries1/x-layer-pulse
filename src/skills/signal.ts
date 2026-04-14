// okx-dex-signal skill wrapper.
// Streams smart-money / KOL / whale activity per chain.
import { runCli } from './cli.js';

export type WalletType = '1' | '2' | '3'; // 1=smart money, 2=KOL, 3=whale

export interface RawSignal {
  amountUsd: string;
  chainIndex: string;
  cursor: string;
  price: string;
  soldRatioPercent: string;     // 100 = full sell
  timestamp: string;            // ms since epoch
  triggerWalletAddress: string; // comma-separated
  triggerWalletCount: string;
  walletType: WalletType;
  token: {
    name: string;
    symbol: string;
    tokenAddress: string;
    marketCapUsd?: string;
    holders?: string;
    top10HolderPercent?: string;
    logo?: string;
  };
}

export interface ListParams {
  chain: string;                 // e.g. xlayer
  walletType?: WalletType[];     // default: smart money + whales
  minAmountUsd?: number;
  minAddressCount?: number;
}

export async function listSignals(params: ListParams): Promise<RawSignal[]> {
  const args = ['signal', 'list', '--chain', params.chain];
  if (params.walletType?.length) args.push('--wallet-type', params.walletType.join(','));
  if (params.minAmountUsd !== undefined) args.push('--min-amount-usd', String(params.minAmountUsd));
  if (params.minAddressCount !== undefined) args.push('--min-address-count', String(params.minAddressCount));
  const r = await runCli<RawSignal[]>(args);
  return r.data ?? [];
}
