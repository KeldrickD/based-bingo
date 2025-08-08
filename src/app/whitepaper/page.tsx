import React from 'react';

export const metadata = {
  title: 'Based Bingo (BINGO) — Whitepaper',
  description: 'Onchain bingo on Base. Tokenomics, contracts, economics, governance, and roadmap for BINGO.',
};

export default function WhitepaperPage() {
  return (
    <main className="prose prose-blue max-w-3xl mx-auto px-4 py-10">
      <h1>Based Bingo (BINGO) — Whitepaper</h1>

      <h2>Abstract</h2>
      <p>
        Based Bingo is an onchain bingo game on Base that uses the BINGO ERC-20 token for gameplay, rewards,
        and fee burns. The system emphasizes permissionless reward distribution, low-friction gameplay,
        and a transparent, capped token supply. This document specifies tokenomics, economic flows,
        governance plans, security considerations, and roadmap.
      </p>

      <h2>Contracts and Network</h2>
      <ul>
        <li><b>Network</b>: Base Mainnet</li>
        <li><b>Token (BINGO)</b>: <code>0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047</code></li>
        <li><b>Game (BingoGameV3)</b>: <code>0x88eAbBdD2158D184f4cB1C39B612eABB48289907</code></li>
        <li><b>Owner (on-chain)</b>: <code>0x86EA71C17B76169Fce3Cd12C94C3CdCaD2C72844</code></li>
      </ul>

      <h2>Token Specifications</h2>
      <ul>
        <li><b>Name / Symbol</b>: Based Bingo (BINGO)</li>
        <li><b>Standard</b>: ERC-20 (OpenZeppelin)</li>
        <li><b>Decimals</b>: 18</li>
        <li><b>Max Supply Cap</b>: 2,000,000,000 BINGO</li>
        <li><b>Initial Mint</b>: 1,000,000,000 BINGO to owner wallet</li>
        <li><b>Minting</b>: Owner-only up to the 2,000,000,000 cap (for emissions and ecosystem funding)</li>
        <li><b>Burning</b>: Enabled (ERC20Burnable). Game contracts may burn a portion of entry fees automatically.</li>
        <li><b>Metadata URI</b>: Off-chain JSON served via <code>tokenURI()</code> for logo/links/descriptions</li>
      </ul>

      <h2>Utility</h2>
      <ul>
        <li><b>Gameplay Currency</b>: Entry fees (if enabled) are paid in BINGO. Users can approve the game contract for gasless token transfers.</li>
        <li><b>Rewards</b>: Winners receive automatic payouts in BINGO per win type, without claims (permissionless awards).</li>
        <li><b>Unlimited Play Pass</b>: Users can buy unlimited daily play using BINGO.</li>
        <li><b>Deflationary Pressure</b>: A portion of each entry fee can be burned, reducing circulating supply over time.</li>
        <li><b>Future Governance/Staking (planned)</b>: Used to align incentives and community direction.</li>
      </ul>
      <blockquote>
        <p>
          <b>Current Frontend Mode: Free-to-Play (F2P).</b> The live frontend does not collect entry fees.
          The contract’s entry fee parameter remains in place but is not charged by the UI.
          Rewards continue to be paid from the game contract balance (funded by treasury/emissions).
        </p>
      </blockquote>

      <h2>Game Economics (V3)</h2>
      <ul>
        <li><b>Entry Fee (Contract Parameter)</b>: 2,500 BINGO per join (adjustable by owner)</li>
        <li><b>Frontend Collection</b>: 0 BINGO (F2P mode)</li>
        <li><b>Reward Per Win Type</b>: 1,000 BINGO (fixed in V3)</li>
        <li><b>Unlimited Day Pass</b>: 50 BINGO</li>
        <li><b>Burn Rate on Entry Fee</b>: 2% burned to <code>0x000000000000000000000000000000000000dEaD</code> (no effect in F2P mode)</li>
        <li><b>Permissionless Rewards</b>: Anyone can call <code>awardWins(winner, [winTypes], gameId)</code>;
          duplicate-safe per win type per game.</li>
        <li><b>Per-session gameId</b>: The frontend assigns a unique gameId each session and includes it with awards to avoid duplicate-claim reverts across sessions.</li>
      </ul>

      <h3>Economic Flow per Join</h3>
      <p><b>Contract-parametrized model (if fees are collected)</b>:</p>
      <ul>
        <li><b>Player pays</b>: 2,500 BINGO</li>
        <li><b>Burned</b>: 2% × 2,500 = 50 BINGO</li>
        <li><b>Retained by contract</b>: 2,450 BINGO</li>
        <li><b>Reward per win type</b>: 1,000 BINGO</li>
      </ul>
      <p><b>Frontend F2P model (current live behavior)</b>:</p>
      <ul>
        <li><b>Player pays</b>: 0 BINGO</li>
        <li><b>Burned</b>: 0 BINGO</li>
        <li><b>Retained by contract</b>: 0 BINGO</li>
        <li><b>Reward per win type</b>: 1,000 BINGO (funded from treasury/contract balance)</li>
      </ul>
      <p>
        The F2P mode is designed for user growth and onboarding; it requires periodic treasury top-ups to maintain reward solvency.
      </p>

      <h3>Solvency Considerations</h3>
      <p>
        Let <code>N</code> be players, <code>b</code> burn rate, <code>E</code> entry fee, <code>R</code> reward per win, and <code>W</code> win types awarded in a game.
      </p>
      <ul>
        <li><b>Fee-collecting model</b>: Retained: <code>N · E · (1 − b)</code>; Rewards: <code>W · R</code>; Solvency: <code>W ≤ N · E · (1 − b) / R</code></li>
        <li><b>F2P model</b>: Retained: 0; Rewards: <code>W · R</code>; Solvency is treasury-funded; ensure game contract balance ≥ <code>W · R</code> over time.</li>
      </ul>

      <h2>Tokenomics and Allocation</h2>
      <ul>
        <li><b>Max Supply</b>: 2,000,000,000 BINGO</li>
        <li><b>Minted at Genesis</b>: 1,000,000,000 BINGO</li>
        <li><b>Emissions Reserve</b>: Up to 1,000,000,000 BINGO can be minted over time for:
          <ul>
            <li>Ecosystem rewards and prize pools</li>
            <li>Liquidity provisioning/market making</li>
            <li>Partnerships, community incentives</li>
            <li>Operations and development</li>
          </ul>
        </li>
      </ul>
      <p><b>Proposed non-binding allocation framework</b> (subject to community updates):</p>
      <ul>
        <li><b>Ecosystem & Rewards</b>: 60%</li>
        <li><b>Liquidity & Market Making</b>: 20%</li>
        <li><b>Operations & Treasury</b>: 10%</li>
        <li><b>Partnerships/Community Growth</b>: 5%</li>
        <li><b>Team (Vested)</b>: 5%</li>
      </ul>
      <p>
        This framework is not hard-coded in contracts; it is a policy commitment subject to public reporting and eventual governance.
        Additional emissions (beyond the initial 1B) will be minted only to support long-term ecosystem health and may be subject to on-chain vesting and community oversight.
      </p>

      <h2>Treasury and Revenue</h2>
      <p><b>Sources</b>:</p>
      <ul>
        <li>Non-burned portion of entry fees retained by the game contract (not active in F2P mode)</li>
        <li>Treasury/emissions top-ups to the game contract</li>
        <li>Partnerships/sponsorships (optional)</li>
      </ul>
      <p><b>Uses</b>:</p>
      <ul>
        <li>Reward pool top-ups to ensure solvency (critical in F2P)</li>
        <li>Liquidity provisioning and market stabilization</li>
        <li>Development, audits, and operations</li>
        <li>Buyback-and-burn (policy-driven)</li>
      </ul>
      <p>
        The V3 game contract’s <code>withdrawFees()</code> allows the owner to withdraw the token balance.
        In F2P, operational policy prioritizes maintaining sufficient reward runway before any treasury movements.
      </p>

      <h2>Governance (Planned)</h2>
      <ul>
        <li><b>Phase 1</b>: Off-chain community signaling and public reporting for treasury actions</li>
        <li><b>Phase 2</b>: Multi-signature ownership; published spending policies and caps</li>
        <li><b>Phase 3</b>: On-chain governance for parameter updates (e.g., entry fee, burn rate, future reward adjustments), treasury allocations, and emissions schedules</li>
      </ul>

      <h2>Security and Risk</h2>
      <ul>
        <li><b>Audited Standards</b>: Uses OpenZeppelin ERC-20, Ownable, ReentrancyGuard</li>
        <li><b>Permissionless Awards</b>: No centralized gatekeeping to trigger rewards; duplicate-safe via per-game, per-winner, per-win-type tracking using keccak256 of standardized win strings</li>
        <li><b>Key Risks</b>:
          <ul>
            <li><b>Parameter Risk</b>: <code>entryFee</code> is adjustable by owner; <code>rewardPerWin</code> is fixed in V3 (future versions may add a setter with governance)</li>
            <li><b>Operational Risk</b>: Treasury withdrawals must be responsibly managed; policy and reporting will be enforced</li>
            <li><b>Input Risk</b>: Win-type strings must be standardized off-chain to avoid mismatch in hashing; mislabeling could block awards</li>
          </ul>
        </li>
      </ul>

      <h2>Roadmap</h2>
      <ul>
        <li><b>Q1</b>: Mainnet deployment (Completed), permissionless rewards (V3), initial funding and testing (Completed)</li>
        <li><b>Q2</b>: Community reporting, standardized win-type registry, operations policy publication</li>
        <li><b>Q3</b>: Multi-sig owner, public treasury dashboard, emissions framework published</li>
        <li><b>Q4</b>: On-chain governance, potential staking or LP incentive programs</li>
      </ul>

      <h2>Disclaimers</h2>
      <ul>
        <li>This document is informational and non-binding. It does not constitute financial advice or an offer of securities.</li>
        <li>Token allocations and policies may evolve with community input and governance. Smart contract parameters are subject to change via owner controls or future governance upgrades.</li>
        <li>Users should verify contract addresses and read code on explorers before interacting.</li>
      </ul>

      <h2>References</h2>
      <ul>
        <li><code>BasedBingo.sol</code> (token): capped supply, burnable, owner-controlled mint within cap, off-chain metadata URI</li>
        <li><code>BingoGameV3.sol</code> (game): entry fee in BINGO, 2% burn, unlimited pass, permissionless duplicate-safe <code>awardWins</code>, owner-only fee withdrawal, <b>join emits/associates a game session (gameId)</b></li>
      </ul>
    </main>
  );
}
