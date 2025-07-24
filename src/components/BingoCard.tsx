'use client'; // Client-side for state

import React, { useState, useEffect, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk'; // For shares
import { toPng } from 'html-to-image'; // For win snapshots
import { useAccount, useWriteContract } from 'wagmi';
import basedBingoABI from '@/abis/BasedBingo.json';
import bingoGameABI from '@/abis/BingoGame.json';

const TOKEN_ADDRESS = '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047' as `0x${string}`;
const GAME_ADDRESS = '0x22cF7a77491614B0b69FF9Fd77D0F63048DB5dDb' as `0x${string}`;

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
  const { address } = useAccount();
  const { writeContract } = useWriteContract();
  const [card, setCard] = useState<(number | string)[][]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set(['22']));
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [recentDraws, setRecentDraws] = useState<number[]>([]);
  const [winInfo, setWinInfo] = useState<{ count: number; types: string[] }>({ count: 0, types: [] });
  const [gameTimer, setGameTimer] = useState(120); // 2 mins
  const [timerActive, setTimerActive] = useState(false);
  const [autoDrawInterval, setAutoDrawInterval] = useState<NodeJS.Timeout | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Daily limits
  const [dailyPlays, setDailyPlays] = useState(0);
  const [lastPlayDate, setLastPlayDate] = useState('');
  const [unlimitedToday, setUnlimitedToday] = useState(false);
  const MAX_FREE_PLAYS = 3;

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const storedDate = localStorage.getItem('lastPlayDate');
    const storedPlays = parseInt(localStorage.getItem('dailyPlays') || '0');
    const storedUnlimited = localStorage.getItem('unlimitedDate') === today;

    if (storedDate !== today) {
      localStorage.setItem('lastPlayDate', today);
      localStorage.setItem('dailyPlays', '0');
      localStorage.removeItem('unlimitedDate');
      setLastPlayDate(today);
      setDailyPlays(0);
      setUnlimitedToday(false);
    } else {
      setLastPlayDate(storedDate || '');
      setDailyPlays(storedPlays);
      setUnlimitedToday(storedUnlimited);
    }
  }, []);

  useEffect(() => {
    if (timerActive && gameTimer > 0) {
      const interval = setInterval(() => setGameTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    } else if (gameTimer === 0) {
      stopAutoDraw();
      alert('Time up! Game over.');
    }
  }, [timerActive, gameTimer]);

  useEffect(() => {
    const newCard = generateBingoCard();
    setCard(newCard);
  }, []);

  const startGame = () => {
    if (!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) return;

    resetGame();
    setTimerActive(true);
    startAutoDraw();

    if (!unlimitedToday && address) {
      writeContract({
        address: GAME_ADDRESS,
        abi: bingoGameABI,
        functionName: 'join',
        value: BigInt(0.0005 * 10**18), // 0.0005 ETH
      }).then(() => {
        const newPlays = dailyPlays + 1;
        setDailyPlays(newPlays);
        localStorage.setItem('dailyPlays', newPlays.toString());
      }).catch((error) => console.error('Join failed:', error));
    }
  };

  const resetGame = () => {
    const newCard = generateBingoCard();
    setCard(newCard);
    setMarked(new Set(['22']));
    setCurrentNumber(null);
    setDrawnNumbers(new Set());
    setRecentDraws([]);
    setWinInfo({ count: 0, types: [] });
    setGameTimer(120);
    setTimerActive(false);
    if (autoDrawInterval) clearInterval(autoDrawInterval);
  };

  const startAutoDraw = () => {
    const interval = setInterval(() => {
      if (drawnNumbers.size >= 75 || gameTimer <= 0) {
        stopAutoDraw();
        return;
      }

      let num1: number, num2: number;
      do {
        num1 = Math.floor(Math.random() * 75) + 1;
      } while (drawnNumbers.has(num1));
      do {
        num2 = Math.floor(Math.random() * 75) + 1;
      } while (drawnNumbers.has(num2) || num2 === num1);

      setDrawnNumbers((prev) => new Set([...prev, num1, num2]));
      setCurrentNumber(num2); // Latest number
      setRecentDraws((prev) => {
        const newDraws = [...prev, num1, num2].slice(-5); // Keep last 5
        return newDraws;
      });
    }, 5000); // 5s interval for two numbers

    setAutoDrawInterval(interval);
  };

  const stopAutoDraw = () => {
    if (autoDrawInterval) clearInterval(autoDrawInterval);
  };

  const markCell = (row: number, col: number) => {
    const num = card[col][row];
    if (typeof num === 'number' && recentDraws.includes(num)) {
      const pos = `${col}${row}`;
      setMarked((prev) => new Set([...prev, pos]));
    }
  };

  useEffect(() => {
    const newWin = checkWin(marked);
    if (newWin.count > winInfo.count && address) {
      setWinInfo(newWin);
      if (gridRef.current) {
        toPng(gridRef.current).then((dataUrl) => {
          console.log('Win image:', dataUrl); // Placeholder; upload to IPFS later
        });
      }

      const winType = newWin.types[newWin.types.length - 1].toLowerCase().replace(/!/g, '').replace(/\s/g, '-');
      const shareUrl = `https://based-bingo.vercel.app/win/${winType}`;
      alert(`New win! Share on Farcaster: ${shareUrl}`);

      sdk.actions.cast({
        text: `Just got ${newWin.types.join(' + ')} in Based Bingo! Won 1000 $BINGO—play now!`,
        embeds: [{ url: shareUrl }],
      }).catch((error) => console.error('Cast failed:', error));

      // Owner claims reward (for now; automate later)
      writeContract({
        address: GAME_ADDRESS,
        abi: bingoGameABI,
        functionName: 'claimWin',
        args: [address],
      }).catch((error) => console.error('Claim failed:', error));
    }
  }, [marked, address, winInfo.count]);

  const shareForExtraPlay = async () => {
    try {
      await sdk.actions.cast({
        text: 'Loving Based Bingo—join the fun! https://based-bingo.vercel.app',
        embeds: [{ url: 'https://based-bingo.vercel.app' }],
      });
      setDailyPlays(0);
      alert('Shared! You get +1 play today.');
    } catch (error) {
      console.error('Share failed:', error);
      alert('Share failed—try again.');
    }
  };

  const payForUnlimited = () => {
    if (address) {
      writeContract({
        address: GAME_ADDRESS,
        abi: bingoGameABI,
        functionName: 'buyUnlimited',
        args: [],
      }).then(() => {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('unlimitedDate', today);
        setUnlimitedToday(true);
        alert('Unlimited access unlocked for today!');
      }).catch((error) => console.error('Unlimited purchase failed:', error));
    }
  };

  return (
    <div className="text-center max-w-sm mx-auto">
      {!address ? (
        <button
          onClick={() => {/* Assume MiniKit handles connect */}}
          className="bg-coinbase-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 mb-4"
        >
          Connect Wallet (for $BINGO)
        </button>
      ) : (
        <p className="text-sm text-coinbase-blue mb-4">Connected: {address.slice(0, 6)}...{address.slice(-4)}</p>
      )}

      <div ref={gridRef} className="grid grid-cols-5 gap-1 mb-4">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div key={letter} className="font-bold text-coinbase-blue text-lg">
            {letter}
          </div>
        ))}
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: 5 }).map((_, col) => {
            const num = card[col]?.[row] ?? '';
            const pos = `${col}${row}`;
            const isMarked = marked.has(pos) || (num === 'FREE' && pos === '22');
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

      <div className="flex justify-center gap-4 mb-2">
        <button onClick={startGame} className="bg-gray-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-600">
          New Game ({unlimitedToday ? 'Unlimited' : MAX_FREE_PLAYS - dailyPlays} left)
        </button>
      </div>

      {timerActive && <p className="text-xl text-red-500">Time Left: {Math.floor(gameTimer / 60)}:{gameTimer % 60 < 10 ? '0' : ''}{gameTimer % 60}</p>}

      <div className="flex justify-center gap-2 mt-2">
        {recentDraws.map((num, idx) => (
          <div
            key={idx}
            className={`w-12 h-12 border-2 border-coinbase-blue flex items-center justify-center text-lg font-bold rounded ${idx < recentDraws.length - 1 ? 'opacity-50' : ''}`}
          >
            {num}
          </div>
        ))}
      </div>

      {winInfo.types.length > 0 && (
        <p className="text-2xl font-bold text-coinbase-blue mt-4 animate-pulse">{winInfo.types.join(' + ')} ({winInfo.count} total)</p>
      )}

      {(!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) && (
        <div className="mt-4 p-4 bg-blue-100 rounded-lg">
          <p className="text-coinbase-blue mb-2">Free plays used up today! Get more:</p>
          <button
            onClick={shareForExtraPlay}
            className="bg-coinbase-blue text-white px-4 py-2 rounded mr-2"
          >
            Share on Farcaster (+1 Play)
          </button>
          <button
            onClick={payForUnlimited}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Pay 50 $BINGO (Unlimited Today)
          </button>
        </div>
      )}
    </div>
  );
}