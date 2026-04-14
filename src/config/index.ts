import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NETWORK: z.enum(['mainnet', 'testnet']).default('mainnet'),
  XLAYER_MAINNET_RPC: z.string().url().default('https://rpc.xlayer.tech'),
  XLAYER_TESTNET_RPC: z.string().url().default('https://testrpc.xlayer.tech'),
  XLAYER_MAINNET_CHAIN_ID: z.coerce.number().default(196),
  XLAYER_TESTNET_CHAIN_ID: z.coerce.number().default(195),

  STRATEGY_MODE: z.enum(['demo', 'conservative']).default('demo'),
  LOOP_INTERVAL_SECONDS: z.coerce.number().default(30),
  MIN_SIGNAL_USD: z.coerce.number().default(200),
  MIN_TRIGGER_WALLETS: z.coerce.number().default(2),
  MAX_SLIPPAGE_PCT: z.coerce.number().default(1),
  COPY_SIZE_USDC: z.coerce.number().default(1),

  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-6'),

  X402_RISK_URL: z.string().url().optional(),
  ONCHAINOS_BIN: z.string().optional(),
  SERVER_PORT: z.coerce.number().default(5174),
});

export const config = schema.parse(process.env);

export const chainName = () => (config.NETWORK === 'mainnet' ? 'xlayer' : 'xlayer-testnet');
export const chainId = () =>
  config.NETWORK === 'mainnet' ? config.XLAYER_MAINNET_CHAIN_ID : config.XLAYER_TESTNET_CHAIN_ID;
export const caip2 = () => `eip155:${chainId()}`;
