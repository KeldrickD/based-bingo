'use client';

import { MiniKitProvider as Provider } from '@coinbase/onchainkit/minikit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { config } from '../lib/wagmi-config';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface MiniKitProviderProps {
  children: ReactNode;
}

export function MiniKitProvider({ children }: MiniKitProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setIsInitialized(true);
    } catch (err: any) {
      console.error('Provider initialization failed:', err);
      setError(err.message);
      setIsInitialized(true);
    }
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white text-coinbase-blue">
        <div className="text-xl font-bold mb-4">Loading Based Bingo...</div>
        <div className="text-sm text-gray-600">Initializing wallet connections...</div>
      </div>
    );
  }

  if (error) {
    console.error('Provider error, but continuing with limited functionality:', error);
  }

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
