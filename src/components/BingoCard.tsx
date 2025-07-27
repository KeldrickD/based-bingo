'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { toPng } from 'html-to-image';
import { useAccount } from 'wagmi';
import { useWriteContracts } from 'wagmi/experimental';
import basedBingoABI from '@/abis/BasedBingo.json';
import bingoGameV3ABI from '@/abis/BingoGameV3.json';

const TOKEN_ADDRESS = '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047' as `0x${string}`;
const GAME_ADDRESS = '0x4CE879376Dc50aBB1Eb8F236B76e8e5a724780Be' as `0x${string}`;

function generateBingoCard(): (number | string)[][] {
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
  card[2][2] = 'FREE';
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
  
  const completed = positions.filter(line => line.every(pos => marked.has(pos) || pos === '22'));
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
          console.log('🎮 All numbers drawn - stopping auto draw');
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

    console.log('🎮 Starting new FREE game (no contract join required)...');
    resetGame();
    setTimerActive(true);
    startAutoDraw();

    // Update plays count - no contract interaction needed for free games
    if (!unlimitedToday) {
      const newPlays = dailyPlays + 1;
      setDailyPlays(newPlays);
      localStorage.setItem('dailyPlays', newPlays.toString());
      console.log('✅ Free game started - play count updated to:', newPlays);
    }
    
    if (!address) {
      console.log('🎮 Demo game started - connect wallet for automatic rewards!');
    } else {
      console.log('🎮 Free game started with wallet connected - ready for automatic rewards!');
    }
  }, [unlimitedToday, dailyPlays, resetGame, startAutoDraw, address]);

  const markCell = useCallback((row: number, col: number) => {
    const num = card[col]?.[row] ?? '';
    if (typeof num === 'number' && recentDraws.includes(num)) {
      const pos = `${col}${row}`;
      setMarked(prev => new Set([...prev, pos]));
    }
  }, [card, recentDraws]);

  // Enhanced win detection with comprehensive logging
  useEffect(() => {
    const newWin = checkWin(marked);
    console.log('🔍 Win check:', { 
      newCount: newWin.count, 
      oldCount: winInfo.count, 
      newTypes: newWin.types,
      hasAddress: !!address,
      shouldTrigger: newWin.count > winInfo.count && address && newWin.count > 0
    });
    
    if (newWin.count > winInfo.count && address && newWin.count > 0) {
      console.log('🎉 WIN DETECTED:', { 
        newWinCount: newWin.count, 
        previousWinCount: winInfo.count,
        winTypes: newWin.types,
        address: `${address.slice(0, 6)}...${address.slice(-4)}`,
        timestamp: new Date().toISOString()
      });
      
      setWinInfo(newWin);
      
      // Generate win image
      if (gridRef.current) {
        toPng(gridRef.current).then((dataUrl) => {
          console.log('📸 Win image generated:', dataUrl.length, 'bytes');
        }).catch((error: any) => {
          console.error('Win image generation failed:', error);
        });
      }

      const winType = newWin.types[newWin.types.length - 1]
        .toLowerCase()
        .replace(/!/g, '')
        .replace(/\s/g, '-');
      const shareUrl = `https://basedbingo.xyz/win/${winType}`;
      
      alert(`🎉 ${newWin.types.join(' + ')} achieved! Rewards being sent automatically... Share: ${shareUrl}`);

      // Auto-cast to Farcaster  
      try {
        if ('actions' in sdk && 'cast' in (sdk as any).actions) {
          (sdk as any).actions.cast({
            text: `Just got ${newWin.types.join(' + ')} in Based Bingo! Won ${1000 * newWin.types.length} $BINGO—play now!`,
            embeds: [{ url: shareUrl }],
          }).catch((error: any) => console.error('Farcaster cast failed:', error));
        } else {
          console.log('Farcaster cast not available in this environment');
        }
      } catch (error: any) {
        console.error('Farcaster SDK error:', error);
      }

      // CRITICAL: Auto-award wins via backend with enhanced logging
      console.log('🚀 Starting automatic reward process...');
      console.log('📡 Calling /api/award-wins with:', { address, winTypes: newWin.types });
      console.log('🔗 API URL:', window.location.origin + '/api/award-wins');
      console.log('🌐 Current origin:', window.location.origin);
      console.log('🕐 Request timestamp:', new Date().toISOString());
      
      const requestPayload = { address, winTypes: newWin.types };
      console.log('📦 Request payload:', JSON.stringify(requestPayload, null, 2));
      
      fetch('/api/award-wins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })
      .then(res => {
        console.log('📨 API Response received:', { 
          status: res.status, 
          statusText: res.statusText,
          ok: res.ok,
          url: res.url,
          headers: Object.fromEntries(res.headers.entries())
        });
        
        if (!res.ok) {
          return res.text().then(text => {
            console.error('📨 Error response body:', text);
            console.error('📨 Full error details:', {
              status: res.status,
              statusText: res.statusText,
              body: text,
              url: res.url
            });
            throw new Error(`Server error: ${res.status} ${res.statusText} - ${text}`);
          });
        }
        return res.json();
      })
      .then(data => {
        console.log('✅ Award API success response:', JSON.stringify(data, null, 2));
        if (data.success) {
          console.log('🎉 SUCCESS: Tokens awarded successfully!');
          console.log('💰 Reward details:', {
            totalRewards: data.totalRewards || (1000 * newWin.types.length),
            transactionHash: data.transactionHash,
            blockNumber: data.blockNumber,
            gasUsed: data.gasUsed,
            processingTime: data.processingTimeMs
          });
          alert(`🎉 ${1000 * newWin.types.length} $BINGO automatically awarded! Tx: ${data.transactionHash?.slice(0, 10)}...`);
        } else {
          console.error('❌ API returned success: false:', data);
          console.error('❌ Failure details:', {
            message: data.message,
            errorCode: data.errorCode,
            errorReason: data.errorReason,
            details: data.details
          });
          alert('🎉 Win detected! However, reward processing returned an error: ' + (data.message || 'Unknown error'));
        }
      })
      .catch((error: any) => {
        console.error('❌ Award API failed completely:', error);
        console.error('❌ Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          cause: error.cause
        });
        console.error('❌ Network info:', {
          userAgent: navigator.userAgent,
          onLine: navigator.onLine,
          cookieEnabled: navigator.cookieEnabled
        });
        alert('🎉 Win detected! However, automatic reward failed: ' + error.message + '. Check console and try refreshing.');
      });
    } else if (newWin.count > winInfo.count && !address) {
      console.log('🎯 Win detected but no wallet connected');
      setWinInfo(newWin);
      alert(`🎉 ${newWin.types.join(' + ')} achieved! Connect your wallet to receive automatic $BINGO rewards!`);
    }
  }, [marked, address, winInfo.count]);

  const shareForExtraPlay = async () => {
    try {
      console.log('📢 Attempting share for extra play...');
      
      if ('actions' in sdk && 'cast' in (sdk as any).actions) {
        await (sdk as any).actions.cast({
          text: 'Loving Based Bingo—join the fun! https://basedbingo.xyz',
          embeds: [{ url: 'https://basedbingo.xyz' }],
        });
        console.log('✅ Share cast successful');
      } else {
        console.log('Farcaster cast not available, granting extra play anyway');
      }
      
      setDailyPlays(0);
      localStorage.setItem('dailyPlays', '0');
      alert('✅ Shared! You get +1 play today.');
      
    } catch (error: any) {
      console.error('❌ Share failed:', error);
      alert('Share failed—try again.');
    }
  };

  const payForUnlimited = async () => {
    if (!address) {
      alert('Please connect your wallet first.');
      return;
    }
    
    try {
      console.log('💳 Purchasing unlimited access with 50 $BINGO...');
      console.log('📝 This requires: 50 $BINGO tokens + ETH for gas fees');
      
      const txResult = await writeContracts({
        contracts: [
          { 
            address: TOKEN_ADDRESS, 
            abi: basedBingoABI as any, 
            functionName: 'approve', 
            args: [GAME_ADDRESS, BigInt(50 * Math.pow(10, 18))]
          },
          { 
            address: GAME_ADDRESS, 
            abi: bingoGameV3ABI as any, 
            functionName: 'buyUnlimited', 
            args: [] 
          },
        ],
        capabilities: process.env.NEXT_PUBLIC_CDP_RPC ? {
          paymasterService: { url: process.env.NEXT_PUBLIC_CDP_RPC }
        } : undefined,
      });

      console.log('⏳ Transaction submitted, waiting for confirmation...');
      console.log('📋 Transaction hash:', txResult);
      
      // Wait a moment for transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Only grant unlimited access after transaction success
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('unlimitedDate', today);
      setUnlimitedToday(true);
      alert('✅ Unlimited access unlocked for today with 50 $BINGO!');
      console.log('✅ Unlimited purchase completed - localStorage updated');
      
    } catch (error: any) {
      console.error('❌ Unlimited purchase failed:', error);
      
      let errorMessage = 'Failed to purchase unlimited access: ';
      
      if (error.message?.includes('insufficient funds') || 
          error.message?.includes('not enough') ||
          error.message?.includes('ERC20: transfer amount exceeds balance')) {
        errorMessage += 'You need 50 $BINGO tokens. Play games to earn tokens first, or get tokens from the faucet.';
      } else if (error.message?.includes('User rejected') || 
                 error.message?.includes('user denied')) {
        errorMessage += 'Transaction was cancelled. You can try again!';
      } else if (error.message?.includes('network')) {
        errorMessage += 'Network error. Check your connection and try again.';
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      
      alert(errorMessage);
    }
  };

  return (
    <div className="text-center max-w-sm mx-auto">
      {/* Wallet Connection */}
      {!address ? (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <button className="w-full bg-coinbase-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 mb-2">
            Connect Wallet (for $BINGO)
          </button>
          <p className="text-xs text-blue-700">Connect for automatic rewards</p>
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
        <p className="text-xl text-red-500 font-bold animate-pulse mb-4">
          ⏰ Time Left: {Math.floor(gameTimer / 60)}:{gameTimer % 60 < 10 ? '0' : ''}{gameTimer % 60}
        </p>
      )}

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
                  ${isMarked ? 'bg-coinbase-blue text-white' : 'bg-white text-coinbase-blue hover:bg-blue-100'}
                  ${num === 'FREE' ? 'text-xs rotate-[-45deg]' : ''}
                  ${isDrawn && !isMarked ? 'animate-pulse border-green-500 border-4' : ''}`}
                disabled={isMarked || (typeof num !== 'number' && num !== 'FREE')}
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
          disabled={!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS}
          className="bg-gray-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          🎮 New Game ({unlimitedToday ? 'Unlimited' : `${MAX_FREE_PLAYS - dailyPlays} left`})
        </button>
      </div>

      {/* Recent Draws */}
      <div className="flex justify-center gap-2 mt-2 mb-4">
        {recentDraws.length > 0 ? (
          recentDraws.map((num, idx) => (
            <div
              key={idx}
              className={`w-12 h-12 border-2 border-coinbase-blue flex items-center justify-center text-lg font-bold rounded transition-all duration-500
                ${idx === recentDraws.length - 1 ? 'bg-coinbase-blue text-white animate-bounce' : 'bg-white text-coinbase-blue opacity-50'}`}
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

      {/* Win Status */}
      {winInfo.types.length > 0 && (
        <div className="mb-4 p-4 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg border-2 border-green-500">
          <p className="text-2xl font-bold text-coinbase-blue animate-pulse">
            🎉 {winInfo.types.join(' + ')} ({winInfo.count} total) ✨ Rewards Sent!
          </p>
          <p className="text-sm text-green-700 mt-2">
            {1000 * winInfo.types.length} $BINGO tokens awarded automatically!
          </p>
        </div>
      )}

      {/* Daily Limit Upsells */}
      {(!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) && (
        <div className="mt-4 p-4 bg-blue-100 rounded-lg shadow-md">
          <p className="text-coinbase-blue mb-2 font-semibold">🎯 Free plays used up today! Get more:</p>
          <div className="space-y-2">
            <button 
              onClick={shareForExtraPlay}
              className="w-full bg-coinbase-blue text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-600"
            >
              📢 Share on Farcaster (+1 Play)
            </button>
            <button 
              onClick={payForUnlimited}
              className="w-full bg-green-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-600"
            >
              💰 Pay 50 $BINGO (Unlimited Today)
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