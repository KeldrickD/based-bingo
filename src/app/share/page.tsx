'use client';

import { useEffect } from 'react';

export default function SharePage() {
  useEffect(() => {
    // Redirect to Warpcast with sharing parameters
    const shareText = encodeURIComponent('Just won at Based Bingo! Play now:');
    const shareUrl = encodeURIComponent('https://based-bingo.vercel.app');
    const warpcastUrl = `https://warpcast.com/~/compose?text=${shareText}&embeds[]=${shareUrl}`;
    
    window.location.href = warpcastUrl;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-coinbase-blue text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Sharing Based Bingo...</h1>
        <p className="text-lg">Redirecting to Warpcast...</p>
        <div className="mt-4">
          <a 
            href="https://warpcast.com/~/compose?text=Just+won+at+Based+Bingo!+Play+now:&embeds[]=https://based-bingo.vercel.app"
            className="bg-white text-coinbase-blue px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
          >
            Click here if not redirected
          </a>
        </div>
      </div>
    </div>
  );
} 