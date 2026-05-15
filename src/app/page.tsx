import { Metadata } from 'next';
import Link from 'next/link';
import { MiniKitProvider } from '@/providers/MiniKitProvider';
import BingoCard from '@/components/BingoCard';
import WalletConnectionPanel from '@/components/WalletConnectionPanel';
import { getCurrentChallenge, getWeekKey } from '@/lib/challenges';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Based Bingo',
  description: 'Play Bingo on Farcaster and Coinbase Wallet. Win $BINGO tokens on Base.',
  keywords: 'bingo, game, farcaster, coinbase, web3, base, mini app',
  authors: [{ name: 'Based Bingo Team' }],
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      name: 'Based Bingo',
      imageUrl: 'https://basedbingo.xyz/preview.png',
      button: {
        title: 'Play Based Bingo',
        action: {
          type: 'launch_frame',
          name: 'launch',
          url: 'https://basedbingo.xyz',
        },
      },
    }),
    'fc:frame': JSON.stringify({
      version: '1',
      name: 'Based Bingo',
      imageUrl: 'https://basedbingo.xyz/preview.png',
      button: {
        title: 'Play Based Bingo',
        action: {
          type: 'launch_frame',
          name: 'launch',
          url: 'https://basedbingo.xyz',
        },
      },
    }),
  },
};

export default function Home() {
  return (
    <MiniKitProvider>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eef4ff_0,#ffffff_42%,#f8fafc_100%)] text-slate-950">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coinbase-blue">Base mini app</p>
              <h1 className="text-3xl font-bold text-slate-950">Based Bingo</h1>
            </div>
            <Link
              href="/share"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-coinbase-blue hover:text-coinbase-blue"
            >
              Share
            </Link>
          </header>

          <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,390px)]">
            <section className="order-2 lg:order-1">
              <BingoCard />
            </section>
            <aside className="order-1 space-y-4 lg:order-2">
              <WalletConnectionPanel />
              <ChallengePanel />
              <div className="rounded-lg border border-slate-200 bg-white/85 p-4 text-sm text-slate-600 shadow-sm">
                <div className="font-semibold text-slate-950">How it pays</div>
                <p className="mt-1">
                  Play up to 3 free rounds daily. Connect a wallet in the mini app to receive automatic $BINGO rewards when a win is detected.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </MiniKitProvider>
  );
}

function ChallengePanel() {
  const challenge = getCurrentChallenge();
  const weekKey = getWeekKey();

  return (
    <div className="rounded-lg border border-slate-200 bg-white/85 p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-950">Weekly Challenge</div>
          <div className="mt-1 text-lg font-bold text-coinbase-blue">{challenge.name}</div>
        </div>
        <div className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">{weekKey}</div>
      </div>
      <div className="mt-2 text-slate-600">{challenge.goal}</div>
      <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">
        Reward: {challenge.rewardBingo} $BINGO
      </div>
    </div>
  );
}
