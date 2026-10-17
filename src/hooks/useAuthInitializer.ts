import { useEffect } from "react";
import { refreshAccessToken, safeRequest } from "../lib/auth";
import { getMe } from "../lib/axios";
import { useAuth } from "../contexts/AuthContext";
import { useUser } from "../contexts/UserContext";

export const useAuthInitializer = () => {
  const { setAccessToken, setIsAuthenticated, setLoading } = useAuth();
  const { setUser } = useUser();

 useEffect(() => {
    const init = async () => {
      try {
        const token = await refreshAccessToken(setAccessToken);

        if (!token) {
          setIsAuthenticated(false);
          setUser(null);
          return;
        }

        setIsAuthenticated(true);

        // Canonical: fetch user from DB
        const meRes = await safeRequest(getMe, token, setAccessToken);
        setUser(meRes.data);
      } catch {
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [setAccessToken, setIsAuthenticated, setLoading, setUser]);
};
