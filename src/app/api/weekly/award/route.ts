import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import bingoGameV3ABI from '@/abis/BingoGameV3.json';

const GAME_ADDRESS = (process.env.GAME_ADDRESS as string) || process.env.NEXT_PUBLIC_GAME_ADDRESS || '0x28BE1BD4267EEE7551eC256A6b1a034D559faeC0';
const BASE_RPC_URL = process.env.NEXT_PUBLIC_CDP_RPC || 'https://mainnet.base.org';

export async function POST(request: NextRequest) {
  try {
    const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      return NextResponse.json({ success: false, message: 'Server configuration error: missing owner key' }, { status: 500 });
    }

    const { player, challengeId, weekKey, amount } = (await request.json()) as { player: string; challengeId: string; weekKey: number; amount: string | number };
    if (!ethers.isAddress(player)) {
      return NextResponse.json({ success: false, message: 'Invalid player address' }, { status: 400 });
    }
    if (!challengeId) {
      return NextResponse.json({ success: false, message: 'Missing challengeId' }, { status: 400 });
    }
    if (!weekKey || Number(weekKey) <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid weekKey' }, { status: 400 });
    }
    const amountWei = BigInt(amount);

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const signer = new ethers.Wallet(ownerPrivateKey, provider);
    const contract = new ethers.Contract(GAME_ADDRESS, bingoGameV3ABI as any, signer) as any;

    const tx = await contract.awardWeeklyChallenge(player, ethers.id(challengeId), weekKey, amountWei);
    const receipt = await tx.wait();

    return NextResponse.json({ success: true, transactionHash: receipt.hash, blockNumber: receipt.blockNumber });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Weekly award failed' }, { status: 500 });
  }
}


