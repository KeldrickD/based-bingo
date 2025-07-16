import { Metadata } from 'next';
import WagmiWrapper from '@/components/WagmiWrapper';
import BingoCard from '@/components/BingoCard';

export const metadata: Metadata = {
  title: 'Based Bingo',
  description: 'Play Bingo on Farcaster and Coinbase Wallet! Win $BINGO tokens soon.',
  keywords: 'bingo, game, farcaster, coinbase, web3, interactive',
  authors: [{ name: 'Based Bingo Team' }],
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      imageUrl: 'https://based-bingo.vercel.app/icon.png', // Your app icon
      buttons: [
        {
          title: 'Play Based Bingo',
          action: {
            type: 'launch_frame',
            url: 'https://based-bingo.vercel.app',
          },
        },
      ],
    }),
  },
};

export default function Home() {
  return (
    <WagmiWrapper>
      <main className="flex min-h-screen flex-col items-center justify-center bg-white text-coinbase-blue p-4">
        <h1 className="text-3xl font-bold mb-4">Based Bingo</h1>
        <BingoCard />
      </main>
    </WagmiWrapper>
  );
}