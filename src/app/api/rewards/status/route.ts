import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const GAME_ADDRESS = (process.env.GAME_ADDRESS || process.env.NEXT_PUBLIC_GAME_ADDRESS || '0x28BE1BD4267EEE7551eC256A6b1a034D559faeC0') as string;
const TOKEN_ADDRESS = (process.env.TOKEN_ADDRESS || process.env.NEXT_PUBLIC_TOKEN_ADDRESS || '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047') as string;
const BASE_RPC_URL = process.env.CDP_RPC || process.env.NEXT_PUBLIC_CDP_RPC || 'https://mainnet.base.org';

const gameAbi = [
  { inputs: [], name: 'getConfig', outputs: [
    { internalType: 'address', name: '_owner', type: 'address' },
    { internalType: 'uint256', name: '_rewardPerWin', type: 'uint256' },
  ], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getGameStats', outputs: [
    { internalType: 'uint256', name: '_totalGamesPlayed', type: 'uint256' },
    { internalType: 'uint256', name: '_contractBalance', type: 'uint256' },
  ], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'oracle', type: 'address' }], name: 'isAuthorizedOracle', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
] as const;

const tokenAbi = [
  { inputs: [{ internalType: 'address', name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
] as const;

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const game = new ethers.Contract(GAME_ADDRESS, gameAbi, provider) as any;
    const token = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, provider) as any;
    const signerAddress = process.env.OWNER_PRIVATE_KEY
      ? new ethers.Wallet(process.env.OWNER_PRIVATE_KEY).address
      : null;

    const [config, stats, tokenBalance, decimals, isAuthorizedOracle] = await Promise.all([
      game.getConfig().catch(() => null),
      game.getGameStats().catch(() => null),
      token.balanceOf(GAME_ADDRESS).catch(() => null),
      token.decimals().catch(() => 18),
      signerAddress ? game.isAuthorizedOracle(signerAddress).catch(() => false) : Promise.resolve(false),
    ]);

    const rewardPerWin = config?._rewardPerWin ?? config?.[1] ?? BigInt(1000) * BigInt(10) ** BigInt(Number(decimals));
    const contractBalance = tokenBalance ?? stats?._contractBalance ?? stats?.[1] ?? BigInt(0);
    const runwayWins = rewardPerWin > BigInt(0) ? Number(contractBalance / rewardPerWin) : 0;

    return NextResponse.json({
      success: true,
      gameAddress: GAME_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      signerConfigured: !!signerAddress,
      signerAddress,
      isAuthorizedOracle,
      rewardPerWin: rewardPerWin.toString(),
      rewardPerWinFormatted: ethers.formatUnits(rewardPerWin, Number(decimals)),
      contractBalance: contractBalance.toString(),
      contractBalanceFormatted: ethers.formatUnits(contractBalance, Number(decimals)),
      runwayWins,
      totalGamesPlayed: (stats?._totalGamesPlayed ?? stats?.[0] ?? BigInt(0)).toString(),
      healthy: !!signerAddress && runwayWins > 0,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, healthy: false, message: error?.message || 'Reward status unavailable' }, { status: 500 });
  }
}
