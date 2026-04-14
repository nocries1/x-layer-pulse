// THE single mainnet proof tx for X Layer Pulse.
// 1 USDC → OKB on X Layer mainnet via the DEX swap aggregator.
//
// Prereqs:
//   - NETWORK=mainnet in .env
//   - Onchain OS wallet logged in (`npm run wallet:status` → loggedIn:true)
//   - Wallet funded with ~$2 USDC + a sliver of OKB for gas
//
// Output: real txHash printed + logged.

import { config, chainName } from '../config/index.js';
import { executeSwap } from '../skills/swap.js';
import { getXLayerAddress } from '../skills/onchainos.js';
import { logEvent } from '../log/index.js';

async function main() {
  if (config.NETWORK !== 'mainnet') {
    throw new Error('Refusing to run: set NETWORK=mainnet in .env first.');
  }
  const wallet = await getXLayerAddress();
  const params = {
    from: 'usdc',
    to: 'okb',
    amount: '1000000', // 1 USDC, 6 decimals
    chain: chainName(),
    wallet,
    slippagePct: config.MAX_SLIPPAGE_PCT,
  };
  logEvent({ type: 'swap.submit', params });
  const result = await executeSwap(params);
  logEvent({ type: 'swap.confirmed', ...result });
  console.log(`\n✅ Mainnet swap complete: ${result.txHash}`);
  console.log(`Explorer: https://www.oklink.com/xlayer/tx/${result.txHash}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
