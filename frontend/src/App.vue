<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from "vue-router";
import { useUserStore } from "./stores/user";

const router = useRouter();
const store = useUserStore();

function handleLogout() {
  store.logout();
  router.push("/login");
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <nav v-if="store.isLoggedIn" class="bg-gray-900 border-b border-gray-800 px-6 py-4">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <RouterLink to="/" class="text-xl font-bold text-white flex items-center gap-2">
          <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Time Tracker
        </RouterLink>
        <div class="flex items-center gap-6">
          <RouterLink to="/" class="text-sm font-medium transition-colors hover:text-emerald-400" :class="$route.name === 'dashboard' ? 'text-emerald-400' : 'text-gray-400'">
            Dashboard
          </RouterLink>
          <RouterLink to="/history" class="text-sm font-medium transition-colors hover:text-emerald-400" :class="$route.name === 'history' ? 'text-emerald-400' : 'text-gray-400'">
            Histórico
          </RouterLink>
          <div class="flex items-center gap-3 pl-4 border-l border-gray-700">
            <span class="text-sm text-gray-400">{{ store.displayName }}</span>
            <button @click="handleLogout" class="text-sm text-red-400 hover:text-red-300 transition-colors">
              Sair
            </button>
          </div>
        </div>
      </div>
    </nav>

    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
