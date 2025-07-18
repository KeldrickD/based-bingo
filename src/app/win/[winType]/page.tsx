import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { winType: string } }): Promise<Metadata> {
  const { winType } = params; // e.g., 'line', 'double', 'full-house'
  
  // Format win type for display
  const displayWinType = winType
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Use dynamic image generation
  const previewImage = `https://based-bingo.vercel.app/api/generate-win-image?type=${winType}&count=1`;

  return {
    title: `I Won ${displayWinType} in Based Bingo!`,
    description: 'Join the fun and win $BINGO tokens on Base.',
    keywords: 'bingo, win, farcaster, coinbase, web3, $BINGO',
    authors: [{ name: 'Based Bingo Team' }],
    openGraph: {
      title: `I Won ${displayWinType} in Based Bingo!`,
      description: 'Join the fun and win $BINGO tokens on Base.',
      images: [previewImage],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `I Won ${displayWinType} in Based Bingo!`,
      description: 'Join the fun and win $BINGO tokens on Base.',
      images: [previewImage],
    },
    other: {
      'fc:frame': JSON.stringify({
        version: '1',
        imageUrl: previewImage,
        name: 'Based Bingo Win',
        button: {
          title: 'Play Based Bingo',
          action: {
            type: 'launch_frame',
            name: 'play',
            url: 'https://based-bingo.vercel.app',
          },
        },
      }),
      'fc:miniapp': JSON.stringify({ // For Mini App compatibility
        version: '1',
        name: 'Based Bingo Win',
        imageUrl: previewImage,
        button: {
          title: 'Play Based Bingo',
          action: {
            type: 'launch_frame',
            name: 'play',
            url: 'https://based-bingo.vercel.app',
          },
        },
      }),
    },
  };
}

export default function WinPage({ params }: { params: { winType: string } }) {
  const { winType } = params;
  
  // Format win type for display
  const displayWinType = winType
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <div className="min-h-screen flex items-center justify-center bg-coinbase-blue text-white">
      <div className="text-center max-w-md mx-auto p-8">
        <h1 className="text-4xl font-bold mb-4">🎉 BINGO! 🎉</h1>
        <h2 className="text-2xl font-bold mb-6">{displayWinType} Win!</h2>
        <p className="text-lg mb-8">
          Congratulations! You won {displayWinType} in Based Bingo!
        </p>
        <div className="space-y-4">
          <a
            href="https://based-bingo.vercel.app"
            className="block bg-white text-coinbase-blue px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            Play Based Bingo
          </a>
          <p className="text-sm opacity-75">
            Share this URL on Farcaster to show off your win!
          </p>
        </div>
      </div>
    </div>
  );
} 