import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { AUTH_EXPIRED } from "@/shared/api/client";
import { clearLoadCache } from "@/shared/hooks/useLoad";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const TOKEN_KEY = "techdea-token";
// The last user /auth/me returned, so a returning visitor gets the app frame
// at once instead of a splash while the server answers. It only decides what
// to draw first: every request is still checked by the server, and the
// background /auth/me below replaces it (or signs out) as soon as it answers.
const USER_KEY = "techdea-user";
// Set at sign-in, read once by WelcomeScreen: { first: boolean }.
export const WELCOME_KEY = "techdea-welcome";

const readCachedUser = () => {
  try {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};
const cacheUser = (u) => {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* storage blocked — we just lose the fast start */
  }
};

// Remember that this person has signed in on this device before, so the
// welcome can tell a first visit ("Welcome to TechDea") from a return.
const seenKey = (id) => `techdea-seen-${id}`;
const queueWelcome = (u, { forceFirst = false } = {}) => {
  if (!u || u.mustChangePassword) return; // they get the password screen first
  try {
    const first = forceFirst || !localStorage.getItem(seenKey(u._id));
    localStorage.setItem(seenKey(u._id), "1");
    sessionStorage.setItem(WELCOME_KEY, JSON.stringify({ first }));
  } catch {
    /* no storage, no welcome — harmless */
  }
};

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(readCachedUser);
  // only block on the boot check when there's nothing remembered to draw
  const [loading, setLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY) && !readCachedUser());
  const [bootError, setBootError] = useState(null); // couldn't verify the session

  const setUser = useCallback((u) => {
    // a different person (or nobody) — drop every remembered page
    setUserState((prev) => {
      if (!u || !prev || String(prev._id) !== String(u._id)) clearLoadCache();
      return u;
    });
    cacheUser(u);
  }, []);

  const setToken = (token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  };

  const loadMe = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    const remembered = !!readCachedUser();
    if (!remembered) setLoading(true);
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
      } else if (!remembered) {
        // with a remembered user the app is already usable; each page shows
        // its own error if the server stays unreachable
        setBootError(e);
      }
    } finally {
      setLoading(false);
    }
  }, [setUser]);

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
    queueWelcome(data.user);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setToken(data.token);
    queueWelcome(data.user, { forceFirst: true });
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
