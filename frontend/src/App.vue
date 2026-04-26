<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useUserStore } from "./stores/user";
import { usePWA } from "./composables/usePWA";

const store = useUserStore();
const route = useRoute();
const { isInstallable, isInstalled, isIOS, install } = usePWA();

onMounted(() => {
  if (localStorage.getItem("auth_token")) {
    void store.fetchMe();
  }
});

function handleLogout() {
  store.logout();
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <nav v-if="store.isLoggedIn && route.meta.bare !== true" class="bg-gray-900 border-b border-gray-800 px-6 py-4">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <RouterLink to="/" class="flex items-center gap-2 no-underline">
          <span class="font-mono text-lg font-medium" style="color: var(--pu-primary)">[·]</span>
          <span class="font-mono text-sm" style="color: var(--pu-muted)">punch</span>
        </RouterLink>
        <div class="flex items-center gap-6">
          <RouterLink to="/" class="text-sm font-medium transition-colors hover:text-cyan-400" :class="$route.name === 'dashboard' ? 'text-cyan-400' : 'text-gray-400'">
            Dashboard
          </RouterLink>
          <RouterLink to="/history" class="text-sm font-medium transition-colors hover:text-cyan-400" :class="$route.name === 'history' ? 'text-cyan-400' : 'text-gray-400'">
            Histórico
          </RouterLink>
          <a href="https://web.proddyt.site" target="_blank" class="text-sm font-medium text-gray-400 transition-colors hover:text-cyan-400 flex items-center gap-1">
            Projetos
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
          </a>
          <div class="flex items-center gap-3 pl-4 border-l border-gray-700">
            <a href="https://proddyt.site" class="font-mono text-sm border border-blue-900/50 text-blue-400 hover:bg-blue-900/20 px-2 py-1 rounded transition-colors">
              &lt; · &gt;
            </a>
            <span class="text-sm text-gray-400">{{ store.displayName }}</span>
            <button v-if="isInstallable && !isInstalled" @click="install" title="Instalar app" class="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
              Instalar
            </button>
            <span v-else-if="isIOS && !isInstalled" class="text-xs text-slate-500" title="Use Compartilhar > Adicionar à Tela de Início">
              📲 iOS
            </span>
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
