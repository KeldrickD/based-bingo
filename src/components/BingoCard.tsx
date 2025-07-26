'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import html2canvas from 'html2canvas';
import { useAccount } from 'wagmi';
import { useWriteContracts } from 'wagmi/experimental';
import basedBingoABI from '@/abis/BasedBingo.json';
import bingoGameV3ABI from '@/abis/BingoGameV3.json';

const TOKEN_ADDRESS = '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047' as `0x${string}`;
const GAME_ADDRESS = '0x4CE879376Dc50aBB1Eb8F236B76e8e5a724780Be' as `0x${string}`;

function generateBingoCard() {
  const columnRanges = [
    { label: 'B', min: 1, max: 15 },
    { label: 'I', min: 16, max: 30 },
    { label: 'N', min: 31, max: 45 },
    { label: 'G', min: 46, max: 60 },
    { label: 'O', min: 61, max: 75 }
  ];
  
  const card: (number | string)[][] = columnRanges.map(({ min, max }) => 
    [...Array(max - min + 1)].map((_, i) => min + i)
      .sort(() => Math.random() - 0.5)
      .slice(0, 5)
  );
  
  // Set center cell as FREE
  (card[2] as (number | string)[])[2] = 'FREE';
  return card;
}

const checkWin = (marked: Set<string>) => {
  const positions = [
    // Rows
    ['00', '01', '02', '03', '04'], ['10', '11', '12', '13', '14'], ['20', '21', '22', '23', '24'],
    ['30', '31', '32', '33', '34'], ['40', '41', '42', '43', '44'],
    // Columns
    ['00', '10', '20', '30', '40'], ['01', '11', '21', '31', '41'], ['02', '12', '22', '32', '42'],
    ['03', '13', '23', '33', '43'], ['04', '14', '24', '34', '44'],
    // Diagonals
    ['00', '11', '22', '33', '44'], ['04', '13', '22', '31', '40'],
  ];
  
  const completed = positions.filter(line => 
    line.every(pos => marked.has(pos) || pos === '22')
  );
  
  const count = completed.length;
  const types: string[] = [];
  
  if (count >= 1) types.push('Line Bingo!');
  if (count >= 2) types.push('Double Line!');
  if (count === 12) types.push('Full House!');
  
  return { count, types };
};

export default function BingoCard() {
  const { address } = useAccount();
  const { writeContracts } = useWriteContracts();
  
  // Game state
  const [card, setCard] = useState<(number | string)[][]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set(['22']));
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [recentDraws, setRecentDraws] = useState<number[]>([]);
  const [winInfo, setWinInfo] = useState<{ count: number; types: string[] }>({ count: 0, types: [] });
  const [gameTimer, setGameTimer] = useState(120);
  const [timerActive, setTimerActive] = useState(false);
  const [autoDrawInterval, setAutoDrawInterval] = useState<NodeJS.Timeout | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Daily limits state
  const [dailyPlays, setDailyPlays] = useState(0);
  const [lastPlayDate, setLastPlayDate] = useState('');
  const [unlimitedToday, setUnlimitedToday] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const MAX_FREE_PLAYS = 3;

  // Initialize daily limits
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

  const resetGame = useCallback(() => {
    setCard(generateBingoCard());
    setMarked(new Set(['22']));
    setCurrentNumber(null);
    setDrawnNumbers(new Set());
    setRecentDraws([]);
    setWinInfo({ count: 0, types: [] });
    setGameTimer(120);
    setTimerActive(false);
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      setAutoDrawInterval(null);
    }
  }, [autoDrawInterval]);

  const stopAutoDraw = useCallback(() => {
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      setAutoDrawInterval(null);
    }
  }, [autoDrawInterval]);

  const startAutoDraw = useCallback(() => {
    const interval = setInterval(() => {
      setDrawnNumbers(prevDrawn => {
        if (prevDrawn.size >= 75) {
          console.log('🎮 All numbers drawn - game complete');
          clearInterval(interval);
          setTimerActive(false);
          alert('🎯 All numbers drawn! Game complete.');
          return prevDrawn;
        }
        
        let num: number;
        do {
          num = Math.floor(Math.random() * 75) + 1;
        } while (prevDrawn.has(num));
        
        const newDrawn = new Set([...prevDrawn, num]);
        setCurrentNumber(num);
        setRecentDraws(prev => [...prev, num].slice(-5));
        
        return newDrawn;
      });
    }, 3000);
    setAutoDrawInterval(interval);
  }, []);

  // Game timer management
  useEffect(() => {
    if (timerActive && gameTimer > 0) {
      const timer = setInterval(() => setGameTimer(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (gameTimer === 0 && timerActive) {
      stopAutoDraw();
      setTimerActive(false);
      alert('⏰ Time up! Game over.');
    }
  }, [timerActive, gameTimer, stopAutoDraw]);

  const startGame = useCallback(async () => {
    if (!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) {
      alert('Daily free plays used up! Share on Farcaster for +1 play or buy unlimited access.');
      return;
    }

    console.log('🎮 Starting new game...');
    resetGame();
    setTimerActive(true);
    startAutoDraw();

    // Join game via contract if wallet connected
    if (address && !unlimitedToday) {
      try {
        console.log('📞 Calling contract join...');
        await writeContracts({
          contracts: [
            {
              address: GAME_ADDRESS,
              abi: bingoGameV3ABI as any,
              functionName: 'join',
              args: [],
            },
          ],
          capabilities: process.env.NEXT_PUBLIC_CDP_RPC ? {
            paymasterService: { url: process.env.NEXT_PUBLIC_CDP_RPC },
          } : undefined,
        });
        
        console.log('✅ Successfully joined game');
        const newPlays = dailyPlays + 1;
        setDailyPlays(newPlays);
        localStorage.setItem('dailyPlays', newPlays.toString());
        
      } catch (error) {
        console.error('❌ Join failed:', error);
        alert('Join failed: ' + (error instanceof Error ? error.message : 'Check network or paymaster'));
        // Continue game even if join fails
      }
    } else if (!address) {
      // Demo mode - increment plays for rate limiting
      const newPlays = dailyPlays + 1;
      setDailyPlays(newPlays);
      localStorage.setItem('dailyPlays', newPlays.toString());
      console.log('🎮 Demo game started - connect wallet for rewards!');
    }
  }, [unlimitedToday, dailyPlays, address, writeContracts, resetGame, startAutoDraw]);

  const markCell = useCallback((row: number, col: number) => {
    const num = card[col]?.[row] ?? '';
    if (typeof num === 'number' && recentDraws.includes(num)) {
      const pos = `${col}${row}`;
      setMarked(prev => new Set([...prev, pos]));
    }
  }, [card, recentDraws]);

  // Win detection with automatic rewards
  useEffect(() => {
    const newWin = checkWin(marked);
    if (newWin.count > winInfo.count && address && newWin.count > 0) {
      setWinInfo(newWin);
      
      // Generate win image
      if (gridRef.current) {
        html2canvas(gridRef.current).then((canvas) => {
          const imageData = canvas.toDataURL('image/png');
          console.log('📸 Win image generated:', imageData);
        }).catch((error) => {
          console.error('Failed to generate win image:', error);
        });
      }

      const winType = newWin.types[newWin.types.length - 1]
        .toLowerCase()
        .replace(/!/g, '')
        .replace(/\s/g, '-');
      const shareUrl = `https://basedbingo.xyz/win/${winType}`;
      
      console.log(`🎉 New win detected: ${newWin.types.join(' + ')}`);
      alert(`🎉 New win! Share on Farcaster: ${shareUrl}`);

      // Auto-cast to Farcaster
      try {
        // Note: sdk.actions.cast may not be available in all environments
        if ('actions' in sdk && 'cast' in (sdk as any).actions) {
          (sdk as any).actions.cast({
            text: `Just got ${newWin.types.join(' + ')} in Based Bingo! Won ${1000 * newWin.types.length} $BINGO—play now!`,
            embeds: [{ url: shareUrl }],
          }).catch((error: any) => console.error('Cast failed:', error));
        } else {
          console.log('Farcaster cast not available in this environment');
        }
      } catch (error: any) {
        console.error('Farcaster cast failed:', error);
      }

      // Auto-award wins via backend
      fetch('/api/award-wins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, winTypes: newWin.types }),
      })
      .then(res => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('✅ Rewards awarded:', data);
        alert(`🎉 ${1000 * newWin.types.length} $BINGO automatically awarded to your wallet!`);
      })
      .catch((error) => {
        console.error('❌ Award failed:', error);
        alert('🎉 Win detected! However, reward processing failed. Please contact support.');
      });
    }
  }, [marked, address, winInfo.count]);

  const shareForExtraPlay = async () => {
    try {
      console.log('📢 Sharing for extra play...');
      
      // Note: sdk.actions.cast may not be available in all environments
      if ('actions' in sdk && 'cast' in (sdk as any).actions) {
        await (sdk as any).actions.cast({
          text: 'Loving Based Bingo—join the fun! https://basedbingo.xyz',
          embeds: [{ url: 'https://basedbingo.xyz' }],
        });
      } else {
        console.log('Farcaster cast not available, granting extra play anyway');
      }
      
      setDailyPlays(0);
      localStorage.setItem('dailyPlays', '0');
      alert('🎉 Shared successfully! You get +1 play today.');
      
    } catch (error: any) {
      console.error('❌ Share failed:', error);
      alert('Share failed—please try again.');
    }
  };

  const payForUnlimited = async () => {
    if (!address) {
      alert('Please connect your wallet first.');
      return;
    }

    if (isProcessingPayment) return;
    setIsProcessingPayment(true);

    try {
      console.log('💳 Purchasing unlimited access...');
      
      await writeContracts({
        contracts: [
          {
            address: TOKEN_ADDRESS,
            abi: basedBingoABI as any,
            functionName: 'approve',
            args: [GAME_ADDRESS, BigInt(50 * Math.pow(10, 18))],
          },
          {
            address: GAME_ADDRESS,
            abi: bingoGameV3ABI as any,
            functionName: 'buyUnlimited',
            args: [],
          },
        ],
        capabilities: process.env.NEXT_PUBLIC_CDP_RPC ? {
          paymasterService: { url: process.env.NEXT_PUBLIC_CDP_RPC },
        } : undefined,
      });
      
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('unlimitedDate', today);
      setUnlimitedToday(true);
      alert('✅ Unlimited access unlocked for today with 50 $BINGO!');
      console.log('✅ Unlimited purchase completed');
      
    } catch (error) {
      console.error('❌ Unlimited purchase failed:', error);
      alert('Failed to purchase unlimited access: ' + 
        (error instanceof Error ? error.message : 'Check $BINGO balance and network'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="text-center max-w-sm mx-auto">
      {/* Wallet Connection */}
      {!address ? (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <button className="w-full bg-coinbase-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 mb-2">
            Connect Wallet
          </button>
          <p className="text-xs text-blue-700">Connect for automatic $BINGO rewards</p>
        </div>
      ) : (
        <div className="mb-4 p-2 bg-green-50 rounded-lg">
          <p className="text-sm text-coinbase-blue font-semibold">
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
          </p>
          {process.env.NEXT_PUBLIC_CDP_RPC && (
            <p className="text-xs text-green-600">⚡ Gasless transactions enabled</p>
          )}
        </div>
      )}

      {/* Timer */}
      {timerActive && (
        <div className="mb-4">
          <p className="text-xl text-red-500 font-bold animate-pulse">
            ⏰ Time Left: {Math.floor(gameTimer / 60)}:{gameTimer % 60 < 10 ? '0' : ''}{gameTimer % 60}
          </p>
        </div>
      )}

      {/* Recent Draws */}
      <div className="flex justify-center gap-2 mb-4">
        {recentDraws.length > 0 ? (
          recentDraws.map((num, idx) => (
            <div
              key={idx}
              className={`w-12 h-12 border-2 border-coinbase-blue flex items-center justify-center text-lg font-bold rounded transition-all duration-500
                ${idx === recentDraws.length - 1 ? 'bg-coinbase-blue text-white animate-bounce' : 'bg-white text-coinbase-blue opacity-60'}`}
            >
              {num}
            </div>
          ))
        ) : (
          <div className="h-12 flex items-center justify-center">
            <p className="text-sm text-gray-400">Waiting for draws...</p>
          </div>
        )}
      </div>

      {/* Bingo Grid */}
      <div ref={gridRef} className="grid grid-cols-5 gap-1 mb-4">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div key={letter} className="font-bold text-coinbase-blue text-lg">{letter}</div>
        ))}
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: 5 }).map((_, col) => {
            const num = card[col]?.[row] ?? '';
            const pos = `${col}${row}`;
            const isMarked = marked.has(pos) || (num === 'FREE' && pos === '22');
            const isDrawn = typeof num === 'number' && recentDraws.includes(num);
            
            return (
              <button
                key={pos}
                onClick={() => markCell(row, col)}
                className={`w-full aspect-square border-2 border-coinbase-blue flex items-center justify-center text-sm font-bold rounded transition-all duration-200
                  ${isMarked ? 'bg-coinbase-blue text-white shadow-lg' : 'bg-white text-coinbase-blue hover:bg-blue-100'}
                  ${num === 'FREE' ? 'text-xs' : ''}
                  ${isDrawn && !isMarked ? 'animate-pulse border-green-500 border-4' : ''}`}
                disabled={isMarked || (typeof num !== 'number' && num !== 'FREE')}
              >
                {num === 'FREE' ? (
                  <span className="rotate-[-45deg]">FREE</span>
                ) : (
                  num
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Game Controls */}
      <div className="flex justify-center gap-4 mb-4">
        <button 
          onClick={startGame}
          disabled={!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS}
          className="bg-coinbase-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          🎮 New Game ({unlimitedToday ? 'Unlimited' : `${MAX_FREE_PLAYS - dailyPlays} left`})
        </button>
      </div>

      {/* Win Status */}
      {winInfo.types.length > 0 && (
        <div className="mb-4 p-4 bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-lg shadow-lg">
          <p className="text-2xl font-bold animate-pulse mb-2">
            🎉 {winInfo.types.join(' + ')} 
          </p>
          <p className="text-sm opacity-90 mb-2">({winInfo.count} total wins)</p>
          
          <div className="bg-white/20 rounded-lg p-3">
            <div className="text-lg font-bold mb-1">
              ✨ Rewards Sent Automatically! ✨
            </div>
            <div className="text-sm opacity-90">
              🎯 {1000 * winInfo.types.length} $BINGO tokens awarded
            </div>
            <div className="text-xs opacity-75 mt-1">
              No claiming needed - instant rewards!
            </div>
          </div>
          
          {timerActive && (
            <p className="text-xs opacity-80 mt-2">
              🎮 Game continues! Keep playing for more wins!
            </p>
          )}
        </div>
      )}

      {/* Daily Limit Upsells */}
      {(!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) && (
        <div className="mb-4 p-4 bg-blue-100 rounded-lg shadow-md">
          <p className="text-coinbase-blue mb-3 font-semibold">
            🎯 Free plays used up today! Get more:
          </p>
          <div className="space-y-2">
            <button 
              onClick={shareForExtraPlay}
              className="w-full bg-coinbase-blue text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-600 transition-colors"
            >
              📢 Share on Farcaster (+1 Play)
            </button>
            <button 
              onClick={payForUnlimited}
              disabled={isProcessingPayment || !address}
              className={`w-full px-4 py-2 rounded-lg font-bold transition-colors ${
                isProcessingPayment || !address
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isProcessingPayment ? '⏳ Processing...' : 
               !address ? '🔗 Connect Wallet First' :
               '💰 Pay 50 $BINGO (Unlimited Today)'}
            </button>
          </div>
          {process.env.NEXT_PUBLIC_CDP_RPC && (
            <p className="text-xs text-green-600 mt-2">⚡ Gasless transactions enabled</p>
          )}
        </div>
      )}
    </div>
  );
}