import { config } from './config/index.js';
import { snapshot } from './observer/index.js';
import { decide } from './reasoner/index.js';
import { execute } from './executor/index.js';
import { logEvent } from './log/index.js';
import { status as walletStatus, getXLayerAddress } from './skills/onchainos.js';
import { publicClient } from './wallet/client.js';

const seen = new Set<string>();

async function preflight(): Promise<string> {
  const s = await walletStatus();
  if (!s.loggedIn) {
    throw new Error('Onchain OS wallet not logged in. Run `npm run wallet:create -- you@example.com` first.');
  }
  const address = await getXLayerAddress();
  const block = await publicClient.getBlockNumber();
  logEvent({ type: 'boot', network: config.NETWORK, mode: config.STRATEGY_MODE, address, block: block.toString() });
  return address;
}

async function tick(address: string) {
  try {
    const events = await snapshot();
    let processed = 0;
    for (const event of events) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      processed++;

      const decision = await decide(event);
      const result = await execute(decision, event);
      logEvent({
        type: 'tick',
        network: config.NETWORK,
        mode: config.STRATEGY_MODE,
        agent: address,
        event,
        decision,
        result,
      });
    }
    if (processed === 0) {
      logEvent({ type: 'idle', network: config.NETWORK, agent: address, totalSeen: seen.size });
    }
  } catch (err) {
    logEvent({ type: 'error', message: (err as Error).message });
  }
}

async function main() {
  const address = await preflight();
  await tick(address);
  setInterval(() => tick(address), config.LOOP_INTERVAL_SECONDS * 1000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
