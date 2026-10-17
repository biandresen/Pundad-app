import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getPublicModerationTerms } from "../lib/axiosModeration";

type ModerationContextType = {
  terms: string[];
  loading: boolean;
  loaded: boolean;
  reloadTerms: () => Promise<void>;
};

const ModerationContext = createContext<ModerationContextType | undefined>(undefined);

type ModerationProviderProps = {
  children: ReactNode;
};

export const ModerationProvider = ({ children }: ModerationProviderProps) => {
  const [terms, setTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadTerms = useCallback(async () => {
    try {
      setLoading(true);

      const fetchedTerms = await getPublicModerationTerms();
      setTerms(Array.isArray(fetchedTerms) ? fetchedTerms : []);
      setLoaded(true);
    } catch {
      setTerms([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  const value = useMemo(
    () => ({
      terms,
      loading,
      loaded,
      reloadTerms: loadTerms,
    }),
    [terms, loading, loaded, loadTerms]
  );

  return (
    <ModerationContext.Provider value={value}>
      {children}
    </ModerationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- Context hooks share their provider module.
export const useModeration = () => {
  const context = useContext(ModerationContext);

  if (!context) {
    throw new Error("useModeration must be used within a ModerationProvider");
  }

  return context;
};