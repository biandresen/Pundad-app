import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { toast } from "react-toastify";

import { useLanguage } from "../../contexts/LanguageContext";
import { useModeration } from "../../contexts/ModerationContext";

import Input from "../../components/atoms/Input";
import Button from "../../components/atoms/Button";

import {
  usernameValidator,
  emailValidator,
  passwordValidator,
} from "../../validators/auth";

import { registerUser } from "../../lib/axios";
import { toastApiError } from "../../lib/apiErrors";
import { moderateFields } from "../../lib/moderation";

type BackendFieldError = {
  field: string;
  message: string;
};

const Register = () => {
  // --------------------------------------------------
  // Global app state
  // --------------------------------------------------
  const { t, tr } = useLanguage();
  const { terms } = useModeration();

  const navigate = useNavigate();

  // --------------------------------------------------
  // Static translated content
  // --------------------------------------------------
  const infoListItems = tr<string[]>("register.infoListItems", []);

  // --------------------------------------------------
  // Prevent the welcome toast from showing repeatedly
  // --------------------------------------------------
  const hasShownWelcomeToast = useRef(false);

  useEffect(() => {
    if (!hasShownWelcomeToast.current) {
      toast.info(t("register.welcome"));
      hasShownWelcomeToast.current = true;
    }
  }, [t]);

  // --------------------------------------------------
  // Form state
  // --------------------------------------------------
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>("");

  const [showPassword, setShowPassword] = useState<boolean>(false);

  // --------------------------------------------------
  // Field validation / error state
  // --------------------------------------------------
  const [input1Valid, setInput1Valid] = useState<boolean>(true);
  const [errorMsg1, setErrorMsg1] = useState<string>("");

  const [input2Valid, setInput2Valid] = useState<boolean>(true);
  const [errorMsg2, setErrorMsg2] = useState<string>("");

  /**
   * This array mainly holds password validation keys from the frontend validator.
   * It may also contain a backend password message if the API returns one.
   */
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const [input4Valid, setInput4Valid] = useState<boolean>(true);
  const [errorMsg4, setErrorMsg4] = useState<string>("");

  // --------------------------------------------------
  // Prevent duplicate submissions while the API request is in flight
  // --------------------------------------------------
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --------------------------------------------------
  // Derived state
  // --------------------------------------------------
  const invalidForm =
    !input1Valid ||
    !input2Valid ||
    passwordErrors.length > 0 ||
    !input4Valid ||
    !username ||
    !email ||
    !password ||
    !passwordConfirmation ||
    !acceptedTerms;

  // --------------------------------------------------
  // Apply backend validation errors to specific fields
  // --------------------------------------------------
  const applyBackendFieldErrors = (errors: BackendFieldError[]) => {
    errors.forEach((error) => {
      switch (error.field) {
        case "username":
          setInput1Valid(false);
          setErrorMsg1(error.message);
          break;

        case "email":
          setInput2Valid(false);
          setErrorMsg2(error.message);
          break;

        case "password":
          setPasswordErrors([error.message]);
          break;

        case "passwordConfirmation":
          setInput4Valid(false);
          setErrorMsg4(error.message);
          break;

        case "acceptedTerms":
          /**
           * You can later add a dedicated terms error message state if needed.
           * For now, the checkbox is still part of invalidForm.
           */
          break;

        default:
          break;
      }
    });
  };

  // --------------------------------------------------
  // Handle register submit
  // --------------------------------------------------
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Guard against invalid form and repeated submits
    if (invalidForm || isSubmitting) {
      if (invalidForm && !isSubmitting) {
        toast.error(t("register.invalidForm"));
      }
      return;
    }

        const usernameModeration = moderateFields(
      { username: username.trim() },
      terms
    );

    if (usernameModeration.blocked) {
      setInput1Valid(false);
      setErrorMsg1(t("validation.blockedUsername"));
      toast.error(t("validation.blockedUsername"));
      return;
    }

    try {
      setIsSubmitting(true);
      const normalizedEmail = email.trim().toLowerCase();


    const res = await registerUser({
      username: username.trim(),
      email: normalizedEmail,
      password,
      passwordConfirmation,
      acceptedTerms,
    });

      if (res.statusCode !== 201) {
        throw new Error(res.message || t("register.registrationFailed"));
      }

      const { needsEmailVerification, email: registeredEmail } = res.data;

      if (needsEmailVerification) {
        toast.info(t("register.verifyEmail"));
        navigate(`/resend-verification?email=${encodeURIComponent(registeredEmail)}`);
        return;
      }

      toast.success(t("register.verifyEmail"));
      navigate(`/resend-verification?email=${encodeURIComponent(registeredEmail)}`);
    } catch (err: any) {
      const backendErrors = err?.response?.data?.errors;

      // If backend returned structured field validation errors,
      // map them to their matching fields instead of using a generic toast only
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        toast.error(t("register.highlightedErrors"));
        applyBackendFieldErrors(backendErrors);
        return;
      }

      // All other API failures go through the centralized toast helper
      toastApiError(err, t("register.registrationFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="inputInfo-container container">
      <div>
        <section className="info-container">
          <h2 className="text-2xl my-3">{t("register.infoHeading")}</h2>

          <div>
            <h3 className="font-medium text-xl">{t("register.infoListHeading")}</h3>
            <hr className="mb-2" />

            <ul>
              {infoListItems.map((list) => (
                <li className="list-disc ml-4 text-lg" key={list}>
                  {list}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="input-container">
        <h2 className="input-heading">{t("register.inputHeading")}</h2>

        <form onSubmit={handleSubmit}>
          <Input
            id="username"
            label={t("register.usernameLabel")}
            value={username}
            errorMsg={errorMsg1}
            placeholder={t("register.usernamePlaceholder")}
            required
            inputValid={input1Valid}
                onChange={(e) => {
                const value = e.target.value;
                setUsername(value);

                const validationKey = usernameValidator(value);

                if (validationKey) {
                  setInput1Valid(false);
                  setErrorMsg1(t(validationKey));
                  return;
                }

                const moderation = moderateFields(
                  { username: value.trim() },
                  terms,
                );

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
            label={t("register.emailLabel")}
            value={email}
            errorMsg={errorMsg2}
            placeholder={t("register.emailPlaceholder")}
            required
            inputValid={input2Valid}
            onChange={(e) => {
              const value = e.target.value;
              setEmail(value);

              const validationKey = emailValidator(value);
              setInput2Valid(!validationKey);
              setErrorMsg2(validationKey ? t(validationKey) : "");
            }}
          />

          <div className="flex relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              label={t("register.passwordLabel")}
              value={password}
              placeholder={t("register.passwordPlaceholder")}
              required
              inputValid={passwordErrors.length === 0}
              onChange={(e) => {
                const value = e.target.value;
                setPassword(value);

                // Re-run client-side password validation on each change
                setPasswordErrors(passwordValidator(value));
              }}
            />

            <Button
              type="button"
              aria-label={
                showPassword
                  ? t("register.hidePassword", "Hide password")
                  : t("register.showPassword", "Show password")
              }
              label={
                showPassword
                  ? t("register.hidePassword", "Hide password")
                  : t("register.showPassword", "Show password")
              }
              size="zero"
              className="bg-transparent absolute left-27 top-2"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? (
                <FaEye size={20} className="text-[var(--text1)]" />
              ) : (
                <FaEyeSlash size={20} className="text-[var(--text1)]" />
              )}
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
            id="passwordConfirmation"
            type={showPassword ? "text" : "password"}
            label={t("register.confirmPasswordLabel")}
            value={passwordConfirmation}
            errorMsg={errorMsg4}
            placeholder={t("register.confirmPasswordPlaceholder")}
            required
            inputValid={input4Valid}
            onChange={(e) => {
              const value = e.target.value;
              setPasswordConfirmation(value);

              const isValid = value === password;
              setInput4Valid(isValid);
              setErrorMsg4(isValid ? "" : t("register.passwordsDoNotMatch"));
            }}
          />

          <label className="mt-4 flex items-start gap-2 text-sm text-[var(--text1)]">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1"
            />
            <span>
              {t("register.agreeTo")}{" "}
              <Link to="/legal/terms" className="underline font-semibold">
                {t("register.terms")}
              </Link>{" "}
              {t("common.and", "and")}{" "}
              <Link to="/legal/rules" className="underline font-semibold">
                {t("register.communityRules")}
              </Link>
              .
            </span>
          </label>

          <Button
            type="submit"
            variant="tertiary"
            className={`w-full mt-7 ${
              invalidForm || isSubmitting ? "cursor-not-allowed opacity-50" : ""
            }`}
            disabled={invalidForm || isSubmitting}
            label={t("register.button")}
          >
            {isSubmitting ? t("common.loading") : t("register.button")}
          </Button>

          <div className="text-center">
            <Link to="/login" className="text-[var(--text1)] mt-3">
              {t("register.goToLogin")} <span className="font-bold">{t("register.link")}</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;