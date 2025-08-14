import { Metadata } from 'next';
import { MiniKitProvider } from '@/providers/MiniKitProvider';
import BingoCard from '@/components/BingoCard';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Based Bingo',
  description: 'Play Bingo on Farcaster and Coinbase Wallet! Win $BINGO tokens soon.',
  keywords: 'bingo, game, farcaster, coinbase, web3, interactive',
  authors: [{ name: 'Based Bingo Team' }],
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      name: 'Based Bingo',  // Required top-level: App name (max 32 chars)
      imageUrl: 'https://basedbingo.xyz/preview.png',  // Fixed URL to match domain
      button: {
        title: 'Play Based Bingo',  // Max 32 chars
        action: {
          type: 'launch_frame',
          name: 'launch',  // Add this for Action validation (short identifier, e.g., "play" or "open")
          url: 'https://basedbingo.xyz',  // Fixed URL to match domain
        },
      },
    }),
    'fc:frame': JSON.stringify({  // Backward compatibility fallback
      version: '1',
      name: 'Based Bingo',
      imageUrl: 'https://basedbingo.xyz/preview.png',  // Fixed URL to match domain
      button: {
        title: 'Play Based Bingo',
        action: {
          type: 'launch_frame',
          name: 'launch',
          url: 'https://basedbingo.xyz',  // Fixed URL to match domain
        },
      },
    }),
  },
};

export default function Home() {
  return (
    <MiniKitProvider>
      <main className="flex min-h-screen flex-col items-center justify-center bg-white text-coinbase-blue p-4 gap-4">
        <h1 className="text-3xl font-bold mb-4">Based Bingo</h1>
        <ChallengePanel />
        <BingoCard />
      </main>
    </MiniKitProvider>
  );
}

function ChallengePanel() {
  return (
    <div className="w-full max-w-md rounded-lg border p-4 text-sm">
      <WeeklyChallengeSnippet />
    </div>
  );
}

async function WeeklyChallengeSnippet() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}/api/analytics?timeframe=7d&challenge=1`, { cache: 'no-store' }).catch(() => null);
  const data = res && res.ok ? await res.json() : null;
  const c = data?.currentChallenge;
  return (
    <div>
      <div className="font-semibold">Weekly Challenge</div>
      {c ? (
        <div className="mt-1">
          <div>{c.name}</div>
          <div className="text-gray-600">{c.goal}</div>
          <div className="text-green-700 mt-1">Reward: {c.rewardBingo} $BINGO</div>
          <div className="mt-2 text-xs text-gray-500">Rotates weekly</div>
        </div>
      ) : (
        <div className="text-gray-500">Loading challenge…</div>
      )}
      <div className="mt-3 text-xs">
        <Link href="/share" className="underline">Share your progress</Link>
      </div>
    </div>
  );
}