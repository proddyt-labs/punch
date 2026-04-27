<script setup lang="ts">
import { ref, onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useUserStore } from "./stores/user";
import { usePWA } from "./composables/usePWA";
import { api } from "./lib/api";

const store = useUserStore();
const route = useRoute();
const { isInstallable, isInstalled, isIOS, install } = usePWA();
const isAdmin = ref(false);

onMounted(async () => {
  if (localStorage.getItem("auth_token")) {
    await store.fetchMe();
    try {
      await api.get("/admin/check");
      isAdmin.value = true;
    } catch {
      isAdmin.value = false;
    }
  }
});

function handleLogout() {
  store.logout();
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <nav
      v-if="store.isLoggedIn && route.meta.bare !== true"
      class="sticky top-0 z-50 px-4 sm:px-6 py-3"
      style="background: rgba(4,6,13,0.92); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid rgba(34,211,238,0.08);"
    >
      <div class="max-w-5xl mx-auto flex items-center gap-2 sm:gap-3">
        <!-- Home (desktop only) -->
        <a href="https://proddyt.site"
          class="hidden sm:flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0"
          style="border: 1px solid rgba(31,111,235,0.25); color: rgba(96,165,250,0.7);"
          onmouseover="this.style.background='rgba(31,111,235,0.08)';this.style.color='rgba(96,165,250,1)'"
          onmouseout="this.style.background='';this.style.color='rgba(96,165,250,0.7)'"
        >
          <span>&lt;·&gt;</span><span>home</span>
        </a>
        <div class="hidden sm:block w-px h-4 flex-shrink-0" style="background: rgba(255,255,255,0.08)" />

        <!-- Brand -->
        <RouterLink to="/" class="flex items-center gap-1.5 no-underline flex-shrink-0">
          <span class="font-mono text-sm font-medium" style="color: var(--pu-primary)">[·]</span>
          <span class="hidden sm:inline font-mono text-xs" style="color: var(--pu-muted)">punch</span>
        </RouterLink>

        <!-- Nav links -->
        <div class="flex items-center gap-0.5 sm:gap-1 flex-1">
          <RouterLink to="/"
            class="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap"
            :style="$route.name === 'dashboard'
              ? 'color: #22D3EE; background: rgba(34,211,238,0.08);'
              : 'color: #64748b;'"
          >Dashboard</RouterLink>
          <RouterLink to="/history"
            class="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap"
            :style="$route.name === 'history'
              ? 'color: #22D3EE; background: rgba(34,211,238,0.08);'
              : 'color: #64748b;'"
          >Histórico</RouterLink>
          <RouterLink to="/report"
            class="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap"
            :style="$route.name === 'report'
              ? 'color: #22D3EE; background: rgba(34,211,238,0.08);'
              : 'color: #64748b;'"
          >Relatório</RouterLink>
          <!-- Admin link (só aparece para admins) -->
          <RouterLink v-if="isAdmin" to="/admin"
            class="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap"
            :style="$route.name === 'admin'
              ? 'color: #f87171; background: rgba(248,113,113,0.08);'
              : 'color: #64748b;'"
          >Admin</RouterLink>
        </div>

        <!-- User area -->
        <div class="flex items-center gap-2 sm:gap-3">
          <span class="hidden sm:inline text-xs font-mono" style="color: var(--pu-muted)">{{ store.displayName }}</span>

          <!-- Install button — só ícone -->
          <button v-if="isInstallable && !isInstalled" @click="install"
            title="Instalar app"
            class="p-1.5 rounded-lg transition-colors"
            style="color: rgba(34,211,238,0.5); border: 1px solid rgba(34,211,238,0.15);"
            onmouseover="this.style.color='#22D3EE';this.style.borderColor='rgba(34,211,238,0.35)'"
            onmouseout="this.style.color='rgba(34,211,238,0.5)';this.style.borderColor='rgba(34,211,238,0.15)'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>
          <span v-else-if="isIOS && !isInstalled"
            class="hidden sm:inline text-xs font-mono cursor-help"
            style="color: #334155"
            title="Compartilhar → Adicionar à Tela de Início"
          >iOS</span>

          <!-- Logout -->
          <button @click="handleLogout"
            class="font-mono text-xs transition-colors"
            style="color: rgba(248,113,113,0.5);"
            onmouseover="this.style.color='rgba(248,113,113,1)'"
            onmouseout="this.style.color='rgba(248,113,113,0.5)'"
          >sair</button>
        </div>
      </div>
    </nav>

    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
