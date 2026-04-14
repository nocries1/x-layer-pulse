import { createPublicClient, http } from 'viem';
import { activeChain } from './chains.js';

export const publicClient = createPublicClient({
  chain: activeChain(),
  transport: http(),
});
