'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { toPng } from 'html-to-image';
import { sdk } from '@farcaster/frame-sdk';
import basedBingoABI from '@/abis/BasedBingo.json';
import bingoGameV3ABI from '@/abis/BingoGameV3.json';
import { wagmiInfo } from '@/lib/wagmi-config';

// Toast notification component
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 text-white hover:text-gray-200">
          ✕
        </button>
      </div>
    </div>
  );
};

const TOKEN_ADDRESS = '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047' as `0x${string}`;
const GAME_ADDRESS = '0x88eAbBdD2158D184f4cB1C39B612eABB48289907' as `0x${string}`;

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
  const { writeContract, writeContractAsync } = useWriteContract();
  
  // Game state
  const [card, setCard] = useState<(number | string)[][]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set(['22']));
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [recentDraws, setRecentDraws] = useState<number[]>([]);
  const [winInfo, setWinInfo] = useState({ count: 0, types: [] as string[] });
  const [shareUrl, setShareUrl] = useState('');
  const [unlimitedToday, setUnlimitedToday] = useState(false);
  const [dailyPlays, setDailyPlays] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [rewardStatus, setRewardStatus] = useState<
    | { state: 'idle' }
    | { state: 'attempt'; attempt: number; maxAttempts: number }
    | { state: 'success'; txHash: string; totalRewards: number }
    | { state: 'error'; message: string; details?: string; diag?: any }
  >({ state: 'idle' });
  const [gameId, setGameId] = useState<number | null>(null);
  const [gameTimer, setGameTimer] = useState(120);
  const [timerActive, setTimerActive] = useState(false);
  const [autoDrawInterval, setAutoDrawInterval] = useState<NodeJS.Timeout | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isJoiningRef = useRef<boolean>(false);
  const [autoJoinDisabled, setAutoJoinDisabled] = useState(false);
  
  // Daily limits state
  const [lastPlayDate, setLastPlayDate] = useState('');
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

  // Auto-join once when wallet connects (gasless if configured)
  useEffect(() => {
    if (!address) return;
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `joined:${address}:${today}`;
    const disabledKey = `autoJoinDisabled:${address}:${today}`;
    if (localStorage.getItem(cacheKey) === '1' || localStorage.getItem(disabledKey) === '1') return;
    // Fire and forget; joinOnDemand already handles toasts and caching
    joinOnDemand();
  }, [address, joinOnDemand]);

  const joinOnDemand = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `joined:${address}:${today}`;
      if (localStorage.getItem(cacheKey) === '1') {
        return true;
      }

      if (isJoiningRef.current) return true;
      isJoiningRef.current = true;

      console.log('🧩 Ensuring on-chain join before awarding...', { address, paymaster: wagmiInfo.isPaymasterEnabled });
      await writeContractAsync({
        address: GAME_ADDRESS,
        abi: bingoGameV3ABI as any,
        functionName: 'join',
        args: [],
        value: BigInt(0),
      });
      localStorage.setItem(cacheKey, '1');
      console.log('✅ Joined recorded for today');
      // Re-enable auto-joining attempts for future if previously disabled
      setAutoJoinDisabled(false);
      return true;
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.warn('⚠️ join() failed:', msg);
      if (!wagmiInfo.isPaymasterEnabled && /insufficient|funds|fee|gas/i.test(msg)) {
        showToast('Join required to receive rewards. Keep a small amount of Base ETH for gas.', 'error');
      } else {
        showToast('Join failed. You may need to confirm in your wallet or try again.', 'error');
      }
      // Disable auto-join to prevent repeated wallet prompts
      setAutoJoinDisabled(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`autoJoinDisabled:${address}:${today}`, '1');
      } catch {}
      return false;
    } finally {
      isJoiningRef.current = false;
    }
  }, [address, writeContractAsync]);

  const startGame = useCallback(async () => {
    if (!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) {
      alert('Daily free plays used up! Share on Farcaster for +1 play or buy unlimited access.');
      return;
    }

    // Generate a new gameId for this session (timestamp-based)
    const newGameId = Math.floor(Date.now() / 1000);
    setGameId(newGameId);

    // Removed on-chain join() to prevent transaction prompts on New Game
    // V3 award is permissionless; joining is optional for rewards in current UX

    console.log('🎮 Starting game session...');
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
      console.log('🎮 Game started with wallet connected - ready for automatic rewards!');
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
      shouldTrigger: newWin.count > winInfo.count && address && newWin.count > 0,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      isInWallet: !!window.ethereum,
      userAgent: navigator.userAgent.substring(0, 100)
    });
    
    if (newWin.count > winInfo.count && address && newWin.count > 0) {
      console.log('🎉 WIN DETECTED:', { 
        newWinCount: newWin.count, 
        previousWinCount: winInfo.count,
        winTypes: newWin.types,
        address: `${address.slice(0, 6)}...${address.slice(-4)}`,
        timestamp: new Date().toISOString(),
        environment: {
          isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
          isCoinbaseWallet: navigator.userAgent.includes('CoinbaseWallet'),
          hasEthereum: !!window.ethereum,
          origin: window.location.origin
        }
      });
      
      setWinInfo(newWin);
      
      // Show immediate win notification with toast
      const rewardAmount = 1000 * newWin.types.length;
      showToast(`🎉 ${newWin.types.join(' + ')} achieved! Sending ${rewardAmount} $BINGO...`, 'info');

      // Generate win image (skip on mobile if causing issues)
      if (gridRef.current && !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))) {
        toPng(gridRef.current).then((dataUrl) => {
          console.log('📸 Win image generated:', dataUrl.length, 'bytes');
        }).catch((error: any) => {
          console.error('Win image generation failed (non-critical):', error);
        });
      } else {
        console.log('📸 Skipping win image generation on mobile');
      }

      const winType = newWin.types[newWin.types.length - 1]
        .toLowerCase()
        .replace(/!/g, '')
        .replace(/\s/g, '-');
      const shareUrl = `https://www.basedbingo.xyz/win/${winType}`;

      // Auto-cast to Farcaster (skip if not available)
      try {
        if ('actions' in sdk && 'cast' in (sdk as any).actions) {
          (sdk as any).actions.cast({
            text: `Just got ${newWin.types.join(' + ')} in Based Bingo! Won ${rewardAmount} $BINGO—play now!`,
            embeds: [{ url: shareUrl }],
          }).catch((error: any) => console.error('Farcaster cast failed (non-critical):', error));
        } else {
          console.log('Farcaster cast not available in this environment');
        }
      } catch (error: any) {
        console.error('Farcaster SDK error (non-critical):', error);
      }

      // Ensure on-chain join before attempting award (gasless if paymaster enabled)
      (async () => {
        const today = new Date().toISOString().split('T')[0];
        const disabled = autoJoinDisabled || localStorage.getItem(`autoJoinDisabled:${address}:${today}`) === '1';
        if (disabled) {
          console.warn('⛔ Skipping auto-join due to previous failure this session/day');
          showToast('Join required to receive rewards. Tap "Enable Rewards (Join)" and confirm in wallet.', 'error');
          return;
        }
        const joinedOk = await joinOnDemand();
        if (!joinedOk) {
          console.warn('⛔ Aborting award: join prerequisite not satisfied');
          return;
        }

        // CRITICAL: Force automatic rewards with aggressive retry mechanism
        console.log('🚀 FORCING automatic reward transaction...');
        console.log('📡 Calling /api/award-wins with:', { address, winTypes: newWin.types });
        console.log('🔗 API URL:', window.location.origin + '/api/award-wins');
        console.log('🌐 Current origin:', window.location.origin);
        console.log('🕐 Request timestamp:', new Date().toISOString());

        // Send ONLY the latest win type to avoid duplicate-claim reverts
        const latestType = newWin.types[newWin.types.length - 1];
        const requestPayload = { address, winTypes: [latestType] };
        console.log('📦 Request payload:', JSON.stringify(requestPayload, null, 2));

        // Aggressive retry mechanism with longer delays and more attempts
        const forceRewardTransaction = async (attempt = 1, maxAttempts = 5) => {
        setRewardStatus({ state: 'attempt', attempt, maxAttempts });
        console.log(`💪 FORCING reward transaction - attempt ${attempt}/${maxAttempts}`);
        
        try {
          // Show progress toast for attempts after the first
          if (attempt > 1) {
            showToast(`🔄 Retrying reward transaction (${attempt}/${maxAttempts})...`, 'info');
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          const response = await fetch('/api/award-wins', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Attempt': attempt.toString()
            },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          console.log('📨 API Response received:', { 
            status: response.status, 
            statusText: response.statusText,
            ok: response.ok,
            url: response.url,
            headers: Object.fromEntries(response.headers.entries()),
            attempt
          });
          
          if (!response.ok) {
            // Try to extract structured JSON details
            let text = '';
            let json: any = null;
            try {
              json = await response.json();
            } catch (e) {
              try { text = await response.text(); } catch {}
            }
            console.error('📨 Error response body:', text);
            console.error('�� Full error details:', {
              status: response.status,
              statusText: response.statusText,
              body: json || text,
              url: response.url,
              attempt
            });
            const msg = json?.message || json?.details || text || 'Unknown server error';
            // Update UI-visible status for mobile envs
            setRewardStatus({
              state: 'error',
              message: `Server error: ${response.status} ${response.statusText}`,
              details: msg?.toString().slice(0, 220),
              diag: json?.diagnostic || undefined,
            });
            showToast((msg || '').toString().slice(0, 160) || 'Reward failed', 'error');
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${msg}`);
          }
          
          const data = await response.json();
          console.log('✅ Award API success response:', JSON.stringify(data, null, 2));
          
          if (data.success) {
            console.log('🎉 SUCCESS: Tokens FORCED successfully!');
            console.log('💰 Reward details:', {
              totalRewards: data.totalRewards || rewardAmount,
              transactionHash: data.transactionHash,
              blockNumber: data.blockNumber,
              gasUsed: data.gasUsed,
              processingTime: data.processingTimeMs,
              attempt
            });
            
            showToast(`🎉 ${rewardAmount} $BINGO awarded! Tx: ${data.transactionHash?.slice(0, 10)}...`, 'success');
            setRewardStatus({ state: 'success', txHash: data.transactionHash, totalRewards: data.totalRewards || rewardAmount });
            return true;
          } else {
            console.error('❌ API returned success: false:', data);
            console.error('❌ Failure details:', {
              message: data.message,
              errorCode: data.errorCode,
              errorReason: data.errorReason,
              details: data.details,
              attempt
            });
            const msg = data.message || data.details || 'Unknown server error';
            setRewardStatus({ state: 'error', message: msg?.toString().slice(0, 220), details: data.details, diag: { errorCode: data.errorCode, errorReason: data.errorReason } });
            showToast(msg.toString().slice(0, 160), 'error');
            throw new Error(msg);
          }
        } catch (error: any) {
          console.error(`❌ Reward attempt ${attempt} failed:`, error);
          
          if (error.name === 'AbortError') {
            console.error('❌ Request timed out after 30 seconds');
          }
          
          if (attempt < maxAttempts) {
            const delay = Math.min(attempt * 3000, 10000); // 3s, 6s, 9s, max 10s
            console.log(`🔄 Retrying in ${delay/1000} seconds...`);
            showToast(`⏳ Attempt ${attempt} failed, retrying in ${delay/1000}s...`, 'info');
            await new Promise(resolve => setTimeout(resolve, delay));
            return forceRewardTransaction(attempt + 1, maxAttempts);
          } else {
            console.error('❌ ALL REWARD ATTEMPTS FAILED:', {
              message: error.message,
              stack: error.stack,
              name: error.name,
              cause: error.cause,
              finalAttempt: attempt
            });
            console.error('❌ Network info:', {
              userAgent: navigator.userAgent,
              onLine: navigator.onLine,
              cookieEnabled: navigator.cookieEnabled
            });
            
            showToast(`❌ Failed to send rewards after ${maxAttempts} attempts. Contact support!`, 'error');
            if (rewardStatus.state !== 'error') {
              setRewardStatus({ state: 'error', message: `Failed after ${maxAttempts} attempts`, details: error?.message?.toString().slice(0, 220) });
            }
            return false;
          }
        }
      };

      // Start the aggressive reward process
      forceRewardTransaction();
      })();
    } else if (newWin.count > winInfo.count && !address) {
      console.log('🎯 Win detected but no wallet connected');
      setWinInfo(newWin);
      alert(`🎉 ${newWin.types.join(' + ')} achieved! Connect your wallet to receive automatic $BINGO rewards!`);
    }
  }, [marked, address, winInfo.count, gameId]);

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
      showToast('Please connect your wallet first.', 'error');
      return;
    }
    
    try {
      console.log('💳 Purchasing unlimited access with 50 $BINGO...');
      console.log('📝 This requires: 50 $BINGO tokens + ETH for gas fees');
      
      // First approve the tokens
      await writeContractAsync({
        address: TOKEN_ADDRESS,
        abi: basedBingoABI as any,
        functionName: 'approve',
        args: [GAME_ADDRESS, BigInt(50 * Math.pow(10, 18))],
        value: BigInt(0) // No ETH payment required for token approval
      });

      // Wait for approval
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Then buy unlimited
      await writeContractAsync({
        address: GAME_ADDRESS,
        abi: bingoGameV3ABI as any,
        functionName: 'buyUnlimited',
        args: [],
        value: BigInt(0) // No ETH payment required - uses approved BINGO tokens
      });

      console.log('⏳ Transaction submitted, waiting for confirmation...');
      
      // Wait a moment for transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Only grant unlimited access after transaction success
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('unlimitedDate', today);
      setUnlimitedToday(true);
      showToast('✅ Unlimited access unlocked for today with 50 $BINGO!', 'success');
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
      
      showToast(errorMessage, 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow-lg max-w-md mx-auto">
      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      {/* Reward Status (mobile-visible) */}
      {rewardStatus.state !== 'idle' && (
        <div className="w-full rounded-lg border p-3 text-sm">
          {rewardStatus.state === 'attempt' && (
            <div>
              <div className="font-semibold">Awarding Rewards...</div>
              <div>Attempt {rewardStatus.attempt}/{rewardStatus.maxAttempts}</div>
            </div>
          )}
          {rewardStatus.state === 'success' && (
            <div className="text-green-700">
              <div className="font-semibold">Rewards Sent</div>
              <div>{rewardStatus.totalRewards} $BINGO</div>
              <div>Tx: {rewardStatus.txHash?.slice(0, 10)}...</div>
            </div>
          )}
          {rewardStatus.state === 'error' && (
            <div className="text-red-700">
              <div className="font-semibold">Reward Failed</div>
              <div>{rewardStatus.message}</div>
              {rewardStatus.details && (<div className="mt-1 text-xs text-red-600">{rewardStatus.details}</div>)}
              {rewardStatus.diag && (
                <div className="mt-2 text-xs text-gray-600">
                  {rewardStatus.diag.signerAddress && (<div>Signer: {String(rewardStatus.diag.signerAddress).slice(0,6)}...{String(rewardStatus.diag.signerAddress).slice(-4)}</div>)}
                  {rewardStatus.diag.contractOwner && (<div>Owner: {String(rewardStatus.diag.contractOwner).slice(0,6)}...{String(rewardStatus.diag.contractOwner).slice(-4)}</div>)}
                  {rewardStatus.diag.player && (<div>Player: {String(rewardStatus.diag.player).slice(0,6)}...{String(rewardStatus.diag.player).slice(-4)}</div>)}
                  {rewardStatus.diag.normalized && (<div>Types: {Array.isArray(rewardStatus.diag.normalized) ? rewardStatus.diag.normalized.join(', ') : String(rewardStatus.diag.normalized)}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Connection Status */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          {address ? (
            <>Connected: {address.slice(0, 6)}...{address.slice(-4)}</>
          ) : (
            'Connect wallet for rewards!'
          )}
        </p>
      </div>

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
      <div className="flex justify-center mb-4">
        <div className="flex flex-col gap-2 items-center">
        <button
          onClick={startGame}
            disabled={!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS}
            className={`px-6 py-3 rounded-lg font-bold text-white transition-colors ${
              !unlimitedToday && dailyPlays >= MAX_FREE_PLAYS
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-coinbase-blue hover:bg-blue-600'
            }`}
          >
            {!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS ? 'Daily Plays Used' : 'New Game'}
          </button>
          {/* Auto-join runs in the background; no extra button needed for UX */}
        </div>
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