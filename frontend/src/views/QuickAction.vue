<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../lib/api";
import { buildAuthorizeUrl } from "../stores/user";

const route = useRoute();
const router = useRouter();
const type = route.params.type as string;
const isClockIn = type === "clock-in";
const state = ref<"confirm"|"loading"|"success"|"error"|"unauth">("confirm");
const errorMsg = ref("");
const time = ref("");

function getNow() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

onMounted(() => {
  time.value = getNow();
  if (!localStorage.getItem("auth_token")) state.value = "unauth";
});

async function confirm() {
  state.value = "loading";
  try {
    await api.post(`/attendance/${type}`, { timestamp: new Date().toISOString() });
    state.value = "success";
    setTimeout(() => router.push("/"), 2000);
  } catch (e: any) {
    if (e.response?.status === 401) { state.value = "unauth"; return; }
    errorMsg.value = e.response?.data?.error ?? "Erro ao registrar";
    state.value = "error";
  }
}

function login() {
  window.location.href = buildAuthorizeUrl();
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-slate-950">
    <div class="w-full max-w-xs">

      <!-- Unauth -->
      <div v-if="state === 'unauth'" class="text-center">
        <div class="w-16 h-16 rounded-2xl bg-red-900/30 ring-1 ring-red-700/40 flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
        </div>
        <p class="text-white font-semibold mb-1">Sessão expirada</p>
        <p class="text-slate-500 text-sm mb-6">Faça login para continuar</p>
        <button @click="login" class="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors">Fazer Login</button>
      </div>

      <!-- Confirm -->
      <div v-else-if="state === 'confirm'" class="text-center">
        <div class="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-1" :class="isClockIn ? 'bg-violet-600/20 ring-violet-500/40' : 'bg-amber-600/20 ring-amber-500/40'">
          <svg v-if="isClockIn" class="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12"/></svg>
          <svg v-else class="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6"/></svg>
        </div>
        <p class="text-xs uppercase tracking-widest mb-1" :class="isClockIn ? 'text-violet-400' : 'text-amber-400'">{{ isClockIn ? 'Registrar Entrada' : 'Registrar Saída' }}</p>
        <p class="text-5xl font-bold text-white tracking-tight mb-1">{{ time }}</p>
        <p class="text-slate-500 text-sm mb-8">{{ new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) }}</p>
        <div class="flex gap-3">
          <button @click="router.push('/')" class="flex-1 py-3.5 rounded-xl ring-1 ring-slate-700 text-slate-400 hover:bg-slate-800 transition-colors font-medium text-sm">Cancelar</button>
          <button @click="confirm" class="flex-1 py-3.5 rounded-xl font-semibold text-white transition-all active:scale-95 text-sm" :class="isClockIn ? 'bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-900/40' : 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/40'">Confirmar</button>
        </div>
      </div>

      <!-- Loading -->
      <div v-else-if="state === 'loading'" class="text-center">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" :class="isClockIn ? 'bg-violet-600/20' : 'bg-amber-600/20'">
          <svg class="w-7 h-7 animate-spin" :class="isClockIn ? 'text-violet-400' : 'text-amber-400'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </div>
        <p class="text-slate-400">Registrando...</p>
      </div>

      <!-- Success -->
      <div v-else-if="state === 'success'" class="text-center">
        <div class="w-20 h-20 rounded-3xl bg-violet-600/20 ring-1 ring-violet-500/40 flex items-center justify-center mx-auto mb-4">
          <svg class="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        </div>
        <p class="text-white font-semibold text-lg mb-1">{{ isClockIn ? 'Entrada registrada!' : 'Saída registrada!' }}</p>
        <p class="text-slate-500 text-sm">Voltando...</p>
      </div>

      <!-- Error -->
      <div v-else-if="state === 'error'" class="text-center">
        <div class="w-16 h-16 rounded-2xl bg-red-900/30 ring-1 ring-red-700/40 flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </div>
        <p class="text-white font-semibold mb-1">Erro ao registrar</p>
        <p class="text-slate-400 text-sm mb-5">{{ errorMsg }}</p>
        <button @click="state = 'confirm'" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors text-sm">Tentar novamente</button>
      </div>

    </div>
  </div>
</template>
