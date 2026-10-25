import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { JokeType } from "../../../types/joke.types";
import type { StreakBonusProgress } from "../../../types/streak.types";
import type { AppLanguage } from "../../../i18n/translations";
import Joke from "../../../components/organisms/Joke";
import Spinner from "../../../components/atoms/Spinner";
import Button from "../../../components/atoms/Button";
import { getDailyJoke, getDailyJokeStreak, recordDailyJokeView } from "../../../lib/axios";
import { safeRequest } from "../../../lib/auth";
import { useUser } from "../../../contexts/UserContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";

const DailyJoke = () => {
  const { language } = useLanguage();
  return <DailyJokeContent key={language} language={language} />;
};

const DailyJokeContent = ({ language }: { language: AppLanguage }) => {
  const [dailyJoke, setDailyJoke] = useState<JokeType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bonus, setBonus] = useState<StreakBonusProgress | null>(null);
  const [bonusLoading, setBonusLoading] = useState(true);
  const [bonusError, setBonusError] = useState(false);
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  const { setUser } = useUser();
  const { accessToken, setAccessToken } = useAuth();
  const { t, tf } = useLanguage();

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await getDailyJoke(language);
        if (active) setDailyJoke(res.data ?? null);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [language]);

  useEffect(() => {
    if (!accessToken || loading) return;
    let active = true;
    setBonusLoading(true);
    setBonusError(false);
    const load = async () => {
      try {
        if (dailyJoke) {
          // Count a visit only after this language's actual daily joke has loaded.
          const res = await safeRequest(recordDailyJokeView, accessToken, setAccessToken, language);
          if (!active) return;
          setBonus(res.data.streakBonus);
          setUser((previous) => previous ? {
            ...previous,
            dailyJokeStreak: res.data.dailyJokeStreak,
            dailyJokeBestStreak: res.data.dailyJokeBestStreak,
            dailyJokeLastViewedAt: res.data.dailyJokeLastViewedAt,
          } : previous);
        } else {
          const res = await safeRequest(getDailyJokeStreak, accessToken, setAccessToken, language);
          if (active) setBonus(res.data);
        }
      } catch {
        if (!active) return;
        setBonusError(true);
        // Recover saved progress independently; leave the failed visit visible for retry.
        if (dailyJoke) {
          try {
            const res = await safeRequest(getDailyJokeStreak, accessToken, setAccessToken, language);
            if (active) setBonus(res.data);
          } catch { /* The retry action remains available. */ }
        }
      } finally {
        if (active) setBonusLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [accessToken, dailyJoke, language, loading, retry, setAccessToken, setUser]);

  if (loading) return <Spinner />;

  return (
    <div className="md:mt-8">
      <h2 className="jokes-heading">{t("dailyJoke.heading")}</h2>
      <p className="text-center text-[var(--text1)] opacity-70 -mt-4 mb-8">{t("dailyJoke.subtitle")}</p>

      <section aria-labelledby="streak-bonus-heading" className="mx-auto mb-6 max-w-150 rounded-2xl border border-[var(--text1)]/20 bg-[var(--bg-input)] p-4 text-[var(--text1)]">
        <h3 id="streak-bonus-heading" className="font-semibold">🔥 {t("dailyJoke.bonus.heading")}</h3>
        {!accessToken ? (
          <p className="mt-2 text-sm">
            {t("dailyJoke.bonus.loginPrompt")}{" "}
            <Link to="/login" className="font-semibold underline">{t("dailyJoke.bonus.login")}</Link>
          </p>
        ) : (
          <>
            {bonusLoading && <p role="status" className="mt-2 text-sm">{t("dailyJoke.bonus.loading")}</p>}
            {bonusError && (
              <div className="mt-2 text-sm">
                <p role="alert">{t(dailyJoke ? "dailyJoke.bonus.recordFailed" : "dailyJoke.bonus.failed")}</p>
                <button type="button" disabled={bonusLoading} onClick={() => setRetry((value) => value + 1)} className="mt-2 font-semibold underline disabled:opacity-50">
                  {t("dailyJoke.bonus.retry")}
                </button>
              </div>
            )}
            {bonus?.language === language && bonus.status === "disabled" && <p className="mt-2 text-sm">{t("dailyJoke.bonus.disabled")}</p>}
            {bonus?.language === language && bonus.status === "scheduled" && (
              <p className="mt-2 text-sm">{tf("dailyJoke.bonus.scheduled", { date: bonus.startsAt ? new Date(bonus.startsAt).toLocaleDateString(language === "NO" ? "nb-NO" : "en-GB", { timeZone: "UTC", dateStyle: "long" }) : "" })}</p>
            )}
            {bonus?.language === language && bonus.status === "active" && (
              <div className="mt-2 space-y-2 text-sm">
                <p className="font-semibold">{tf(bonus.streak === 1 ? "dailyJoke.bonus.progressOne" : "dailyJoke.bonus.progress", { days: bonus.streak, language })}</p>
                <p>{tf(bonus.daysUntilBonus === 1 ? "dailyJoke.bonus.nextOne" : "dailyJoke.bonus.next", { days: bonus.daysUntilBonus })}</p>
                <p>{t(bonus.viewedToday ? "dailyJoke.bonus.viewedToday" : "dailyJoke.bonus.notViewedToday")}</p>
                {bonus.awarded && <p role="status" className="font-semibold">{t("dailyJoke.bonus.awarded")}</p>}
              </div>
            )}
            <p className="mt-2 text-sm opacity-80">{t("dailyJoke.bonus.rule")}</p>
          </>
        )}
      </section>

      <section className="jokes-section">
        {error ? <p role="alert" className="text-center text-[var(--text1)]">{t("dailyJoke.states.failed")}</p>
          : !dailyJoke ? <h3 className="jokes-section-heading text-[var(--text1)]">{t("dailyJoke.states.notFound")}</h3>
          : <Joke key={dailyJoke.id} joke={dailyJoke} />}
      </section>

      <div className="mt-8 flex justify-center">
        <Button type="button" onClick={() => navigate("/jokes/all-jokes")} className="bg-[var(--button3)] text-[var(--text0)]! px-6 py-2 hover:brightness-110" label={t("dailyJoke.actions.goToAllJokes")}>
          {t("dailyJoke.actions.goToAllJokes")}
        </Button>
      </div>
    </div>
  );
};

export default DailyJoke;
