'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { toPng } from 'html-to-image';
import { sdk } from '@farcaster/frame-sdk';
import { isMiniApp, supportsHaptics, hapticsNotify, hapticsImpact } from '@/lib/miniapp';
import basedBingoABI from '@/abis/BasedBingo.json';
import bingoGameV3ABI from '@/abis/BingoGameV3.json';

const GAME_DURATION_SECONDS = 120;
const DRAW_INTERVAL_MS = 3000;
const MAX_FREE_PLAYS = 3;
const XP_PER_GAME = 25;
const XP_PER_WIN = 150;

type RewardRunway = {
  healthy: boolean;
  rewardPerWinFormatted: string;
  contractBalanceFormatted: string;
  runwayWins: number;
  isAuthorizedOracle: boolean;
  signerConfigured: boolean;
};

type PlayerStats = {
  xp: number;
  level: number;
  totalGames: number;
  totalWins: number;
  tickets: number;
};

const formatTimer = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

const numberColumn = (num: number | null) => {
  if (!num) return '--';
  return ['B', 'I', 'N', 'G', 'O'][Math.floor((num - 1) / 15)] || '--';
};

const levelFromXp = (xp: number) => Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);

// Toast notification component
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className={`fixed left-4 right-4 top-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 sm:left-auto sm:max-w-sm`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 text-white hover:text-gray-200" aria-label="Dismiss notification">
          ✕
        </button>
      </div>
    </div>
  );
};

const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}`) || '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047';
const GAME_ADDRESS = (process.env.NEXT_PUBLIC_GAME_ADDRESS as `0x${string}`) || '0x28BE1BD4267EEE7551eC256A6b1a034D559faeC0';

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
  const { writeContractAsync } = useWriteContract();
  
  // Game state
  const [card, setCard] = useState<(number | string)[][]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set(['22']));
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set());
  const [recentDraws, setRecentDraws] = useState<number[]>([]);
  const [winInfo, setWinInfo] = useState({ count: 0, types: [] as string[] });
  const [awardedTypes, setAwardedTypes] = useState<Set<string>>(new Set());
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
  const [gameTimer, setGameTimer] = useState(GAME_DURATION_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [autoDrawInterval, setAutoDrawInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [streakCount, setStreakCount] = useState(0);
  const [challengeInfo, setChallengeInfo] = useState<{ id: string; name: string; goal: string; rewardBingo: number } | null>(null);
  const [notifyOptIn, setNotifyOptIn] = useState<boolean>(false);
  const [rewardRunway, setRewardRunway] = useState<RewardRunway | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    xp: 0,
    level: 1,
    totalGames: 0,
    totalWins: 0,
    tickets: 0,
  });

  const playsRemaining = useMemo(
    () => unlimitedToday ? 'Unlimited' : Math.max(0, MAX_FREE_PLAYS - dailyPlays).toString(),
    [dailyPlays, unlimitedToday]
  );
  const drawProgress = useMemo(() => Math.round((drawnNumbers.size / 75) * 100), [drawnNumbers.size]);
  const timerLabel = useMemo(() => formatTimer(gameTimer), [gameTimer]);
  const gameStatus = useMemo(() => {
    if (timerActive) return 'Live';
    if (winInfo.types.length > 0) return 'Won';
    if (drawnNumbers.size > 0) return 'Paused';
    return 'Ready';
  }, [drawnNumbers.size, timerActive, winInfo.types.length]);
  const rewardPerWin = rewardRunway?.rewardPerWinFormatted || '1000.0';
  const levelProgress = useMemo(() => {
    const currentLevelFloor = Math.pow(playerStats.level - 1, 2) * 100;
    const nextLevelFloor = Math.pow(playerStats.level, 2) * 100;
    return Math.min(100, Math.round(((playerStats.xp - currentLevelFloor) / (nextLevelFloor - currentLevelFloor)) * 100));
  }, [playerStats.level, playerStats.xp]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  const updatePlayerStats = useCallback((delta: Partial<Omit<PlayerStats, 'level'>>) => {
    setPlayerStats((prev) => {
      const nextXp = Math.max(0, prev.xp + (delta.xp || 0));
      const next = {
        xp: nextXp,
        level: levelFromXp(nextXp),
        totalGames: Math.max(0, prev.totalGames + (delta.totalGames || 0)),
        totalWins: Math.max(0, prev.totalWins + (delta.totalWins || 0)),
        tickets: Math.max(0, prev.tickets + (delta.tickets || 0)),
      };
      localStorage.setItem('playerStats', JSON.stringify(next));
      return next;
    });
  }, []);

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
      setDailyPlays(0);
      setUnlimitedToday(false);
    } else {
      setDailyPlays(storedPlays);
      setUnlimitedToday(storedUnlimited);
    }
  }, []);

  // Load streaks and weekly challenge
  useEffect(() => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const lastPlayed = localStorage.getItem('lastPlayedDate');
      const storedStreak = parseInt(localStorage.getItem('streakCount') || '0', 10);
      const storedStats = JSON.parse(localStorage.getItem('playerStats') || '{}');
      if (lastPlayed === today) {
        setStreakCount(storedStreak);
      } else {
        // do not update here; update on game start
        setStreakCount(storedStreak);
      }
      const xp = Number(storedStats.xp || 0);
      setPlayerStats({
        xp,
        level: levelFromXp(xp),
        totalGames: Number(storedStats.totalGames || 0),
        totalWins: Number(storedStats.totalWins || 0),
        tickets: Number(storedStats.tickets || 0),
      });
      setNotifyOptIn(localStorage.getItem('notifyChallenge') === '1');
    } catch {}
    (async () => {
      try {
        const [challengeRes, rewardRes] = await Promise.all([
          fetch('/api/analytics?timeframe=7d&challenge=1'),
          fetch('/api/rewards/status'),
        ]);
        const data = await challengeRes.json();
        if (data?.currentChallenge) {
          setChallengeInfo({
            id: data.currentChallenge.id,
            name: data.currentChallenge.name,
            goal: data.currentChallenge.goal,
            rewardBingo: data.currentChallenge.rewardBingo,
          });
        }
        if (rewardRes.ok) {
          const rewards = await rewardRes.json();
          if (rewards?.success) setRewardRunway(rewards);
        }
      } catch {}
    })();
  }, []);

  const resetGame = useCallback(() => {
    setCard(generateBingoCard());
    setMarked(new Set(['22']));
    setCurrentNumber(null);
    setDrawnNumbers(new Set());
    setRecentDraws([]);
    setWinInfo({ count: 0, types: [] });
    setAwardedTypes(new Set());
    setGameTimer(GAME_DURATION_SECONDS);
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
          showToast('All numbers drawn. Game complete.', 'info');
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
    }, DRAW_INTERVAL_MS);
    setAutoDrawInterval(interval);
  }, [showToast]);

  // Game timer management
  useEffect(() => {
    if (timerActive && gameTimer > 0) {
      const timer = setInterval(() => setGameTimer(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (gameTimer === 0 && timerActive) {
      stopAutoDraw();
      setTimerActive(false);
      showToast('Time is up. Start a new round when you are ready.', 'info');
    }
  }, [timerActive, gameTimer, stopAutoDraw, showToast]);

  // Pause/cleanup on back/navigation
  useEffect(() => {
    const onPopState = () => {
      stopAutoDraw();
      setTimerActive(false);
    };
    window.addEventListener('popstate', onPopState);
    try {
      const anySdk = sdk as any;
      if (anySdk?.navigation?.registerBackHandler) {
        anySdk.navigation.registerBackHandler(() => {
          stopAutoDraw();
          setTimerActive(false);
          return false; // let container handle the actual back
        });
      }
    } catch {}
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [stopAutoDraw]);

  const startGame = useCallback(async () => {
    if (!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) {
      showToast('Daily free plays are used. Share for another play or unlock unlimited for today.', 'info');
      return;
    }

    // Generate a new gameId for this session (timestamp-based)
    const newGameId = Date.now();
    setGameId(newGameId);

    // Removed on-chain join() to prevent transaction prompts on New Game
    // V3 award is permissionless; joining is optional for rewards in current UX

    console.log('🎮 Starting game session...');
    resetGame();
    setTimerActive(true);
    startAutoDraw();
    updatePlayerStats({ xp: XP_PER_GAME, totalGames: 1 });

    // Update plays count - no contract interaction needed for free games
    if (!unlimitedToday) {
      const newPlays = dailyPlays + 1;
      setDailyPlays(newPlays);
      localStorage.setItem('dailyPlays', newPlays.toString());
      console.log('✅ Free game started - play count updated to:', newPlays);
    }

    // Update streaks
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const lastPlayed = localStorage.getItem('lastPlayedDate');
      let nextStreak = 1;
      if (lastPlayed === today) {
        nextStreak = streakCount || 1;
      } else if (lastPlayed === yesterday) {
        nextStreak = (streakCount || 0) + 1;
      } else {
        nextStreak = 1;
      }
      localStorage.setItem('lastPlayedDate', today);
      localStorage.setItem('streakCount', String(nextStreak));
      setStreakCount(nextStreak);
    } catch {}
    
    if (!address) {
      console.log('🎮 Demo game started - connect wallet for automatic rewards!');
    } else {
      console.log('🎮 Game started with wallet connected - ready for automatic rewards!');
    }
  }, [unlimitedToday, dailyPlays, resetGame, startAutoDraw, updatePlayerStats, address, showToast, streakCount]);

  const pauseGame = useCallback(() => {
    stopAutoDraw();
    setTimerActive(false);
    showToast('Game paused.', 'info');
  }, [showToast, stopAutoDraw]);

  const resumeGame = useCallback(() => {
    if (gameTimer <= 0 || drawnNumbers.size >= 75) return;
    startAutoDraw();
    setTimerActive(true);
    showToast('Game resumed.', 'info');
  }, [drawnNumbers.size, gameTimer, showToast, startAutoDraw]);

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
      const rewardAmount = Number.parseFloat(rewardPerWin) * newWin.types.length;
      showToast(`🎉 ${newWin.types.join(' + ')} achieved! Sending ${rewardAmount} $BINGO...`, 'info');

      // Subtle haptics on win (if supported in Mini App environment)
      if (isMiniApp() && supportsHaptics()) {
        hapticsNotify('success');
      }

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

      // Determine which types to award now (avoid duplicates in same game)
      (async () => {
        const earnedNow: string[] = [];
        if (newWin.count >= 1) earnedNow.push('LINE');
        if (newWin.count >= 2) earnedNow.push('DOUBLE_LINE');
        if (newWin.count === 12) earnedNow.push('FULL_HOUSE');
        const toAward = earnedNow.filter((t) => !awardedTypes.has(t));
        if (toAward.length === 0) {
          console.log('🛑 No new types to award (already awarded in this game)');
          return;
        }

        // CRITICAL: Force automatic rewards with aggressive retry mechanism
        console.log('🚀 FORCING automatic reward transaction...');
        console.log('📡 Calling /api/award-wins with:', { address, winTypes: newWin.types });
        console.log('🔗 API URL:', window.location.origin + '/api/award-wins');
        console.log('🌐 Current origin:', window.location.origin);
        console.log('🕐 Request timestamp:', new Date().toISOString());

        // Send only new types not previously awarded in this game
        const requestPayload = { address, winTypes: toAward, gameId };
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

          // Preflight verify to ensure container injects auth header
          try {
            await fetch('/api/miniapp/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              keepalive: true,
              body: JSON.stringify({ ping: true }),
            });
          } catch {}

          const response = await fetch('/api/award-wins', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Attempt': attempt.toString()
            },
            credentials: 'include',
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
            } catch {
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

            // No client-side fallback; rely on server only to avoid wallet prompts
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
            
            // Track awarded types to prevent duplicates
            setAwardedTypes((prev) => new Set([...prev, ...toAward]));
            updatePlayerStats({ xp: XP_PER_WIN * toAward.length, totalWins: toAward.length, tickets: toAward.length });
            showToast(`🎉 ${data.totalRewards || rewardAmount} $BINGO awarded! Tx: ${data.transactionHash?.slice(0, 10)}...`, 'success');
             if (isMiniApp() && supportsHaptics()) {
               hapticsImpact('heavy');
             }

             // Streak bonus at 7 days
             try {
               if (streakCount >= 7) {
                 // Attempt onchain streak bonus claim (if contract supports it)
                 try {
                   await writeContractAsync({
                     address: GAME_ADDRESS,
                     abi: bingoGameV3ABI as any,
                     functionName: 'claimStreakBonus',
                     args: [],
                     value: BigInt(0),
                   });
                   showToast('🔥 7-day streak bonus claimed onchain!', 'success');
                 } catch {
                   showToast('🔥 7-day streak! Bonus claim available soon.', 'info');
                 }
               }
             } catch {}
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
      showToast(`${newWin.types.join(' + ')} achieved. Connect your wallet to receive $BINGO rewards.`, 'success');
    }
  // Reward dispatch intentionally snapshots award state for each newly detected win.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showToast('Shared. You have an extra play today.', 'success');
      
    } catch (error: any) {
      console.error('❌ Share failed:', error);
      showToast('Share failed. Try again.', 'error');
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

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-500">Round status</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-md bg-coinbase-blue px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">{gameStatus}</span>
            <span className="text-sm text-slate-600">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Wallet not connected'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-bold text-slate-950">{timerLabel}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">time left</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
        <div className="rounded-md bg-slate-50 p-3">
          <div className="font-mono text-xl font-bold text-slate-950">{playsRemaining}</div>
          <div className="text-xs text-slate-500">plays left</div>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <div className="font-mono text-xl font-bold text-slate-950">{playerStats.level}</div>
          <div className="text-xs text-slate-500">level</div>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <div className="font-mono text-xl font-bold text-slate-950">{streakCount}</div>
          <div className="text-xs text-slate-500">day streak</div>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <div className="font-mono text-xl font-bold text-slate-950">{playerStats.tickets}</div>
          <div className="text-xs text-slate-500">prize tickets</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-slate-500">
          <span>Draw progress: {drawnNumbers.size}/75</span>
          <span>Level progress: {levelProgress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${drawProgress}% of numbers drawn`}>
          <div className="h-full rounded-full bg-coinbase-blue transition-all" style={{ width: `${drawProgress}%` }} />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${levelProgress}% to next level`}>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${levelProgress}%` }} />
        </div>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
          <div className="font-bold">Reward runway</div>
          <div className="mt-1 text-xs">
            {rewardRunway ? `${rewardRunway.runwayWins} wins funded at ${rewardPerWin} $BINGO each` : 'Checking rewards...'}
          </div>
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-800">
          <div className="font-bold">Today&apos;s loop</div>
          <div className="mt-1 text-xs">Play, mark fast, win tickets, come back tomorrow to protect your streak.</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current draw</div>
          <div className="mt-1 font-mono text-3xl font-bold text-coinbase-blue">
            {currentNumber ? `${numberColumn(currentNumber)}-${currentNumber}` : '--'}
          </div>
        </div>
        <div className="flex min-h-12 flex-wrap justify-end gap-2">
          {recentDraws.length > 0 ? (
            recentDraws.map((num, idx) => (
              <div
                key={`${num}-${idx}`}
                className={`flex h-11 w-11 items-center justify-center rounded-md border font-mono text-base font-bold transition ${
                  idx === recentDraws.length - 1
                    ? 'border-coinbase-blue bg-coinbase-blue text-white'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {num}
              </div>
            ))
          ) : (
            <div className="flex items-center text-sm text-slate-400">Waiting for draws</div>
          )}
        </div>
      </div>

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
      <div className="hidden text-center">
        <p className="text-sm text-gray-600">
          {address ? (
            <>Connected: {address.slice(0, 6)}...{address.slice(-4)}</>
          ) : (
            'Connect wallet for rewards!'
          )}
        </p>
        {!supportsHaptics() && (
          <p className="text-xs text-gray-400 mt-1">Haptics not available in this environment</p>
        )}
        <div className="mt-2 text-xs text-gray-600">
          Streak: <span className="font-semibold">{streakCount} day{streakCount === 1 ? '' : 's'}</span>
        </div>
        {challengeInfo && (
          <div className="mt-1 text-xs text-gray-600">
            Weekly: <span className="font-semibold">{challengeInfo.name}</span> — reward {challengeInfo.rewardBingo} $BINGO
          </div>
        )}
        <div className="mt-2">
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyOptIn}
              onChange={async (e) => {
                const checked = e.target.checked;
                setNotifyOptIn(checked);
                localStorage.setItem('notifyChallenge', checked ? '1' : '0');
                try {
                  await fetch('/api/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'subscribe_challenge', data: { optIn: checked } }),
                  });
                } catch {}
              }}
            />
            Notify me when a new weekly challenge starts
          </label>
        </div>
      </div>

      {/* Timer */}
      {timerActive && (
        <p className="hidden text-xl text-red-500 font-bold animate-pulse mb-4">
          ⏰ Time Left: {Math.floor(gameTimer / 60)}:{gameTimer % 60 < 10 ? '0' : ''}{gameTimer % 60}
        </p>
      )}

      {/* Bingo Grid */}
      <div ref={gridRef} className="grid grid-cols-5 gap-1">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div key={letter} className="flex h-8 items-center justify-center rounded-md bg-slate-950 text-sm font-bold text-white">{letter}</div>
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
                className={`flex aspect-square min-h-12 items-center justify-center rounded-md border-2 text-sm font-bold transition-all duration-200 sm:text-base
                  ${isMarked ? 'border-coinbase-blue bg-coinbase-blue text-white shadow-sm' : 'border-slate-200 bg-white text-slate-900 hover:border-coinbase-blue hover:bg-blue-50'}
                  ${num === 'FREE' ? 'text-xs' : ''}
                  ${isDrawn && !isMarked ? 'animate-pulse border-emerald-500 bg-emerald-50 text-emerald-700' : ''}`}
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
        <div className="grid w-full grid-cols-2 gap-2">
        <button
          onClick={startGame}
            disabled={!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS}
            className={`rounded-md px-4 py-3 font-bold text-white transition-colors ${
              !unlimitedToday && dailyPlays >= MAX_FREE_PLAYS
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-coinbase-blue hover:bg-blue-700'
            }`}
          >
            {!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS ? 'Daily Plays Used' : 'New Game'}
        </button>
          {timerActive ? (
            <button
              onClick={pauseGame}
              className="rounded-md border border-slate-200 px-4 py-3 font-bold text-slate-700 transition hover:border-slate-400"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={resumeGame}
              disabled={drawnNumbers.size === 0 || gameTimer <= 0}
              className="rounded-md border border-slate-200 px-4 py-3 font-bold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Resume
            </button>
          )}
          {/* Auto-join runs in the background; no extra button needed for UX */}
        </div>
      </div>

      {/* Recent Draws */}
      <div className="hidden justify-center gap-2 mt-2 mb-4">
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
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
          <p className="font-bold">
            🎉 {winInfo.types.join(' + ')} ({winInfo.count} total) ✨ Rewards Sent!
          </p>
          <p className="mt-1 text-sm">
            {Number.parseFloat(rewardPerWin) * winInfo.types.length} $BINGO tokens awarded automatically!
          </p>
        </div>
      )}

      {/* Daily Limit Upsells */}
      {(!unlimitedToday && dailyPlays >= MAX_FREE_PLAYS) && (
        <div className="rounded-md bg-blue-50 p-3">
          <p className="text-coinbase-blue mb-2 font-semibold">🎯 Free plays used up today! Get more:</p>
          <div className="space-y-2">
            <button 
              onClick={shareForExtraPlay}
              className="w-full rounded-md bg-coinbase-blue px-4 py-2 font-bold text-white hover:bg-blue-700"
            >
              📢 Share on Farcaster (+1 Play)
            </button>
            <button
              onClick={payForUnlimited}
              className="w-full rounded-md bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700"
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
