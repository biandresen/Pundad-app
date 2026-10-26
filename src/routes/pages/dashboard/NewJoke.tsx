import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Button from "../../../components/atoms/Button";
import Input from "../../../components/atoms/Input";

import { publishJoke, saveDraft } from "../../../lib/axios";
import { safeRequest } from "../../../lib/auth";
import { getCharactersLeft, setInputErrors } from "../../../lib/utils";
import { getPostBodyError, getPostBodyApiError, normalizePostBody, type PostBodyError } from "../../../lib/postBody";
import { MAX_CHARS } from "../../../lib/constants";

import { useAuth } from "../../../contexts/AuthContext";
import { useJokes } from "../../../contexts/JokesContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useModeration } from "../../../contexts/ModerationContext";

import { useAutosaveDraft } from "../../../hooks/useAutosaveDraft";
import { useUnsavedChangesWarning } from "../../../hooks/useUnsavedChangesWarning";
import { moderateFields } from "../../../lib/moderation";

const NewJoke = () => {
  const [serverBodyError, setServerBodyError] = useState<PostBodyError | "invalid" | null>(null);
  const [jokeErrors, setJokeErrors] = useState<string[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const navigate = useNavigate();

  const { accessToken, setAccessToken } = useAuth();
  const { refreshJokes } = useJokes();
  const { language, t } = useLanguage();
  const { terms } = useModeration();

  const { state, setState, resetDraft, isSaved } = useAutosaveDraft(
    "new-joke-draft",
    {
      title: "",
      body: "",
      tags: "",
    },
    { debounceMs: 1200 },
  );

  const { title, body, tags } = state;

  const bodyError = (body ? getPostBodyError(body) : null) ?? serverBodyError;
  const invalidForm = !title.trim() || !body.trim() || Boolean(bodyError);

  const parsedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags],
  );

  const hasUnsavedContent = Boolean(title || body || tags);
  useUnsavedChangesWarning(hasUnsavedContent);

  type SubmitJokeOptions = {
    request: typeof saveDraft;
    setLoading: (isLoading: boolean) => void;
    mustBeLoggedInMessage: string;
    successMessage: string;
    errorLabel: string;
    redirectTo: string;
  };

  const submitJoke = async ({
    request,
    setLoading,
    mustBeLoggedInMessage,
    successMessage,
    errorLabel,
    redirectTo,
  }: SubmitJokeOptions) => {
    if (invalidForm || isSavingDraft || isPublishing) return;

    if (!accessToken) {
      toast.error(mustBeLoggedInMessage);
      return;
    }

    const moderation = moderateFields(
      {
        title,
        body,
        tags: parsedTags.join(" "),
      },
      terms,
    );

    if (moderation.blocked) {
      toast.error(t("validation.blockedContent"));
      return;
    }

    try {
      setLoading(true);
      setJokeErrors([]);

      const res = await safeRequest(
        request,
        accessToken,
        setAccessToken,
        title.trim(),
        normalizePostBody(body),
        parsedTags,
        language,
      );

      if (res.statusCode !== 200) {
        throw new Error(res.message ?? t("newJoke.toasts.requestFailed"));
      }

      toast.success(successMessage);

      await refreshJokes();
      resetDraft();
      setJokeErrors([]);
      navigate(redirectTo);
    } catch (err: any) {
      if (err?.message?.includes("token")) {
        toast.error(t("newJoke.toasts.sessionExpired"));
      }

      console.error(errorLabel, err);
      const fieldError = getPostBodyApiError(err);
      setServerBodyError(fieldError);
      const otherErrors = err?.response?.data?.errors?.filter((error: { field?: string }) => error.field !== "body");
      setJokeErrors(fieldError && !otherErrors?.length ? [] : setInputErrors(otherErrors));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () =>
    submitJoke({
      request: saveDraft,
      setLoading: setIsSavingDraft,
      mustBeLoggedInMessage: t("newJoke.toasts.mustBeLoggedInDraft"),
      successMessage: t("newJoke.toasts.draftSaved"),
      errorLabel: "Failed to save draft",
      redirectTo: "/dashboard/drafts",
    });

  const handlePublishJoke = () =>
    submitJoke({
      request: publishJoke,
      setLoading: setIsPublishing,
      mustBeLoggedInMessage: t("newJoke.toasts.mustBeLoggedInPublish"),
      successMessage: t("newJoke.toasts.jokePublished"),
      errorLabel: "Failed to publish joke",
      redirectTo: "/jokes",
    });

  return (
    <div className="bg-[var(--primary)] p-3 md:p-8 rounded-2xl max-w-120 md:min-w-1/2 mx-auto md:mt-10">
      <h2 className="text-3xl md:text-5xl text-center my-5">{t("newJoke.heading")}</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handlePublishJoke();
        }}
      >
        <div className="relative">
          <Input
            className="text-[var(--text2)] rounded-xl md:text-2xl! mb-2"
            id="jokeTitle"
            label={t("newJoke.fields.title")}
            type="text"
            value={title}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS.TITLE) {
                setState((prev) => ({ ...prev, title: e.target.value }));
              }
            }}
            placeholder={t("newJoke.placeholders.title")}
            maxLength={MAX_CHARS.TITLE}
            required
          />
          <span className="characters-left bottom-2!">{getCharactersLeft(title, MAX_CHARS.TITLE)}</span>
        </div>

        <label htmlFor="body" className="text-[var(--text2)] md:text-2xl font-semibold mb-2">
          {t("newJoke.fields.body")}
        </label>

        <div className="relative">
          <textarea
            className="md:text-2xl rounded-2xl bg-[var(--bg)] w-full text-[var(--text1)] px-3 font-normal md:h-50 py-2 min-h-12 outline-none placeholder:text-[0.9rem]
            md:placeholder:text-[1rem]"
            title={t("newJoke.fields.body")}
            value={body}
            onChange={(e) => {
              setServerBodyError(null);
              setState((prev) => ({ ...prev, body: e.target.value }));
            }}
            placeholder={t("newJoke.placeholders.body")}
            id="body"
            aria-invalid={Boolean(bodyError)}
            aria-describedby={bodyError ? "new-joke-body-error" : undefined}
            required
          />
          <span className="characters-left bottom-2!" aria-label={t("validation.postBody.counter")}>{getCharactersLeft(normalizePostBody(body), MAX_CHARS.BODY)}</span>
        </div>

        {bodyError && <p id="new-joke-body-error" role="alert" className="text-sm text-[var(--error)] my-2">{t(`validation.postBody.${bodyError}`)}</p>}

        <div className="relative">
          <Input
            className="text-[var(--text2)] rounded-xl text-sm md:text-xl! mb-2"
            id="tags"
            label={t("newJoke.fields.tags")}
            type="text"
            value={tags}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS.TAGS) {
                setState((prev) => ({ ...prev, tags: e.target.value }));
              }
            }}
            maxLength={MAX_CHARS.TAGS}
            placeholder={t("newJoke.placeholders.tags")}
          />
          <span className="characters-left bottom-2!">{getCharactersLeft(tags, MAX_CHARS.TAGS)}</span>
        </div>

        <div className="mb-2 text-right text-xs opacity-80">
          {hasUnsavedContent ?
            isSaved ?
              t("newJoke.draftSaved", "Draft saved")
            : t("newJoke.savingDraft", "Saving draft...")
          : ""}
        </div>

        <ul className="text-[0.9rem] text-[var(--error)] my-2">
          {jokeErrors.map((err, index) => (
            <li key={`${index}-${err}`}>• {err}</li>
          ))}
        </ul>

        <div className="flex flex-col pb-3 md:flex-row justify-space-between md:gap-10 md:my-4">
          <Button
            type="button"
            variant="secondaryOnDark"
            onClick={handleSaveDraft}
            className="w-full mt-4 text-[var(--text0)]"
            disabled={invalidForm || isSavingDraft || isPublishing}
            label={t("newJoke.actions.saveDraft")}
          >
            {isSavingDraft ? t("common.loading") : t("newJoke.actions.saveDraft")}
          </Button>

          <Button
            type="submit"
            variant="tertiary"
            className="w-full mt-4"
            disabled={invalidForm || isPublishing || isSavingDraft}
            label={t("newJoke.actions.publishJoke")}
          >
            {isPublishing ? t("common.loading") : t("newJoke.actions.publishJoke")}
          </Button>
        </div>
      </form>

      <p className="text-center text-xs md:text-sm text-[var(--text2)] opacity-80 mb-0">
        {t("newJoke.currentLanguageLabel")} {language}
      </p>
    </div>
  );
};

export default NewJoke;
