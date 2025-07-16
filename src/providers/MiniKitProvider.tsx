'use client';

import { MiniKitProvider as Provider } from '@coinbase/onchainkit/minikit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '../lib/wagmi-config';
import { base } from 'wagmi/chains';

const queryClient = new QueryClient();

export function MiniKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider chain={base}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </Provider>
  );
} 