<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../lib/api";

interface AttendanceRecord {
  id: string;
  userId: string;
  type: "CLOCK_IN" | "CLOCK_OUT";
  timestamp: string;
  createdAt: string;
}

function getLast7Days(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

const defaultDates = getLast7Days();
const startDate = ref(defaultDates.start);
const endDate = ref(defaultDates.end);
const records = ref<AttendanceRecord[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function fetchHistory() {
  if (!startDate.value || !endDate.value) return;

  isLoading.value = true;
  error.value = null;

  const params = new URLSearchParams({
    from: startDate.value,
    to: endDate.value + "T23:59:59",
  });

  try {
    const { data } = await api.get<AttendanceRecord[]>(
      `/attendance/history?${params.toString()}`
    );
    records.value = data;
  } catch (err: any) {
    error.value = err.response?.data?.message ?? "Erro ao buscar histórico";
    records.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchHistory);
</script>

<template>
  <div class="max-w-4xl mx-auto px-6 py-10">
    <h1 class="text-2xl font-bold text-white mb-8">Histórico de Registros</h1>

    <!-- Date Filters -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-end gap-4">
        <div class="flex-1 w-full">
          <label for="start-date" class="block text-xs text-gray-500 uppercase tracking-wide mb-1">
            De
          </label>
          <input
            id="start-date"
            v-model="startDate"
            type="date"
            class="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div class="flex-1 w-full">
          <label for="end-date" class="block text-xs text-gray-500 uppercase tracking-wide mb-1">
            Até
          </label>
          <input
            id="end-date"
            v-model="endDate"
            type="date"
            class="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <button
          @click="fetchHistory"
          :disabled="isLoading"
          class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="isLoading">Pesquisando...</span>
          <span v-else>Pesquisar</span>
        </button>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-900/30 border border-red-800 text-red-300 rounded-xl px-5 py-4 mb-6">
      {{ error }}
    </div>

    <!-- Results -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div v-if="records.length === 0 && !isLoading" class="px-6 py-12 text-center">
        <svg class="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <p class="text-gray-500 text-sm">Nenhum registro encontrado neste período.</p>
      </div>

      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-gray-800">
            <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Data</th>
            <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Horário</th>
            <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Tipo</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="record in records"
            :key="record.id"
            class="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors"
          >
            <td class="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
              {{ formatDate(record.timestamp) }}
            </td>
            <td class="px-6 py-4 text-sm text-white font-mono">
              {{ formatTime(record.timestamp) }}
            </td>
            <td class="px-6 py-4">
              <span
                class="inline-flex items-center gap-1.5 text-sm font-medium"
                :class="record.type === 'CLOCK_IN' ? 'text-emerald-400' : 'text-orange-400'"
              >
                <span
                  class="w-2 h-2 rounded-full"
                  :class="record.type === 'CLOCK_IN' ? 'bg-emerald-400' : 'bg-orange-400'"
                ></span>
                {{ record.type === "CLOCK_IN" ? "Entrada" : "Saída" }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
