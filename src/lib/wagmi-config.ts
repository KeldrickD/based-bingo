import { createConfig, http, cookieStorage, createStorage } from 'wagmi';
import { base } from 'wagmi/chains';
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector';
import { baseAccount, coinbaseWallet, injected } from 'wagmi/connectors';
import { Attribution } from 'ox/erc8021';

// Base Builder Code for onchain attribution (base.dev → Settings → Builder Code)
const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ['bc_162gf8gz'],
});

// Enhanced RPC configuration with fallback and monitoring
const CDP_RPC = process.env.NEXT_PUBLIC_CDP_RPC;
const DEFAULT_BASE_RPC = 'https://mainnet.base.org';
// const BACKUP_RPC = 'https://base.gateway.tenderly.co'; // Reserved for future use

// Dynamic URL detection for proper WalletConnect configuration
const getAppUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Fallback for SSR - both URLs work
  return 'https://www.basedbingo.xyz';
};

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
const appUrl = getAppUrl();

// Build connectors for Base App first, then Farcaster/browser fallbacks.
const connectorsList = [
  injected(),

  baseAccount({
    appName: 'Based Bingo',
  }),

  coinbaseWallet({
    appName: 'Based Bingo',
    appLogoUrl: `${appUrl}/icon.png`,
    chainId: base.id,
    preference: 'smartWalletOnly',
  }),

  // Keep Farcaster compatibility for users opening from Farcaster clients.
  miniAppConnector(),
];

// Enhanced wagmi configuration with paymaster support
export const config = createConfig({
  chains: [base],
  connectors: connectorsList as any,
  dataSuffix: DATA_SUFFIX,
  
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
} as Parameters<typeof createConfig>[0]);

// Export configuration details for monitoring
export const wagmiInfo = {
  rpcUrl,
  appUrl,
  isPaymasterEnabled: !!CDP_RPC,
  supportedConnectors: [
    'Injected wallet',
    'Base Account',
    'Coinbase Wallet (Smart Wallet)',
    'Farcaster Mini App',
  ],
  features: {
    gaslessTransactions: !!CDP_RPC,
    erc4337Support: true,
    batchRequests: true,
    ssrSupport: true,
    sessionPersistence: true,
    dynamicUrlHandling: true,
  },
}; 
