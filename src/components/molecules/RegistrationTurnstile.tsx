import { useEffect, useRef, useState } from "react";
import { DEFAULT_SCRIPT_ID, Turnstile } from "@marsidev/react-turnstile";
import { useLanguage } from "../../contexts/LanguageContext";
import Button from "../atoms/Button";

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

export default function RegistrationTurnstile({ onChange }: { onChange: (token: string) => void }) {
  const { language, t } = useLanguage();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [widgetSize, setWidgetSize] = useState<"compact" | "flexible">("compact");
  const container = useRef<HTMLDivElement>(null);
  const loadTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!container.current) return;

    // Flexible widgets cannot shrink below 300px. Measure the space inside the form.
    const observer = new ResizeObserver(([entry]) => {
      setWidgetSize(entry.contentRect.width < 300 ? "compact" : "flexible");
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onChange("");
    // Also handle blocked or stalled script loads, which cannot emit widget callbacks.
    loadTimer.current = window.setTimeout(() => {
      onChange("");
      setFailed(true);
    }, 15_000);

    return () => {
      window.clearTimeout(loadTimer.current);
      onChange("");
    };
  }, [attempt, language, onChange, widgetSize]);

  const fail = () => {
    window.clearTimeout(loadTimer.current);
    onChange("");
    setFailed(true);
  };

  return (
    <div ref={container} className="mt-5 min-w-0 w-full" aria-label={t("register.securityCheck")}>
      {siteKey && (
        <Turnstile
          key={`${language}:${attempt}:${widgetSize}`}
          siteKey={siteKey}
          options={{
            action: "register",
            language: language === "NO" ? "nb" : "en",
            size: widgetSize,
            responseField: false,
            refreshExpired: "auto",
          }}
          onWidgetLoad={() => window.clearTimeout(loadTimer.current)}
          onSuccess={(token) => {
            setFailed(false);
            onChange(token);
          }}
          onExpire={() => onChange("")}
          onError={fail}
          onTimeout={fail}
          onUnsupported={fail}
        />
      )}
      {(!siteKey || failed) && (
        <div role="alert" className="text-sm text-[var(--error)]">
          <p>{t("register.securityUnavailable")}</p>
          {siteKey && (
            <Button type="button" className="mt-2" label={t("register.retrySecurity")}
              onClick={() => {
                onChange("");
                setFailed(false);
                // Let the library inject the script again after a failed load.
                if (!window.turnstile) document.getElementById(DEFAULT_SCRIPT_ID)?.remove();
                setAttempt((value) => value + 1);
              }}>
              {t("register.retrySecurity")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
