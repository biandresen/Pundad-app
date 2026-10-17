import { createContext, useContext, useCallback, useMemo, useState } from "react";
import { getAllJokes } from "../lib/axios";
import { type JokeType } from "../types/joke.types";

interface JokesContextType {
  jokes: JokeType[];
  loading: boolean;
  error: string | null;
  refreshJokes: (page?: number, limit?: number) => Promise<void>;
  addJoke: (newJoke: JokeType) => void;
  clearJokes: () => void;
  hasLoaded: boolean;
}

const JokesContext = createContext<JokesContextType | undefined>(undefined);

export const JokesProvider = ({ children }: { children: React.ReactNode }) => {
  const [jokes, setJokes] = useState<JokeType[]>([]);
  const [loading, setLoading] = useState(false); // start false since we won't auto-fetch
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const refreshJokes = useCallback(async (page = 1, limit = 50) => {
    try {
      setLoading(true);
      setError(null);

      const res = await getAllJokes(null, page, limit);
      if (res.statusCode !== 200) throw new Error(res.message);

      setJokes(res.data);
      setHasLoaded(true);
    } catch (err: any) {
      setError(err.message || "Failed to fetch jokes");
    } finally {
      setLoading(false);
    }
  }, []);

  const addJoke = useCallback((newJoke: JokeType) => {
    setJokes((prev) => [newJoke, ...prev]);
  }, []);

  const clearJokes = useCallback(() => {
    setJokes([]);
    setError(null);
    setLoading(false);
    setHasLoaded(false);
  }, []);

  const value = useMemo(
    () => ({ jokes, loading, error, refreshJokes, addJoke, clearJokes, hasLoaded }),
    [jokes, loading, error, refreshJokes, addJoke, clearJokes, hasLoaded]
  );

  return <JokesContext.Provider value={value}>{children}</JokesContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- Context hooks share their provider module.
export const useJokes = () => {
  const context = useContext(JokesContext);
  if (!context) throw new Error("useJokes must be used within a JokesProvider");
  return context;
};
