import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import type { AppLanguage } from "../../i18n/translations";
import { normalizeLanguage } from "../../lib/utils";

function readQueryLanguage(search: string): AppLanguage | null {
  const params = new URLSearchParams(search);
  const raw = params.get("lang");

  if (!raw) return null;

  return normalizeLanguage(raw);
}

type LanguageRouteGateProps = {
  children: React.ReactNode;
};

const LanguageRouteGate = ({ children }: LanguageRouteGateProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();

  const queryLanguage = useMemo(() => {
    return readQueryLanguage(location.search);
  }, [location.search]);

  const shouldAddQueryLanguage = !queryLanguage;
  const shouldSyncLanguage = Boolean(queryLanguage) && queryLanguage !== language;

  useEffect(() => {
    if (shouldSyncLanguage && queryLanguage) {
      setLanguage(queryLanguage);
      return;
    }

    if (shouldAddQueryLanguage) {
      const params = new URLSearchParams(location.search);
      params.set("lang", language.toLowerCase());

      navigate(
        {
          pathname: location.pathname,
          search: `?${params.toString()}`,
          hash: location.hash,
        },
        { replace: true },
      );
    }
  }, [
    shouldSyncLanguage,
    queryLanguage,
    shouldAddQueryLanguage,
    language,
    setLanguage,
    navigate,
    location.pathname,
    location.search,
    location.hash,
  ]);

  // Adding the current language does not change rendered content. Keep editors
  // mounted while replacing the URL so lazy-route recovery can protect edits.
  if (shouldSyncLanguage) {
    return null;
  }

  return <>{children}</>;
};

export default LanguageRouteGate;
