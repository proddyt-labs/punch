<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { api } from "../lib/api";

interface OverviewData {
  today: string;
  lastClockIn: { id: string; timestamp: string } | null;
  lastClockOut: { id: string; timestamp: string } | null;
  clockInCount: number;
  clockOutCount: number;
  workedHours: number | null;
}

interface Stats {
  todayHours: string;
  todayEntries: number;
  todayExits: number;
  lastIn: string | null;
  lastOut: string | null;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

function toLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalTimeInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

const stats = ref<Stats>({
  todayHours: "0h 0min",
  todayEntries: 0,
  todayExits: 0,
  lastIn: null,
  lastOut: null,
});

const selectedDate = ref(toLocalDateInput(new Date()));
const launchTime = ref(toLocalTimeInput(new Date()));
const toast = ref<ToastState | null>(null);
const isLoading = ref(false);
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

const selectedDateLabel = computed(() => {
  const [year, month, day] = selectedDate.value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
});

function showToast(message: string, type: ToastState["type"] = "success") {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.value = { message, type };
  toastTimeout = setTimeout(() => { toast.value = null; }, 3000);
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function buildLaunchTimestamp(): string | null {
  const [year, month, day] = selectedDate.value.split("-").map(Number);
  const [hours, minutes] = launchTime.value.split(":").map(Number);
  if ([year, month, day, hours, minutes].some((value) => Number.isNaN(value))) return null;
  const launchDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (launchDate.getFullYear() !== year || launchDate.getMonth() !== month - 1 || launchDate.getDate() !== day) return null;
  return launchDate.toISOString();
}

function goToToday() {
  const now = new Date();
  selectedDate.value = toLocalDateInput(now);
  launchTime.value = toLocalTimeInput(now);
  void fetchOverview();
}

async function fetchOverview() {
  try {
    const { data } = await api.get<OverviewData>("/dashboard/overview", { params: { date: selectedDate.value } });
    stats.value.todayEntries = data.clockInCount;
    stats.value.todayExits = data.clockOutCount;
    stats.value.lastIn = data.lastClockIn ? formatTime(data.lastClockIn.timestamp) : null;
    stats.value.lastOut = data.lastClockOut ? formatTime(data.lastClockOut.timestamp) : null;
    if (data.workedHours !== null && data.workedHours > 0) {
      const hours = Math.floor(data.workedHours);
      const minutes = Math.floor((data.workedHours - hours) * 60);
      stats.value.todayHours = `${hours}h ${String(minutes).padStart(2, "0")}min`;
    } else if (data.clockInCount === 0 && data.clockOutCount === 0) {
      stats.value.todayHours = "—";
    } else {
      stats.value.todayHours = "0h 00min";
    }
  } catch (err: any) {
    console.error("Erro ao buscar overview:", err);
  }
}

async function clockIn() {
  const timestamp = buildLaunchTimestamp();
  if (!timestamp) { showToast("Data/hora de lançamento inválida", "error"); return; }
  isLoading.value = true;
  try {
    const { data } = await api.post<{ timestamp: string }>("/attendance/clock-in", { timestamp });
    showToast(`Entrada registrada em ${formatDateTime(data.timestamp)}`, "success");
    await fetchOverview();
  } catch (err: any) {
    showToast(err.response?.data?.error ?? "Erro ao registrar entrada", "error");
  } finally {
    isLoading.value = false;
  }
}

async function clockOut() {
  const timestamp = buildLaunchTimestamp();
  if (!timestamp) { showToast("Data/hora de lançamento inválida", "error"); return; }
  isLoading.value = true;
  try {
    const { data } = await api.post<{ timestamp: string }>("/attendance/clock-out", { timestamp });
    showToast(`Saída registrada em ${formatDateTime(data.timestamp)}`, "success");
    await fetchOverview();
  } catch (err: any) {
    showToast(err.response?.data?.error ?? "Erro ao registrar saída", "error");
  } finally {
    isLoading.value = false;
  }
}

const isToday = computed(() => selectedDate.value === toLocalDateInput(new Date()));

let refreshTimer: ReturnType<typeof setInterval> | null = null;

function startLiveRefresh() {
  stopLiveRefresh();
  if (isToday.value) {
    refreshTimer = setInterval(() => { void fetchOverview(); }, 60000);
  }
}

function stopLiveRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

watch(selectedDate, () => {
  void fetchOverview();
  startLiveRefresh();
});

onMounted(() => {
  void fetchOverview();
  startLiveRefresh();
});

onUnmounted(stopLiveRefresh);
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

    <!-- Toast -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div v-if="toast" class="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium max-w-xs flex items-center gap-2.5 shadow-2xl"
        :style="toast.type === 'success'
          ? 'background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.3); color: #22D3EE;'
          : toast.type === 'error'
          ? 'background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171;'
          : 'background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.3); color: #93c5fd;'"
      >
        <span class="w-1.5 h-1.5 rounded-full flex-shrink-0"
          :style="toast.type === 'success' ? 'background: #22D3EE;' : toast.type === 'error' ? 'background: #f87171;' : 'background: #93c5fd;'"
        ></span>
        {{ toast.message }}
      </div>
    </Transition>

    <!-- Header -->
    <div class="flex items-start justify-between mb-8">
      <div>
        <p class="text-xs font-mono uppercase tracking-widest mb-1" style="color: rgba(34,211,238,0.5)">// registro de ponto</p>
        <h1 class="text-2xl font-semibold leading-tight" style="color: #e2e8f0">{{ selectedDateLabel }}</h1>
      </div>
      <div v-if="isToday" class="flex items-center gap-1.5 mt-1">
        <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: #22D3EE;"></span>
        <span class="text-xs font-mono" style="color: rgba(34,211,238,0.4)">ao vivo</span>
      </div>
    </div>

    <!-- Time selector -->
    <div class="rounded-2xl p-5 mb-6" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
      <div class="flex flex-col md:flex-row gap-4 md:items-end">
        <div class="flex-1">
          <label for="dash-date" class="block text-xs font-mono uppercase tracking-widest mb-2" style="color: #475569">Dia</label>
          <input
            id="dash-date"
            v-model="selectedDate"
            type="date"
            class="w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
            style="background: #04060d; border: 1px solid rgba(34,211,238,0.1); color: #e2e8f0;"
          />
        </div>
        <div class="md:w-44">
          <label for="dash-time" class="block text-xs font-mono uppercase tracking-widest mb-2" style="color: #475569">Hora</label>
          <input
            id="dash-time"
            v-model="launchTime"
            type="time"
            class="w-full rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
            style="background: #04060d; border: 1px solid rgba(34,211,238,0.1); color: #e2e8f0;"
          />
        </div>
        <button
          @click="goToToday"
          class="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
          style="background: rgba(34,211,238,0.07); border: 1px solid rgba(34,211,238,0.15); color: rgba(34,211,238,0.7);"
          onmouseover="this.style.background='rgba(34,211,238,0.13)';this.style.color='#22D3EE'"
          onmouseout="this.style.background='rgba(34,211,238,0.07)';this.style.color='rgba(34,211,238,0.7)'"
        >
          Hoje
        </button>
      </div>
      <p class="text-xs font-mono mt-3" style="color: #334155">
        lançamento: {{ selectedDate }} às {{ launchTime }}
      </p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <!-- Horas — destaque com accent -->
      <div class="rounded-2xl p-5" style="background: #080c14; border-top: 1px solid rgba(34,211,238,0.08); border-right: 1px solid rgba(34,211,238,0.08); border-bottom: 1px solid rgba(34,211,238,0.08); border-left: 2px solid rgba(34,211,238,0.35);">
        <p class="text-xs font-mono uppercase tracking-widest mb-2" style="color: #475569">Horas</p>
        <p class="text-xl font-bold font-mono"
          :style="stats.todayHours === '—' ? 'color: #1e293b' : 'color: #22D3EE'"
        >{{ stats.todayHours }}</p>
      </div>
      <!-- Última entrada -->
      <div class="rounded-2xl p-5" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
        <p class="text-xs font-mono uppercase tracking-widest mb-2" style="color: #475569">Entrada</p>
        <p class="text-xl font-bold font-mono" style="color: #e2e8f0">{{ stats.lastIn ?? '--:--' }}</p>
      </div>
      <!-- Última saída -->
      <div class="rounded-2xl p-5" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
        <p class="text-xs font-mono uppercase tracking-widest mb-2" style="color: #475569">Saída</p>
        <p class="text-xl font-bold font-mono" style="color: #e2e8f0">{{ stats.lastOut ?? '--:--' }}</p>
      </div>
      <!-- Total -->
      <div class="rounded-2xl p-5" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
        <p class="text-xs font-mono uppercase tracking-widest mb-2" style="color: #475569">Batidas</p>
        <p class="text-xl font-bold font-mono" style="color: #e2e8f0">{{ stats.todayEntries + stats.todayExits }}</p>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-col sm:flex-row gap-3">
      <button
        @click="clockIn"
        :disabled="isLoading"
        class="flex-1 py-5 px-8 rounded-2xl text-base font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 group"
        style="background: rgba(34,211,238,0.09); border: 1px solid rgba(34,211,238,0.22); color: #22D3EE;"
        onmouseover="if(!this.disabled){this.style.background='rgba(34,211,238,0.18)';this.style.borderColor='rgba(34,211,238,0.4)'}"
        onmouseout="this.style.background='rgba(34,211,238,0.09)';this.style.borderColor='rgba(34,211,238,0.22)'"
      >
        <svg class="w-5 h-5 transition-transform group-hover:-translate-y-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>
        Entrada
      </button>

      <button
        @click="clockOut"
        :disabled="isLoading"
        class="flex-1 py-5 px-8 rounded-2xl text-base font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 group"
        style="background: rgba(249,115,22,0.09); border: 1px solid rgba(249,115,22,0.22); color: #f97316;"
        onmouseover="if(!this.disabled){this.style.background='rgba(249,115,22,0.18)';this.style.borderColor='rgba(249,115,22,0.4)'}"
        onmouseout="this.style.background='rgba(249,115,22,0.09)';this.style.borderColor='rgba(249,115,22,0.22)'"
      >
        <svg class="w-5 h-5 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
        </svg>
        Saída
      </button>
    </div>

  </div>
</template>
