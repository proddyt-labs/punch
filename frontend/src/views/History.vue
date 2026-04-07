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
const deletingId = ref<string | null>(null);
const editingId = ref<string | null>(null);
const editingTimestamp = ref<string>("");
const deleteConfirmId = ref<string | null>(null);

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

function toLocalDatetimeLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

async function startEdit(record: AttendanceRecord) {
  editingId.value = record.id;
  editingTimestamp.value = toLocalDatetimeLocal(new Date(record.timestamp));
}

async function saveEdit() {
  if (!editingId.value || !editingTimestamp.value) return;
  try {
    const { data } = await api.patch<AttendanceRecord>(
      `/attendance/records/${editingId.value}`,
      { timestamp: editingTimestamp.value },
    );
    const idx = records.value.findIndex((r) => r.id === editingId.value);
    if (idx !== -1) records.value[idx] = data;
    editingId.value = null;
    editingTimestamp.value = "";
  } catch (err: any) {
    error.value = err.response?.data?.error ?? "Erro ao editar registro";
  }
}

function cancelEdit() {
  editingId.value = null;
  editingTimestamp.value = "";
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

async function deleteRecord(id: string) {
  if (deleteConfirmId.value !== id) {
    deleteConfirmId.value = id;
    return;
  }

  // Confirm second click
  deleteConfirmId.value = null;
  deletingId.value = id;
  try {
    await api.delete(`/attendance/records/${id}`);
    records.value = records.value.filter((r) => r.id !== id);
  } catch (err: any) {
    error.value = err.response?.data?.error ?? "Erro ao excluir registro";
  } finally {
    deletingId.value = null;
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
            <th class="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="record in records" :key="record.id">
            <!-- Edit mode -->
            <tr v-if="editingId === record.id" class="border-b border-gray-800/50 bg-gray-800/30">
              <td class="px-6 py-3" colspan="4">
                <div class="flex items-center gap-4">
                  <input
                    v-model="editingTimestamp"
                    type="datetime-local"
                    class="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <button @click="saveEdit" class="px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                    Salvar
                  </button>
                  <button @click="cancelEdit" class="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                    Cancelar
                  </button>
                </div>
              </td>
            </tr>
            <!-- View mode -->
            <tr
              v-else
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
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-3">
                  <button
                    @click="startEdit(record)"
                    class="text-gray-600 hover:text-blue-400 transition-colors text-sm"
                    title="Editar registro"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>
                  <button
                    @click="deleteRecord(record.id)"
                    :disabled="deletingId === record.id"
                    class="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50 text-sm"
                    :title="deleteConfirmId === record.id ? 'Clique novamente para confirmar' : 'Excluir registro'"
                  >
                    <svg v-if="deletingId === record.id" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <svg v-else-if="deleteConfirmId === record.id" class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
