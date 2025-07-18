'use client'; // Client-side for state

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { sdk } from '@farcaster/miniapp-sdk';
import { toPng } from 'html-to-image';

// EIP-5792 environment detection
const isMiniAppEnvironment = () => {
  if (typeof window === 'undefined') return false;
  
  // Check for Farcaster Mini App environment
  const isFarcasterMiniApp = window.location.hostname.includes('warpcast.com') || 
                            window.location.hostname.includes('farcaster.xyz') ||
                            window.navigator.userAgent.includes('Farcaster');
  
  // Check for Coinbase Wallet Mini App environment
  const isCoinbaseMiniApp = window.location.hostname.includes('coinbase.com') ||
                           window.navigator.userAgent.includes('Coinbase');
  
  // Check for EIP-5792 support
  const hasEIP5792 = typeof window !== 'undefined' && 
                    (window as any).ethereum?.isMiniApp === true;
  
  return isFarcasterMiniApp || isCoinbaseMiniApp || hasEIP5792;
};

function generateBingoCard() {
  const columnRanges = [
    { label: 'B', min: 1, max: 15 },
    { label: 'I', min: 16, max: 30 },
    { label: 'N', min: 31, max: 45 },
    { label: 'G', min: 46, max: 60 },
    { label: 'O', min: 61, max: 75 },
  ];

  const card: (number | string)[][] = columnRanges.map(({ min, max }) => {
    const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const shuffled = [...nums].sort(() => Math.random() - 0.5).slice(0, 5);
    return shuffled;
  });

  card[2][2] = 'FREE'; // Center free space
  return card;
}

function checkWin(marked: Set<string>): { count: number; types: string[] } {
  const wins = [
    // Rows (single lines)
    ['00', '01', '02', '03', '04'], // Row 1
    ['10', '11', '12', '13', '14'], // Row 2
    ['20', '21', '22', '23', '24'], // Row 3
    ['30', '31', '32', '33', '34'], // Row 4
    ['40', '41', '42', '43', '44'], // Row 5
    // Columns (single lines)
    ['00', '10', '20', '30', '40'], // Col B
    ['01', '11', '21', '31', '41'], // Col I
    ['02', '12', '22', '32', '42'], // Col N
    ['03', '13', '23', '33', '43'], // Col G
    ['04', '14', '24', '34', '44'], // Col O
    // Diagonals (single lines)
    ['00', '11', '22', '33', '44'], // Main diagonal
    ['04', '13', '22', '31', '40'], // Anti-diagonal
  ];

  const completed = wins.filter((line) => line.every((pos) => marked.has(pos) || pos === '22'));
  const count = completed.length;
  const types: string[] = [];
  if (count >= 1) types.push('Line Bingo!');
  if (count >= 2) types.push('Double Line!');
  if (count >= 5) types.push('Full House!'); // e.g., 5+ lines for blackout feel

  return { count, types };
}

export default function BingoCard() {
  const [card, setCard] = useState<(number | string)[][]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set(['22']));
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [recentDraws, setRecentDraws] = useState<number[]>([]); // Last 5 draws
  const [winInfo, setWinInfo] = useState<{ count: number; types: string[] }>({ count: 0, types: [] });
  const [gameTimer, setGameTimer] = useState(120); // 2 mins
  const [timerActive, setTimerActive] = useState(false);
  const [autoDrawInterval, setAutoDrawInterval] = useState<NodeJS.Timeout | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);

  // Daily limits (from before)
  const [dailyPlays, setDailyPlays] = useState(0);
  const [unlimitedToday, setUnlimitedToday] = useState(false);
  const MAX_FREE_PLAYS = 3;

  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const miniKit = useMiniKit();

  // Refs for card snapshot
  const gridRef = useRef<HTMLDivElement>(null);

  // Enhanced wallet connection with EIP-5792 support
  const handleWalletConnection = useCallback(async () => {
    console.log('Attempting wallet connection...');
    console.log('Available connectors:', connectors);
    console.log('Mini App environment:', isMiniApp);
    
    try {
      // Try Farcaster Mini App connector first (EIP-5792 compliant)
      const miniAppConnector = connectors.find(connector => 
        connector.name === 'Farcaster Mini App' || 
        connector.name.includes('Farcaster') ||
        connector.name.includes('Mini App')
      );
      
      if (miniAppConnector) {
        console.log('Using Farcaster Mini App connector:', miniAppConnector.name);
        await connect({ connector: miniAppConnector });
      } else {
        // Fallback to first available connector
        if (connectors.length > 0) {
          console.log('Using fallback connector:', connectors[0].name);
          await connect({ connector: connectors[0] });
        } else {
          console.error('No connectors available');
          alert('No wallet connectors available. Please ensure you have a compatible wallet installed.');
        }
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      alert('Wallet connection failed. You can still play the game!');
    }
  }, [connect, connectors, isMiniApp]);

  const resetGame = useCallback(() => {
    // Clear any existing interval first
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      setAutoDrawInterval(null);
    }
    
    const newCard = generateBingoCard();
    setCard(newCard);
    setMarked(new Set(['22']));
    setDrawnNumbers(new Set());
    setRecentDraws([]);
    setWinInfo({ count: 0, types: [] });
    setGameTimer(120);
    setTimerActive(false);
    setIsSharing(false);
    setGameStarted(false);
    
    console.log('Game Reset. Card:', newCard);
    console.log('Center (col 2, row 2):', newCard[2][2]); // Debug
  }, [autoDrawInterval]);

  const stopAutoDraw = useCallback(() => {
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      setAutoDrawInterval(null);
    }
  }, [autoDrawInterval]);

  // Initialize card on mount (but don't start game)
  useEffect(() => {
    const newCard = generateBingoCard();
    setCard(newCard);
    console.log('Initial card generated:', newCard);
  }, []);

  // Daily limits load
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const storedDate = localStorage.getItem('lastPlayDate');
    const storedPlays = parseInt(localStorage.getItem('dailyPlays') || '0');
    const storedUnlimited = localStorage.getItem('unlimitedDate') === today;

    if (storedDate !== today) {
      localStorage.setItem('lastPlayDate', today);
      localStorage.setItem('dailyPlays', '0');
      localStorage.removeItem('unlimitedDate');
      setDailyPlays(0);
      setUnlimitedToday(false);
    } else {
      setDailyPlays(storedPlays);
      setUnlimitedToday(storedUnlimited);
    }
  }, []);

  // Game timer countdown
  useEffect(() => {
    if (timerActive && gameTimer > 0) {
      const interval = setInterval(() => setGameTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    } else if (gameTimer === 0 && timerActive) {
      stopAutoDraw();
      alert('Time up! Game over.');
      setTimerActive(false);
    }
  }, [timerActive, gameTimer, stopAutoDraw]);

  // New: Call MiniKit setFrameReady() once the card is loaded
  useEffect(() => {
    if (card.length > 0) { // Ensure app is ready (card generated)
      miniKit.setFrameReady(); // Hide splash screen in Coinbase Wallet
    }
  }, [card, miniKit]);

  // Handle hydration with timeout fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 1000); // 1 second timeout

    return () => clearTimeout(timer);
  }, []);

  // Detect Mini App environment and EIP-5792 support
  useEffect(() => {
    const miniAppEnv = isMiniAppEnvironment();
    setIsMiniApp(miniAppEnv);
    console.log('Mini App environment detected:', miniAppEnv);
    
    if (miniAppEnv) {
      console.log('EIP-5792 supported environment detected');
      // Additional Mini App specific setup can go here
    }
  }, []);

  const startGame = () => {
    if (!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) {
      alert('Daily limit reached! Share on Farcaster for +1 play or pay 50 $BINGO for unlimited.');
      return;
    }

    console.log('Starting game...');
    resetGame();
    setGameStarted(true);
    setTimerActive(true);
    
    // Start auto-draw immediately
    startAutoDraw();

    if (!unlimitedToday) {
      const newPlays = dailyPlays + 1;
      setDailyPlays(newPlays);
      localStorage.setItem('dailyPlays', newPlays.toString());
    }
  };

  const startAutoDraw = () => {
    console.log('Starting auto-draw...');
    
    // Draw first number immediately
    const drawFirstNumber = () => {
      if (drawnNumbers.size >= 75 || gameTimer <= 0) {
        stopAutoDraw();
        return;
      }

      let num: number;
      do {
        num = Math.floor(Math.random() * 75) + 1;
      } while (drawnNumbers.has(num));

      console.log('Drawing first number:', num);
      console.log('Current drawn numbers:', Array.from(drawnNumbers));
      setDrawnNumbers((prev) => new Set([...prev, num]));
      setRecentDraws((prev) => {
        const newDraws = [...prev, num].slice(-5); // Keep last 5
        return newDraws;
      });
    };

    // Draw first number immediately
    drawFirstNumber();
    
    // Then set up interval for subsequent draws
    const interval = setInterval(() => {
      setDrawnNumbers((currentDrawnNumbers) => {
        if (currentDrawnNumbers.size >= 75 || gameTimer <= 0) {
          stopAutoDraw();
          return currentDrawnNumbers;
        }

        let num: number;
        do {
          num = Math.floor(Math.random() * 75) + 1;
        } while (currentDrawnNumbers.has(num));

        console.log('Drawing number:', num);
        console.log('Current drawn numbers:', Array.from(currentDrawnNumbers));
        const newDrawnNumbers = new Set([...currentDrawnNumbers, num]);
        
        setRecentDraws((prev) => {
          const newDraws = [...prev, num].slice(-5); // Keep last 5
          return newDraws;
        });
        
        return newDrawnNumbers;
      });
    }, 2500); // 2.5s interval (faster than before)

    setAutoDrawInterval(interval);
  };

  const markCell = (row: number, col: number) => {
    if (!gameStarted) return; // Can't mark if game hasn't started
    
    const num = card[col][row];
    if (typeof num === 'number' && recentDraws.includes(num)) { // Allow marking any recent draw
      const pos = `${col}${row}`;
      setMarked((prev) => new Set([...prev, pos]));
      console.log('Marked cell:', pos, 'with number:', num);
    }
  };

  const shareWin = useCallback(async (winTypes: string[]) => {
    if (isSharing) return; // Prevent multiple shares
    setIsSharing(true);

    try {
      // Generate card snapshot
      if (gridRef.current) {
        const dataUrl = await toPng(gridRef.current, {
          quality: 0.95,
          backgroundColor: '#ffffff',
        });
        console.log('Win card snapshot generated:', dataUrl);
        // In production, upload this to IPFS or your image service
        // For now, we'll use a placeholder
      }

      // Generate share URL
      const winType = winTypes[winTypes.length - 1]
        .toLowerCase()
        .replace(/!/g, '')
        .replace(/\s/g, '-'); // e.g., 'full-house'
      const shareUrl = `https://based-bingo.vercel.app/win/${winType}`;

      // Auto-cast the win
      await sdk.actions.openUrl(
        `https://warpcast.com/~/compose?text=Just+got+${winTypes.join('+%2B+')}+in+Based+Bingo!+Won+$BINGO—play+now!&embeds[]=${encodeURIComponent(shareUrl)}`
      );

      // Grant extra play for sharing
      setDailyPlays((prev) => {
        const newPlays = Math.max(0, prev - 1); // Reduce by 1 to allow another play
        localStorage.setItem('dailyPlays', newPlays.toString());
        return newPlays;
      });

      alert(`Win shared! You got +1 play for sharing!`);
    } catch (error) {
      console.error('Failed to share win:', error);
      alert('Failed to share win. You can still play!');
    } finally {
      setIsSharing(false);
    }
  }, [isSharing]);

  useEffect(() => {
    const newWin = checkWin(marked);
    if (newWin.count > winInfo.count) {
      setWinInfo(newWin);
      
      // Prompt to share the win
      const shouldShare = confirm(
        `🎉 New win! ${newWin.types.join(' + ')} - Claim more $BINGO!\n\nShare your victory on Farcaster for +1 play?`
      );
      
      if (shouldShare) {
        shareWin(newWin.types);
      }
    }
  }, [marked, winInfo.count, shareWin]);

  const shareForExtraPlay = async () => {
    try {
      // Use openUrl to share on Farcaster
      await sdk.actions.openUrl('https://warpcast.com/~/compose?text=Just+playing+Based+Bingo—join+me!+https://based-bingo.vercel.app&embeds[]=https://based-bingo.vercel.app');
      // On success, grant +1 play
      setDailyPlays((prev) => {
        const newPlays = Math.max(0, prev - 1); // Reduce by 1 to allow another play
        localStorage.setItem('dailyPlays', newPlays.toString());
        return newPlays;
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const payForUnlimited = () => {
    // Future: Add $BINGO token cost for unlimited plays
    setUnlimitedToday(true);
    localStorage.setItem('unlimitedDate', new Date().toISOString().split('T')[0]);
    alert('Unlimited plays activated for today!');
  };

  const canPlay = dailyPlays < MAX_FREE_PLAYS || unlimitedToday;

  return (
    <div className="text-center max-w-sm mx-auto min-h-[600px] flex flex-col"> {/* Fixed height container */}
      {!isHydrated ? (
        <div className="mb-4 p-2 text-coinbase-blue">Loading...</div>
      ) : (
        <>
          {/* EIP-5792 Status */}
          {isMiniApp && (
            <div className="mb-4 p-2 bg-green-100 border border-green-300 rounded-lg">
              <p className="text-sm text-green-700 font-semibold">
                🎯 EIP-5792 Mini App Environment Detected
              </p>
              <p className="text-xs text-green-600">
                Native wallet integration enabled
              </p>
            </div>
          )}
          
          {isConnecting ? (
            <p className="text-coinbase-blue mb-4">Connecting...</p>
          ) : isConnected ? (
            <div className="mb-4">
              <p className="text-sm text-coinbase-blue mb-1">
                Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
              {isMiniApp && (
                <p className="text-xs text-green-600">
                  ✓ EIP-5792 wallet connection active
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={handleWalletConnection}
              className="bg-coinbase-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 mb-4"
            >
              {isMiniApp ? 'Connect Wallet (EIP-5792)' : 'Connect Wallet (for $BINGO beta)'}
            </button>
          )}
          {connectError && (
            <p className="text-red-500 text-sm mb-4">Wallet connection failed. You can still play!</p>
          )}
        </>
      )}

      {/* Daily plays counter */}
      <div className="mb-4 text-sm">
        <p className="text-coinbase-blue">
          Free plays today: {dailyPlays}/{MAX_FREE_PLAYS}
        </p>
        {!canPlay && (
          <div className="mt-2">
            <p className="text-red-500 text-sm mb-2">Daily limit reached!</p>
            <button
              onClick={shareForExtraPlay}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 mr-2"
            >
              Share on Farcaster for +1 Play
            </button>
            <button
              onClick={payForUnlimited}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-600"
            >
              Pay 50 $BINGO for Unlimited
            </button>
          </div>
        )}
      </div>

      {/* Recent draws display (moved to top, between title and card) */}
      <div className="mb-4 min-h-[80px]"> {/* Fixed height to prevent layout shift */}
        {recentDraws.length > 0 ? (
          <>
            <p className="text-sm text-coinbase-blue mb-2">
              Recent Draws: ({drawnNumbers.size}/75 total)
            </p>
            <div className="flex justify-center gap-2">
              {recentDraws.map((num, idx) => (
                <div
                  key={idx}
                  className={`w-12 h-12 border-2 border-coinbase-blue flex items-center justify-center text-lg font-bold rounded transition-opacity ${
                    idx < recentDraws.length - 1 ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  {num}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-12 flex items-center justify-center">
            <p className="text-sm text-gray-400">Waiting for draws...</p>
          </div>
        )}
      </div>

      <div ref={gridRef} className="grid grid-cols-5 gap-1 mb-4 w-full max-w-sm mx-auto">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div key={letter} className="font-bold text-coinbase-blue text-lg h-8 flex items-center justify-center">
            {letter}
          </div>
        ))}
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: 5 }).map((_, col) => {
            const num = card[col]?.[row] ?? '';
            const pos = `${col}${row}`;
            const isMarked = marked.has(pos) || (num === 'FREE' && pos === '22'); // Visually mark FREE
            const isRecentDraw = typeof num === 'number' && recentDraws.includes(num);
            return (
              <button
                key={pos}
                onClick={() => markCell(row, col)}
                className={`w-full aspect-square border-2 border-coinbase-blue flex items-center justify-center text-sm font-bold rounded transition-all min-h-[48px] ${
                  isMarked ? 'bg-coinbase-blue text-white' : 'bg-white text-coinbase-blue hover:bg-blue-100'
                } ${num === 'FREE' ? 'text-xs rotate-[-45deg]' : ''} ${
                  isRecentDraw && !isMarked ? 'border-yellow-500 border-4 animate-pulse' : ''
                }`}
                disabled={isMarked || (typeof num !== 'number' && num !== 'FREE') || !gameStarted}
              >
                {num}
              </button>
            );
          })
        )}
      </div>

      <div className="flex justify-center gap-4 mb-2">
        <button
          onClick={startGame}
          className={`px-6 py-2 rounded-lg font-bold transition-all ${
            !canPlay
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-gray-500 text-white hover:bg-gray-600'
          }`}
          disabled={!canPlay}
        >
          {gameStarted ? 'New Game' : 'Start Game'} ({unlimitedToday ? 'Unlimited' : MAX_FREE_PLAYS - dailyPlays} left)
        </button>
      </div>

      {/* Timer display */}
      {timerActive && (
        <p className="text-xl text-red-500 font-bold mb-2">
          Time Left: {Math.floor(gameTimer / 60)}:{gameTimer % 60 < 10 ? '0' : ''}{gameTimer % 60}
        </p>
      )}

      {winInfo.types.length > 0 && (
        <div className="mt-4">
          <p className="text-2xl font-bold text-coinbase-blue animate-pulse mb-2">
            {winInfo.types.join(' + ')} ({winInfo.count} total)
          </p>
          {!isSharing && (
            <button
              onClick={() => shareWin(winInfo.types)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700"
            >
              Share Win on Farcaster (+1 Play)
            </button>
          )}
          {isSharing && (
            <p className="text-sm text-green-600">Sharing win...</p>
          )}
        </div>
      )}
    </div>
  );
}