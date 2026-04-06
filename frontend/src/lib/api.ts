import axios from "axios";

export const api = axios.create({
  baseURL: "/time-tracker/api",
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

// Handle 401 — auto-logout
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = "/time-tracker/login";
    }
    return Promise.reject(err);
  }
);
