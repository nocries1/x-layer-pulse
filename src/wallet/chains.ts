import { defineChain } from 'viem';
import { config } from '../config/index.js';

export const xLayerMainnet = defineChain({
  id: config.XLAYER_MAINNET_CHAIN_ID,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: [config.XLAYER_MAINNET_RPC] } },
  blockExplorers: { default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer' } },
});

export const xLayerTestnet = defineChain({
  id: config.XLAYER_TESTNET_CHAIN_ID,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: [config.XLAYER_TESTNET_RPC] } },
  blockExplorers: { default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer-test' } },
  testnet: true,
});

export const activeChain = () =>
  config.NETWORK === 'mainnet' ? xLayerMainnet : xLayerTestnet;
