import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash, FaRegCheckCircle } from "react-icons/fa";
import { RxCrossCircled } from "react-icons/rx";

import { safeRequest } from "../../lib/auth";
import { getMe, loginUser } from "../../lib/axios";

import Input from "../../components/atoms/Input";
import Button from "../../components/atoms/Button";
import { userInputValidator, loginPasswordValidator } from "../../validators/auth";
import { useAuth } from "../../contexts/AuthContext";
import { useUser } from "../../contexts/UserContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getApiErrorMessage, toastApiError } from "../../lib/apiErrors";

const Login = () => {
  const [needsVerification, setNeedsVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [userInput, setUserInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Inline validation / field errors
  const [input1Valid, setInput1Valid] = useState(true);
  const [errorMsg1, setErrorMsg1] = useState("");

  const [input2Valid, setInput2Valid] = useState(true);
  const [errorMsg2, setErrorMsg2] = useState("");

  // Prevent duplicate submissions while request is in flight
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prevent welcome toast from showing multiple times on rerenders / language changes
  const hasShownWelcomeToast = useRef(false);

  const navigate = useNavigate();

  const invalidForm = !input1Valid || !input2Valid || !userInput || !password;

  const { setAccessToken, setIsAuthenticated } = useAuth();
  const { setUser, user } = useUser();
  const { language, setLanguage, t, tr, tf } = useLanguage();

  const infoListItems = tr<string[]>("login.infoListItems", []);

  // --------------------------------------------------
  // Redirect logged-in users away from login page
  // Show welcome toast only once for non-authenticated users
  // --------------------------------------------------
  useEffect(() => {
    if (user) {
      navigate("/jokes/daily-joke");
      return;
    }

    if (!hasShownWelcomeToast.current) {
      toast.info(t("login.welcome"));
      hasShownWelcomeToast.current = true;
    }
  }, [user, navigate, t]);

  // --------------------------------------------------
  // Handle login submit
  // --------------------------------------------------
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Guard against invalid form or repeated submits
    if (invalidForm || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setNeedsVerification(false);
      setPendingEmail("");
      setErrorMsg2("");

      const normalizedUserInput = userInput.trim().toLowerCase();
      const res = await loginUser({ userInput: normalizedUserInput, password }, language);

      if (res.statusCode !== 200) {
        throw new Error(res.message || t("login.loginFailed"));
      }

      const accessToken = res.data?.accessToken;
      if (typeof accessToken !== "string" || !accessToken) {
        throw new Error(t("login.missingAccessToken"));
      }

      // Use backend preferred language when available
      const preferred =
        res.data?.user?.preferredLanguage === "EN" || res.data?.user?.preferredLanguage === "NO" ?
          res.data.user.preferredLanguage
        : language;

      setLanguage(preferred);

      // Fetch the authenticated user before committing auth state globally
      const meRes = await safeRequest(getMe, accessToken, setAccessToken, preferred);
      const me = meRes?.data;

      if (!me) {
        throw new Error(t("login.loginFailed"));
      }

      // Commit auth state only after all required login steps succeed
      setAccessToken(accessToken);
      setIsAuthenticated(true);
      setUser(me);

      toast.success(tf("login.success", { username: me.username }));
      navigate("/jokes/daily-joke");
    } catch (err: any) {
      const message = getApiErrorMessage(err, t("login.loginFailed"));
      const status =
        err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.response?.data?.statusCode;

      const code = err?.response?.data?.code ?? err?.code;

      console.log("Login error details:", {
        message,
        status,
        code,
        raw: err?.response?.data,
      });

      if (status === 400 || status === 401) {
        setNeedsVerification(false);
        setPendingEmail("");
        setErrorMsg2(message);
        return;
      }

      if (status === 403 && code === "EMAIL_NOT_VERIFIED") {
        setErrorMsg2(message);
        setNeedsVerification(true);

        if (userInput.includes("@")) {
          setPendingEmail(userInput.trim().toLowerCase());
        } else {
          setPendingEmail("");
        }

        return;
      }

      setNeedsVerification(false);
      setPendingEmail("");
      toastApiError(err, t("login.loginFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="inputInfo-container container">
      <div>
        <section className="info-container">
          <h2 className="text-2xl my-3">{t("login.infoHeading")}</h2>
          <div>
            <h3 className="font-medium text-xl">{t("login.infoListHeading")}</h3>
            <hr className="mb-2" />
            <ul>
              {infoListItems.map((list) => (
                <li className="list-disc ml-4 text-lg" key={list}>
                  {list}
                </li>
              ))}
            </ul>
            <Link to="/points-and-ranking" className="mt-4 inline-block font-semibold text-[var(--text2)] underline underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4">
              {t("rankingGuide.link")} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </div>

      <div className="input-container">
        <h2 className="input-heading">{t("login.inputHeading")}</h2>

        <form onSubmit={handleSubmit}>
          <Input
            id="userInput"
            label={t("login.userInputLabel")}
            value={userInput}
            errorMsg={errorMsg1}
            placeholder={t("login.userInputPlaceholder")}
            required
            inputValid={input1Valid}
            onChange={(e) => {
              const value = e.target.value;
              setUserInput(value);

              setNeedsVerification(false);
              setPendingEmail("");

              const validationKey = userInputValidator(value);
              setInput1Valid(!validationKey);
              setErrorMsg1(validationKey ? t(validationKey) : "");
            }}
          />

          <div>
            <div className="flex items-center gap-2.5 text-lg font-semibold md:text-2xl my-1">
              <label htmlFor="password" className="text-[var(--text1)]">
                {t("login.passwordLabel")}
              </label>
              <Button
                type="button"
                aria-label={
                  showPassword ?
                    t("login.hidePassword", "Hide password")
                  : t("login.showPassword", "Show password")
                }
                label={
                  showPassword ?
                    t("login.hidePassword", "Hide password")
                  : t("login.showPassword", "Show password")
                }
                size="zero"
                className="bg-transparent"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ?
                  <FaEye size={20} className="text-[var(--text1)]" />
                : <FaEyeSlash size={20} className="text-[var(--text1)]" />}
              </Button>
            </div>
            <div className={`flex flex-col ${errorMsg2 ? "-mb-1.5" : "mb-3"}`}>
              <div className="relative flex items-center -mt-0.5">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPassword(value);

                    setNeedsVerification(false);

                    const validationKey = loginPasswordValidator(value);
                    setInput2Valid(!validationKey);
                    setErrorMsg2(validationKey ? t(validationKey) : "");
                  }}
                  placeholder={t("login.passwordPlaceholder")}
                  required
                  className={`bg-[var(--bg)] text-[var(--text1)] font-semibold rounded-full w-full text-lg md:text-xl px-3 py-0.5 pr-13
                    outline-none border
                    placeholder:text-[0.7rem]
                    md:placeholder:text-[1rem]
                    ${input2Valid === false && password?.trim().length ? "border-[var(--error)]" : "border-transparent"}`}
                />
                {input2Valid === true && password?.trim().length ?
                  <FaRegCheckCircle
                    size={22}
                    className="absolute right-2 text-[var(--success)]"
                    aria-hidden
                  />
                : null}
                {input2Valid === false && password?.trim().length ?
                  <RxCrossCircled size={22} className="absolute right-2 text-[var(--error)]" aria-hidden />
                : null}
              </div>
              {errorMsg2 && password?.trim().length ?
                <p className="text-[0.9rem] text-[var(--error)] mb-2" role="alert">
                  {errorMsg2}
                </p>
              : null}
            </div>
          </div>

          <Button
            type="submit"
            variant="tertiary"
            className="w-full mt-7"
            label={t("login.button")}
            disabled={invalidForm || isSubmitting}
          >
            {isSubmitting ? t("common.loading") : t("login.button")}
          </Button>

          <div className="text-center flex flex-col">
            <Link to="/register" className="text-[var(--text1)] mt-3">
              {t("login.goToRegister")} <span className="font-bold">{t("login.link")}</span>
            </Link>
            <Link to="/forgotPassword" className="text-[var(--text1)] mt-3">
              {t("login.forgotPassword")} <span className="font-bold">{t("login.link2")}</span>
            </Link>
            {needsVerification && (
              <Link
                to={`/resend-verification${pendingEmail ? `?email=${encodeURIComponent(pendingEmail)}` : ""}`}
                className="text-[var(--text1)] mt-3 underline font-semibold"
              >
                {t("login.resendVerificationLink", "Resend verification email")}
              </Link>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
