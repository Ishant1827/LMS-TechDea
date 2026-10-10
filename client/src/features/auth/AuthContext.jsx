import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { AUTH_EXPIRED } from "@/shared/api/client";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const TOKEN_KEY = "techdea-token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(null); // couldn't verify the session

  const setToken = (token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  };

  const loadMe = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setBootError(null);
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch (e) {
      // Only the server actually rejecting the token ends the session. A
      // network failure means we couldn't ask — throwing the token away there
      // signed people out (and lost their place) over a momentary blip.
      if (e.status === 401 || e.status === 403) {
        setToken(null);
        setUser(null);
      } else {
        setBootError(e);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // The token stopped being accepted. Drop the session; ProtectedRoute then
  // sends us to /login and remembers where we were.
  useEffect(() => {
    const onExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener(AUTH_EXPIRED, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED, onExpired);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  // Signs out here at once, then asks the server to revoke the token, so a copy
  // taken before sign-out stops working too (G2). The header is passed by hand
  // because the stored token is already gone; a failure is ignored — the user
  // is signed out on this device either way.
  const logout = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    if (token) {
      api.post("/auth/logout", null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
  };

  const patchUser = (u) => setUser(u);

  // Changing a password ends every other session, including the token this tab
  // is holding. The server issues a replacement in the same response; storing it
  // is what stops the user being signed out of the tab they just used.
  const applyToken = (token) => setToken(token);

  return (
    <AuthCtx.Provider
      value={{ user, loading, bootError, retryBoot: loadMe, refreshUser: loadMe,
               login, register, logout, patchUser, applyToken }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
