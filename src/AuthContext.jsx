// src/AuthContext.jsx
import React from "react";

const AuthContext = React.createContext(null);
export function useAuth() { return React.useContext(AuthContext); }

export function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  // beim Laden: Session prüfen
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          setUser(data?.user ?? null);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(identifier, password) {
    const username = String(identifier ?? "").trim();
    if (!username || !password) {
      return { ok: false, error: "fehlende_credentials" };
    }

    let res;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
    } catch (err) {
      throw err;
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok || !data?.user) {
      return { ok: false, error: data?.error || "invalid_credentials" };
    }

    setUser(data.user);
    return { ok: true, user: data.user };
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
    }
  }

  const value = React.useMemo(() => ({ user, loading, login, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
