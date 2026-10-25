import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { LeaderboardRow } from "../../../types/leaderboard.types";
import { getLeaderboardUsers } from "../../../lib/axios";

import Spinner from "../../../components/atoms/Spinner";
import AvatarWithBadges from "../../../components/atoms/AvatarWithBadges";

import { useLanguage } from "../../../contexts/LanguageContext";
import type { AppLanguage } from "../../../i18n/translations";

type LeaderboardPeriod = "week" | "month" | "all";

const LIMIT = 25;

const Leaderboard = () => {
  const { t, language } = useLanguage();

  const [period, setPeriod] = useState<LeaderboardPeriod>("month");
  const [items, setItems] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedLanguage, setLoadedLanguage] = useState<AppLanguage | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await getLeaderboardUsers(period, LIMIT, language);

        if (!isActive) return;

        setItems(res.data ?? []);
      } catch (err: any) {
        if (!isActive) return;

        setError(err?.message ?? t("leaderboard.states.failed"));
      } finally {
        if (isActive) {
          setLoadedLanguage(language);
          setLoading(false);
        }
      }
    };

    fetchLeaderboard();

    return () => {
      isActive = false;
    };
  }, [period, language, t]);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriod(e.target.value as LeaderboardPeriod);
  };

  if (loading || loadedLanguage !== language) {
    return <Spinner />;
  }

  if (error) {
    return <div className="text-center text-[var(--text1)]">{error}</div>;
  }

  return (
    <div className="container max-w-150 md:mt-8">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-4xl font-bold text-[var(--text1)] lg:text-4xl">{t("leaderboard.heading")}</h2>

        <select
          className="w-full lg:w-auto rounded-lg border border-white/10 bg-[var(--primary)] px-3 py-2 text-[var(--text2)]"
          value={period}
          onChange={handlePeriodChange}
          aria-label={t("leaderboard.heading")}
          disabled={loading}
        >
          <option value="week">{t("leaderboard.periods.week")}</option>
          <option value="month">{t("leaderboard.periods.month")}</option>
          <option value="all">{t("leaderboard.periods.all")}</option>
        </select>
      </div>

      <p className="mb-5 text-sm text-[var(--text1)]">
        <Link to="/points-and-ranking" className="font-semibold underline underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4">
          {t("rankingGuide.link")} <span aria-hidden="true">→</span>
        </Link>
      </p>

      {items.length === 0 ?
        <div className="text-[var(--text1)] opacity-70">{t("leaderboard.states.empty")}</div>
      : <div className="rounded-2xl border border-white/10 bg-[var(--bg-input)] overflow-x-hidden overflow-y-visible">
          <div>
            <div
              className="
                grid grid-cols-[24px_minmax(0,1fr)] lg:grid-cols-[32px_minmax(0,1fr)_64px_64px_44px_52px]
                gap-3 px-3 py-3 lg:px-4 bg-[var(--primary)] text-lg text-[var(--text2)]
              "
            >
              <div>{t("leaderboard.table.rank")}</div>
              <div>{t("leaderboard.table.user")}</div>
              <div className="hidden lg:block text-right font-semibold">{t("leaderboard.table.score")}</div>
              <div className="hidden lg:block text-right text-sm">{t("leaderboard.table.wins")}</div>
              <div className="hidden lg:block text-right">{t("leaderboard.table.likes")}</div>
              <div className="hidden lg:block text-right" title={t("leaderboard.table.streakInfo")}>{t("leaderboard.table.streak")}</div>
            </div>

            {items.map((row, idx) => (
              <div
                key={row.user.id}
                className="
                  relative grid grid-cols-[24px_minmax(0,1fr)] lg:grid-cols-[32px_minmax(0,1fr)_64px_64px_44px_52px]
                  gap-3 px-3 py-3 lg:px-4 border-t border-white/10 text-[var(--text1)]
                  overflow-visible
                "
              >
                <div className="opacity-70">{idx + 1}</div>

                <div className="flex items-center gap-3 min-w-0">
                  <AvatarWithBadges user={row.user} size={60} />
                  <div title={row.user.username} className="font-semibold min-w-0 break-words">
                    {row.user.username}
                  </div>
                </div>

                <div className="hidden lg:block text-right font-bold">{row.featuredScore}</div>
                <div className="hidden lg:block text-right">{row.winsTotal}</div>
                <div className="hidden lg:block text-right">{row.likesReceived}</div>
                <div className="hidden lg:block text-right" title={t("leaderboard.table.streakInfo")}>{row.dailyStreak}</div>

                <div className="lg:hidden col-span-2 -mt-2 text-xs opacity-70">
                  <strong>{t("leaderboard.table.score")}: {row.featuredScore}</strong> • {t("leaderboard.mobileStats.wins")}: {row.winsTotal} • {t("leaderboard.mobileStats.likes")}: {row.likesReceived} • {t("leaderboard.table.comments")}: {row.commentsReceived} • {t("leaderboard.mobileStats.streak")}: {row.dailyStreak}
                </div>
                <div className="col-span-2 lg:col-start-2 lg:col-span-5 text-xs opacity-70">
                  <span className="hidden lg:inline">{t("leaderboard.table.comments")}: {row.commentsReceived} • </span>
                  {t("leaderboard.table.streakBonusPoints")}: {row.streakBonusPoints ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    </div>
  );
};

export default Leaderboard;
