import React, { createContext, useContext, useState } from "react";
import { type token, type AuthContextType } from "../types/context.types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<token | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <AuthContext.Provider
      value={{ accessToken, setAccessToken, isAuthenticated, setIsAuthenticated, loading, setLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- Context hooks share their provider module.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
