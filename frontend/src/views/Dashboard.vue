<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
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

function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildLaunchTimestamp(): string | null {
  const [year, month, day] = selectedDate.value.split("-").map(Number);
  const [hours, minutes] = launchTime.value.split(":").map(Number);

  if ([year, month, day, hours, minutes].some((value) => Number.isNaN(value))) {
    return null;
  }

  const launchDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    launchDate.getFullYear() !== year ||
    launchDate.getMonth() !== month - 1 ||
    launchDate.getDate() !== day
  ) {
    return null;
  }

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
    const { data } = await api.get<OverviewData>("/dashboard/overview", {
      params: { date: selectedDate.value },
    });

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
  const timestamp = buildLaunchTimestamp();
  if (!timestamp) {
    showToast("Data/hora de lançamento inválida", "error");
    return;
  }

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
  if (!timestamp) {
    showToast("Data/hora de lançamento inválida", "error");
    return;
  }

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

watch(selectedDate, () => {
  void fetchOverview();
});

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
    <h1 class="text-2xl font-bold text-white mb-6">
      {{ selectedDateLabel }}
    </h1>

    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
      <div class="flex flex-col md:flex-row gap-4 md:items-end">
        <div class="flex-1">
          <label for="dash-date" class="block text-xs text-gray-500 uppercase tracking-wide mb-1">Dia</label>
          <input
            id="dash-date"
            v-model="selectedDate"
            type="date"
            class="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div class="md:w-48">
          <label for="dash-time" class="block text-xs text-gray-500 uppercase tracking-wide mb-1">Hora do Lançamento</label>
          <input
            id="dash-time"
            v-model="launchTime"
            type="time"
            class="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          @click="goToToday"
          class="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-lg transition-colors"
        >
          Ir Para Hoje
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-3">
        Os botões de lançamento vão registrar no dia {{ selectedDate }} às {{ launchTime }}.
      </p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Horas no Dia</p>
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
        <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Registros no Dia</p>
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
