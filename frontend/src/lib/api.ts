import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.DEV ? "/time-tracker/api" : "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — auto-logout (dev: redirect to login, prod: refresh to trigger Auth redirect)
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("auth_token");
      if (import.meta.env.DEV) {
        window.location.href = "/time-tracker/login";
      } else {
        window.location.reload();
      }
    }
    return Promise.reject(err);
  }
);
