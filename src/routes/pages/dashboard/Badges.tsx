import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { safeRequest } from "../../../lib/auth";
import { BADGE_CATALOG, isCurrentBadgeActive } from "../../../lib/badges";
import { getMyBadgeHistory, getMyCurrentBadges } from "../../../lib/axios";
import { usePagination } from "../../../hooks/usePagination";
import { useBadgeClock } from "../../../hooks/useBadgeClock";

import Spinner from "../../../components/atoms/Spinner";

import type { BadgeAward, CurrentUserBadge } from "../../../types/context.types";
import type { AppLanguage } from "../../../i18n/translations";

const HISTORY_LIMIT = 15;

const Badges = () => {
  const { language } = useLanguage();
  // A new language gets fresh pagination and cannot receive the old view's responses.
  return <BadgeData key={language} language={language} />;
};

const BadgeData = ({ language }: { language: AppLanguage }) => {
  const { accessToken, setAccessToken } = useAuth();
  const { t } = useLanguage();

  const [current, setCurrent] = useState<CurrentUserBadge[]>([]);
  const [currentLoading, setCurrentLoading] = useState(true);
  const [currentError, setCurrentError] = useState(false);
  const historyArgs = useMemo(() => [language], [language]);
  const now = useBadgeClock(current);
  const activeCurrent = current.filter((badge) => isCurrentBadgeActive(badge, language, now));

  const {
    items: history,
    meta,
    loading: historyLoading,
    error: historyError,
    canPrev,
    canNext,
    prev,
    next,
  } = usePagination<BadgeAward>(getMyBadgeHistory, {
    accessToken,
    setAccessToken,
    limit: HISTORY_LIMIT,
    mode: "paged",
    args: historyArgs,
    resetKey: language,
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    let isMounted = true;

    const fetchCurrentBadges = async () => {
      if (!accessToken) {
        if (isMounted) {
          setCurrent([]);
          setCurrentLoading(false);
        }
        return;
      }

      setCurrentLoading(true);
      setCurrentError(false);

      try {
        const res = await safeRequest(getMyCurrentBadges, accessToken, setAccessToken, language);

        if (isMounted) {
          setCurrent((res.data ?? []) as CurrentUserBadge[]);
        }
      } catch {
        if (isMounted) {
          setCurrent([]);
          setCurrentError(true);
        }
      } finally {
        if (isMounted) {
          setCurrentLoading(false);
        }
      }
    };

    fetchCurrentBadges();

    return () => {
      isMounted = false;
    };
  }, [accessToken, setAccessToken, language]);

  const loading = currentLoading || historyLoading;

  if (loading && history.length === 0 && current.length === 0) {
    return <Spinner />;
  }

  return (
    <div className="container max-w-150">
      <h2 className="text-3xl font-bold text-[var(--text1)] mb-6">
        {t("badges.heading")}
      </h2>

      {/* CURRENT BADGES */}

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-xl font-semibold text-[var(--text1)]">
            {t("badges.current.heading")}
          </h3>

          <p className="text-sm opacity-70 text-[var(--text1)]">
            {t("badges.current.subheading")}
          </p>
        </div>

        {currentError ? (
          <p role="alert" className="text-[var(--text1)]">{t("badges.current.failed")}</p>
        ) : activeCurrent.length === 0 ? (
          <p className="text-[var(--text1)] opacity-70">
            {t("badges.current.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {activeCurrent.map((b) => {
              const badgeMeta = BADGE_CATALOG[b.badge];

              return (
                <li
                  key={b.id}
                  className="rounded-xl border border-white/10 bg-[var(--bg-input)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[var(--text1)]">
                      {badgeMeta?.icon ?? "🏅"}{" "}
                      {t(`badges.labels.${b.badge}`, badgeMeta?.label ?? b.badge)}
                    </div>

                    <div className="text-sm opacity-70 text-[var(--text1)]">
                      {t("badges.current.since")}{" "}
                      {new Date(b.since).toLocaleDateString()}
                    </div>
                  </div>

                  {b.context?.jokeId && (
                    <div className="text-sm mt-2 opacity-80 text-[var(--text1)]">
                      {t("badges.relatedJoke")}:{" "}
                      <Link
                        to={`/jokes/${b.context.jokeId}`}
                        className="underline font-semibold hover:opacity-90"
                      >
                        #{b.context.jokeId}
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* BADGE HISTORY */}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-xl font-semibold text-[var(--text1)]">
            {t("badges.history.heading")}
          </h3>

          <p className="text-sm opacity-70 text-[var(--text1)]">
            {t("badges.history.subheading")}
          </p>
        </div>

        {historyError ? (
          <p role="alert" className="text-[var(--text1)]">{t("badges.history.failed")}</p>
        ) : history.length === 0 ? (
          <p className="text-[var(--text1)] opacity-70">
            {t("badges.history.empty")}
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {history.map((a) => {
                const badgeMeta = BADGE_CATALOG[a.badge];

                return (
                  <li
                    key={a.id}
                    className="rounded-xl border border-white/10 bg-[var(--bg-input)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[var(--text1)]">
                        {badgeMeta?.icon ?? "🏅"}{" "}
                        {t(`badges.labels.${a.badge}`, badgeMeta?.label ?? a.badge)}
                      </div>

                      <div className="text-sm opacity-70 text-[var(--text1)]">
                        {new Date(a.awardedAt).toLocaleDateString()}
                      </div>
                    </div>

                    {(a.validFrom || a.validTo) && (
                      <div className="text-sm mt-2 opacity-80 text-[var(--text1)]">
                        {t("badges.history.valid")}{" "}
                        {a.validFrom
                          ? `${t("badges.history.from")} ${new Date(
                              a.validFrom
                            ).toLocaleDateString()}`
                          : ""}
                        {a.validTo
                          ? ` ${t("badges.history.to")} ${new Date(
                              a.validTo
                            ).toLocaleDateString()}`
                          : ""}
                      </div>
                    )}

                    {a.context?.jokeId && (
                      <div className="text-sm mt-2 opacity-80 text-[var(--text1)]">
                        {t("badges.relatedJoke")}:{" "}
                        <Link
                          to={`/jokes/${a.context.jokeId}`}
                          className="underline font-semibold hover:opacity-90"
                        >
                          #{a.context.jokeId}
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-end gap-3 mt-6">
              {meta && (
                <div className="mr-auto text-sm opacity-70 text-[var(--text1)]">
                  {t("badges.page")} {meta.page} {t("badges.of")}{" "}
                  {meta.totalPages} • {t("badges.total")} {meta.total}
                </div>
              )}

              <button
                type="button"
                className="rounded-lg border border-[var(--text0]/10 px-3 py-2 text-[var(--text1)] disabled:opacity-50"
                disabled={!canPrev || historyLoading}
                onClick={prev}
              >
                {t("badges.prev")}
              </button>

              <button
                type="button"
                className="rounded-lg border border-[var(--text0]/10 px-3 py-2 text-[var(--text1)] disabled:opacity-50"
                disabled={!canNext || historyLoading}
                onClick={next}
              >
                {t("badges.next")}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Badges;
