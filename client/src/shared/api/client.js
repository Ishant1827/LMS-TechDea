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

    const isNetwork = err.code === "ERR_NETWORK" || err.code === "ECONNABORTED";
    const status = err.response?.status ?? 0;
    // Prefer the server's own wording. Failing that, say something a person can
    // act on — axios's "Request failed with status code 500" is not that, and
    // it used to be shown verbatim (it is what a dead upstream behind the dev
    // proxy produces).
    const msg =
      err.response?.data?.message ||
      (isNetwork
        ? "Can't reach the server"
        : status >= 500
        ? "The server had a problem. Try again in a moment."
        : err.message) ||
      "Something went wrong";

    // Carry the status through. Callers that only read `.message` are
    // unaffected, but a page can now tell "this course doesn't exist" (404)
    // apart from "we couldn't ask" (0) instead of guessing.
    const error = new Error(msg);
    error.status = status;
    // Some refusals are a state the UI can act on rather than just text to
    // show — EMAIL_NOT_VERIFIED being the first. Matching on `code` keeps the
    // wording free to change without breaking the branch that reads it.
    error.code = err.response?.data?.code;
    error.isNetwork = isNetwork;
    error.ref = err.response?.data?.ref; // request id, for 500s worth reporting
    return Promise.reject(error);
  }
);

export default api;
