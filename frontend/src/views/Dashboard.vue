<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
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

const stats = ref<Stats>({
  todayHours: "0h 0min",
  todayEntries: 0,
  todayExits: 0,
  lastIn: null,
  lastOut: null,
});

const toast = ref<ToastState | null>(null);
const isLoading = ref(false);
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, type: ToastState["type"] = "success") {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.value = { message, type };
  toastTimeout = setTimeout(() => {
    toast.value = null;
  }, 3000);
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function calculateHours(inTime: string, outTime: string): string {
  const diff = new Date(outTime).getTime() - new Date(inTime).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${minutes}min`;
}

async function fetchOverview() {
  try {
    const { data } = await api.get<OverviewData>("/dashboard/overview");

    stats.value.todayEntries = data.clockInCount;
    stats.value.todayExits = data.clockOutCount;

    if (data.lastClockIn) {
      stats.value.lastIn = formatTime(data.lastClockIn.timestamp);
    } else {
      stats.value.lastIn = null;
    }

    if (data.lastClockOut) {
      stats.value.lastOut = formatTime(data.lastClockOut.timestamp);
    } else {
      stats.value.lastOut = null;
    }

    if (data.workedHours !== null && data.workedHours > 0) {
      const hours = Math.floor(data.workedHours);
      const minutes = Math.floor((data.workedHours - hours) * 60);
      stats.value.todayHours = `${hours}h ${minutes}min`;
    } else {
      stats.value.todayHours = "0h 0min";
    }
  } catch (err: any) {
    console.error("Erro ao buscar overview:", err);
  }
}

async function clockIn() {
  isLoading.value = true;
  try {
    const { data } = await api.post<{ timestamp: string }>("/attendance/clock-in");
    const time = formatTime(data.timestamp);
    showToast(`Entrada registrada às ${time}`, "success");
    await fetchOverview();
  } catch (err: any) {
    showToast(err.response?.data?.error ?? "Erro ao registrar entrada", "error");
  } finally {
    isLoading.value = false;
  }
}

async function clockOut() {
  isLoading.value = true;
  try {
    const { data } = await api.post<{ timestamp: string }>("/attendance/clock-out");
    const time = formatTime(data.timestamp);
    showToast(`Saída registrada às ${time}`, "success");
    await fetchOverview();
  } catch (err: any) {
    showToast(err.response?.data?.error ?? "Erro ao registrar saída", "error");
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchOverview);
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-10">
    <!-- Toast -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 -translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-4"
    >
      <div
        v-if="toast"
        class="fixed top-20 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium max-w-xs"
        :class="
          toast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : toast.type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-blue-600 text-white'
        "
      >
        {{ toast.message }}
      </div>
    </Transition>

    <!-- Header -->
    <h1 class="text-2xl font-bold text-white mb-8">
      {{ new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) }}
    </h1>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Horas Hoje</p>
        <p class="text-2xl font-bold text-emerald-400">{{ stats.todayHours }}</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Últ. Entrada</p>
        <p class="text-2xl font-bold text-white">{{ stats.lastIn ?? "--:--" }}</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Últ. Saída</p>
        <p class="text-2xl font-bold text-white">{{ stats.lastOut ?? "--:--" }}</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Registros Hoje</p>
        <p class="text-2xl font-bold text-white">{{ stats.todayEntries + stats.todayExits }}</p>
      </div>
    </div>

    <!-- Clock Buttons -->
    <div class="flex flex-col sm:flex-row gap-4">
      <button
        @click="clockIn"
        :disabled="isLoading"
        class="flex-1 py-5 px-8 rounded-xl text-lg font-semibold transition-all duration-200 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-900/30"
      >
        <span class="flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
          Entrada
        </span>
      </button>

      <button
        @click="clockOut"
        :disabled="isLoading"
        class="flex-1 py-5 px-8 rounded-xl text-lg font-semibold transition-all duration-200 bg-orange-600 hover:bg-orange-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-orange-900/30"
      >
        <span class="flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          </svg>
          Saída
        </span>
      </button>
    </div>
  </div>
</template>
