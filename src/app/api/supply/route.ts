import { NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';

const erc20Abi = [
  { type: 'function', stateMutability: 'view', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', stateMutability: 'view', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', stateMutability: 'view', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const TOKEN_ADDRESS = '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047' as `0x${string}`;
const NON_CIRC_ADDRESSES: `0x${string}`[] = [
  '0x86EA71C17B76169Fce3Cd12C94C3CdCaD2C72844',
  '0x88eAbBdD2158D184f4cB1C39B612eABB48289907',
  '0x22cF7a77491614B0b69FF9Fd77D0F63048DB5dDb',
  '0x36Fb73233f8BB562a80fcC3ab9e6e011Cfe091f5',
  '0x4CE879376Dc50aBB1Eb8F236B76e8e5a724780Be',
  '0x000000000000000000000000000000000000dEaD',
];

const client = createPublicClient({ chain: base, transport: http() });

export async function GET() {
  try {
    const [decimals, totalSupply] = await Promise.all([
      client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: 'decimals' }),
      client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: 'totalSupply' }),
    ]);

    const balances = await Promise.all(
      NON_CIRC_ADDRESSES.map((addr) =>
        client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [addr] })
      )
    );

    const nonCircTotal = balances.reduce((acc, v) => acc + v, BigInt(0));
    const circulatingRaw = totalSupply - nonCircTotal;
    const circulatingSafe = circulatingRaw < BigInt(0) ? BigInt(0) : circulatingRaw;

    const payload = {
      token_address: TOKEN_ADDRESS,
      network: 'base-mainnet',
      decimals: Number(decimals),
      total_supply: totalSupply.toString(),
      circulating_supply: circulatingSafe.toString(),
      total_supply_formatted: formatUnits(totalSupply, Number(decimals)),
      circulating_supply_formatted: formatUnits(circulatingSafe, Number(decimals)),
      non_circulating_addresses: NON_CIRC_ADDRESSES,
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'internal_error' }, { status: 500 });
  }
}
