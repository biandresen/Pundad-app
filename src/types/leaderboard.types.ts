import type { User } from "./context.types";

export type LeaderboardRow = {
  user: User;
  winsByBadge: Record<string, number>;
  winsTotal: number;
  featuredScore: number;
  streakBonusPoints: number;
  likesReceived: number;
  commentsReceived: number;
  dailyStreak: number;
  bestStreak: number;
};
