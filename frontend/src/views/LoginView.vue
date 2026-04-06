<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/user";

const router = useRouter();
const store = useUserStore();

const isRegister = ref(false);
const username = ref("");
const email = ref("");
const password = ref("");
const errorMsg = ref("");

async function handleSubmit() {
  errorMsg.value = "";
  const result = isRegister.value
    ? await store.register(username.value, email.value, password.value)
    : await store.login(username.value, password.value);

  if (result.success) {
    router.push("/");
  } else {
    errorMsg.value = result.error;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <svg class="w-10 h-10 text-emerald-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 class="text-xl font-bold text-white">{{ isRegister ? "Criar conta" : "Time Tracker" }}</h1>
        <p class="text-sm text-gray-500 mt-1">{{ isRegister ? "Preencha os dados" : "Faça login para continuar" }}</p>
      </div>

      <form @submit.prevent="handleSubmit" class="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label for="username" class="block text-xs text-gray-500 uppercase tracking-wide mb-1">Usuário</label>
          <input
            id="username" v-model="username" type="text" required
            placeholder="seu usuario"
            class="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div v-if="isRegister">
          <label for="email" class="block text-xs text-gray-500 uppercase tracking-wide mb-1">Email</label>
          <input
            id="email" v-model="email" type="email" required
            placeholder="seu@email.com"
            class="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label for="password" class="block text-xs text-gray-500 uppercase tracking-wide mb-1">Senha</label>
          <input
            id="password" v-model="password" type="password" required
            placeholder="••••••••"
            class="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div v-if="errorMsg" class="text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-4 py-2">
          {{ errorMsg }}
        </div>

        <button
          type="submit" :disabled="store.loading"
          class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {{ isRegister ? "Criar conta" : "Entrar" }}
        </button>

        <p class="text-center text-sm text-gray-500">
          {{ isRegister ? "Já tem conta?" : "Não tem conta?" }}
          <button type="button" class="text-emerald-400 hover:underline" @click="isRegister = !isRegister">
            {{ isRegister ? "Fazer login" : "Criar conta" }}
          </button>
        </p>
      </form>
    </div>
  </div>
</template>
