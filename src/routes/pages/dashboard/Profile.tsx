import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import Input from "../../../components/atoms/Input";
import Button from "../../../components/atoms/Button";
import Modal from "../../../components/molecules/Modal";
import AvatarWithBadges from "../../../components/atoms/AvatarWithBadges";

import { useUser } from "../../../contexts/UserContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useModeration } from "../../../contexts/ModerationContext";

import { deleteUser, resendEmailChangeVerification, updateUser } from "../../../lib/axios";
import { safeRequest } from "../../../lib/auth";
import { logoutAndRedirect } from "../../../lib/logout";
import { formatDateProfile } from "../../../lib/utils";
import { getApiErrorMessage, toastApiError } from "../../../lib/apiErrors";

import { passwordValidator, usernameValidator, emailValidator } from "../../../validators/auth";

import type { User } from "../../../types/context.types";
import { moderateFields } from "../../../lib/moderation";

const MAX_AVATAR_SIZE = 6 * 1024 * 1024; // 6 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const Profile = () => {
  const { user, setUser } = useUser();
  const { accessToken, setAccessToken } = useAuth();
  const { t, tf } = useLanguage();
  const { terms } = useModeration();
  const navigate = useNavigate();

  // --------------------------------------------------
  // Local UI state
  // --------------------------------------------------
  const [showModal, setShowModal] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);

  // Prevent duplicate requests
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  // --------------------------------------------------
  // Form state
  // --------------------------------------------------
  const [username, setUsername] = useState<string>(user?.username || "");
  const [email, setEmail] = useState<string>(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [avatar, setAvatar] = useState<File | null>(null);

  // --------------------------------------------------
  // Validation / inline error state
  // --------------------------------------------------
  const [input1Valid, setInput1Valid] = useState<boolean>(true);
  const [errorMsg1, setErrorMsg1] = useState<string>("");

  const [input2Valid, setInput2Valid] = useState<boolean>(true);
  const [errorMsg2, setErrorMsg2] = useState<string>("");

  const [currentPasswordError, setCurrentPasswordError] = useState<string>("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string>("");
  const [avatarUpdated, setAvatarUpdated] = useState(false);

  const [emailPendingVerification, setEmailPendingVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  // --------------------------------------------------
  // Derived state
  // --------------------------------------------------
  const normalizedCurrentEmail = (user?.email || "").trim().toLowerCase();
  const normalizedNextEmail = email.trim().toLowerCase();

  const emailChanged = normalizedNextEmail !== normalizedCurrentEmail;
  const passwordChangeRequested = newPassword.trim().length > 0;
  const sensitiveChangeRequested = emailChanged || passwordChangeRequested;
  const currentPasswordMissing = sensitiveChangeRequested && !currentPassword.trim();

  const invalidForm =
    !input1Valid ||
    !input2Valid ||
    passwordErrors.length > 0 ||
    !!currentPasswordError ||
    !!avatarError ||
    !username ||
    !email ||
    currentPasswordMissing;

  // --------------------------------------------------
  // Keep form values in sync if user context changes
  // --------------------------------------------------
  useEffect(() => {
    setUsername(user?.username || "");
    setEmail(user?.email || "");
    setPendingEmail("");
    setEmailPendingVerification(false);
    setAvatarUpdated(false);
  }, [user?.username, user?.email]);

  // --------------------------------------------------
  // Clear current password error when no longer relevant
  // --------------------------------------------------
  useEffect(() => {
    if (!sensitiveChangeRequested) {
      setCurrentPasswordError("");
    }
  }, [sensitiveChangeRequested]);

  // --------------------------------------------------
  // Clean up object URL previews to avoid memory leaks
  // --------------------------------------------------
  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // --------------------------------------------------
  // Logout
  // --------------------------------------------------
  const handleLogout = () => {
    if (isSubmitting || isDeleting) return;
    logoutAndRedirect({ setUser, setAccessToken, navigate });
  };

  // --------------------------------------------------
  // Open delete confirmation modal
  // --------------------------------------------------
  const handleDeleteButton = () => {
    if (isSubmitting || isDeleting) return;
    setShowModal(true);
  };

  // --------------------------------------------------
  // Delete profile
  // --------------------------------------------------
  const handleDeleteProfile = async () => {
    if (isDeleting) return;

    try {
      if (!accessToken || !user?.id) return;

      setIsDeleting(true);

      const res = await safeRequest(deleteUser, accessToken, setAccessToken, Number(user.id));

      if (res.statusCode !== 200) {
        throw new Error(res.message || t("profile.toasts.deleteFailed"));
      }

      toast.success(t("profile.toasts.deleteSuccess"));
      setUser(null);
      setAccessToken(null);
      navigate("/login");
    } catch (err: any) {
      toastApiError(err, t("profile.toasts.deleteFailed"));
    } finally {
      setIsDeleting(false);
      setShowModal(false);
    }
  };

  // --------------------------------------------------
  // Resend pending email verification
  // --------------------------------------------------
  const handleResendEmailChangeVerification = async () => {
    if (!accessToken || isResendingVerification) return;

    try {
      setIsResendingVerification(true);

      const res = await safeRequest(resendEmailChangeVerification, accessToken, setAccessToken);

      setEmailPendingVerification(true);
      setPendingEmail(res?.data?.pendingEmail || pendingEmail);

      toast.success(t("profile.toasts.resendEmailChangeVerificationSuccess"));
    } catch (err: any) {
      toastApiError(err, t("profile.toasts.resendEmailChangeVerificationFailed"));
    } finally {
      setIsResendingVerification(false);
    }
  };

  // --------------------------------------------------
  // Update profile
  // --------------------------------------------------
  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (invalidForm || isSubmitting) return;
    if (!accessToken || !user?.id) return;

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const usernameModeration = moderateFields({ username: trimmedUsername }, terms);

    if (usernameModeration.blocked) {
      setInput1Valid(false);
      setErrorMsg1(t("validation.blockedUsername"));
      toast.error(t("validation.blockedUsername"));
      return;
    }

    const updates: Record<string, unknown> = {
      username: trimmedUsername,
      email: trimmedEmail,
    };

    if (sensitiveChangeRequested) {
      updates.currentPassword = currentPassword;
    }

    if (newPassword.trim().length > 0) {
      updates.password = newPassword;
    }

    if (avatar) {
      updates.avatar = avatar;
    }

    try {
      setIsSubmitting(true);

      const res = await safeRequest(updateUser, accessToken, setAccessToken, Number(user.id), updates);

      if (res.statusCode !== 200) {
        throw new Error(res.message || t("profile.toasts.updateFailed"));
      }

      setUser(res.data);

      const avatarWasUpdated = !!avatar;
      setAvatarUpdated(avatarWasUpdated);

      setCurrentPassword("");
      setNewPassword("");
      setPasswordErrors([]);
      setCurrentPasswordError("");

      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }

      setAvatar(null);
      setAvatarPreview(null);
      setAvatarError("");

      if (emailChanged) {
        setEmailPendingVerification(true);
        setPendingEmail(trimmedEmail);
        toast.success(t("profile.toasts.emailChangePendingVerification"));
        return;
      }

      toast.success(t("profile.toasts.updateSuccess"));
    } catch (err: any) {
      const backendErrors = err?.response?.data?.errors;

      const currentPasswordFieldError =
        Array.isArray(backendErrors) ?
          backendErrors.find((error: any) => error?.field === "currentPassword")
        : null;

      if (currentPasswordFieldError?.message) {
        setCurrentPasswordError(currentPasswordFieldError.message);
      } else {
        setCurrentPasswordError("");
      }

      const message = getApiErrorMessage(err, t("profile.toasts.updateFailed"));

      if (err?.response?.data?.message === "File too large") {
        toast.error(t("profile.toasts.avatarTooLarge"));
        return;
      }

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container inputInfo-container">
      <Modal
        isOpen={showModal}
        title={t("profile.modal.title")}
        message={t("profile.modal.message")}
        confirmText={isDeleting ? t("common.loading") : t("profile.modal.confirmText")}
        cancelText={t("profile.modal.cancelText")}
        onConfirm={handleDeleteProfile}
        onCancel={() => {
          if (isDeleting) return;
          setShowModal(false);
        }}
      />

      <div>
        <div className="info-container flex flex-col">
          <div className="flex flex-col-reverse gap-3 sm:flex-row md:gap-0 items-center justify-between">
            <h2 className="text-2xl md:text-4xl font-bold">{t("profile.infoHeading")}</h2>

            <AvatarWithBadges
              size={80}
              avatarUrl={user?.avatar}
              username={user?.username}
              user={user as User}
            />
          </div>

          <dl className="mt-6 grid gap-y-3 text-lg md:text-xl">
            <div className="grid grid-cols-[1fr_auto] items-start gap-x-6">
              <dt className="opacity-70">{t("profile.facts.bestDailyStreak")}</dt>
              <dd className="font-bold break-all text-right">{user?.dailyJokeBestStreak}</dd>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-start gap-x-6">
              <dt className="opacity-70">{t("profile.facts.username")}</dt>
              <dd className="font-bold break-all text-right">{user?.username}</dd>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-start gap-x-6">
              <dt className="opacity-70">{t("profile.facts.email")}</dt>
              <dd className="font-bold break-all text-right">{user?.email}</dd>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-start gap-x-6">
              <dt className="opacity-70">{t("profile.facts.role")}</dt>
              <dd className="font-bold text-right">{user?.role}</dd>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-start gap-x-6">
              <dt className="opacity-70">{t("profile.facts.created")}</dt>
              <dd className="font-bold text-right">{formatDateProfile(user?.createdAt)}</dd>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-start gap-x-6">
              <dt className="opacity-70">{t("profile.facts.updated")}</dt>
              <dd className="font-bold text-right">{formatDateProfile(user?.updatedAt)}</dd>
            </div>

            <div className="my-2 border-t border-white/10" />

            <div className="grid grid-cols-[1fr_auto] items-start gap-x-6">
              <dt className="opacity-70">{t("profile.facts.termsAccepted")}</dt>
              <dd className="font-bold text-right">{formatDateProfile(user?.termsAcceptedAt)}</dd>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-start gap-x-6">
              <dt className="opacity-70">{t("profile.facts.termsVersion")}</dt>
              <dd className="font-bold text-right">
                {user?.termsVersion ?? t("profile.facts.notAvailable")}
              </dd>
            </div>
          </dl>

          <div className="mt-auto pt-6 flex flex-col gap-4">
            <Button
              type="button"
              variant="secondaryOnDark"
              onClick={handleLogout}
              className="w-full"
              label={t("profile.actions.logout")}
              disabled={isSubmitting || isDeleting}
            >
              {t("profile.actions.logout")}
            </Button>

            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm opacity-80 mb-3">{t("profile.deleteBox.text")}</p>
              <Button
                type="button"
                variant="error"
                onClick={handleDeleteButton}
                className="w-full"
                label={t("profile.actions.deleteProfile")}
                disabled={isSubmitting || isDeleting}
              >
                {isDeleting ? t("common.loading") : t("profile.actions.deleteProfile")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="input-container">
        <h2 className="input-heading">{t("profile.inputHeading")}</h2>

        <form onSubmit={handleUpdateUser} className="flex flex-col h-[88%]">
          <div>
            <Input
              id="username"
              label={t("profile.fields.username")}
              value={username}
              errorMsg={errorMsg1}
              placeholder=""
              required
              inputValid={input1Valid}
              onChange={(e) => {
                const value = e.target.value;
                setUsername(value);
                setAvatarUpdated(false);

                const validationKey = usernameValidator(value);

                if (validationKey) {
                  setInput1Valid(false);
                  setErrorMsg1(t(validationKey));
                  return;
                }

                const moderation = moderateFields({ username: value.trim() }, terms);

                if (moderation.blocked) {
                  setInput1Valid(false);
                  setErrorMsg1(t("validation.blockedUsername"));
                  return;
                }

                setInput1Valid(true);
                setErrorMsg1("");
              }}
            />

            <Input
              id="email"
              type="email"
              label={t("profile.fields.email")}
              value={email}
              errorMsg={errorMsg2}
              placeholder=""
              required
              inputValid={input2Valid}
              onChange={(e) => {
                const value = e.target.value;
                setEmail(value);
                setAvatarUpdated(false);

                if (emailPendingVerification) {
                  setEmailPendingVerification(false);
                  setPendingEmail("");
                }

                const validationKey = emailValidator(value);
                setInput2Valid(!validationKey);
                setErrorMsg2(validationKey ? t(validationKey) : "");
              }}
            />

            {emailPendingVerification && pendingEmail && (
              <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                <p className="text-sm opacity-90 break-words [overflow-wrap:anywhere]">
                  {tf("profile.pendingEmail.message", { email: pendingEmail })}
                </p>

                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 text-[0.6rem] md:text-sm! "
                  label={t("profile.actions.resendEmailChangeVerification")}
                  onClick={handleResendEmailChangeVerification}
                  disabled={isResendingVerification || isSubmitting || isDeleting}
                >
                  {isResendingVerification ?
                    t("common.loading")
                  : t("profile.actions.resendEmailChangeVerification")}
                </Button>
              </div>
            )}

            {sensitiveChangeRequested && (
              <>
                <div className="flex flex-col relative">
                  <Input
                    id="currentPassword"
                    className="text-[var(--text1)] max-md:placeholder-shown:pr-2"
                    type={showCurrentPassword ? "text" : "password"}
                    label={t("profile.fields.currentPassword")}
                    value={currentPassword}
                    errorMsg={currentPasswordError}
                    placeholder={t("profile.placeholders.currentPassword")}
                    inputValid={!currentPasswordError}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (currentPasswordError) setCurrentPasswordError("");
                    }}
                  />

                  <Button
                    type="button"
                    aria-label={
                      showCurrentPassword ? t("profile.aria.hidePassword") : t("profile.aria.showPassword")
                    }
                    label={
                      showCurrentPassword ? t("profile.aria.hidePassword") : t("profile.aria.showPassword")
                    }
                    size="zero"
                    className="bg-transparent absolute left-38 md:left-51 top-2"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    disabled={isSubmitting || isDeleting}
                  >
                    {showCurrentPassword ?
                      <FaEye size={20} className="text-[var(--text1)]" />
                    : <FaEyeSlash size={20} className="text-[var(--text1)]" />}
                  </Button>
                </div>

                <p className="text-xs text-gray-500 mb-3 mt-[-5px]">
                  {t("profile.help.currentPasswordRequired")}
                </p>
              </>
            )}

            <div className="flex flex-col relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                label={t("profile.fields.newPassword")}
                value={newPassword}
                placeholder={t("profile.placeholders.newPassword")}
                inputValid={passwordErrors.length === 0}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewPassword(value);
                  setPasswordErrors(passwordValidator(value));
                }}
              />

              <Button
                type="button"
                aria-label={showNewPassword ? t("profile.aria.hidePassword") : t("profile.aria.showPassword")}
                label={showNewPassword ? t("profile.aria.hidePassword") : t("profile.aria.showPassword")}
                size="zero"
                className="bg-transparent absolute left-32 md:left-42 top-2"
                onClick={() => setShowNewPassword((prev) => !prev)}
                disabled={isSubmitting || isDeleting}
              >
                {showNewPassword ?
                  <FaEye size={20} className="text-[var(--text1)]" />
                : <FaEyeSlash size={20} className="text-[var(--text1)]" />}
              </Button>
            </div>

            {passwordErrors.length > 0 && (
              <ul className="text-[0.9rem] text-[var(--error)] my-2">
                {passwordErrors.map((message) => (
                  <li key={message}>• {t(message, message)}</li>
                ))}
              </ul>
            )}

            <Input
              id="avatar"
              type="file"
              label={t("profile.fields.avatar")}
              title={t("profile.fields.avatar")}
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (!file) {
                  if (avatarPreview) {
                    URL.revokeObjectURL(avatarPreview);
                  }

                  setAvatar(null);
                  setAvatarPreview(null);
                  setAvatarError("");
                  return;
                }

                if (!ALLOWED_TYPES.includes(file.type)) {
                  setAvatar(null);
                  if (avatarPreview) {
                    URL.revokeObjectURL(avatarPreview);
                  }
                  setAvatarPreview(null);
                  setAvatarError(t("profile.avatar.invalidType"));
                  return;
                }

                if (file.size > MAX_AVATAR_SIZE) {
                  setAvatar(null);
                  if (avatarPreview) {
                    URL.revokeObjectURL(avatarPreview);
                  }
                  setAvatarPreview(null);
                  setAvatarError(
                    tf("profile.avatar.tooLarge", {
                      size: String(MAX_AVATAR_SIZE / (1024 * 1024)),
                    }),
                  );
                  return;
                }

                if (avatarPreview) {
                  URL.revokeObjectURL(avatarPreview);
                }

                setAvatar(file);
                setAvatarError("");
                setAvatarPreview(URL.createObjectURL(file));
                setAvatarUpdated(false);
              }}
            />

            <p className="text-xs text-gray-500 mb-3 mt-[-5px]">
              {tf("profile.avatar.help1", {
                size: String(MAX_AVATAR_SIZE / (1024 * 1024)),
              })}
            </p>

            <p className="text-xs text-gray-500 mb-3 mt-[-10px]">{t("profile.avatar.help2")}</p>

            {avatarPreview && (
              <img
                src={avatarPreview}
                alt={t("profile.avatar.previewAlt")}
                className="rounded-full w-20 h-20 object-cover mb-4 md:mb-0"
              />
            )}

            {avatarError && <p className="text-red-500">{avatarError}</p>}
          </div>

          {avatarUpdated && (
            <p className="text-xs text-[var(--text2)] opacity-80 mt-4 mb-3">
              {t("profile.avatar.refreshNote")}
            </p>
          )}

          <Button
            type="submit"
            variant="tertiary"
            className="w-full mt-auto disabled:cursor-not-allowed disabled:opacity-50"
            label={t("profile.actions.update")}
            disabled={invalidForm || isSubmitting || isDeleting}
          >
            {isSubmitting ? t("common.loading") : t("profile.actions.update")}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
