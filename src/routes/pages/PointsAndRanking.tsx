import { Link } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { BADGE_CATALOG } from "../../lib/badges";

const AWARD_POINTS = [
  ["TOP_CREATOR_MONTH", 5],
  ["JOKE_OF_DAY", 4],
  ["TRENDING_WEEK", 3],
  ["FASTEST_GROWING", 3],
  ["MOST_COMMENTED_WEEK", 2],
  ["STREAK_BONUS", 1],
] as const;

const PointsAndRanking = () => {
  const { t, tf } = useLanguage();

  return (
    <article className="container max-w-2xl py-8! md:py-10! text-[var(--text1)]">
      <header className="mb-6">
        <h1 className="text-3xl font-bold md:text-4xl">{t("rankingGuide.heading")}</h1>
        <p className="mt-3 leading-relaxed">{t("rankingGuide.intro")}</p>
      </header>

      <section aria-labelledby="award-points-heading" className="rounded-2xl border border-[var(--text1)]/20 bg-[var(--bg-input)] p-4 md:p-6">
        <h2 id="award-points-heading" className="text-xl font-semibold">{t("rankingGuide.awardsHeading")}</h2>
        <dl className="mt-2 divide-y divide-[var(--text1)]/15">
          {AWARD_POINTS.map(([badge, points]) => (
            <div key={badge} className="flex items-start justify-between gap-4 py-4">
              <dt className="min-w-0">
                <span className="font-semibold">
                  <span aria-hidden="true">{BADGE_CATALOG[badge].icon} </span>
                  {t(`badges.labels.${badge}`)}
                </span>
                <p className="mt-1 text-sm leading-relaxed opacity-80">{t(`rankingGuide.awardDescriptions.${badge}`)}</p>
              </dt>
              <dd className="shrink-0 font-bold">{badge === "STREAK_BONUS" ? t("rankingGuide.bonusPoints") : tf("rankingGuide.points", { points })}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 rounded-xl bg-[var(--primary)] p-3 text-sm leading-relaxed text-[var(--text2)]">
          {t("rankingGuide.example")}
        </p>
        <p className="mt-3 text-sm leading-relaxed opacity-80">{t("rankingGuide.changingWinners")}</p>
        <p className="mt-2 text-sm leading-relaxed opacity-80">{t("rankingGuide.fastestGrowing")}</p>
      </section>

      <section aria-labelledby="ranking-period-heading" className="mt-6">
        <h2 id="ranking-period-heading" className="text-xl font-semibold">{t("rankingGuide.periodHeading")}</h2>
        <p className="mt-2 leading-relaxed">{t("rankingGuide.periods")}</p>
        <p className="mt-2 text-sm leading-relaxed opacity-80">{t("rankingGuide.awardDates")}</p>
        <p className="mt-2 leading-relaxed">{t("rankingGuide.history")}</p>
      </section>

      <section aria-labelledby="ranking-ties-heading" className="mt-6">
        <h2 id="ranking-ties-heading" className="text-xl font-semibold">{t("rankingGuide.tiesHeading")}</h2>
        <p className="mt-2 leading-relaxed">{t("rankingGuide.tiesIntro")}</p>
        <ol className="mt-2 ml-5 list-decimal space-y-1">
          <li>{t("rankingGuide.ties.awards")}</li>
          <li>{t("rankingGuide.ties.likes")}</li>
          <li>{t("rankingGuide.ties.comments")}</li>
        </ol>
        <p className="mt-2 text-sm leading-relaxed opacity-80">{t("rankingGuide.exactTies")}</p>
        <p className="mt-2 leading-relaxed">{t("rankingGuide.engagement")}</p>
      </section>

      <aside className="mt-6 rounded-2xl border border-[var(--text1)]/20 bg-[var(--bg-input)] p-4 md:p-6">
        <h2 className="text-xl font-semibold">
          <span aria-hidden="true">{BADGE_CATALOG.STREAK.icon} </span>
          {t("rankingGuide.streakHeading")}
        </h2>
        <p className="mt-2 leading-relaxed">{t("rankingGuide.streak")}</p>
      </aside>

      <Link to="/jokes/leaderboard" className="mt-6 inline-block font-semibold underline underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4">
        {t("rankingGuide.leaderboardLink")} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
};

export default PointsAndRanking;
