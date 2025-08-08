const { createPublicClient, http } = require("viem");
const { base } = require("viem/chains");

// ERC-20 minimal ABI
const erc20Abi = [
  { type: "function", stateMutability: "view", name: "decimals", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", stateMutability: "view", name: "totalSupply", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", stateMutability: "view", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
];

// Based Bingo token on Base mainnet
const TOKEN_ADDRESS = "0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047";

// Addresses considered non-circulating for circulating supply calculation
// - Treasury/Owner wallet (operational reserves)
// - Game contracts (reward pools)
// - Burn address
const NON_CIRC_ADDRESSES = [
  // Owner/Treasury
  "0x86EA71C17B76169Fce3Cd12C94C3CdCaD2C72844",
  // Active Game V3
  "0x88eAbBdD2158D184f4cB1C39B612eABB48289907",
  // Legacy pool addresses (V1/V2/old V3) if still holding balances
  "0x22cF7a77491614B0b69FF9Fd77D0F63048DB5dDb", // V1
  "0x36Fb73233f8BB562a80fcC3ab9e6e011Cfe091f5", // V2
  "0x4CE879376Dc50aBB1Eb8F236B76e8e5a724780Be", // old V3
  // Burn address
  "0x000000000000000000000000000000000000dEaD",
];

const client = createPublicClient({ chain: base, transport: http() });

function formatUnits(bn, decimals) {
  const s = bn.toString();
  if (decimals === 0) return s;
  const pad = decimals - (s.length - Math.max(0, s.length - decimals));
  const whole = s.length > decimals ? s.slice(0, -decimals) : "0";
  const frac = s.length > decimals ? s.slice(-decimals) : s.padStart(decimals, "0");
  return `${whole}.${frac}`.replace(/\.0+$/, "");
}

module.exports = async (req, res) => {
  try {
    // Fetch on-chain data
    const [decimals, totalSupply] = await Promise.all([
      client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "totalSupply" }),
    ]);

    // Sum non-circulating balances
    const balances = await Promise.all(
      NON_CIRC_ADDRESSES.map((addr) => client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [addr] }))
    );
    const nonCircTotal = balances.reduce((acc, v) => acc + v, 0n);

    const circulating = totalSupply - nonCircTotal;

    const payload = {
      token_address: TOKEN_ADDRESS,
      network: "base-mainnet",
      decimals: Number(decimals),
      total_supply: totalSupply.toString(),
      circulating_supply: (circulating < 0n ? 0n : circulating).toString(),
      total_supply_formatted: formatUnits(totalSupply, Number(decimals)),
      circulating_supply_formatted: formatUnits(circulating < 0n ? 0n : circulating, Number(decimals)),
      non_circulating_addresses: NON_CIRC_ADDRESSES,
      updated_at: new Date().toISOString(),
    };

    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(payload));
  } catch (e) {
    res.status(500).send(JSON.stringify({ error: e?.message || "internal_error" }));
  }
};
