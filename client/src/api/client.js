import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

// Broadcast when the server stops accepting our token, so AuthContext can drop
// the session without the api layer having to know about React.
export const AUTH_EXPIRED = "auth:expired";

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("techdea-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Surface a clean Error(message) to callers.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // A 401 from the sign-in endpoints just means wrong credentials. Anywhere
    // else it means the token is no longer good — expired, or the account was
    // deactivated mid-session — and without this the user is stranded in a
    // shell where every request fails and nothing leads back to /login.
    const url = err.config?.url || "";
    const isSignIn = /\/auth\/(login|register)$/.test(url);
    if (err.response?.status === 401 && !isSignIn) {
      window.dispatchEvent(new Event(AUTH_EXPIRED));
    }

    const msg =
      err.response?.data?.message ||
      (err.code === "ERR_NETWORK" ? "Can't reach the server" : err.message) ||
      "Something went wrong";
    return Promise.reject(new Error(msg));
  }
);

export default api;
