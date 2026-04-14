# 🐋 X Layer Pulse

> **OKX Build X Hackathon 2026 — X Layer Arena**
> Real-time smart-money copy-trading agent with a live dashboard. Built end-to-end on Onchain OS skills.

X Layer Pulse watches whale and smart-money trades on X Layer in real time, asks Claude whether to copy each one, and mirrors the high-conviction moves from a TEE-backed Onchain OS Agentic Wallet — all visible on a single live dashboard updated over Server-Sent Events.

---

## 1. Project intro

Every loop, X Layer Pulse:

1. **Observes** smart-money + whale trades on X Layer via `onchainos signal list`
2. **Pays** an x402-gated risk feed for per-token risk scores (`onchainos payment x402-pay`)
3. **Reasons** with Claude Sonnet 4.6: copy or skip, with rationale + confidence
4. **Validates** through hard-coded safety gates (sell-skip, min market cap, max risk, min wallet count)
5. **Executes** the copy via `onchainos swap execute` (testnet loop) or `npm run swap:once` (mainnet proof)
6. **Streams** every event to a four-panel live dashboard: Whale Feed · Agent State · Reasoning · Actions

The dashboard is the product. You can open it during the demo and **literally watch the agent think and act** — whale buys appear in the feed, Claude's rationale shows up in the reasoning panel, and tx hashes drop into the actions panel with clickable OKLink links.

---

## 2. Architecture

```
            ┌─────────────────── X Layer Pulse Agent ──────────────────┐
            │                                                          │
            │   Observer ──▶ Reasoner (Claude) ──▶ Safety ──▶ Executor│
            │      │              │                           │       │
            │      ▼              ▼                           ▼       │
            │  onchainos     onchainos payment        onchainos swap  │
            │  signal list   x402-pay                 execute         │
            │                                                          │
            │              logs/decisions.jsonl                        │
            └────────────────────┬─────────────────────────────────────┘
                                 ▼
                      tiny Express SSE server
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │  4-panel live dashboard      │
                  │  Whale Feed · Agent State    │
                  │  Reasoning  · Actions        │
                  └──────────────────────────────┘
                                 │
                                 ▼
                  Onchain OS TEE Agentic Wallet
                                 │
                                 ▼
                          X Layer (mainnet)
```

### Project layout

```
x-layer-pulse/
├── dashboard/index.html          4-panel live dashboard (SSE, no build step)
├── src/
│   ├── config/index.ts           zod-validated env, network helpers
│   ├── wallet/
│   │   ├── chains.ts             X Layer chain definitions
│   │   ├── client.ts             read-only viem client
│   │   └── create.ts             Onchain OS TEE wallet bootstrap
│   ├── skills/
│   │   ├── cli.ts                ★ hardened onchainos CLI runner
│   │   ├── onchainos.ts          ★ wallet skill
│   │   ├── signal.ts             ★ smart-money / whale signal skill
│   │   ├── swap.ts               ★ DEX swap skill
│   │   └── x402.ts               ★ x402 payment skill
│   ├── observer/index.ts         signal snapshot enriched with paid risk
│   ├── reasoner/index.ts         Claude Sonnet 4.6 + heuristic fallback
│   ├── executor/
│   │   ├── safety.ts             sell-skip + mcap + risk + size gates
│   │   └── index.ts              real swap execute, mainnet hard-disabled
│   ├── log/index.ts              JSONL append → logs/decisions.jsonl
│   ├── server/sse.ts             tiny Express SSE + static server
│   ├── loop.ts                   main scheduler (dedupes by signal cursor)
│   └── scripts/swap-once.ts      ★ THE single mainnet proof tx
├── .env.example
├── package.json
├── skills-lock.json              pinned Onchain OS skill versions
└── tsconfig.json
```

---

## 3. Deployment address

| | |
|---|---|
| **Agentic Wallet (Onchain OS TEE)** | `0x08d63b383b8d5f51282cef8a93e3c1b33335f43c` |
| **Network** | X Layer (chainId 196) |
| **Mainnet swap tx hash** | `<paste after running npm run swap:once>` |
| **Explorer** | [oklink.com/xlayer/address/0x08d63b...f43c](https://www.oklink.com/xlayer/address/0x08d63b383b8d5f51282cef8a93e3c1b33335f43c) |

The wallet is a TEE-backed Onchain OS Agentic Wallet — there is no local private key file in this repo or on disk. Signing happens inside OKX's secure enclave.

---

## 4. Onchain OS skill usage

Four Onchain OS skills, real CLI calls, zero mocks.

| Skill | CLI commands used | File |
|---|---|---|
| **okx-agentic-wallet** | `wallet status`, `wallet login`, `wallet verify`, `wallet addresses`, `wallet balance` | `src/skills/onchainos.ts`, `src/wallet/create.ts` |
| **okx-dex-signal** | `signal list` | `src/skills/signal.ts` |
| **okx-dex-swap** | `swap execute` | `src/skills/swap.ts`, `src/scripts/swap-once.ts` |
| **okx-x402-payment** | `payment x402-pay` | `src/skills/x402.ts` |

The DEX Swap aggregator routes through 500+ sources (Uniswap V3 included) to find the best execution.

---

## 5. Working mechanics

### Setup

```bash
git clone <repo>
cd x-layer-pulse
npm install
npx skills add okx/onchainos-skills --yes --all
```

### One-time wallet bootstrap

```bash
npm run wallet:create -- you@example.com
onchainos wallet verify <code-from-email>
npm run wallet:create                       # prints your X Layer address
```

Fund the printed EVM address with a small amount of USDC + a sliver of OKB for gas on X Layer mainnet.

### Run the agent + dashboard

Two terminals.

```bash
# Terminal 1 — autonomous loop (polls signal feed every 30s, dedupes by cursor)
npm run dev
```

```bash
# Terminal 2 — Express SSE server
npm run server
# → http://localhost:5174/dashboard/index.html
```

Open the URL. The four panels populate within seconds:

- **🐳 Whale Feed** — every signal from smart-money + whale wallets, color-coded buy/sell
- **🤖 Agent State** — last action, signals seen, copies executed, x402 spent
- **🧠 Reasoning** — Claude's COPY/SKIP decisions with rationale + confidence
- **⚡ Actions** — copy executions with clickable OKLink tx hashes

### The single mainnet proof tx

```bash
# .env: NETWORK=mainnet
npm run swap:once
# → ✅ Mainnet swap complete: 0x...
# → Explorer: https://www.oklink.com/xlayer/tx/0x...
```

Paste the hash into §3 above and into the Google Form submission.

### Strategy & safety

- **Strategy** (`src/reasoner`): Buy signals from 3+ smart-money wallets in agreement = copy. Sells, low-cap (<$10k mcap in demo mode), high-risk (>60), or low-consensus = skip. Falls back to a deterministic heuristic if no `ANTHROPIC_API_KEY`.
- **Safety gates** (`src/executor/safety.ts`): sell-skip, min market cap, max risk score, min signal size, token address required. Mainnet executor in the autonomous loop is **hard-disabled** — only `swap:once` can submit on mainnet.
- **Position size** (`COPY_SIZE_USDC`): default 1 USDC per copy. Bump in `.env` to scale up.
- **Demo mode** (`STRATEGY_MODE=demo`): lowers market-cap floor so the agent visibly acts during the recorded demo.

---

## 6. Team

Solo: **[@ajaythxkur](https://github.com/ajaythxkur)**

---

## 7. Positioning in the X Layer ecosystem

X Layer Pulse is a load-bearing example of what builders can ship on X Layer **today** using only Onchain OS primitives — no custom smart contracts, no custodial keys, no bespoke aggregator integrations. Most hackathon entries will be yield bots or DEX dashboards; almost none will use the **smart-money signal skill**, which is the most novel piece of Onchain OS but has the steepest "what do I do with this?" learning curve. Building on top of it is automatic differentiation.

The agent binds **four** flagship Onchain OS skills (Agentic Wallet, DEX Signal, DEX Swap, x402 Payment) into one self-sustaining reactive loop on a single TEE wallet. Each `src/skills/*.ts` wrapper is intentionally small and side-effect-free, so any of them can be lifted out and resubmitted standalone to the **Skills Arena** as reusable agent skills.

---

## Hackathon submission checklist

- [x] At least one component on X Layer (loop + mainnet swap)
- [x] Agentic Wallet as onchain identity (Onchain OS TEE)
- [x] Uses Onchain OS skills (4 of them)
- [x] Public GitHub repo
- [x] README contains all 7 required sections
- [ ] Demo video (1–3 min, YouTube link)
- [ ] X post with `#XLayerHackathon` tagging `@XLayerOfficial`
- [ ] Google Form submitted before **Apr 15 23:59 UTC**

## License

MIT — see [LICENSE](./LICENSE).
