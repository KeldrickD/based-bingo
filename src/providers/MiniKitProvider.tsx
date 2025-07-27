'use client';

import { MiniKitProvider as Provider } from '@coinbase/onchainkit/minikit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '../lib/wagmi-config';
import { base } from 'wagmi/chains';
import { useState, useEffect, ReactNode } from 'react';

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
    // Add initialization timeout to prevent hanging
    const initTimeout = setTimeout(() => {
      if (!isInitialized) {
        console.warn('⚠️ Provider initialization taking longer than expected, continuing anyway...');
        setIsInitialized(true);
      }
    }, 5000); // 5 second timeout

    try {
      // Initialize providers
      setIsInitialized(true);
      clearTimeout(initTimeout);
    } catch (err: any) {
      console.error('❌ Provider initialization failed:', err);
      setError(err.message);
      setIsInitialized(true); // Continue anyway
      clearTimeout(initTimeout);
    }

    return () => clearTimeout(initTimeout);
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
    console.error('❌ Provider error, but continuing with limited functionality:', error);
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