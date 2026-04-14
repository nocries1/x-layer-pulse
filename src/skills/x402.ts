// okx-x402-payment skill wrapper.
import { runCliOrThrow } from './cli.js';

export interface X402PaymentProof {
  signature: string;
  authorization: unknown;
  network: string;
  payTo: string;
  asset: string;
  amount: string;
}

export interface PayParams {
  network: string;     // CAIP-2 e.g. eip155:196
  payTo: string;
  asset: string;       // ERC-20 contract used for payment
  amount: string;      // minimal units
  from?: string;
  maxTimeoutSeconds?: number;
}

export async function pay(params: PayParams): Promise<X402PaymentProof> {
  const args = [
    'payment', 'x402-pay',
    '--network', params.network,
    '--pay-to', params.payTo,
    '--asset', params.asset,
    '--amount', params.amount,
  ];
  if (params.from) args.push('--from', params.from);
  if (params.maxTimeoutSeconds) args.push('--max-timeout-seconds', String(params.maxTimeoutSeconds));
  return runCliOrThrow<X402PaymentProof>(args);
}

export async function fetchPaid(url: string, init: RequestInit = {}): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status !== 402) return res;
  const challenge = await res.clone().json().catch(() => null) as
    | { network: string; payTo: string; asset: string; amount: string }
    | null;
  if (!challenge) throw new Error('x402 endpoint returned 402 without a valid challenge');
  const proof = await pay(challenge);
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'X-PAYMENT': Buffer.from(JSON.stringify(proof)).toString('base64'),
    },
  });
}
