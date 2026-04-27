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
  <div class="min-h-screen flex items-center justify-center px-4" style="background: #04060d;">
    <div class="w-full max-w-xs">

      <!-- Brand mark -->
      <div class="text-center mb-8">
        <span class="font-mono text-sm font-medium" style="color: #22D3EE">[·]</span>
        <span class="font-mono text-xs ml-1.5" style="color: #334155">punch</span>
      </div>

      <!-- Unauth -->
      <div v-if="state === 'unauth'" class="rounded-2xl p-8 text-center" style="background: #080c14; border: 1px solid rgba(239,68,68,0.12);">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15);">
          <svg class="w-7 h-7" style="color: #f87171" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
          </svg>
        </div>
        <p class="text-xs font-mono uppercase tracking-widest mb-1" style="color: rgba(248,113,113,0.6)">// acesso negado</p>
        <p class="font-semibold mb-1" style="color: #e2e8f0">Sessão expirada</p>
        <p class="text-sm mb-7" style="color: #475569">Faça login para continuar</p>
        <button @click="login"
          class="px-6 py-2.5 rounded-xl text-sm font-medium transition-all w-full"
          style="background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); color: #f87171;"
          onmouseover="this.style.background='rgba(248,113,113,0.14)'"
          onmouseout="this.style.background='rgba(248,113,113,0.08)'"
        >Fazer Login</button>
      </div>

      <!-- Confirm -->
      <div v-else-if="state === 'confirm'" class="rounded-2xl p-8 text-center"
        :style="isClockIn
          ? 'background: #080c14; border: 1px solid rgba(34,211,238,0.1);'
          : 'background: #080c14; border: 1px solid rgba(249,115,22,0.1);'"
      >
        <!-- Icon -->
        <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          :style="isClockIn
            ? 'background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.15);'
            : 'background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.15);'"
        >
          <svg v-if="isClockIn" class="w-8 h-8" style="color: #22D3EE" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12"/>
          </svg>
          <svg v-else class="w-8 h-8" style="color: #f97316" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6"/>
          </svg>
        </div>

        <!-- Label -->
        <p class="text-xs font-mono uppercase tracking-widest mb-4"
          :style="isClockIn ? 'color: rgba(34,211,238,0.5)' : 'color: rgba(249,115,22,0.5)'"
        >// {{ isClockIn ? 'registrar entrada' : 'registrar saída' }}</p>

        <!-- Time -->
        <p class="text-5xl font-bold font-mono tracking-tight mb-1" style="color: #e2e8f0">{{ time }}</p>
        <p class="text-sm font-mono mb-8" style="color: #334155">
          {{ new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) }}
        </p>

        <!-- Actions -->
        <div class="flex gap-3">
          <button @click="router.push('/')"
            class="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); color: #475569;"
            onmouseover="this.style.background='rgba(255,255,255,0.06)';this.style.color='#64748b'"
            onmouseout="this.style.background='rgba(255,255,255,0.03)';this.style.color='#475569'"
          >Cancelar</button>
          <button @click="confirm"
            class="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
            :style="isClockIn
              ? 'background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.25); color: #22D3EE;'
              : 'background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.25); color: #f97316;'"
            :onmouseover="isClockIn
              ? `this.style.background='rgba(34,211,238,0.18)'`
              : `this.style.background='rgba(249,115,22,0.18)'`"
            :onmouseout="isClockIn
              ? `this.style.background='rgba(34,211,238,0.1)'`
              : `this.style.background='rgba(249,115,22,0.1)'`"
          >Confirmar</button>
        </div>
      </div>

      <!-- Loading -->
      <div v-else-if="state === 'loading'" class="rounded-2xl p-10 text-center"
        :style="isClockIn
          ? 'background: #080c14; border: 1px solid rgba(34,211,238,0.08);'
          : 'background: #080c14; border: 1px solid rgba(249,115,22,0.08);'"
      >
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          :style="isClockIn
            ? 'background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.12);'
            : 'background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.12);'"
        >
          <svg class="w-7 h-7 animate-spin"
            :style="isClockIn ? 'color: #22D3EE' : 'color: #f97316'"
            fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </div>
        <p class="text-sm font-mono" style="color: #334155">Registrando...</p>
      </div>

      <!-- Success -->
      <div v-else-if="state === 'success'" class="rounded-2xl p-10 text-center" style="background: #080c14; border: 1px solid rgba(34,211,238,0.1);">
        <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style="background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.2);">
          <svg class="w-8 h-8" style="color: #22D3EE" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
          </svg>
        </div>
        <p class="text-xs font-mono uppercase tracking-widest mb-3" style="color: rgba(34,211,238,0.5)">// registrado</p>
        <p class="font-semibold" style="color: #e2e8f0">{{ isClockIn ? 'Entrada registrada!' : 'Saída registrada!' }}</p>
        <p class="text-sm font-mono mt-1" style="color: #334155">Voltando...</p>
      </div>

      <!-- Error -->
      <div v-else-if="state === 'error'" class="rounded-2xl p-8 text-center" style="background: #080c14; border: 1px solid rgba(239,68,68,0.12);">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15);">
          <svg class="w-7 h-7" style="color: #f87171" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <p class="text-xs font-mono uppercase tracking-widest mb-3" style="color: rgba(248,113,113,0.5)">// erro</p>
        <p class="font-semibold mb-1" style="color: #e2e8f0">Erro ao registrar</p>
        <p class="text-sm mb-6" style="color: #475569">{{ errorMsg }}</p>
        <button @click="state = 'confirm'"
          class="px-5 py-2.5 rounded-xl text-sm transition-all w-full"
          style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #64748b;"
          onmouseover="this.style.background='rgba(255,255,255,0.07)';this.style.color='#94a3b8'"
          onmouseout="this.style.background='rgba(255,255,255,0.04)';this.style.color='#64748b'"
        >Tentar novamente</button>
      </div>

    </div>
  </div>
</template>
