'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi-config';
import { ReactNode } from 'react';

const queryClient = new QueryClient();

interface WagmiWrapperProps {
  children: ReactNode;
}

export default function WagmiWrapper({ children }: WagmiWrapperProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
} 