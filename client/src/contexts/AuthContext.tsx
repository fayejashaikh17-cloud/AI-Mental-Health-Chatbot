import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type AuthUser = { id: number; username: string } | null;

type AuthContextValue = {
  user: AuthUser;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser({ id: data.id, username: data.username });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = "Login failed. Please try again.";
      try {
        const data = JSON.parse(text);
        if (data && typeof data.error === "string") msg = data.error;
      } catch {
        if (text) msg = text;
      }
      throw new Error(msg);
    }
    const data = JSON.parse(text);
    setUser({ id: data.id, username: data.username });
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = "Registration failed. Please try again.";
      try {
        const data = JSON.parse(text);
        if (data && typeof data.error === "string") msg = data.error;
      } catch {
        if (text) msg = text;
      }
      throw new Error(msg);
    }
    const data = JSON.parse(text);
    setUser({ id: data.id, username: data.username });
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  const value: AuthContextValue = { user, loading, login, register, logout, refetch };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
