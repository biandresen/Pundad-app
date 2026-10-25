import type { Badge, BadgeKey, CurrentUserBadge, User } from "../types/context.types";
import type { AppLanguage } from "../i18n/translations";

export const BADGE_CATALOG: Record<BadgeKey, Omit<Badge, "key">> = {
  ADMIN: { label: "Admin", icon: "🛡️", priority: 0 },
  TOP_CREATOR_MONTH: { label: "Top Creator (Month)", icon: "🏆", priority: 1 },
  JOKE_OF_DAY: { label: "Joke of the Day", icon: "👑", priority: 2 },
  TRENDING_WEEK: { label: "Trending (Week)", icon: "⚡", priority: 3 },
  MOST_COMMENTED_WEEK: { label: "Most Commented (Week)", icon: "🎭", priority: 4 },
  FASTEST_GROWING: { label: "Fastest Growing", icon: "🚀", priority: 5 },
  STREAK: { label: "Daily Streak", icon: "🔥", priority: 6 },
  STREAK_BONUS: { label: "Streak bonus", icon: "🔥", priority: 7 },
};

export function getCurrentBadgeValidity(badge: CurrentUserBadge): { from: number; to: number } {
  const from = Date.parse(badge.validFrom ?? badge.since);
  let to = badge.validTo == null ? Infinity : Date.parse(badge.validTo);
  if (badge.badge === "JOKE_OF_DAY" && badge.validTo == null) {
    // Older daily awards have no expiry metadata; they still last one UTC day.
    const day = new Date(from);
    day.setUTCHours(24, 0, 0, 0);
    to = day.getTime();
  }
  return { from, to };
}

export function isCurrentBadgeActive(badge: CurrentUserBadge, language?: AppLanguage, now = Date.now()): boolean {
  if (badge.badge === "STREAK_BONUS") return false;
  if (language && badge.language && badge.language !== language) return false;
  const { from, to } = getCurrentBadgeValidity(badge);
  return Number.isFinite(from) && from <= now && now < to;
}

export function resolveActiveBadgesFromUser(user?: User | null, language?: AppLanguage, now = Date.now()): Badge[] {
  if (!user) return [];

  const keys = new Set<BadgeKey>();

  if (user.role === "ADMIN") keys.add("ADMIN");

  (user.currentBadges ?? []).forEach((b) => {
    if (BADGE_CATALOG[b.badge] && isCurrentBadgeActive(b, language, now)) keys.add(b.badge);
  });

  // streak badge rule (example: only >= 7)
  if ((user.dailyJokeStreak ?? 0) >= 7) keys.add("STREAK");

  return Array.from(keys).map((key) => ({ key, ...BADGE_CATALOG[key] }));
}

export function pickPrimaryBadgeFromUser(user?: User | null, language?: AppLanguage, now = Date.now()): Badge | null {
  const active = resolveActiveBadgesFromUser(user, language, now);
  if (!active.length) return null;
  return active.sort((a, b) => a.priority - b.priority)[0];
}


export function getStreakTier(streak: number) {
  if (streak >= 365) return { tier: "legend", label: "Legend", colorClass: "bg-purple-500/90" };
  if (streak >= 100) return { tier: "elite", label: "Elite", colorClass: "bg-blue-500/90" };
  if (streak >= 30) return { tier: "gold", label: "Gold", colorClass: "bg-yellow-500/90" };
  if (streak >= 7) return { tier: "hot", label: "Hot", colorClass: "bg-orange-500/90" };
  if (streak >= 1) return { tier: "warm", label: "Warm", colorClass: "bg-orange-400/90" };
  return { tier: "none", label: "None", colorClass: "bg-white/10" };
}
