import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector';
import { coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
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