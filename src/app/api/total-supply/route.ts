import { NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';

const erc20Abi = [
  { type: 'function', stateMutability: 'view', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', stateMutability: 'view', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

const TOKEN_ADDRESS = '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047' as `0x${string}`;
const client = createPublicClient({ chain: base, transport: http() });

export async function GET() {
  try {
    const [decimals, totalSupply] = await Promise.all([
      client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: 'decimals' }),
      client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: 'totalSupply' }),
    ]);

    const payload = {
      token_address: TOKEN_ADDRESS,
      network: 'base-mainnet',
      decimals: Number(decimals),
      total_supply: totalSupply.toString(),
      total_supply_formatted: formatUnits(totalSupply, Number(decimals)),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'internal_error' }, { status: 500 });
  }
}
