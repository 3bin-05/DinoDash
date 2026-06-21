export interface DailyChallengeDef {
  id: string;
  type: "score" | "games" | "time";
  target: number;
  title: string;
  description: string;
}

export const DAILY_CHALLENGES: DailyChallengeDef[] = [
  {
    id: "score_2500",
    type: "score",
    target: 2500,
    title: "SCORE CHASER",
    description: "Reach a score of 2,500 points in a single run."
  },
  {
    id: "play_3_games",
    type: "games",
    target: 3,
    title: "TRIPLE RUNNER",
    description: "Complete 3 full game runs today."
  },
  {
    id: "survive_3_min",
    type: "time",
    target: 180, // 180 seconds = 3 minutes
    title: "SURVIVAL EXPERT",
    description: "Survive for 3 minutes (180 seconds) in a single run."
  },
  {
    id: "score_5000",
    type: "score",
    target: 5000,
    title: "LEGENDARY CHASER",
    description: "Reach a score of 5,000 points in a single run."
  }
];

// Deterministic generator using string hashing
export function getDailyChallengeForDate(dateStr: string): DailyChallengeDef {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DAILY_CHALLENGES.length;
  return DAILY_CHALLENGES[index];
}
