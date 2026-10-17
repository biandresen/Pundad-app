import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { usePagination } from "../../../hooks/usePagination";
import { getCurrentUserDrafts } from "../../../lib/axios";

import Spinner from "../../../components/atoms/Spinner";
import Button from "../../../components/atoms/Button";
import JokePreviewCard from "../../../components/molecules/JokePreviewCard";
import Joke from "../../../components/organisms/Joke";

import type { JokeType } from "../../../types/joke.types";

const LIMIT = 15;

const Drafts = () => {
  const { accessToken, setAccessToken } = useAuth();
  const { language, t, tf } = useLanguage();
  const [showMiniJokes, setShowMiniJokes] = useState(true);

  // Stable pagination config values.
  const args = useMemo(() => [language], [language]);
  const resetKey = useMemo(() => `my-drafts:${language}`, [language]);

  const {
    items: drafts,
    meta,
    loading,
    error,
    sentinelRef,
    reload,
    replaceItem,
    removeItem,
  } = usePagination<JokeType>(getCurrentUserDrafts, {
    accessToken,
    setAccessToken,
    enabled: Boolean(accessToken),
    limit: LIMIT,
    args,
    mode: "infinite",
    autoLoadMore: true,
    rootMargin: "700px",
    resetKey,
  });

  // Hooks always run in the same order. Pagination stays disabled while logged out.
  if (!accessToken) {
    return <p className="text-center mt-10 text-[var(--text1)]">{t("drafts.authRequired")}</p>;
  }

  const handleTogglePresentation = () => {
    setShowMiniJokes((prev) => !prev);
  };

  // Initial page load only
  if (loading && drafts.length === 0) {
    return <Spinner />;
  }

  return (
    <div className="md:mt-8">
      <h2 className="text-[var(--text1)] text-center text-4xl md:text-5xl mb-5 md:mb-10">
        {t("drafts.heading")}
      </h2>

      {drafts.length > 0 && (
        <div className="flex gap-3 justify-center">
          <Button
            onClick={handleTogglePresentation}
            type="button"
            size="md"
            variant="primary"
            label={showMiniJokes ? t("drafts.toggleShowTitles") : t("drafts.toggleShowFull")}
            disabled={loading}
          >
            {showMiniJokes ? t("drafts.toggleShowTitles") : t("drafts.toggleShowFull")}
          </Button>

          <Button
            onClick={reload}
            type="button"
            size="md"
            variant="secondary"
            label={t("drafts.reload")}
            disabled={loading}
          >
            {loading ? t("common.loading") : t("drafts.reload")}
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-4 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      <section className="jokes-section">
        {drafts.length === 0 && !loading && !error && (
          <div className="text-center jokes-section-heading text-[var(--text1)]">
            <p className="text-sm md:text-lg">{t("drafts.empty")}</p>

            <Link to="/dashboard" className="inline-block mt-3">
              <Button type="button" label={t("drafts.createDraft")} className="text-sm">
                {t("drafts.createDraft")}
              </Button>
            </Link>
          </div>
        )}

        {drafts.map((draft) =>
          showMiniJokes ?
            <Joke
              key={draft.id}
              joke={draft}
              onJokeUpdated={(updated) => {
                if (updated.published) {
                  removeItem(updated.id);
                } else {
                  replaceItem(updated.id, updated);
                }
              }}
              onJokeDeleted={(id) => removeItem(id)}
            />
          : <JokePreviewCard key={draft.id} id={draft.id} title={draft.title} />,
        )}

        <div ref={sentinelRef} className="w-full h-px opacity-0 pointer-events-none" />
      </section>

      {meta && (
        <div className="mt-4 text-center text-sm opacity-70 text-[var(--text1)]">
          {tf("drafts.showing", {
            shown: String(drafts.length),
            total: String(meta.total),
          })}
        </div>
      )}
    </div>
  );
};

export default Drafts;
