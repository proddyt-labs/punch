import axios from "axios";
import { buildAuthorizeUrl } from "../stores/user";

export const api = axios.create({
  baseURL: import.meta.env.DEV ? "/time-tracker/api" : "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = buildAuthorizeUrl();
    }
    return Promise.reject(err);
  }
);
