import { useEffect, useRef, useState } from "react";
import { DEFAULT_SCRIPT_ID, Turnstile } from "@marsidev/react-turnstile";
import { useLanguage } from "../../contexts/LanguageContext";
import Button from "../atoms/Button";

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

export default function RegistrationTurnstile({ onChange }: { onChange: (token: string) => void }) {
  const { language, t } = useLanguage();
  const [widgetFailed, setWidgetFailed] = useState(false);
  const [retryGeneration, setRetryGeneration] = useState(0);
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
      setWidgetFailed(true);
    }, 15_000);

    return () => {
      window.clearTimeout(loadTimer.current);
      onChange("");
    };
  }, [retryGeneration, language, onChange, widgetSize]);

  const handleWidgetFailure = () => {
    window.clearTimeout(loadTimer.current);
    onChange("");
    setWidgetFailed(true);
  };

  return (
    <div ref={container} className="mt-5 min-w-0 w-full" aria-label={t("register.securityCheck")}>
      {siteKey && (
        <Turnstile
          key={`${language}:${retryGeneration}:${widgetSize}`}
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
            setWidgetFailed(false);
            onChange(token);
          }}
          onExpire={() => onChange("")}
          onError={handleWidgetFailure}
          onTimeout={handleWidgetFailure}
          onUnsupported={handleWidgetFailure}
        />
      )}
      {(!siteKey || widgetFailed) && (
        <div role="alert" className="text-sm text-[var(--error)]">
          <p>{t("register.securityUnavailable")}</p>
          {siteKey && (
            <Button type="button" className="mt-2" label={t("register.retrySecurity")}
              onClick={() => {
                onChange("");
                setWidgetFailed(false);
                // Let the library inject the script again after a failed load.
                if (!window.turnstile) document.getElementById(DEFAULT_SCRIPT_ID)?.remove();
                setRetryGeneration((value) => value + 1);
              }}>
              {t("register.retrySecurity")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
