import type { Dispatch, SetStateAction } from "react";
import type { AppLanguage } from "../i18n/translations";

export type ColorTheme = "light" | "dark";

export interface ColorThemeContextType {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  toggleTheme: () => void;
}
//--------------------------------------------
export type UserRole = "USER" | "ADMIN";

export type BadgeKey =
  | "ADMIN"
  | "TOP_CREATOR_MONTH"
  | "JOKE_OF_DAY"
  | "TRENDING_WEEK"
  | "MOST_COMMENTED_WEEK"
  | "FASTEST_GROWING"
  | "STREAK_BONUS"
  | "STREAK";

export type Badge = {
  key: BadgeKey;
  label: string;
  icon: string;
  priority: number; // lower = higher priority
};

export type CurrentUserBadge = {
  id: string;
  badge: BadgeKey;
  since: string;
  validFrom?: string | null;
  validTo?: string | null;
  language?: AppLanguage | null;
  context?: any;
};

export type BadgeAward = {
  id: string;
  badge: BadgeKey;
  awardedAt: string;
  validFrom?: string | null;
  validTo?: string | null;
  context?: any;
};

export type User = {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;

  termsAcceptedAt: string | null;
  termsVersion: string | null;
  preferredLanguage: AppLanguage;

  dailyJokeStreak: number;
  dailyJokeLastViewedAt: string | null;
  dailyJokeBestStreak: number;

  currentBadges?: CurrentUserBadge[];
  badgeAwards?: BadgeAward[];
};

export interface UserContextType {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
}
//--------------------------------------------

export type token = string | null;

export interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
  loading: boolean;
  setLoading: (val: boolean) => void;
}
