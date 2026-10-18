import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import Button from "../../components/atoms/Button";
import { getMe, verifyEmail } from "../../lib/axios";
import { useLanguage } from "../../contexts/LanguageContext";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useAuth } from "../../contexts/AuthContext";
import { useUser } from "../../contexts/UserContext";
import { safeRequest } from "../../lib/auth";

const VerifyEmail = () => {
  const { t } = useLanguage();
  const { token } = useParams<{ token: string }>();

  const { accessToken, setAccessToken, setIsAuthenticated } = useAuth();
  const { setUser } = useUser();

  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const run = async () => {
      if (!token) {
        setErrorMessage(t("verifyEmail.missingToken", "Missing verification token"));
        setLoading(false);
        return;
      }

      try {
        const res = await verifyEmail(token);

        if (res.statusCode !== 200) {
          throw new Error(res.message || t("verifyEmail.failed", "Email verification failed"));
        }

        // Refresh user if logged in
        if (accessToken) {
          try {
            const me = await safeRequest(getMe, accessToken, setAccessToken);

            if (me?.data) {
              setUser(me.data);
            }
          } catch (err: any) {
            if (err?.code === "SESSION_EXPIRED") {
              setAccessToken(null);
              setUser(null);
              setIsAuthenticated(false);
            } else {
              console.error("Failed to refresh user:", err);
            }
          }
        }

        setVerified(true);
        toast.success(t("verifyEmail.success"));
      } catch (err: any) {
        const message = getApiErrorMessage(err, t("verifyEmail.failed"));
        setErrorMessage(message);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [token, t, accessToken, setAccessToken, setIsAuthenticated, setUser]);

  // Determine correct redirect
  const redirectPath = accessToken ? "/dashboard/profile" : "/login";

  return (
    <div className="container py-8">
      <div className="single-container max-w-100 mx-auto text-center text-[var(--text1)]">
        <h1 className="text-2xl font-bold mb-4">{t("verifyEmail.heading")}</h1>

        {loading && <p>{t("common.loading")}</p>}

        {!loading && verified && (
          <div className="space-y-4">
            <p>{t("verifyEmail.success")}</p>

            <Button
              variant="tertiary"
              onClick={() => navigate(redirectPath)}
              label={accessToken ? t("verifyEmail.goToProfile") : t("verifyEmail.goToLogin")}
            >
              {accessToken ? t("verifyEmail.goToProfile") : t("verifyEmail.goToLogin")}
            </Button>
          </div>
        )}

        {!loading && !verified && (
          <div className="space-y-4">
            <p>{errorMessage}</p>

            <Link to="/resend-verification">
              <Button variant="tertiary" label={t("verifyEmail.resend")}>
                {t("verifyEmail.resend")}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
