import { createConfig, http, cookieStorage, createStorage } from 'wagmi';
import { base } from 'wagmi/chains';
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

// Enhanced RPC configuration with fallback and monitoring
const CDP_RPC = process.env.NEXT_PUBLIC_CDP_RPC;
const DEFAULT_BASE_RPC = 'https://mainnet.base.org';
// const BACKUP_RPC = 'https://base.gateway.tenderly.co'; // Reserved for future use

// Select RPC with priority: CDP Paymaster > Default > Backup
const getRpcUrl = () => {
  if (CDP_RPC) {
    console.log('🚀 Using CDP Paymaster RPC for gasless transactions');
    return CDP_RPC;
  }
  console.log('⛽ Using standard Base RPC (gas required)');
  return DEFAULT_BASE_RPC;
};

const rpcUrl = getRpcUrl();

// Enhanced wagmi configuration with paymaster support
export const config = createConfig({
  chains: [base],
  connectors: [
    // Primary: Farcaster Mini App connector (EIP-5792 compliant)
    miniAppConnector(),
    
    // Enhanced: Coinbase Wallet with ERC-4337 support
    coinbaseWallet({
      appName: 'Based Bingo V2',
      appLogoUrl: 'https://basedbingo.xyz/icon.png',
      chainId: base.id,
      preference: 'smartWalletOnly', // Enable smart wallet features
    }),
    
    // Additional connectors for broader compatibility
    injected({
      target: 'metaMask',
    }),
    
    // WalletConnect for mobile wallets
    ...(process.env.NEXT_PUBLIC_WC_PROJECT_ID ? [
      walletConnect({
        projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID,
        metadata: {
          name: 'Based Bingo V2',
          description: 'On-chain Bingo game with automatic win claiming',
          url: 'https://basedbingo.xyz',
          icons: ['https://basedbingo.xyz/icon.png'],
        },
      })
    ] : []),
  ],
  
  // Enhanced storage for session persistence
  storage: createStorage({
    storage: cookieStorage,
  }),
  
  // SSR support
  ssr: true,
  
  // Transport configuration with fallback
  transports: {
    [base.id]: http(rpcUrl, {
      batch: true,
      retryCount: 3,
      retryDelay: 1000,
    }),
  },
  
  // Batch requests for better performance
  batch: {
    multicall: true,
  },
});

// Export configuration details for monitoring
export const wagmiInfo = {
  rpcUrl,
  isPaymasterEnabled: !!CDP_RPC,
  supportedConnectors: [
    'Farcaster Mini App',
    'Coinbase Wallet (Smart Wallet)',
    'MetaMask',
    ...(process.env.NEXT_PUBLIC_WC_PROJECT_ID ? ['WalletConnect'] : []),
  ],
  features: {
    gaslessTransactions: !!CDP_RPC,
    erc4337Support: true,
    batchRequests: true,
    ssrSupport: true,
    sessionPersistence: true,
  },
}; 