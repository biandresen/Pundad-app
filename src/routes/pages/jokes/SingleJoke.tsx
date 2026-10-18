import { useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";

import { useJokes } from "../../../contexts/JokesContext";
import { useUser } from "../../../contexts/UserContext";
import { useLanguage } from "../../../contexts/LanguageContext";

import Spinner from "../../../components/atoms/Spinner";
import Joke from "../../../components/organisms/Joke";

import { getJoke } from "../../../lib/axios";
import type { JokeType } from "../../../types/joke.types";
import { useAuth } from "../../../contexts/AuthContext";
import Button from "../../../components/atoms/Button";
import { useAppLanguage } from "../../../hooks/useAppLanguage";

const SingleJoke = () => {
  const [localJoke, setLocalJoke] = useState<JokeType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notAvailableInLanguage, setNotAvailableInLanguage] = useState(false);

  const { id: jokeId } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const { jokes } = useJokes();
  const { user } = useUser();
  const { language, t } = useLanguage();
  const { setAppLanguage } = useAppLanguage();

  const parsedJokeId = Number(jokeId);

  const contextJoke = useMemo(() => {
    if (Number.isNaN(parsedJokeId)) return undefined;
    return jokes.find((p) => p.id === parsedJokeId);
  }, [jokes, parsedJokeId]);

  useEffect(() => {
    let cancelled = false;

    const fetchSingleJoke = async () => {
      if (!jokeId || Number.isNaN(parsedJokeId)) {
        setLocalJoke(null);
        setError(t("singleJoke.states.invalidId"));
        setNotAvailableInLanguage(false);
        return;
      }

      if (contextJoke) {
        setLocalJoke(contextJoke);
        setError(null);
        setNotAvailableInLanguage(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setNotAvailableInLanguage(false);

        const res = await getJoke(accessToken, parsedJokeId, language);

        if (cancelled) return;

        const nextJoke = res?.data ?? null;
        setLocalJoke(nextJoke);

        if (!nextJoke) {
          setNotAvailableInLanguage(true);
        }
      } catch (err: any) {
        if (cancelled) return;

        const status = err?.response?.status ?? err?.response?.data?.statusCode;

        if (status === 404) {
          setLocalJoke(null);
          setNotAvailableInLanguage(true);
          setError(null);
        } else {
          const message = err?.response?.data?.message || err?.message || t("singleJoke.states.failed");

          setError(message);
          setNotAvailableInLanguage(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSingleJoke();

    return () => {
      cancelled = true;
    };
  }, [jokeId, parsedJokeId, language, contextJoke, t, accessToken]);

  const joke = localJoke;

  const isAuthor = joke && joke.authorId?.toString() === user?.id?.toString();

  const isDraft = joke?.published === false;

  const handleJokeUpdated = (updated: JokeType) => {
    setLocalJoke(updated);
  };

  const handleJokeDeleted = () => {
    setLocalJoke(null);
    setError(null);
    setNotAvailableInLanguage(false);
  };

  if (loading && !joke) {
    return <Spinner />;
  }

  return (
    <div className="md:mt-8">
      <h2 className="jokes-heading">{t("singleJoke.heading")}</h2>

      <section className="jokes-section">
        {error && (
          <div className="text-center text-[var(--text1)]">
            <h3 className="jokes-section-heading text-[var(--error)]">{t("singleJoke.states.failed")}</h3>
            <p className="opacity-70 mt-2">{error}</p>
          </div>
        )}

        {!error && notAvailableInLanguage && (
          <div className="text-center text-[var(--text1)]">
            <h3 className="jokes-section-heading">{t("singleJoke.states.notAvailableInLanguage")}</h3>

            <p className="opacity-70 mt-2">{t("singleJoke.states.tryAnotherLanguage")}</p>

            <div className="mt-4 flex justify-center">
              <Button
                onClick={() => setAppLanguage(language === "EN" ? "NO" : "EN")}
                label="language change button"
              >
                {t("singleJoke.actions.changeLanguage")}
              </Button>
              <Button label="go to all jokes" className="ml-4">
                <NavLink to="/jokes">{t("singleJoke.actions.goToAllJokes")}</NavLink>
              </Button>
            </div>
          </div>
        )}

        {!error && !notAvailableInLanguage && !joke && (
          <h3 className="jokes-section-heading text-[var(--text1)]">{t("singleJoke.states.notFound")}</h3>
        )}

        {!error && !notAvailableInLanguage && joke && isDraft && !isAuthor && (
          <h3 className="jokes-section-heading text-[var(--text1)]">{t("singleJoke.states.privateDraft")}</h3>
        )}

        {!error && !notAvailableInLanguage && joke && (!isDraft || isAuthor) && (
          <Joke
            key={`${joke.id}-${language}`}
            joke={joke}
            onJokeUpdated={handleJokeUpdated}
            onJokeDeleted={handleJokeDeleted}
          />
        )}
      </section>
    </div>
  );
};

export default SingleJoke;
