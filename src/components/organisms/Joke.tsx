import { useEffect, useState, useRef, useMemo } from "react";

import { type CommentType, type JokeType } from "../../types/joke.types";
import Button from "../../components/atoms/Button";
import Comment from "../molecules/Comment";
import CommentForm from "../molecules/CommentForm";
import { capitalizeFirstLetter, formatDate, getCharactersLeft } from "../../lib/utils";
import { useUser } from "../../contexts/UserContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  deleteComment,
  deleteJoke,
  editComment,
  editJoke,
  getJokeComments,
  toggleLike,
} from "../../lib/axios";
import { toast } from "react-toastify";
import { MdDelete, MdEdit } from "react-icons/md";
import { AiOutlineLike, AiFillLike } from "react-icons/ai";
import { IoSend } from "react-icons/io5";
import { BsThreeDotsVertical } from "react-icons/bs";
import { FiShare2 } from "react-icons/fi";
import { safeRequest } from "../../lib/auth";
import { useAutoResizeTextarea } from "../../hooks/useAutoResizeTextarea";
import { useSubmitOnEnter } from "../../hooks/useSubmitOnEnter";
import AvatarWithBadges from "../atoms/AvatarWithBadges";
import { NavLink } from "react-router-dom";
import Modal from "../molecules/Modal";
import { MAX_CHARS } from "../../lib/constants";
import { getPostBodyError, getPostBodyApiError, type PostBodyError, normalizePostBody } from "../../lib/postBody";
import TagsCard from "../molecules/TagsCard";
import type { User } from "../../types/context.types";
import { usePagination } from "../../hooks/usePagination";
import { useLanguage } from "../../contexts/LanguageContext";
import Spinner from "../atoms/Spinner";
import { jokeDeletedEvent } from "../../lib/events";
import { moderateFields } from "../../lib/moderation";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useModeration } from "../../contexts/ModerationContext";

const Joke = ({
  joke,
  onJokeUpdated,
  onJokeDeleted,
}: {
  joke: JokeType;
  onJokeUpdated?: (updated: JokeType) => void;
  onJokeDeleted?: (id: number) => void;
}) => {
  const [commentsIsOpen, setCommentsIsOpen] = useState<boolean>(false);
  // const [comments, setComments] = useState(joke.comments);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(joke.title);
  const [serverBodyError, setServerBodyError] = useState<PostBodyError | "invalid" | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editedBody, setEditedBody] = useState(joke.body);
  const [editedTags, setEditedTags] = useState(joke.tags.map((tag) => tag.name).join(", "));
  const bodyError = getPostBodyError(editedBody) ?? serverBodyError;
  const [published, setPublished] = useState(joke.published);
  const [hasLiked, setHasLiked] = useState(false);
  const [likedList, setLikedList] = useState<string[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showEditMenu, setShowEditMenu] = useState<boolean>(false);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [avatarSize, setAvatarSize] = useState(63);

  const { language, t } = useLanguage();
  const { terms } = useModeration();

  useEffect(() => {
    const updateSize = () => {
      if (window.innerWidth >= 1280) setAvatarSize(63);
      else if (window.innerWidth >= 768) setAvatarSize(55);
      else setAvatarSize(55);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const { user } = useUser();
  const { accessToken, setAccessToken } = useAuth();
  const { ref: textRef, handleInput } = useAutoResizeTextarea(editedBody, isEditing);

  const COMMENTS_LIMIT = 10;

  const args = useMemo<any[]>(() => [joke.id, "desc", language], [joke.id, language]);
  const noopSetAccessToken = useMemo(() => () => {}, []);

  const {
    items: comments,
    loading: commentsLoading,
    error: commentsError,
    canNext,
    next: loadMoreComments,
    reload: reloadComments,
  } = usePagination<CommentType>(getJokeComments, {
    accessToken: null,
    setAccessToken: noopSetAccessToken,
    limit: COMMENTS_LIMIT,
    args,
    resetKey: `comments:${joke.id}:${language}`,
    enabled: commentsIsOpen,
    mode: "infinite",
    autoLoadMore: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const isAuthor = user?.id != null && joke.authorId === Number(user.id);
  const isAdmin = user?.role === "ADMIN";
  const canEdit = isAuthor || isAdmin;
  const buttonText = commentsIsOpen ? t("joke.actions.closeComments") : t("joke.actions.openComments");

  const BODY_PREVIEW_LIMIT = 600;
  // No prior line limit existed. Six lines keeps feed cards readable on mobile.
  const BODY_PREVIEW_LINES = 6;
  const previewRef = useRef<HTMLParagraphElement>(null);
  const [previewOverflows, setPreviewOverflows] = useState(false);
  const normalizedBody = normalizePostBody(joke.body);
  const bodyIsLong = normalizedBody.length > BODY_PREVIEW_LIMIT ||
    normalizedBody.split("\n").length > BODY_PREVIEW_LINES || previewOverflows;

  const displayedBody =
    !isBodyExpanded && normalizedBody.length > BODY_PREVIEW_LIMIT
      ? normalizedBody.slice(0, BODY_PREVIEW_LIMIT) + "..." : normalizedBody;

  useEffect(() => {
    const element = previewRef.current;
    if (!element || isBodyExpanded) return;
    const measure = () => setPreviewOverflows(element.scrollHeight > element.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [displayedBody, isBodyExpanded, isEditing]);

  useEffect(() => {
    // reset when joke changes
    setIsBodyExpanded(false);
  }, [joke.id, joke.body]);

  useEffect(() => {
    if (!joke) return;

    const liked = user ? joke.likes.some((like) => like.userId === Number(user.id)) : false;
    setLikedList(joke.likes.map((like) => like.user.username));
    setHasLiked(liked);
  }, [joke, user]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const toggleComments = () => {
    setCommentsIsOpen((prev) => !prev);
  };

  const handleTitleEnter = useSubmitOnEnter(() =>
    handleEditJoke(
      joke.id,
      editedTitle,
      editedBody,
      editedTags.split(",").map((t) => t.trim()),
    ),
  );

  const handleTagsEnter = useSubmitOnEnter(() =>
    handleEditJoke(
      joke.id,
      editedTitle,
      editedBody,
      editedTags.split(",").map((t) => t.trim()),
    ),
  );

  const handleEditInput = () => {
    setServerBodyError(null);
    setCommentsIsOpen(false);
    setIsEditing((prev) => !prev);
    setEditedBody(joke.body);
    setEditedTitle(joke.title);
    setEditedTags(joke.tags.map((tag) => tag.name).join(", "));
  };

  const handleOpenEditMenu = () => {
    setShowEditMenu(!showEditMenu);
  };

  const handleShareJoke = async () => {
    const shareUrl = `${window.location.origin}/jokes/${joke.id}?lang=${language.toLowerCase()}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: joke.title,
          text: joke.body?.slice(0, 120) || joke.title,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("joke.toasts.linkCopied"));
    } catch (err: any) {
      // Ignore cancelled native share
      if (err?.name === "AbortError") return;

      toast.error(t("joke.toasts.shareFailed"));
      console.error("Failed to share joke", err);
    }
  };

  const handleToggleLike = async () => {
    if (!accessToken || !user) {
      toast.error(t("joke.toasts.mustBeLoggedInToLike"));
      return;
    }

    if (Number(user.id) == Number(joke.authorId)) {
      toast.error(t("joke.toasts.cannotLikeOwn"));
      return;
    }

    try {
      const res = await safeRequest(toggleLike, accessToken, setAccessToken, joke.id);
      if (res.statusCode === 200 || res.statusCode === 201) {
        setLikedList((prev) => {
          if (hasLiked) {
            return prev.filter((username) => username !== user?.username);
          } else {
            return [...prev, user?.username || "Unknown"];
          }
        });
        setHasLiked((prev) => !prev);
      } else {
        throw new Error();
      }

      // await refreshJokes();
    } catch (err: any) {
      toast.error(t("joke.toasts.toggleLikeFailed"));
      console.error("Failed to toggle like", err.message);
    }
  };

  const handleEditJoke = async (jokeId: number, newTitle: string, newBody: string, editedTags: string[]) => {
    if (!accessToken || getPostBodyError(newBody) || serverBodyError || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      const moderation = moderateFields(
        {
          title: newTitle,
          body: newBody,
          tags: editedTags.join(" "),
        },
        terms,
      );

      if (moderation.blocked) {
        toast.error(t("validation.blockedContent"));
        return;
      }

      const res = await safeRequest(
        editJoke,
        accessToken,
        setAccessToken,
        jokeId,
        newTitle,
        normalizePostBody(newBody),
        published,
        editedTags,
        language,
      );

      if (res.statusCode !== 200) {
        throw new Error(res.message || t("joke.toasts.editJokeFailed"));
      }

      const updatedJoke: JokeType = res.data;

      setIsEditing(false);
      setEditedTitle(updatedJoke.title);
      setEditedBody(updatedJoke.body);
      setEditedTags(updatedJoke.tags.map((t) => t.name).join(", "));
      setPublished(updatedJoke.published);

      onJokeUpdated?.(updatedJoke);

      toast.success(
        `${t("joke.toasts.jokeEdited")} ${
          updatedJoke.published ? t("joke.toasts.published") : t("joke.toasts.unpublished")
        }`,
      );
    } catch (err: any) {
      const fieldError = getPostBodyApiError(err);
      if (fieldError) {
        setServerBodyError(fieldError);
        return;
      }
      const backendFieldErrors = err?.response?.data?.errors;
      const blockedContentError =
        Array.isArray(backendFieldErrors) ?
          backendFieldErrors.find((error: any) => error?.field === "content")
        : null;

      const message =
        blockedContentError?.message || getApiErrorMessage(err, t("joke.toasts.editJokeFailed"));

      toast.error(message);
      console.error("Failed to edit joke", err?.response?.data || err?.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteJoke = async (jokeId: number) => {
    try {
      if (!accessToken) return;
      console.log("Deleting joke with ID:", jokeId);

      const res = await safeRequest(deleteJoke, accessToken, setAccessToken, jokeId, language);
      if (res.statusCode !== 200) throw new Error("Request failed");

      setShowModal(false);
      toast.success(t("joke.toasts.jokeDeleted"));

      // ✅ Tell parent to remove it from its list
      onJokeDeleted?.(jokeId);

      window.dispatchEvent(
        new CustomEvent(jokeDeletedEvent, {
          detail: { jokeId },
        }),
      );
    } catch (err: any) {
      toast.error(t("joke.toasts.deleteJokeFailed"));
      console.error("Failed to delete joke", err.message);
    }
  };

  const handleEditComment = async (commentId: number, newBody: string) => {
    try {
      if (!accessToken) return;

      const moderation = moderateFields({ comment: newBody }, terms);

      if (moderation.blocked) {
        toast.error(t("validation.blockedComment"));
        return;
      }

      const res = await safeRequest(editComment, accessToken, setAccessToken, commentId, newBody);

      if (res.statusCode !== 200) {
        throw new Error(res.message || t("joke.toasts.editCommentFailed"));
      }

      toast.success(t("joke.toasts.commentEdited"));
      reloadComments();
    } catch (err: any) {
      const backendFieldErrors = err?.response?.data?.errors;
      const blockedCommentError =
        Array.isArray(backendFieldErrors) ?
          backendFieldErrors.find((error: any) => error?.field === "comment")
        : null;

      const message =
        blockedCommentError?.message || getApiErrorMessage(err, t("joke.toasts.editCommentFailed"));

      toast.error(message);
      console.error("Failed to edit comment", err?.response?.data || err?.message);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      if (!accessToken) return;

      const res = await safeRequest(deleteComment, accessToken, setAccessToken, commentId);
      if (res.statusCode !== 200) throw new Error("Request failed");

      toast.success(t("joke.toasts.commentDeleted"));
      reloadComments(); // ✅ refresh list
    } catch (err: any) {
      toast.error(t("joke.toasts.deleteCommentFailed"));
      console.error("Failed to delete comment", err.message);
    }
  };

  return (
    <div
      className={`relative bg-[var(--bg-input)] bg-cover bg-center bg-full text-[var(--text1)] w-full xl:w-[90%] xl:max-w-250 mx-auto rounded-2xl mb-10`}
    >
      <Modal
        isOpen={showModal}
        title={t("joke.modal.deleteTitle")}
        message={t("joke.modal.deleteMessage")}
        confirmText={t("joke.modal.deleteConfirm")}
        cancelText={t("joke.modal.cancel")}
        onConfirm={() => handleDeleteJoke(joke.id)}
        onCancel={() => setShowModal(false)}
      />
      {published ? null : (
        <div className="text-[var(--text1)] absolute top-5 md:top-4.5 right-14 xl:right-19 text-sm md:text-lg">
          {t("joke.status.draft")}
        </div>
      )}
      <div className="flex absolute gap-2 top-4 right-5 xl:right-10">
        {canEdit && (
          <button
            onClick={handleOpenEditMenu}
            type="button"
            title={t("joke.aria.editJoke")}
            className="hover:bg-[var(--bg)] py-1 rounded-full px-1 mr-[-6px]"
          >
            <BsThreeDotsVertical size={20} color="var(--text3)" />
          </button>
        )}

        {showEditMenu && (
          <div className="absolute flex top-9 right-0 bg-[var(--bg-input)] border-1 border-[var(--text1)]/20 rounded-full px-1 py-0.5 z-50 opacity-80">
            {isAuthor && (
              <button
                onClick={handleEditInput}
                type="button"
                title={t("joke.aria.editJoke")}
                className="hover:bg-[var(--bg)] py-1 rounded-full px-1"
              >
                <MdEdit size={15} color="var(--text3)" />
              </button>
            )}

            {(isAuthor || isAdmin) && (
              <button
                onClick={() => setShowModal(true)}
                type="button"
                title={t("joke.aria.deleteJoke")}
                className="hover:bg-[var(--bg)] py-1 rounded-full px-1"
              >
                <MdDelete size={15} color="var(--text3)" />
              </button>
            )}
          </div>
        )}

        {!published ? null : (
          <button
            type="button"
            onClick={handleShareJoke}
            aria-label={t("joke.aria.shareJoke")}
            title={t("joke.aria.shareJoke")}
            className="hover:bg-[var(--bg)] py-1 rounded-full px-2"
          >
            <FiShare2 className="mt-0.5" />
          </button>
        )}
        {!published ? null : (
          <div className="group">
            <button
              aria-label={t("joke.aria.likeJoke")}
              title={t("joke.aria.likeJoke")}
              type="button"
              onClick={handleToggleLike}
              className="flex cursor-pointer px-2.5 pt-1 min-w-14 rounded-full transition-colors duration-200 bg-transparent border-1 border-[var(--text1)]/20 text-[var(--text3)] text-md hover:bg-[var(--bg)]"
              style={{ color: hasLiked ? "var(--button3)" : "var(--text3)" }}
            >
              {hasLiked ?
                <AiFillLike />
              : <AiOutlineLike className="mt-0.5" />}
              <span className="ml-1 font-bold">
                {likedList?.length > 0 ?
                  likedList?.length
                : hasLiked ?
                  1
                : 0}
              </span>
            </button>

            {likedList?.length > 0 && (
              <div
                className="
                absolute right-0 xl:right-0 top-8 border max-h-300 overflow-y-auto
                w-32 p-2 rounded bg-[var(--bg-input)] shadow-lg text-[var(--text1)]
                opacity-0 pointer-events-none
                group-hover:opacity-100 group-hover:pointer-events-auto
                transition-opacity duration-200
                z-50"
              >
                {likedList.map((username, index) => (
                  <div key={index + username} className="text-sm border-b last:border-b-0 py-1">
                    {username}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row xl:mb-0 md:ml-auto absolute top-3 left-5 xl:left-10">
        <AvatarWithBadges
          size={avatarSize}
          avatarUrl={joke.user?.avatar}
          username={joke.user?.username}
          user={joke.user as User}
        />
        <div className="flex flex-col justify-center ml-0 lg:ml-2 max-w-[calc(20px+30vw)] mt-0 lg:mt-2">
          <p
            title={t("joke.labels.username")}
            className="font-bold text-[0.8rem]/3.5 md:text-[1rem] [overflow-wrap:anywhere] max-w-[calc(5px+30vw)]"
          >
            {capitalizeFirstLetter(joke.user.username)}
          </p>
          <p title={t("joke.labels.jokeDate")} className="text-[0.7rem] mt-0 opacity-80">
            {formatDate(joke.createdAt)}
          </p>
        </div>
      </div>

      <hr className="text-[var(--text1)] opacity-10 mt-28 lg:mt-23" />
      <div className="flex flex-col-reverse md:flex-row px-5 xl:px-10 pt-4">
        {isEditing ?
          <div className="bg-[var(--bg)] rounded-lg p-1 w-full relative">
            <input
              ref={inputRef}
              title={t("joke.aria.editJokeTitle")}
              type="text"
              value={editedTitle}
              maxLength={MAX_CHARS.TITLE}
              onKeyDown={handleTitleEnter}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHARS.TITLE) setEditedTitle(e.target.value);
              }}
              className="w-full text-xl xl:text-3xl md:text-3xl/8 p-4 bg-transparent outline-none"
            />
            <span className="characters-left">{getCharactersLeft(editedTitle, MAX_CHARS.TITLE)}</span>
          </div>
        : <NavLink aria-label="Go to joke" to={`/jokes/${joke.id}`}>
            <h3
              title="Joke title"
              className="text-xl/5 xl:text-3xl md:text-3xl/8 mt-autom mr-22 [overflow-wrap:anywhere]"
            >
              {joke.title}
            </h3>
          </NavLink>
        }
      </div>

      {isEditing ?
        <div className="mx-5 xl:mx-10 my-4 w-auto bg-[var(--bg)] rounded-lg relative">
          <textarea
            ref={textRef}
            aria-label={t("joke.aria.editJokeBody")}
            title={t("joke.aria.editJokeBody")}
            value={editedBody}
            aria-invalid={Boolean(bodyError)}
            aria-describedby={bodyError ? `joke-body-error-${joke.id}` : undefined}
            onChange={(e) => {
              setServerBodyError(null);
              setEditedBody(e.target.value);
              handleInput();
            }}
            className="text-sm md:text-lg p-5 resize-none w-full overflow-hidden outline-none"
          />
          <span className="characters-left" aria-label={t("validation.postBody.counter")}>{getCharactersLeft(normalizePostBody(editedBody), MAX_CHARS.BODY)}</span>
        </div>
      : <div className="px-5 xl:px-10 pb-4 pt-1">
          <p
            ref={previewRef}
            style={!isBodyExpanded ? {
              display: "-webkit-box", WebkitBoxOrient: "vertical",
              WebkitLineClamp: BODY_PREVIEW_LINES, overflow: "hidden",
            } : undefined}
            className="text-sm md:text-lg/7 xl:text-lg whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]"
          >
            {displayedBody}
          </p>
          {/* If I want to add links */}
          {/* <LinkifiedText
            className="text-sm md:text-lg/7 xl:text-lg whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]"
            text={displayedBody}
          /> */}

          {bodyIsLong && (
            <button
              type="button"
              onClick={() => setIsBodyExpanded((p) => !p)}
              className="mt-2 text-sm md:text-lg opacity-80 hover:opacity-100 underline"
              aria-expanded={isBodyExpanded}
            >
              {isBodyExpanded ? t("joke.actions.showLess") : t("joke.actions.readMore")}
            </button>
          )}
        </div>
      }
      {isEditing && bodyError && <p id={`joke-body-error-${joke.id}`} role="alert" className="mx-5 xl:mx-10 text-sm text-[var(--error)] mb-4">{t(`validation.postBody.${bodyError}`)}</p>}
      <hr className="text-[var(--text1)] opacity-10" />
      <div className="flex flex-col gap-3 xl:flex-row justify-between px-5 xl:px-10 py-4">
        {isEditing ?
          <div className="mb-8 w-full bg-[var(--bg)] rounded-lg relative">
            <input
              type="text"
              aria-label={t("joke.aria.editJokeTags")}
              title={t("joke.aria.editJokeTags")}
              value={editedTags}
              maxLength={MAX_CHARS.TAGS}
              onKeyDown={handleTagsEnter}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHARS.TAGS) setEditedTags(e.target.value);
              }}
              className="w-full text-sm md:text-lg p-5 outline-none"
            />
            <span className="characters-left">{getCharactersLeft(editedTags, MAX_CHARS.TAGS)}</span>
          </div>
        : joke.tags[0]?.name.length >= 1 ?
          <TagsCard tags={joke?.tags} />
        : <p className="opacity-0 mb-[-10px]"></p>}

        {isEditing && (
          <div className="flex items-center absolute bottom-3.5 right-15">
            <label htmlFor="publish/unpublish" className="mr-2">
              <b>{t("joke.actions.publish")}</b>
            </label>
            <input
              className="w-4 h-4 cursor-pointer accent-[var(--text1)]"
              onChange={() => setPublished((prev) => !prev)}
              id="publish/unpublish"
              aria-label={t("joke.aria.publishUnpublish")}
              type="checkbox"
              checked={published}
            />
          </div>
        )}
        {isEditing ?
          <button
            type="button"
            disabled={Boolean(bodyError) || isSavingEdit}
            aria-label={t("joke.aria.editMessage")}
            title={t("joke.aria.editMessage")}
            className="absolute bottom-2 right-2 p-2 rounded-full hover:bg-[var(--bg)] text-[var(--button3)]"
            onClick={() => {
              handleEditJoke(
                joke.id,
                editedTitle,
                editedBody,
                editedTags.split(",").map((tag) => tag.trim()),
              );
            }}
          >
            <IoSend size={20} />
          </button>
        : <Button
            className="w-full xl:w-auto xl:min-w-[180px] max-h-10 mt-auto hover:bg-[var(--bg)]! hover:text-[var(--text1)]!"
            onClick={toggleComments}
            size="sm"
            variant="outline"
            title="Toggle comments"
            label={buttonText}
          >
            {buttonText}
          </Button>
        }
      </div>
      {commentsIsOpen && (
        <div className={`bg-[var(--primary)] text-[var(--text2)] p-6 rounded-b-2xl`}>
          <h3 className="text-lg md:text-2xl mb-0">{t("joke.labels.comments")}</h3>

          {user && published ?
            <CommentForm jokeId={joke.id} onCommentAdded={() => reloadComments()} />
          : null}

          {commentsLoading && comments.length === 0 && <Spinner />}

          {commentsError && (
            <p className="text-center text-sm text-red-400 mt-2">
              {typeof commentsError === "string" ? commentsError : t("joke.labels.failedToLoadComments")}
            </p>
          )}

          {!commentsLoading && comments.length === 0 && (
            <div className="text-xs md:text-sm opacity-70">
              <p>
                {t("joke.labels.noComments")}
                {published && user ? ` ${t("joke.labels.beFirstToComment")}` : ""}
                {published && !user ? ` ${t("joke.labels.logInToComment")}` : ""}
              </p>

              {published && !user && (
                <NavLink to="/login" className="inline-block mt-2 underline text-[var(--text2)] opacity-100">
                  {t("joke.actions.goToLogin")}
                </NavLink>
              )}
            </div>
          )}

          {comments.map((comment) => (
            <Comment
              key={comment.id}
              commentId={comment.id}
              username={comment.user?.username || "Unknown"}
              authorId={Number(comment.user?.id) || null}
              avatar={comment.user?.avatar || null}
              date={formatDate(comment.createdAt)}
              comment={comment.body}
              onEdit={handleEditComment}
              onDelete={handleDeleteComment}
            />
          ))}

          {canNext && (
            <div className="mt-5 flex justify-center">
              <Button
                label={t("joke.actions.loadMoreComments")}
                onClick={loadMoreComments}
                size="sm"
                variant="secondary"
                disabled={commentsLoading}
              >
                {commentsLoading ? t("joke.actions.loading") : t("joke.actions.loadMoreComments")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Joke;
