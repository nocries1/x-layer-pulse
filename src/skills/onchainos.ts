// okx-agentic-wallet skill wrapper.
import { runCli, runCliOrThrow } from './cli.js';

export interface WalletStatus {
  loggedIn: boolean;
  loginType?: 'email' | 'ak';
  currentAccountName?: string;
  currentAccountId?: string;
  email?: string;
}

export interface AddressEntry {
  address: string;
  chainIndex: string;
  chainName: string;
}
export interface WalletAddresses {
  xlayer?: AddressEntry[];
  evm?: AddressEntry[];
  solana?: AddressEntry[];
}

export interface BalanceItem {
  symbol: string;
  tokenContractAddress: string;
  balance: string;
  balanceUsd?: string;
}

export async function status(): Promise<WalletStatus> {
  const r = await runCli<WalletStatus>(['wallet', 'status']);
  return r.data ?? { loggedIn: false };
}

export async function addresses(): Promise<WalletAddresses> {
  return runCliOrThrow<WalletAddresses>(['wallet', 'addresses']);
}

export async function balance(chainIdNum?: number): Promise<BalanceItem[]> {
  const args = ['wallet', 'balance'];
  if (chainIdNum) args.push('--chain', String(chainIdNum));
  const data = await runCliOrThrow<{ tokens?: BalanceItem[] } | BalanceItem[]>(args);
  if (Array.isArray(data)) return data;
  return data.tokens ?? [];
}

export async function getXLayerAddress(): Promise<string> {
  const addrs = await addresses();
  const xl = addrs.xlayer?.[0]?.address;
  const evm = addrs.evm?.[0]?.address;
  const addr = xl ?? evm;
  if (!addr) throw new Error('No EVM/X Layer address on the active Agentic Wallet');
  return addr;
}
