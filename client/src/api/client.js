import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("techdea-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Surface a clean Error(message) to callers.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err.response?.data?.message ||
      (err.code === "ERR_NETWORK" ? "Can't reach the server" : err.message) ||
      "Something went wrong";
    return Promise.reject(new Error(msg));
  }
);

export default api;
