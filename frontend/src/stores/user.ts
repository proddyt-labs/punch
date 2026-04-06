import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "../lib/api";

export interface User {
  id: string;
  username: string;
  name: string | null;
  email: string;
}

export const useUserStore = defineStore("user", () => {
  const user = ref<User | null>(null);
  const loading = ref(false);

  const isLoggedIn = computed(() => user.value !== null);
  const displayName = computed(() => user.value?.name ?? user.value?.username ?? "Usuário");

  function getToken(): string | null {
    return localStorage.getItem("auth_token");
  }

  function setToken(token: string) {
    localStorage.setItem("auth_token", token);
  }

  function clearToken() {
    localStorage.removeItem("auth_token");
  }

  async function login(username: string, password: string) {
    loading.value = true;
    try {
      const { data } = await api.post<{ token: string; user: User }>("/auth/login", { username, password });
      setToken(data.token);
      user.value = data.user;
      return { success: true } as const;
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error ?? "Erro ao fazer login" } as const;
    } finally {
      loading.value = false;
    }
  }

  async function register(username: string, email: string, password: string) {
    loading.value = true;
    try {
      const { data } = await api.post<{ token: string; user: User }>("/auth/register", {
        username,
        email,
        password,
      });
      setToken(data.token);
      user.value = data.user;
      return { success: true } as const;
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error ?? "Erro ao criar conta" } as const;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMe() {
    const token = getToken();
    if (!token) return;
    try {
      const { data } = await api.get<{ user: User }>("/auth/me");
      user.value = data.user;
    } catch {
      clearToken();
      user.value = null;
    }
  }

  function logout() {
    clearToken();
    user.value = null;
  }

  return { user, loading, isLoggedIn, displayName, token: getToken(), login, logout, fetchMe };
});
