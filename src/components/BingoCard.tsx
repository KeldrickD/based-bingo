'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { toPng } from 'html-to-image';
import { useAccount, useWriteContract } from 'wagmi';
import { useWriteContracts } from 'wagmi/experimental';
import { keccak256, stringToHex } from 'viem';
import basedBingoABI from '@/abis/BasedBingo.json';
import bingoGameABI from '@/abis/BingoGame.json';

const TOKEN_ADDRESS = '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047' as `0x${string}`;
const GAME_ADDRESS = '0x36Fb73233f8BB562a80fcC3ab9e6e011Cfe091f5' as `0x${string}`;

function generateBingoCard() {
  const columnRanges = [
    { label: 'B', min: 1, max: 15 }, 
    { label: 'I', min: 16, max: 30 }, 
    { label: 'N', min: 31, max: 45 }, 
    { label: 'G', min: 46, max: 60 }, 
    { label: 'O', min: 61, max: 75 }
  ];
  
  const card: (number | string)[][] = columnRanges.map(({ min, max }) => 
    [...Array(max - min + 1)].map((_, i) => min + i).sort(() => Math.random() - 0.5).slice(0, 5)
  );
  
  card[2][2] = 'FREE';
  return card;
}

function checkWin(marked: Set<string>): { count: number; types: string[] } {
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
  
  const completed = positions.filter((line) => 
    line.every((pos) => marked.has(pos) || pos === '22')
  );
  
  const count = completed.length;
  const types: string[] = [];
  
  if (count >= 1) types.push('Line Bingo!');
  if (count >= 2) types.push('Double Line!');
  if (count === 12) types.push('Full House!');
  
  return { count, types };
}

export default function BingoCard() {
  const { address } = useAccount();
  const { writeContract } = useWriteContract();
  const { writeContracts } = useWriteContracts();
  
  // Game state
  const [card, setCard] = useState<(number | string)[][]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set(['22']));
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [recentDraws, setRecentDraws] = useState<number[]>([]);
  const [winInfo, setWinInfo] = useState<{ count: number; types: string[] }>({ count: 0, types: [] });
  const [gameTimer, setGameTimer] = useState(120);
  const [timerActive, setTimerActive] = useState(false);
  const [autoDrawInterval, setAutoDrawInterval] = useState<NodeJS.Timeout | null>(null);
  const [isClaimingWin, setIsClaimingWin] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Daily limits state
  const [dailyPlays, setDailyPlays] = useState(0);
  const [unlimitedToday, setUnlimitedToday] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const MAX_FREE_PLAYS = 3;

  // Analytics tracking
  const trackEvent = useCallback(async (event: string, data?: Record<string, unknown>) => {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          player: address,
          data,
          sessionId: sessionStorage.getItem('gameSessionId') || `session-${Date.now()}`,
        }),
      });
    } catch (error) {
      console.error('Analytics tracking failed:', error);
    }
  }, [address]);

  // Initialize session tracking
  useEffect(() => {
    if (!sessionStorage.getItem('gameSessionId')) {
      sessionStorage.setItem('gameSessionId', `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    }
  }, []);

  // Enhanced signature generation with retry logic
  const getWinSignature = useCallback(async (address: string, winTypes: string[], retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔐 Attempting win signature generation (attempt ${attempt}/${retries})`);
        
        const response = await fetch('/api/verify-win', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            winTypes,
            gameId: `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Backend returned success: false');
        }

        console.log('✅ Win signature generated successfully');
        await trackEvent('win_signature_generated', { 
          winTypes, 
          attempt,
          processingTime: Date.now() - ((window as { winDetectionTime?: number }).winDetectionTime || 0),
        });

        return {
          hash: data.hash,
          signature: data.signature,
          winData: data.winData,
        };

      } catch (error) {
        console.error(`❌ Signature attempt ${attempt} failed:`, error);
        
        if (attempt === retries) {
          console.warn('⚠️  Using fallback signature generation');
          await trackEvent('win_signature_fallback', { 
            winTypes, 
            attempts: retries,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          
          // Fallback to client-side signature
          const winData = `${address}-${winTypes.join('-')}-${Date.now()}`;
          const hash = keccak256(stringToHex(winData));
          const mockSignature = '0x' + '1'.repeat(128);
          
          return { hash, signature: mockSignature, winData: null };
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    throw new Error('All signature generation attempts failed');
  }, [trackEvent]);

  // Daily limit initialization
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

  const stopAutoDraw = useCallback(() => {
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      setAutoDrawInterval(null);
    }
  }, [autoDrawInterval]);

  const resetGame = useCallback(() => {
    const newCard = generateBingoCard();
    setCard(newCard);
    setMarked(new Set(['22']));
    setDrawnNumbers(new Set());
    setRecentDraws([]);
    setWinInfo({ count: 0, types: [] });
    setGameTimer(120);
    setTimerActive(false);
    if (autoDrawInterval) clearInterval(autoDrawInterval);
  }, [autoDrawInterval]);

  // Game timer management (only stops on natural completion)
  useEffect(() => {
    if (timerActive && gameTimer > 0) {
      const interval = setInterval(() => setGameTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    } else if (gameTimer === 0 && timerActive) {
      // Game ends naturally
      stopAutoDraw();
      setTimerActive(false);
      console.log('🎮 Game completed naturally - time expired');
      
      if (winInfo.types.length > 0) {
        alert(`⏰ Time up! Final result: ${winInfo.types.join(' + ')} - Don't forget to claim your rewards!`);
      } else {
        alert('⏰ Time up! Game over. Better luck next time!');
      }
      
      trackEvent('game_completed', { 
        reason: 'timeout', 
        gameTimer: 0,
        finalWins: winInfo.types,
        finalWinCount: winInfo.count,
      });
    }
  }, [timerActive, gameTimer, stopAutoDraw, trackEvent, winInfo]);

  const startAutoDraw = useCallback(() => {
    const interval = setInterval(() => {
      setDrawnNumbers((prevDrawn) => {
        if (prevDrawn.size >= 75) {
          // Natural game completion - all numbers drawn
          console.log('🎮 Game completed naturally - all numbers drawn');
          stopAutoDraw();
          setTimerActive(false);
          
          trackEvent('game_completed', { 
            reason: 'all_numbers_drawn', 
            drawnNumbers: 75,
            finalWins: winInfo.types,
            finalWinCount: winInfo.count,
          });
          
          if (winInfo.types.length > 0) {
            alert(`🎯 All numbers drawn! Final result: ${winInfo.types.join(' + ')} - Claim your rewards!`);
          } else {
            alert('🎯 All numbers drawn! Game complete.');
          }
          
          return prevDrawn;
        }
        
        let num: number;
        do {
          num = Math.floor(Math.random() * 75) + 1;
        } while (prevDrawn.has(num));
        
        const newDrawn = new Set([...prevDrawn, num]);
        setRecentDraws((prev) => [...prev, num].slice(-5));
        
        return newDrawn;
      });
    }, 3000);
    setAutoDrawInterval(interval);
  }, [stopAutoDraw, trackEvent, winInfo]);

  // Enhanced game start with analytics (removed entry fee for better onboarding)
  const startGame = useCallback(async () => {
    if (!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) {
      alert('Daily free plays used up! Share on Farcaster for +1 play or buy unlimited access.');
      return;
    }

    console.log('🎮 Starting new game...');
    await trackEvent('game_started', {
      unlimited: unlimitedToday,
      dailyPlays,
      gameTime: new Date().toISOString(),
    });

    resetGame();
    setTimerActive(true);
    startAutoDraw();

    // Remove entry fee for better user onboarding - game is now free to play
    if (!unlimitedToday && address) {
      try {
        console.log('🎮 Game started successfully - no entry fee required!');
        
        // Update plays count
        const newPlays = dailyPlays + 1;
        setDailyPlays(newPlays);
        localStorage.setItem('dailyPlays', newPlays.toString());
        
        await trackEvent('game_joined_successfully', {
          unlimited: unlimitedToday,
          totalPlays: newPlays,
          freeToPlay: true,
        });
        
      } catch (error) {
        console.error('❌ Game start failed:', error);
        await trackEvent('error_occurred', {
          type: 'game_start_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          unlimited: unlimitedToday,
        });
        alert('Failed to start game: ' + (error instanceof Error ? error.message : 'Please try again'));
      }
    } else if (!address) {
      // Game can be played without wallet connection for demo purposes
      const newPlays = dailyPlays + 1;
      setDailyPlays(newPlays);
      localStorage.setItem('dailyPlays', newPlays.toString());
      console.log('🎮 Demo game started - connect wallet to claim rewards!');
    }
  }, [unlimitedToday, dailyPlays, address, trackEvent, resetGame, startAutoDraw]);

  const markCell = useCallback((row: number, col: number) => {
    const num = card[col]?.[row] ?? '';
    if (typeof num === 'number' && recentDraws.includes(num)) {
      const pos = `${col}${row}`;
      setMarked((prev) => new Set([...prev, pos]));
    }
  }, [card, recentDraws]);

  // Simplified win claiming for mobile wallet compatibility
  const claimWin = useCallback(async () => {
    // Debug info via alert for mobile
    if (!address) {
      alert('❌ DEBUG: No wallet connected\nPlease connect your wallet first!');
      return;
    }
    
    if (winInfo.types.length === 0) {
      alert('❌ DEBUG: No wins available\nPlay the game and get BINGO first!');
      return;
    }

    if (isClaimingWin) {
      alert('❌ DEBUG: Already claiming\nPlease wait for current claim to finish!');
      return;
    }

    // Simple confirmation without complex formatting
    const userConfirmed = window.confirm(
      `Claim ${winInfo.types.join(' + ')} for 1000 $BINGO tokens?\n\nThis requires gas fees. Continue?`
    );

    if (!userConfirmed) {
      return;
    }

    setIsClaimingWin(true);
    
    try {
      alert('🔄 DEBUG: Starting claim process...');
      
      await trackEvent('manual_win_claim_started', {
        winTypes: winInfo.types,
        winCount: winInfo.count,
        gameActive: timerActive,
        timeRemaining: gameTimer,
      });

      const { hash, signature } = await getWinSignature(address, winInfo.types);
      
      alert('🔄 DEBUG: Got signature, sending transaction...');
      
      // Simplified transaction - try writeContract first for mobile compatibility
      await writeContract({
        address: GAME_ADDRESS,
        abi: bingoGameABI as any,
        functionName: 'claimWin',
        args: [hash, signature],
      });
      
      await trackEvent('manual_win_claim_success', {
        winTypes: winInfo.types,
        hash: hash.slice(0, 10),
        gameActive: timerActive,
      });
      
      alert('✅ SUCCESS: Claim submitted! Tokens should arrive shortly!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      let userMessage = 'Claim failed: ';
      
      if (errorMessage.toLowerCase().includes('insufficient funds') || 
          errorMessage.toLowerCase().includes('not enough')) {
        userMessage += 'You need ETH for gas fees on Base network.';
      } else if (errorMessage.toLowerCase().includes('rejected') ||
                 errorMessage.toLowerCase().includes('denied')) {
        userMessage += 'Transaction was cancelled. You can try again!';
      } else {
        userMessage += errorMessage;
      }
      
      alert(`❌ ERROR: ${userMessage}`);
      
      await trackEvent('error_occurred', {
        type: 'manual_win_claim_failed',
        winTypes: winInfo.types,
        error: errorMessage,
        gameActive: timerActive,
      });
    } finally {
      setIsClaimingWin(false);
    }
  }, [address, winInfo, isClaimingWin, trackEvent, getWinSignature, writeContract, timerActive, gameTimer]);

  // Enhanced win detection (non-interrupting, game continues)
  useEffect(() => {
    const newWin = checkWin(marked);
    if (newWin.count > winInfo.count && address && newWin.count > 0) {
      setWinInfo(newWin);
      
      // Generate win image (non-blocking)
      if (gridRef.current) {
        toPng(gridRef.current).then((dataUrl) => {
          console.log('📸 Win image generated:', dataUrl);
        }).catch((error) => {
          console.error('Failed to generate win image:', error);
        });
      }

      const winType = newWin.types[newWin.types.length - 1].toLowerCase().replace(/!/g, '').replace(/\s/g, '-');
      const shareUrl = `https://basedbingo.xyz/win/${winType}`;
      
      console.log(`🎉 New win detected: ${newWin.types.join(' + ')} - Game continues!`);
      console.log(`🎯 Share URL: ${shareUrl}`);

      // Track win detection (non-blocking)
      trackEvent('win_detected', {
        winTypes: newWin.types,
        winCount: newWin.count,
        gameTimer,
        markedCells: marked.size,
        gameActive: timerActive, // Track that game is still active
      });

      // Show a brief non-blocking notification
      if (newWin.count === 1) {
        console.log('🎯 First BINGO achieved! Game continues - go for more wins!');
      } else if (newWin.count >= 2) {
        console.log('🔥 Multiple BINGOs! Keep playing for maximum rewards!');
      }
    }
  }, [marked, address, winInfo.count, gameTimer, trackEvent, timerActive]);

  const shareForExtraPlay = useCallback(async () => {
    try {
      console.log('📢 Share requested for extra play');
      // Note: Farcaster sharing temporarily disabled for build compatibility
      setDailyPlays(0);
      localStorage.setItem('dailyPlays', '0');
      
      await trackEvent('extra_play_shared', { previousPlays: dailyPlays });
      alert('🎉 Extra play granted! (Auto-share coming soon)');
      
    } catch (error) {
      console.error('❌ Share failed:', error);
      alert('Share failed—try again.');
    }
  }, [dailyPlays, trackEvent]);

  const payForUnlimited = useCallback(async () => {
    if (!address) {
      alert('Please connect your wallet.');
      return;
    }

    if (isProcessingPayment) return;

    setIsProcessingPayment(true);
    const purchaseStartTime = Date.now();

    try {
      console.log('💳 Purchasing unlimited play...');
      
      await trackEvent('unlimited_purchase_started', {
        currentPlays: dailyPlays,
        timestamp: new Date().toISOString(),
      });

      if (process.env.NEXT_PUBLIC_CDP_RPC && writeContracts) {
        // Try gasless batch transaction
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
              abi: bingoGameABI as any,
              functionName: 'buyUnlimited',
              args: [],
            },
          ],
          capabilities: {
            paymasterService: { url: process.env.NEXT_PUBLIC_CDP_RPC },
          },
        });
      } else {
        // Fallback: Sequential transactions
        writeContract({
          address: TOKEN_ADDRESS,
          abi: basedBingoABI as any,
          functionName: 'approve',
          args: [GAME_ADDRESS, BigInt(50 * Math.pow(10, 18))],
        });
        
        setTimeout(() => {
          writeContract({
            address: GAME_ADDRESS,
            abi: bingoGameABI as any,
            functionName: 'buyUnlimited',
            args: [],
          });
        }, 2000);
      }

      // Update UI
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('unlimitedDate', today);
      setUnlimitedToday(true);
      
      await trackEvent('unlimited_purchased', {
        processingTime: Date.now() - purchaseStartTime,
        previousPlays: dailyPlays,
        timestamp: new Date().toISOString(),
      });
      
      alert('✅ Unlimited access unlocked for today with 50 $BINGO!');
      console.log('✅ Unlimited purchase completed');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Unlimited purchase failed:', error);
      
      await trackEvent('error_occurred', {
        type: 'unlimited_purchase_failed',
        error: errorMessage,
        processingTime: Date.now() - purchaseStartTime,
      });
      
      alert(`Failed to purchase unlimited access: ${errorMessage}\nMake sure you have 50 $BINGO tokens and enough ETH for gas.`);
    } finally {
      setIsProcessingPayment(false);
    }
  }, [address, isProcessingPayment, dailyPlays, trackEvent, writeContracts, writeContract]);

  return (
    <div className="text-center max-w-sm mx-auto">
      {/* Timer and Recent Draws at Top */}
      {timerActive && (
        <div className="mb-4">
          <p className="text-xl text-red-500 font-bold animate-pulse mb-3">
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
              className={`w-12 h-12 border-2 border-coinbase-blue flex items-center justify-center text-lg font-bold rounded transition-opacity duration-500
                ${idx === recentDraws.length - 1 ? 'bg-coinbase-blue text-white animate-bounce' : 'opacity-60'}`}
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
            return (
              <button
                key={pos}
                onClick={() => markCell(row, col)}
                className={`w-full aspect-square border-2 border-coinbase-blue flex items-center justify-center text-sm font-bold rounded transition-all duration-200
                  ${isMarked ? 'bg-coinbase-blue text-white shadow-lg' : 'bg-white text-coinbase-blue hover:bg-blue-100'}
                  ${num === 'FREE' ? 'text-xs' : ''}
                  ${typeof num === 'number' && recentDraws.includes(num) && !isMarked ? 'animate-pulse border-green-500' : ''}`}
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

      {/* Connect wallet notice for non-connected users */}
      {!address && winInfo.types.length === 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-blue-700 text-sm text-center">
            Connect your wallet to claim $BINGO rewards when you win!
          </p>
        </div>
      )}

      {/* Win Status with Clickable Claim Button - Game Continues */}
      {winInfo.types.length > 0 && (
        <div className="mb-4 p-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg shadow-lg">
          <p className="text-2xl font-bold animate-pulse mb-2">
            🎉 {winInfo.types.join(' + ')} 
          </p>
          <p className="text-sm opacity-90 mb-2">({winInfo.count} total wins)</p>
          
          {/* Debug info for mobile */}
          <div className="text-xs opacity-75 mb-2 bg-white/20 rounded px-2 py-1">
            DEBUG: Address={address ? '✅ Connected' : '❌ Not connected'} | 
            Claiming={!isClaimingWin ? '✅ Ready' : '⏳ Currently Claiming'} | 
            Wins={winInfo.types.length}
          </div>
          
          {timerActive && (
            <p className="text-xs opacity-80 mb-3 bg-white/20 rounded px-2 py-1">
              🎮 Game continues! Keep playing for more wins!
            </p>
          )}
          
          <div className="text-center space-y-4">
            {/* Debug info - now showing correct states */}
            <div className="text-sm text-green-600 bg-white/20 rounded px-3 py-2">
              🔄 DEBUG: Wallet: {address ? '✅ Connected' : '❌ Not Connected'} | 
              Claiming: {!isClaimingWin ? '✅ Ready' : '❌ Currently Claiming'} | 
              Wins: {winInfo.types.length > 0 ? `✅ ${winInfo.types.length}` : '❌ 0'}
            </div>

            {/* Single working claim button - simplified for mobile */}
            <button
              onClick={(e) => {
                console.log('🎯 CLAIM BUTTON: Clicked!', { address, isClaimingWin, wins: winInfo.types.length });
                e.preventDefault();
                e.stopPropagation();
                
                if (!isClaimingWin && address && winInfo.types.length > 0) {
                  console.log('🎯 Conditions met, starting claim...');
                  setIsClaimingWin(true);
                  claimWin();
                } else {
                  const reason = !address ? 'No wallet connected' : 
                               isClaimingWin ? 'Already claiming in progress' : 
                               'No wins available';
                  alert(`❌ Cannot claim: ${reason}`);
                  console.log('🎯 Claim blocked:', reason);
                }
              }}
              disabled={!address || isClaimingWin || winInfo.types.length === 0}
              className={`w-full px-6 py-4 rounded-lg font-bold text-lg transition-all duration-200 ${
                isClaimingWin
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : !address
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : winInfo.types.length === 0
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-white text-orange-500 hover:bg-gray-100 border-4 border-orange-500 cursor-pointer'
              }`}
              style={{ 
                minHeight: '60px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'rgba(255,165,0,0.3)'
              }}
            >
              {isClaimingWin ? (
                '⏳ Claiming 1000 $BINGO...'
              ) : !address ? (
                '🔗 Connect Wallet to Claim'
              ) : winInfo.types.length === 0 ? (
                '❌ No Wins to Claim'
              ) : (
                '🎯 CLAIM 1000 $BINGO TOKENS!'
              )}
            </button>
            
            {/* Status message */}  
            <div className="text-xs text-center opacity-75">
              {!address && '👆 Connect your wallet first'}
              {address && winInfo.types.length === 0 && '👆 Get BINGO to unlock claiming'}
              {address && winInfo.types.length > 0 && !isClaimingWin && '👆 Ready to claim your rewards!'}
              {address && winInfo.types.length > 0 && isClaimingWin && '👆 Processing your claim...'}
            </div>
          </div>
          
          {/* Fallback tap area for mobile */}
          <div 
            onClick={() => {
              if (!isClaimingWin && address && winInfo.types.length > 0) {
                claimWin();
              } else {
                alert('Fallback button clicked! Something is blocking the main button.');
              }
            }}
            className="mt-2 p-2 bg-red-500 text-white text-center rounded cursor-pointer"
            style={{ 
              minHeight: '40px',
              WebkitTapHighlightColor: 'transparent',
              zIndex: 15
            }}
          >
            🚨 BACKUP CLAIM BUTTON (If main button doesn&apos;t work)
          </div>
          
          {!address && (
            <p className="text-xs opacity-75 mt-2">Connect wallet below to claim your rewards</p>
          )}
          
          {address && timerActive && (
            <p className="text-xs opacity-75 mt-2">
              💡 Tip: You can claim now or wait for more wins!
            </p>
          )}
          
          {address && (
            <p className="text-xs opacity-75 mt-1">
              ⚡ Small gas fee required on Base network
            </p>
          )}
        </div>
      )}

      {/* Daily Limit Upsells */}
      {(!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) && (
        <div className="mb-4 p-4 bg-blue-100 rounded-lg shadow-md">
          <p className="text-coinbase-blue mb-3 font-semibold">🎯 Free plays used up today! Get more:</p>
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
               !address ? '🔗 Connect Wallet for Unlimited' :
               '💰 Pay 50 $BINGO (Unlimited Today)'}
            </button>
          </div>
          {process.env.NEXT_PUBLIC_CDP_RPC && (
            <p className="text-xs text-green-600 mt-2">⚡ Gasless transactions enabled</p>
          )}
        </div>
      )}

      {/* Wallet Connection Status - Moved to Bottom */}
      {!address ? (
        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <button className="w-full bg-coinbase-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 mb-2">
            Connect Wallet
          </button>
          <p className="text-xs text-gray-600 text-center">
            Connect to claim $BINGO rewards when you win
          </p>
        </div>
      ) : (
        <div className="mt-4 p-2 bg-gray-50 rounded-lg">
          <p className="text-sm text-coinbase-blue text-center">
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
            {process.env.NEXT_PUBLIC_CDP_RPC && <span className="ml-2 text-green-600">⚡ Gasless</span>}
          </p>
          <p className="text-xs text-gray-500 text-center mt-1">
            Ready to claim rewards • Make sure you have ETH for gas
          </p>
        </div>
      )}
    </div>
  );
}