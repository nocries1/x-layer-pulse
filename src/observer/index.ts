import { listSignals, type RawSignal } from '../skills/signal.js';
import { fetchPaid } from '../skills/x402.js';
import { config, chainName } from '../config/index.js';

export type Side = 'buy' | 'sell';

export interface WhaleEvent {
  id: string;                    // unique cursor
  side: Side;
  tokenSymbol: string;
  tokenAddress: string;
  amountUsd: number;
  marketCapUsd: number;
  triggerWalletCount: number;
  walletType: 'smart-money' | 'kol' | 'whale';
  timestamp: number;
  riskScore: number | null;
  riskCostUsd: number;
  raw: RawSignal;
}

const WALLET_TYPE_LABEL = {
  '1': 'smart-money',
  '2': 'kol',
  '3': 'whale',
} as const;

function num(s: string | undefined | null): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function risk(token: string): Promise<{ score: number | null; costUsd: number }> {
  if (!config.X402_RISK_URL) return { score: null, costUsd: 0 };
  try {
    const res = await fetchPaid(`${config.X402_RISK_URL}?token=${encodeURIComponent(token)}`);
    if (!res.ok) return { score: null, costUsd: 0 };
    const body = (await res.json()) as { score?: number; costUsd?: number };
    return { score: body.score ?? null, costUsd: body.costUsd ?? 0 };
  } catch {
    return { score: null, costUsd: 0 };
  }
}

export async function snapshot(): Promise<WhaleEvent[]> {
  const raws = await listSignals({
    chain: chainName(),
    walletType: ['1', '3'],                       // smart money + whales
    minAmountUsd: config.MIN_SIGNAL_USD,
    minAddressCount: config.MIN_TRIGGER_WALLETS,
  });

  return Promise.all(
    raws.map(async (r): Promise<WhaleEvent> => {
      const soldPct = num(r.soldRatioPercent);
      const rk = await risk(r.token.tokenAddress);
      return {
        id: r.cursor,
        side: soldPct > 0 ? 'sell' : 'buy',
        tokenSymbol: r.token.symbol,
        tokenAddress: r.token.tokenAddress,
        amountUsd: num(r.amountUsd),
        marketCapUsd: num(r.token.marketCapUsd),
        triggerWalletCount: num(r.triggerWalletCount),
        walletType: WALLET_TYPE_LABEL[r.walletType] ?? 'whale',
        timestamp: num(r.timestamp),
        riskScore: rk.score,
        riskCostUsd: rk.costUsd,
        raw: r,
      };
    })
  );
}
