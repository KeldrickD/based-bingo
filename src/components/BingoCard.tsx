'use client'; // Client-side for state

import React, { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { sdk } from '@farcaster/miniapp-sdk';

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

  card[2][2] = 'FREE'; // Explicitly set center free space
  return card;
}

function checkWin(marked: Set<string>): boolean {
  const wins = [
    // Rows
    ['00', '01', '02', '03', '04'],
    ['10', '11', '12', '13', '14'],
    ['20', '21', '22', '23', '24'],
    ['30', '31', '32', '33', '34'],
    ['40', '41', '42', '43', '44'],
    // Columns
    ['00', '10', '20', '30', '40'],
    ['01', '11', '21', '31', '41'],
    ['02', '12', '22', '32', '42'],
    ['03', '13', '23', '33', '43'],
    ['04', '14', '24', '34', '44'],
    // Diagonals
    ['00', '11', '22', '33', '44'],
    ['04', '13', '22', '31', '40'],
  ];
  return wins.some((line) => line.every((pos) => marked.has(pos) || pos === '22'));
}

export default function BingoCard() {
  const [card, setCard] = useState<(number | string)[][]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set(['22'])); // FREE marked by default
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set()); // Track uniques
  const [isWin, setIsWin] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Daily limit logic
  const [dailyPlays, setDailyPlays] = useState(0);
  const [lastPlayDate, setLastPlayDate] = useState('');
  const [unlimitedAccess, setUnlimitedAccess] = useState(false); // For future premium users
  const MAX_FREE_PLAYS = 3;

  // Timer logic
  const [timer, setTimer] = useState(60);
  const [timerActive, setTimerActive] = useState(false);

  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const miniKit = useMiniKit();

  useEffect(() => {
    resetGame();
  }, []);

  // Daily plays tracking
  useEffect(() => {
    const storedDate = localStorage.getItem('lastPlayDate');
    const storedPlays = parseInt(localStorage.getItem('dailyPlays') || '0');
    const today = new Date().toISOString().split('T')[0];

    if (storedDate !== today) {
      setDailyPlays(0);
      setLastPlayDate(today);
      localStorage.setItem('dailyPlays', '0');
      localStorage.setItem('lastPlayDate', today);
    } else {
      setDailyPlays(storedPlays);
      setLastPlayDate(storedDate);
    }
  }, []);

  // Timer effect
  useEffect(() => {
    if (timerActive && timer > 0) {
      const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    } else if (timer === 0 && timerActive) {
      setTimerActive(false);
      setCurrentNumber(null); // Miss turn
    }
  }, [timer, timerActive]);

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

  const resetGame = () => {
    // Check daily limit
    if (dailyPlays >= MAX_FREE_PLAYS && !unlimitedAccess) {
      return; // Don't reset if limit reached
    }

    const newCard = generateBingoCard();
    setCard(newCard);
    setMarked(new Set(['22']));
    setCurrentNumber(null);
    setDrawnNumbers(new Set());
    setIsWin(false);
    setTimer(60);
    setTimerActive(false);
    
    // Increment daily plays
    setDailyPlays((prev) => {
      const newPlays = prev + 1;
      localStorage.setItem('dailyPlays', newPlays.toString());
      return newPlays;
    });

    console.log('New Game Started. Card:', newCard);
    console.log('Center (col 2, row 2):', newCard[2][2]); // Debug
  };

  const drawNumber = () => {
    let num: number;
    do {
      num = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.has(num)); // Ensure unique
    setDrawnNumbers((prev) => new Set([...prev, num]));
    setCurrentNumber(num);
    setTimer(60);
    setTimerActive(true);
  };

  const markCell = (row: number, col: number) => {
    const num = card[col][row];
    if (typeof num === 'number' && num === currentNumber) {
      const pos = `${col}${row}`;
      setMarked((prev) => new Set([...prev, pos]));
      setTimerActive(false); // Stop timer when number is marked
    }
  };

  const handleShareForPlay = async () => {
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

  const extendTimer = () => {
    // Future: Add $BINGO token cost for extending timer
    setTimer((prev) => prev + 30);
  };

  useEffect(() => {
    if (checkWin(marked)) {
      setIsWin(true);
      setTimerActive(false);
    }
  }, [marked]);

  const canPlay = dailyPlays < MAX_FREE_PLAYS || unlimitedAccess;

  return (
    <div className="text-center max-w-sm mx-auto"> {/* Responsive container */}
      {!isHydrated ? (
        <div className="mb-4 p-2 text-coinbase-blue">Loading...</div>
      ) : (
        <>
          {isConnecting ? (
            <p className="text-coinbase-blue mb-4">Connecting...</p>
          ) : isConnected ? (
            <p className="text-sm text-coinbase-blue mb-4">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })} // Triggers SIWF/in-app if needed
              className="bg-coinbase-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 mb-4"
            >
              Connect Wallet (for $BINGO beta)
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
              onClick={handleShareForPlay}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700"
            >
              Share on Farcaster for +1 Play
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1 mb-4">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div key={letter} className="font-bold text-coinbase-blue text-lg">
            {letter}
          </div>
        ))}
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: 5 }).map((_, col) => {
            const num = card[col]?.[row] ?? '';
            const pos = `${col}${row}`;
            const isMarked = marked.has(pos) || (num === 'FREE' && pos === '22'); // Visually mark FREE
            return (
              <button
                key={pos}
                onClick={() => markCell(row, col)}
                className={`w-full aspect-square border-2 border-coinbase-blue flex items-center justify-center text-sm font-bold rounded
                  ${isMarked ? 'bg-coinbase-blue text-white' : 'bg-white text-coinbase-blue hover:bg-blue-100'}
                  ${num === 'FREE' ? 'text-xs rotate-[-45deg]' : ''}`}
                disabled={isMarked || (typeof num !== 'number' && num !== 'FREE')}
              >
                {num}
              </button>
            );
          })
        )}
      </div>

      {/* Timer display */}
      {timerActive && (
        <div className="mb-4">
          <p className={`text-lg font-bold ${timer <= 10 ? 'text-red-500' : 'text-coinbase-blue'}`}>
            Time left: {timer}s
          </p>
          {timer <= 10 && (
            <button
              onClick={extendTimer}
              className="bg-yellow-500 text-white px-3 py-1 rounded text-sm font-bold hover:bg-yellow-600 mt-1"
            >
              +30s (10 $BINGO)
            </button>
          )}
        </div>
      )}

      <div className="flex justify-center gap-4 mb-2">
        <button
          onClick={drawNumber}
          className={`px-6 py-2 rounded-lg font-bold transition-all ${
            isWin || drawnNumbers.size >= 75 || !canPlay
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-coinbase-blue text-white hover:bg-blue-600'
          }`}
          disabled={isWin || drawnNumbers.size >= 75 || !canPlay}
        >
          Draw Number
        </button>
        <button
          onClick={resetGame}
          className={`px-6 py-2 rounded-lg font-bold transition-all ${
            !canPlay
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-gray-500 text-white hover:bg-gray-600'
          }`}
          disabled={!canPlay}
        >
          New Game
        </button>
      </div>
      {currentNumber && <p className="text-xl mt-2 text-coinbase-blue">Current Draw: {currentNumber}</p>}
      {isWin && <p className="text-2xl font-bold text-coinbase-blue mt-4 animate-pulse">BINGO! You Win 100 $BINGO (coming soon!)</p>}
    </div>
  );
}