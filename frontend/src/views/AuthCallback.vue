<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="text-center space-y-3 max-w-md">
      <div v-if="!error" class="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-sm" :class="error ? 'text-red-400' : 'text-gray-500'">
        {{ error || "Autenticando..." }}
      </p>
      <button v-if="error" @click="retry" class="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-sm">
        Tentar novamente
      </button>
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

function retry() {
  error.value = "";
  store.login();
}

onMounted(async () => {
  const code = route.query.code as string | undefined;
  if (!code) {
    if (store.isLoggedIn) router.replace("/");
    else store.login();
    return;
  }
  try {
    await store.handleCallback(code);
    router.replace("/");
  } catch (err: any) {
    error.value = err?.response?.data?.error ?? "Erro ao autenticar. Tente novamente.";
    // Não redireciona automaticamente — evita loop infinito
  }
});
</script>
