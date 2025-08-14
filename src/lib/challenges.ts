export type ChallengeId =
  | 'LINE_MASTER'
  | 'FULL_HOUSE_HUNT'
  | 'STREAK_BUILDER'
  | 'SOCIAL_DAUBER'
  | 'TOKEN_BURNER'
  | 'MULTI_WIN_MARATHON'
  | 'REFERRAL_RALLY'
  | 'SPEED_BINGO';

export interface WeeklyChallenge {
  id: ChallengeId;
  name: string;
  description: string;
  goal: string;
  rewardBingo: number;
  supported: boolean;
}

export function getIsoWeekInfo(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) as any;
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)) as any;
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

export function getWeekKey(date = new Date()): string {
  const { year, week } = getIsoWeekInfo(date);
  return `${year}-W${week}`;
}

export const ALL_CHALLENGES: WeeklyChallenge[] = [
  {
    id: 'LINE_MASTER',
    name: 'Line Master',
    description: 'Win at least 5 lines across all games this week.',
    goal: 'Get 5 line wins (rows, columns, or diagonals).',
    rewardBingo: 500,
    supported: true,
  },
  {
    id: 'FULL_HOUSE_HUNT',
    name: 'Full House Hunt',
    description: 'Achieve 1 full house win this week.',
    goal: 'Get at least one Full House!',
    rewardBingo: 2000,
    supported: true,
  },
  {
    id: 'STREAK_BUILDER',
    name: 'Streak Builder',
    description: 'Maintain a 5-day play streak with at least 1 win per day.',
    goal: 'Play and win once per day for 5 days.',
    rewardBingo: 1000,
    supported: true,
  },
  {
    id: 'SOCIAL_DAUBER',
    name: 'Social Dauber',
    description: 'Share 3 wins on Farcaster and get 2 shares back.',
    goal: 'Share wins and get replies.',
    rewardBingo: 400,
    supported: false,
  },
  {
    id: 'TOKEN_BURNER',
    name: 'Token Burner',
    description: 'Burn 100 $BINGO for a lucky card and win.',
    goal: 'Burn and win with lucky card.',
    rewardBingo: 1500,
    supported: false,
  },
  {
    id: 'MULTI_WIN_MARATHON',
    name: 'Multi-Win Marathon',
    description: 'Achieve 3 multi-wins (double line or better).',
    goal: 'Get 3 double-line or full house wins.',
    rewardBingo: 2500,
    supported: true,
  },
  {
    id: 'REFERRAL_RALLY',
    name: 'Referral Rally',
    description: 'Refer 2 friends who complete 1 game.',
    goal: 'Get two friends to play a game.',
    rewardBingo: 600,
    supported: false,
  },
  {
    id: 'SPEED_BINGO',
    name: 'Speed Bingo',
    description: 'Complete a line in under 1 minute (short timer mode).',
    goal: 'Win a line with 60s or more remaining.',
    rewardBingo: 1200,
    supported: true,
  },
];

export function getCurrentChallenge(date = new Date()): WeeklyChallenge {
  const { week } = getIsoWeekInfo(date);
  // Use only supported challenges for rotation
  const supported = ALL_CHALLENGES.filter((c) => c.supported);
  const idx = (week - 1) % supported.length;
  return supported[idx];
}


