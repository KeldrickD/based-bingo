const { createPublicClient, http } = require("viem");
const { base } = require("viem/chains");

const erc20Abi = [
  { type: "function", stateMutability: "view", name: "decimals", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", stateMutability: "view", name: "totalSupply", inputs: [], outputs: [{ type: "uint256" }] },
];

const TOKEN_ADDRESS = "0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047";
const client = createPublicClient({ chain: base, transport: http() });

function formatUnits(bn, decimals) {
  const s = bn.toString();
  if (decimals === 0) return s;
  const whole = s.length > decimals ? s.slice(0, -decimals) : "0";
  const frac = s.length > decimals ? s.slice(-decimals) : s.padStart(decimals, "0");
  return `${whole}.${frac}`.replace(/\.0+$/, "");
}

module.exports = async (req, res) => {
  try {
    const [decimals, totalSupply] = await Promise.all([
      client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "totalSupply" }),
    ]);

    const payload = {
      token_address: TOKEN_ADDRESS,
      network: "base-mainnet",
      decimals: Number(decimals),
      total_supply: totalSupply.toString(),
      total_supply_formatted: formatUnits(totalSupply, Number(decimals)),
      updated_at: new Date().toISOString(),
    };

    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(payload));
  } catch (e) {
    res.status(500).send(JSON.stringify({ error: e?.message || "internal_error" }));
  }
};
