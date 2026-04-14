import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../config/index.js';
import type { WhaleEvent } from '../observer/index.js';

const decisionSchema = z.object({
  action: z.enum(['copy', 'skip']),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});

export type Decision = z.infer<typeof decisionSchema> & { signalId: string; tokenSymbol: string };

const SYSTEM = `You are X Layer Pulse, an autonomous copy-trading agent that mirrors smart-money trades on X Layer.
You receive ONE whale event at a time: side, token, amountUsd, marketCapUsd, triggerWalletCount, walletType, riskScore.
Decide: copy or skip.
Rules of thumb:
- BUYs from 3+ smart-money wallets in agreement → strong copy
- High riskScore (>60) → skip
- Tiny market cap (<$50k) → skip (illiquid)
- Sells → almost always skip (we're a momentum buyer, not a profit-taker)
Respond ONLY with a JSON object: {"action","rationale","confidence"}.`;

export async function decide(event: WhaleEvent): Promise<Decision> {
  if (!config.ANTHROPIC_API_KEY) {
    // Heuristic fallback
    const tooRisky = (event.riskScore ?? 0) > 60;
    const tinyCap = event.marketCapUsd > 0 && event.marketCapUsd < 50_000;
    const isSell = event.side === 'sell';
    const hasConsensus = event.triggerWalletCount >= 3;
    const action: Decision['action'] =
      isSell || tooRisky || tinyCap ? 'skip' : hasConsensus ? 'copy' : 'skip';
    return {
      action,
      rationale: action === 'copy'
        ? `${event.triggerWalletCount} ${event.walletType} wallets bought ${event.tokenSymbol}`
        : `heuristic skip (${isSell ? 'sell' : tooRisky ? 'risky' : tinyCap ? 'illiquid' : 'low consensus'})`,
      confidence: action === 'copy' ? 0.7 : 0.9,
      signalId: event.id,
      tokenSymbol: event.tokenSymbol,
    };
  }

  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  const compact = {
    side: event.side,
    token: event.tokenSymbol,
    amountUsd: event.amountUsd,
    marketCapUsd: event.marketCapUsd,
    triggerWalletCount: event.triggerWalletCount,
    walletType: event.walletType,
    riskScore: event.riskScore,
  };
  const msg = await client.messages.create({
    model: config.CLAUDE_MODEL,
    max_tokens: 256,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(compact) }],
  });
  const text = msg.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No text in LLM response');
  const json = text.text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('No JSON in LLM response');
  const parsed = decisionSchema.parse(JSON.parse(json));
  return { ...parsed, signalId: event.id, tokenSymbol: event.tokenSymbol };
}
