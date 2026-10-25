import type { AppLanguage } from "../i18n/translations";

export type StreakBonusProgress = {
  language: AppLanguage;
  status: "disabled" | "scheduled" | "active";
  startsAt: string | null;
  streak: number;
  bestStreak: number;
  lastViewedAt: string | null;
  viewedToday: boolean;
  daysUntilBonus: number;
  awarded?: boolean;
};

export type DailyJokeView = {
  dailyJokeStreak: number;
  dailyJokeBestStreak: number;
  dailyJokeLastViewedAt: string | null;
  streakBonus: StreakBonusProgress;
};
