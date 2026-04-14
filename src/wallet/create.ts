import { runCli } from '../skills/cli.js';

async function main() {
  const email = process.argv[2];
  const status = await runCli<{ loggedIn?: boolean; currentAccountName?: string }>(['wallet', 'status']);

  if (status.data?.loggedIn) {
    console.log('✓ Already logged in:', status.data.currentAccountName ?? '(unnamed)');
  } else {
    if (!email) {
      console.error('Usage: npm run wallet:create -- you@example.com');
      process.exit(1);
    }
    const r = await runCli(['wallet', 'login', email, '--locale', 'en-US']);
    if (!r.ok) {
      console.error('login failed:', r.stderr || r.stdout);
      process.exit(1);
    }
    console.log(`✓ Verification code sent to ${email}.`);
    console.log('  Run: onchainos wallet verify <code>');
    console.log('  Then re-run: npm run wallet:create');
    return;
  }

  const addrs = await runCli<Record<string, unknown>>(['wallet', 'addresses']);
  console.log('\n=== Agentic Wallet ready ===');
  console.log(JSON.stringify(addrs.data, null, 2));
  console.log('\nFund the EVM address on X Layer mainnet, then `npm run dev`.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
