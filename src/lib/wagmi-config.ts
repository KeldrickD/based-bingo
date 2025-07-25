import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector';
import { coinbaseWallet } from 'wagmi/connectors';

// Use CDP RPC for paymaster support if available, fallback to default
const rpcUrl = process.env.NEXT_PUBLIC_CDP_RPC || 'https://mainnet.base.org';

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(rpcUrl),
  },
  connectors: [
    // Primary: Farcaster Mini App connector (EIP-5792 compliant)
    miniAppConnector(),
    // Fallback: Coinbase Wallet connector for non-Mini App environments
    coinbaseWallet({
      appName: 'Based Bingo',
      appLogoUrl: 'https://basedbingo.xyz/icon.png',
      chainId: base.id
    })
  ]
}); 