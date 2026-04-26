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
    <nav v-if="store.isLoggedIn && route.meta.bare !== true" class="bg-gray-900 border-b border-gray-800 px-6 py-3">
      <div class="max-w-5xl mx-auto flex items-center gap-4">
        <!-- Home -->
        <a href="https://proddyt.site" class="flex items-center gap-1.5 font-mono text-xs border border-blue-900/40 text-blue-400 hover:bg-blue-900/20 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0">
          <span>&lt;·&gt;</span><span>Home</span>
        </a>
        <div class="w-px h-4 bg-gray-700 flex-shrink-0" />
        <!-- Brand -->
        <RouterLink to="/" class="flex items-center gap-2 no-underline flex-shrink-0">
          <span class="font-mono text-base font-medium" style="color: var(--pu-primary)">[·]</span>
          <span class="font-mono text-sm" style="color: var(--pu-muted)">punch</span>
        </RouterLink>
        <!-- Nav links -->
        <div class="flex items-center gap-5 flex-1">
          <RouterLink to="/" class="text-sm font-medium transition-colors hover:text-cyan-400" :class="$route.name === 'dashboard' ? 'text-cyan-400' : 'text-gray-400'">Dashboard</RouterLink>
          <RouterLink to="/history" class="text-sm font-medium transition-colors hover:text-cyan-400" :class="$route.name === 'history' ? 'text-cyan-400' : 'text-gray-400'">Histórico</RouterLink>
        </div>
        <!-- User -->
        <div class="flex items-center gap-3 text-sm">
          <span class="text-gray-400">{{ store.displayName }}</span>
          <button v-if="isInstallable && !isInstalled" @click="install" class="text-cyan-400 hover:text-cyan-300 transition-colors">Instalar</button>
          <span v-else-if="isIOS && !isInstalled" class="text-xs text-slate-500" title="Use Compartilhar > Adicionar à Tela de Início">iOS</span>
          <button @click="handleLogout" class="text-red-400 hover:text-red-300 transition-colors">Sair</button>
        </div>
      </div>
    </nav>

    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
