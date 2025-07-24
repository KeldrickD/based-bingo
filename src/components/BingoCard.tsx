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

  card[2][2] = 'FREE';
  return card;
}

function checkWin(marked: Set<string>): { count: number; types: string[] } {
  const positions = [
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

  const completed = positions.filter((line) => line.every((pos) => marked.has(pos) || pos === '22'));
  const count = completed.length;
  let types: string[] = [];
  if (count >= 1) types.push('Line Bingo!');
  if (count >= 2) types.push('Double Line!');
  if (count === 12) types.push('Full House!');

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
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Daily limits
  const [dailyPlays, setDailyPlays] = useState(0);
  const [unlimitedToday, setUnlimitedToday] = useState(false);
  const MAX_FREE_PLAYS = 3;

  // Initialize card and load daily limits
  useEffect(() => {
    const newCard = generateBingoCard();
    setCard(newCard);

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

  const stopAutoDraw = () => {
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      setAutoDrawInterval(null);
    }
  };

  // Game timer countdown
  useEffect(() => {
    if (timerActive && gameTimer > 0) {
      const interval = setInterval(() => setGameTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    } else if (gameTimer === 0) {
      stopAutoDraw();
      setTimerActive(false);
      alert('Time up! Game over.');
    }
  }, [timerActive, gameTimer, autoDrawInterval]);

  const startGame = () => {
    if (!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) {
      alert('Daily limit reached! Share on Farcaster for +1 play or pay 50 $BINGO for unlimited.');
      return;
    }

    resetGame();
    setTimerActive(true);
    startAutoDraw();

    // Charge entry fee if not unlimited
    if (!unlimitedToday && address) {
      writeContract({
        address: GAME_ADDRESS,
        abi: bingoGameABI,
        functionName: 'join',
        value: BigInt(Math.floor(0.0005 * 10**18)), // 0.0005 ETH
      });
      
      // Update plays count for UI feedback
      const newPlays = dailyPlays + 1;
      setDailyPlays(newPlays);
      localStorage.setItem('dailyPlays', newPlays.toString());
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
    stopAutoDraw();
  };

  const startAutoDraw = () => {
    const interval = setInterval(() => {
      setDrawnNumbers((prevDrawnNumbers) => {
        if (prevDrawnNumbers.size >= 75 || gameTimer <= 0) {
          stopAutoDraw();
          return prevDrawnNumbers;
        }

        let num: number;
        do {
          num = Math.floor(Math.random() * 75) + 1;
        } while (prevDrawnNumbers.has(num));

        const newDrawnNumbers = new Set([...prevDrawnNumbers, num]);
        
        setCurrentNumber(num);
        setRecentDraws((prev) => {
          const newDraws = [...prev, num].slice(-5); // Keep last 5
          return newDraws;
        });
        
        return newDrawnNumbers;
      });
    }, 3000); // 3s interval for one number

    setAutoDrawInterval(interval);
  };

  const markCell = (row: number, col: number) => {
    const num = card[col][row];
    if (typeof num === 'number' && recentDraws.includes(num)) {
      const pos = `${col}${row}`;
      setMarked((prev) => new Set([...prev, pos]));
    }
  };

  // Win detection and rewards
  useEffect(() => {
    const newWin = checkWin(marked);
    if (newWin.count > winInfo.count && address && newWin.count > 0) {
      setWinInfo(newWin);
      
      // Generate win image
      if (gridRef.current) {
        toPng(gridRef.current).then((dataUrl) => {
          console.log('Win image generated:', dataUrl);
          // TODO: Upload to IPFS for sharing
        }).catch((error) => {
          console.error('Failed to generate win image:', error);
        });
      }

      const winType = newWin.types[newWin.types.length - 1].toLowerCase().replace(/!/g, '').replace(/\s/g, '-');
      const shareUrl = `https://basedbingo.xyz/win/${winType}`;
      
      alert(`🎉 ${newWin.types.join(' + ')}! Share your win: ${shareUrl}`);

      // Auto-claim reward (owner-only for now)
      writeContract({
        address: GAME_ADDRESS,
        abi: bingoGameABI,
        functionName: 'claimWin',
        args: [address],
      });

      // Auto-share win (when SDK is working)
      try {
        console.log(`Win detected: ${newWin.types.join(' + ')} - Share URL: ${shareUrl}`);
        // TODO: Implement auto-cast when Farcaster SDK is fixed
      } catch (error) {
        console.error('Failed to share win:', error);
      }
    }
  }, [marked, address, winInfo.count, writeContract]);

  const shareForExtraPlay = async () => {
    try {
      // For now, just grant the extra play
      // TODO: Implement actual Farcaster sharing when SDK is working
      const newPlays = Math.max(0, dailyPlays - 1);
      setDailyPlays(newPlays);
      localStorage.setItem('dailyPlays', newPlays.toString());
      alert('Extra play granted! (Share feature coming soon)');
    } catch (error) {
      console.error('Share failed:', error);
      alert('Share failed—try again.');
    }
  };

  const payForUnlimited = async () => {
    if (!address) {
      alert('Please connect your wallet.');
      return;
    }

    if (isProcessingPayment) {
      return; // Prevent double-clicking
    }

    setIsProcessingPayment(true);

    try {
      // Step 1: Approve the BingoGame contract to spend 50 $BINGO
      console.log('Approving 50 $BINGO for unlimited play...');
      writeContract({
        address: TOKEN_ADDRESS,
        abi: basedBingoABI,
        functionName: 'approve',
        args: [GAME_ADDRESS, BigInt(50 * 10**18)], // Approve 50 $BINGO
      });

      // Small delay to ensure approval is processed
      setTimeout(() => {
        // Step 2: Call buyUnlimited after approval
        console.log('Purchasing unlimited play...');
        writeContract({
          address: GAME_ADDRESS,
          abi: bingoGameABI,
          functionName: 'buyUnlimited',
          args: [],
        });

        // Update UI immediately for feedback
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('unlimitedDate', today);
        setUnlimitedToday(true);
        alert('Unlimited access unlocked for today with 50 $BINGO!');
        setIsProcessingPayment(false);
      }, 2000);

    } catch (error) {
      console.error('Unlimited purchase failed:', error);
      alert('Failed to purchase unlimited access. Make sure you have 50 $BINGO tokens.');
      setIsProcessingPayment(false);
    }
  };

  const canPlay = unlimitedToday || dailyPlays < MAX_FREE_PLAYS;

  return (
    <div className="text-center max-w-sm mx-auto">
      {/* Wallet Connection */}
      {!address ? (
        <button
          onClick={() => {/* MiniKit handles connection automatically */}}
          className="bg-coinbase-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 mb-4"
        >
          Connect Wallet (for $BINGO)
        </button>
      ) : (
        <p className="text-sm text-coinbase-blue mb-4">
          Connected: {address.slice(0, 6)}...{address.slice(-4)}
        </p>
      )}

      {/* Recent draws display moved to top */}
      <div className="mb-4 min-h-[80px]">
        {recentDraws.length > 0 ? (
          <>
            <p className="text-sm text-coinbase-blue mb-2">Recent Draws:</p>
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

      {/* Bingo Card */}
      <div ref={gridRef} className="grid grid-cols-5 gap-1 mb-4">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div key={letter} className="font-bold text-coinbase-blue text-lg h-8 flex items-center justify-center">
            {letter}
          </div>
        ))}
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: 5 }).map((_, col) => {
            const num = card[col]?.[row] ?? '';
            const pos = `${col}${row}`;
            const isMarked = marked.has(pos) || (num === 'FREE' && pos === '22');
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
                disabled={isMarked || (typeof num !== 'number' && num !== 'FREE') || !timerActive}
              >
                {num}
              </button>
            );
          })
        )}
      </div>

      {/* Game Controls */}
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
          {timerActive ? 'New Game' : 'Start Game'} ({unlimitedToday ? 'Unlimited' : MAX_FREE_PLAYS - dailyPlays} left)
        </button>
      </div>

      {/* Timer */}
      {timerActive && (
        <p className="text-xl text-red-500 font-bold mb-2">
          Time Left: {Math.floor(gameTimer / 60)}:{gameTimer % 60 < 10 ? '0' : ''}{gameTimer % 60}
        </p>
      )}

      {/* Win Display */}
      {winInfo.types.length > 0 && (
        <p className="text-2xl font-bold text-coinbase-blue mt-4 animate-pulse">
          {winInfo.types.join(' + ')} ({winInfo.count} total)
        </p>
      )}

      {/* Daily Limit Upsells */}
      {(!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) && (
        <div className="mt-4 p-4 bg-blue-100 rounded-lg">
          <p className="text-coinbase-blue mb-2">Free plays used up today! Get more:</p>
          <div className="space-y-2">
            <button
              onClick={shareForExtraPlay}
              className="bg-coinbase-blue text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-600 w-full"
            >
              Share on Farcaster (+1 Play)
            </button>
            <button
              onClick={payForUnlimited}
              disabled={isProcessingPayment}
              className={`px-4 py-2 rounded-lg font-bold w-full ${
                isProcessingPayment
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isProcessingPayment ? 'Processing...' : 'Pay 50 $BINGO (Unlimited Today)'}
            </button>
          </div>
        </div>
      )}

      {/* Daily Play Counter */}
      <div className="mt-4 text-sm text-gray-600">
        <p>
          Plays today: {dailyPlays}/{MAX_FREE_PLAYS} 
          {unlimitedToday && ' (Unlimited Active)'}
        </p>
      </div>
    </div>
  );
}