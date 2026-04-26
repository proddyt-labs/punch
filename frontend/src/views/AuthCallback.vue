<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center space-y-3">
      <div class="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-sm text-gray-500">{{ error || "Autenticando..." }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "../stores/user";

const route = useRoute();
const router = useRouter();
const store = useUserStore();
const error = ref("");

onMounted(async () => {
  const code = route.query.code as string | undefined;
  if (!code) {
    router.replace("/");
    return;
  }
  try {
    await store.handleCallback(code);
    router.replace("/");
  } catch (err: any) {
    error.value = err?.response?.data?.error ?? "Erro ao autenticar. Tente novamente.";
    setTimeout(() => store.login(), 2000);
  }
});
</script>
