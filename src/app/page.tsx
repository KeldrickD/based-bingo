import { Metadata } from 'next';
import { MiniKitProvider } from '@/providers/MiniKitProvider';
import BingoCard from '@/components/BingoCard';

export const metadata: Metadata = {
  title: 'Based Bingo',
  description: 'Play Bingo on Farcaster and Coinbase Wallet! Win $BINGO tokens soon.',
  keywords: 'bingo, game, farcaster, coinbase, web3, interactive',
  authors: [{ name: 'Based Bingo Team' }],
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      name: 'Based Bingo',  // Required top-level: App name (max 32 chars)
      imageUrl: 'https://www.basedbingo.xyz/preview.png',  // Fixed URL to match domain
      button: {
        title: 'Play Based Bingo',  // Max 32 chars
        action: {
          type: 'launch_frame',
          name: 'launch',  // Add this for Action validation (short identifier, e.g., "play" or "open")
          url: 'https://www.basedbingo.xyz',  // Fixed URL to match domain
        },
      },
    }),
    'fc:frame': JSON.stringify({  // Backward compatibility fallback
      version: '1',
      name: 'Based Bingo',
      imageUrl: 'https://www.basedbingo.xyz/preview.png',  // Fixed URL to match domain
      button: {
        title: 'Play Based Bingo',
        action: {
          type: 'launch_frame',
          name: 'launch',
          url: 'https://www.basedbingo.xyz',  // Fixed URL to match domain
        },
      },
    }),
  },
};

export default function Home() {
  return (
    <MiniKitProvider>
      <main className="flex min-h-screen flex-col items-center justify-center bg-white text-coinbase-blue p-4">
        <h1 className="text-3xl font-bold mb-4">Based Bingo</h1>
        <BingoCard />
      </main>
    </MiniKitProvider>
  );
}