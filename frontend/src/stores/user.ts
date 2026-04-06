import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "../lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
}

export const useUserStore = defineStore("user", () => {
  const user = ref<User | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isLoggedIn = computed(() => user.value !== null);
  const displayName = computed(() => user.value?.name ?? "Usuário");

  async function fetchUser() {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.get<{ user: User }>("/auth/me");
      user.value = data.user;
    } catch (err: any) {
      error.value = err.response?.data?.message ?? "Erro ao buscar usuário";
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  function clearUser() {
    user.value = null;
  }

  return { user, loading, error, isLoggedIn, displayName, fetchUser, clearUser };
});
