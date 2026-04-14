// Tiny static + SSE server. Tails logs/decisions.jsonl and pushes new lines
// to any connected dashboard. Also serves /dashboard/index.html.
import express from 'express';
import { createReadStream, statSync, watch } from 'node:fs';
import { join, resolve } from 'node:path';
import { chainId, config } from '../config/index.js';
import { LOG_FILE } from '../log/index.js';
import { runCli } from '../skills/cli.js';

const app = express();
const ROOT = resolve('.');

app.use(express.static(ROOT));

app.get('/', (_req, res) => {
  res.redirect('/dashboard/index.html');
});

app.get('/api/state', async (_req, res) => {
  // Return last 200 events as a JSON array
  try {
    const lines = await tailLines(LOG_FILE, 200);
    res.json(lines.map((l) => safeJson(l)).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/strategy', (_req, res) => {
  const minMcap = config.STRATEGY_MODE === 'demo' ? 10_000 : 100_000;
  res.json({
    network: config.NETWORK,
    chainId: chainId(),
    pollIntervalSec: config.LOOP_INTERVAL_SECONDS,
    copySizeUsdc: config.COPY_SIZE_USDC,
    minSignalUsd: config.MIN_SIGNAL_USD,
    minTriggerWallets: config.MIN_TRIGGER_WALLETS,
    maxSlippagePct: config.MAX_SLIPPAGE_PCT,
    maxRiskScore: 70,
    minMarketCapUsd: minMcap,
    model: config.CLAUDE_MODEL,
    anthropicEnabled: !!config.ANTHROPIC_API_KEY,
    safetyGates: [
      'Side must be BUY (sells are always skipped)',
      `Market cap ≥ $${minMcap.toLocaleString()}`,
      'Token risk score ≤ 70 / 100',
      `Signal amount ≥ $${config.MIN_SIGNAL_USD}`,
      `Concurring smart-money wallets ≥ ${config.MIN_TRIGGER_WALLETS}`,
      'Token contract address must be present',
    ],
  });
});

let walletCache: { at: number; data: unknown } | null = null;
app.get('/api/wallet', async (_req, res) => {
  if (walletCache && Date.now() - walletCache.at < 10_000) {
    return res.json(walletCache.data);
  }
  try {
    const [s, a] = await Promise.all([
      runCli(['wallet', 'status']),
      runCli(['wallet', 'addresses']),
    ]);
    const data = { status: s.data ?? null, addresses: a.data ?? null };
    walletCache = { at: Date.now(), data };
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/skills', async (_req, res) => {
  const lines = await tailLines(LOG_FILE, 10_000);
  let signals = 0;
  let copies = 0;
  let x402Spent = 0;
  let ticks = 0;
  for (const l of lines) {
    const obj = safeJson(l) as Record<string, unknown> | null;
    if (!obj || obj.type !== 'tick') continue;
    ticks++;
    const ev = obj.event as Record<string, unknown> | undefined;
    const result = obj.result as Record<string, unknown> | undefined;
    if (ev) signals++;
    if (result?.executed) copies++;
    const risk = ev?.riskCostUsd;
    if (typeof risk === 'number') x402Spent += risk;
  }
  res.json({
    skills: [
      {
        id: 'okx-agentic-wallet',
        name: 'Agentic Wallet',
        description: 'TEE-backed wallet. Private key never leaves the OKX secure enclave.',
        commands: ['wallet status', 'wallet login', 'wallet verify', 'wallet addresses', 'wallet balance'],
        file: 'src/skills/onchainos.ts',
        usage: `Boot + pre-flight identity · ${ticks} ticks`,
      },
      {
        id: 'okx-dex-signal',
        name: 'DEX Signal',
        description: 'Real-time feed of smart-money and whale wallet trades on X Layer.',
        commands: ['signal list'],
        file: 'src/skills/signal.ts',
        usage: `${signals} signals ingested`,
      },
      {
        id: 'okx-x402-payment',
        name: 'x402 Payment',
        description: 'Pays an HTTP 402 risk-score feed per token. Sign → retry → risk data.',
        commands: ['payment x402-pay'],
        file: 'src/skills/x402.ts',
        usage: `$${x402Spent.toFixed(2)} spent on risk lookups`,
      },
      {
        id: 'okx-dex-swap',
        name: 'DEX Swap',
        description: 'Aggregator swap execution across 500+ DEX sources (Uniswap V3 included).',
        commands: ['swap execute'],
        file: 'src/skills/swap.ts',
        usage: `${copies} copies executed`,
      },
    ],
    totals: { ticks, signals, copies, x402Spent },
  });
});

app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`event: hello\ndata: {}\n\n`);

  let lastSize = 0;
  try { lastSize = statSync(LOG_FILE).size; } catch { /* file may not exist yet */ }

  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15_000);

  const watcher = watch(LOG_FILE, { persistent: false }, () => {
    let size = 0;
    try { size = statSync(LOG_FILE).size; } catch { return; }
    if (size <= lastSize) { lastSize = size; return; }
    const stream = createReadStream(LOG_FILE, { start: lastSize, end: size });
    let buf = '';
    stream.on('data', (chunk) => (buf += chunk.toString()));
    stream.on('end', () => {
      lastSize = size;
      const lines = buf.split('\n').filter(Boolean);
      for (const line of lines) {
        const obj = safeJson(line);
        if (obj) res.write(`data: ${JSON.stringify(obj)}\n\n`);
      }
    });
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    watcher.close();
  });
});

function safeJson(line: string): unknown | null {
  try { return JSON.parse(line); } catch { return null; }
}

async function tailLines(file: string, n: number): Promise<string[]> {
  const { readFile } = await import('node:fs/promises');
  try {
    const content = await readFile(file, 'utf8');
    return content.trim().split('\n').slice(-n);
  } catch {
    return [];
  }
}

const port = config.SERVER_PORT;
app.listen(port, () => {
  console.log(`X Layer Pulse dashboard: http://localhost:${port}/dashboard/index.html`);
});
