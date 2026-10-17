// Vite proxies these paths in development; Nginx handles them after deployment.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "";

const JOKE_API = {
  BASE: API_BASE_URL,
  BASE_AVATAR: API_ORIGIN,
  REGISTER: "/auth/register",
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  REFRESH: "/auth/refresh",
  VERIFY_EMAIL: "/auth/verify-email",
  RESEND_VERIFICATION: "/auth/resend-verification",
  RESETPASSWORD: "/auth/reset-password",
  NEWPASSWORD: "/auth/new-password",
  GCU_DRAFTS: "/jokes/drafts",
  USER: "/user",
  USERINPUT: "/user/input",
  JOKES: "/jokes",
  COMMENTS: "/comments",
  PUBLISH: "/publish",
  POPULAR: "/popular",
  RANDOM: "/random",
  DAILY: "/daily",
  DAILY_VIEW: "/daily/view",
  BADGE_HISTORY_ME: "/badges/me/history",
  CURRENT_BADGES_ME: "/badges/me/current",
  SEARCH: "/search",
  CONTACT: "/contact",
};

export default JOKE_API;
