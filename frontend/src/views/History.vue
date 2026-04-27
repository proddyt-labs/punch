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

// ── Import CSV ──────────────────────────────────────────
interface ParsedRow {
  type: "CLOCK_IN" | "CLOCK_OUT";
  timestamp: string; // ISO
  displayDate: string;
  displayTime: string;
  displayType: string;
}

const importPreview = ref<ParsedRow[]>([]);
const importError   = ref<string | null>(null);
const isImporting   = ref(false);
const showImport    = ref(false);

function parseCsvRow(line: string): ParsedRow | null {
  const cols = line.split(",");
  if (cols.length < 3) return null;
  const [dateStr, timeStr, typeStr] = cols.map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  // Data: DD/MM/YYYY
  const dateParts = dateStr.split("/");
  if (dateParts.length !== 3) return null;
  const [day, month, year] = dateParts.map(Number);
  // Hora: HH:MM:SS ou HH:MM
  const timeParts = timeStr.split(":");
  if (timeParts.length < 2) return null;
  const [hour, minute, second = 0] = timeParts.map(Number);
  if ([day, month, year, hour, minute].some(isNaN)) return null;
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (isNaN(date.getTime())) return null;
  const lc = typeStr.toLowerCase();
  const type = lc === "entrada" ? "CLOCK_IN" : lc === "saída" || lc === "saida" ? "CLOCK_OUT" : null;
  if (!type) return null;
  return {
    type,
    timestamp: date.toISOString(),
    displayDate: dateStr,
    displayTime: timeStr,
    displayType: typeStr,
  };
}

function onFileChange(event: Event) {
  importError.value = null;
  importPreview.value = [];
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    importError.value = "Selecione um arquivo .csv";
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    let text = (e.target?.result as string) ?? "";
    // Remove BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    // Skip header if present
    const startLine = lines[0]?.toLowerCase().includes("data") ? 1 : 0;
    const rows: ParsedRow[] = [];
    for (let i = startLine; i < lines.length; i++) {
      const row = parseCsvRow(lines[i]);
      if (!row) { importError.value = `Linha ${i + 1} inválida: "${lines[i]}"`; importPreview.value = []; return; }
      rows.push(row);
    }
    if (rows.length === 0) { importError.value = "Nenhum registro encontrado no arquivo"; return; }
    if (rows.length > 500) { importError.value = "Máximo de 500 registros por importação"; return; }
    importPreview.value = rows;
    showImport.value = true;
  };
  reader.readAsText(file, "utf-8");
}

function closeImport() {
  showImport.value = false;
  importPreview.value = [];
  importError.value = null;
  // Reset file input
  const input = document.getElementById("csv-import-input") as HTMLInputElement;
  if (input) input.value = "";
}

async function confirmImport() {
  if (!importPreview.value.length) return;
  isImporting.value = true;
  try {
    const { data } = await api.post<{ imported: number }>("/attendance/import", {
      records: importPreview.value.map((r) => ({ type: r.type, timestamp: r.timestamp })),
    });
    closeImport();
    error.value = null;
    await fetchHistory();
    // show brief success via error slot (green)
    error.value = `✓ ${data.imported} registros importados com sucesso`;
    setTimeout(() => { error.value = null; }, 4000);
  } catch (err: any) {
    importError.value = err.response?.data?.error ?? "Erro ao importar";
  } finally {
    isImporting.value = false;
  }
}

function exportCSV() {
  const header = "Data,Horário,Tipo\n";
  const rows = records.value
    .map(
      (r) =>
        `${formatDate(r.timestamp)},${formatTime(r.timestamp)},${r.type === "CLOCK_IN" ? "Entrada" : "Saída"}`
    )
    .join("\n");
  const blob = new Blob(["﻿" + header + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `registros-${startDate.value}-${endDate.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

    <!-- Header -->
    <div class="flex items-start justify-between mb-6 sm:mb-8">
      <div>
        <p class="text-xs font-mono uppercase tracking-widest mb-1" style="color: rgba(34,211,238,0.5)">// histórico</p>
        <h1 class="text-2xl font-semibold" style="color: #e2e8f0">Registros de Ponto</h1>
      </div>
      <div class="flex items-center gap-2 mt-1">
        <!-- Import CSV -->
        <label
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer"
          style="background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.15); color: rgba(34,211,238,0.6);"
          onmouseover="this.style.background='rgba(34,211,238,0.12)';this.style.color='#22D3EE'"
          onmouseout="this.style.background='rgba(34,211,238,0.06)';this.style.color='rgba(34,211,238,0.6)'"
          title="Importar CSV"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 4l4-4m0 0l4 4m-4-4v12"/>
          </svg>
          <span class="hidden sm:inline">Importar</span>
          <input id="csv-import-input" type="file" accept=".csv" class="hidden" @change="onFileChange" />
        </label>
        <!-- Export CSV -->
        <button
          v-if="records.length > 0"
          @click="exportCSV"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono transition-all"
          style="background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.15); color: rgba(34,211,238,0.6);"
          onmouseover="this.style.background='rgba(34,211,238,0.12)';this.style.color='#22D3EE'"
          onmouseout="this.style.background='rgba(34,211,238,0.06)';this.style.color='rgba(34,211,238,0.6)'"
          title="Exportar CSV"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          <span class="hidden sm:inline">Exportar</span>
        </button>
      </div>
    </div>

    <!-- Date Filters -->
    <div class="rounded-2xl p-4 sm:p-5 mb-5" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
      <div class="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4">
        <div class="flex-1 w-full">
          <label for="start-date" class="block text-xs font-mono uppercase tracking-widest mb-2" style="color: #475569">De</label>
          <input id="start-date" v-model="startDate" type="date"
            class="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            style="background: #04060d; border: 1px solid rgba(34,211,238,0.1); color: #e2e8f0;"
          />
        </div>
        <div class="flex-1 w-full">
          <label for="end-date" class="block text-xs font-mono uppercase tracking-widest mb-2" style="color: #475569">Até</label>
          <input id="end-date" v-model="endDate" type="date"
            class="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            style="background: #04060d; border: 1px solid rgba(34,211,238,0.1); color: #e2e8f0;"
          />
        </div>
        <button @click="fetchHistory" :disabled="isLoading"
          class="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style="background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.25); color: #22D3EE;"
          onmouseover="if(!this.disabled)this.style.background='rgba(34,211,238,0.18)'"
          onmouseout="this.style.background='rgba(34,211,238,0.1)'"
        >
          <span v-if="isLoading">Pesquisando…</span>
          <span v-else>Pesquisar</span>
        </button>
      </div>
    </div>

    <!-- Error / Success message -->
    <div v-if="error" class="rounded-xl px-5 py-4 mb-5 text-sm"
      :style="error.startsWith('✓')
        ? 'background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.2); color: #22D3EE;'
        : 'background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171;'"
    >
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-if="records.length === 0 && !isLoading" class="rounded-2xl px-6 py-16 text-center" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
      <div class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background: rgba(34,211,238,0.05); border: 1px solid rgba(34,211,238,0.1);">
        <svg class="w-6 h-6" style="color: rgba(34,211,238,0.3)" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </div>
      <p class="text-sm font-mono" style="color: #334155">Nenhum registro neste período.</p>
    </div>

    <template v-else>
      <!-- ── MOBILE cards (hidden sm+) ── -->
      <div class="sm:hidden rounded-2xl overflow-hidden" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
        <template v-for="record in records" :key="record.id + '-m'">
          <!-- Edit mode mobile -->
          <div v-if="editingId === record.id" class="px-4 py-4" style="border-bottom: 1px solid rgba(34,211,238,0.05); background: rgba(34,211,238,0.02);">
            <input v-model="editingTimestamp" type="datetime-local"
              class="w-full rounded-xl px-3 py-2 text-sm outline-none mb-3"
              style="background: #04060d; border: 1px solid rgba(34,211,238,0.2); color: #e2e8f0;"
            />
            <div class="flex gap-2">
              <button @click="saveEdit" class="flex-1 py-2 text-sm font-medium rounded-xl" style="background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.25); color: #22D3EE;">Salvar</button>
              <button @click="cancelEdit" class="flex-1 py-2 text-sm rounded-xl" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #64748b;">Cancelar</button>
            </div>
          </div>
          <!-- View mode mobile -->
          <div v-else class="px-4 py-4 flex items-center justify-between gap-3" style="border-bottom: 1px solid rgba(34,211,238,0.05);">
            <div class="flex items-center gap-3 min-w-0">
              <!-- Type dot -->
              <span class="w-2 h-2 rounded-full flex-shrink-0"
                :style="record.type === 'CLOCK_IN' ? 'background: #22D3EE;' : 'background: #f97316;'"
              ></span>
              <div class="min-w-0">
                <p class="text-base font-mono font-semibold" style="color: #e2e8f0">{{ formatTime(record.timestamp) }}</p>
                <p class="text-xs font-mono" style="color: #475569">{{ formatDate(record.timestamp) }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
              <span class="text-xs font-mono font-medium"
                :style="record.type === 'CLOCK_IN' ? 'color: #22D3EE' : 'color: #f97316'"
              >{{ record.type === "CLOCK_IN" ? "Entrada" : "Saída" }}</span>
              <button @click="startEdit(record)" class="p-1.5 rounded-lg" style="color: #334155;"
                onmouseover="this.style.color='rgba(34,211,238,0.7)'" onmouseout="this.style.color='#334155'">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                </svg>
              </button>
              <button @click="deleteRecord(record.id)" :disabled="deletingId === record.id"
                class="p-1.5 rounded-lg disabled:opacity-40"
                :style="deleteConfirmId === record.id ? 'color: #f87171;' : 'color: #334155;'"
                onmouseover="if(!this.disabled)this.style.color='#f87171'" onmouseout="if(this.getAttribute('data-confirm')!=='1')this.style.color='#334155'"
              >
                <svg v-if="deletingId === record.id" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                <svg v-else-if="deleteConfirmId === record.id" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                </svg>
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- ── DESKTOP table (hidden below sm) ── -->
      <div class="hidden sm:block rounded-2xl overflow-hidden" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
        <table class="w-full">
          <thead>
            <tr style="border-bottom: 1px solid rgba(34,211,238,0.08);">
              <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Data</th>
              <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Horário</th>
              <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Tipo</th>
              <th class="text-right text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Ações</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="record in records" :key="record.id">
              <!-- Edit mode -->
              <tr v-if="editingId === record.id" style="border-bottom: 1px solid rgba(34,211,238,0.05); background: rgba(34,211,238,0.03);">
                <td class="px-6 py-3" colspan="4">
                  <div class="flex items-center gap-3 flex-wrap">
                    <input v-model="editingTimestamp" type="datetime-local"
                      class="rounded-xl px-3 py-2 text-sm outline-none"
                      style="background: #04060d; border: 1px solid rgba(34,211,238,0.2); color: #e2e8f0;"
                    />
                    <button @click="saveEdit"
                      class="px-4 py-2 text-sm font-medium rounded-xl transition-all"
                      style="background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.25); color: #22D3EE;"
                    >Salvar</button>
                    <button @click="cancelEdit"
                      class="px-4 py-2 text-sm rounded-xl transition-all"
                      style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #64748b;"
                    >Cancelar</button>
                  </div>
                </td>
              </tr>
              <!-- View mode -->
              <tr v-else class="transition-colors" style="border-bottom: 1px solid rgba(34,211,238,0.05);"
                onmouseover="this.style.background='rgba(34,211,238,0.03)'"
                onmouseout="this.style.background=''"
              >
                <td class="px-6 py-4 text-sm font-mono whitespace-nowrap" style="color: #64748b">
                  {{ formatDate(record.timestamp) }}
                </td>
                <td class="px-6 py-4 text-sm font-mono font-medium" style="color: #e2e8f0">
                  {{ formatTime(record.timestamp) }}
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center gap-1.5 text-xs font-mono font-medium px-2.5 py-1 rounded-full"
                    :style="record.type === 'CLOCK_IN'
                      ? 'background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.2); color: #22D3EE;'
                      : 'background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.2); color: #f97316;'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full"
                      :style="record.type === 'CLOCK_IN' ? 'background: #22D3EE;' : 'background: #f97316;'"
                    ></span>
                    {{ record.type === "CLOCK_IN" ? "Entrada" : "Saída" }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-3">
                    <button @click="startEdit(record)" title="Editar" class="transition-colors p-1 rounded-lg"
                      style="color: #334155;"
                      onmouseover="this.style.color='rgba(34,211,238,0.7)'"
                      onmouseout="this.style.color='#334155'"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button @click="deleteRecord(record.id)" :disabled="deletingId === record.id"
                      :title="deleteConfirmId === record.id ? 'Clique novamente para confirmar' : 'Excluir'"
                      class="transition-colors p-1 rounded-lg disabled:opacity-40"
                      :style="deleteConfirmId === record.id ? 'color: #f87171;' : 'color: #334155;'"
                      onmouseover="if(!this.disabled)this.style.color='#f87171'"
                      onmouseout="if(this.getAttribute('data-confirm')!=='1')this.style.color='#334155'"
                    >
                      <svg v-if="deletingId === record.id" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <svg v-else-if="deleteConfirmId === record.id" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
    </template>
  </div>

  <!-- ── Import CSV Modal ── -->
  <Teleport to="body">
    <div v-if="showImport" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style="background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);">
      <div class="w-full sm:max-w-lg rounded-2xl overflow-hidden"
        style="background: #080c14; border: 1px solid rgba(34,211,238,0.12);">
        <!-- Modal header -->
        <div class="px-5 py-4 flex items-center justify-between" style="border-bottom: 1px solid rgba(34,211,238,0.06);">
          <div>
            <p class="text-xs font-mono uppercase tracking-widest" style="color: rgba(34,211,238,0.4)">// importar</p>
            <p class="text-sm font-medium mt-0.5" style="color: #e2e8f0">{{ importPreview.length }} registros encontrados</p>
          </div>
          <button @click="closeImport" class="p-1.5 rounded-lg transition-colors" style="color: #475569;"
            onmouseover="this.style.color='#e2e8f0'" onmouseout="this.style.color='#475569'">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Error -->
        <div v-if="importError" class="mx-5 mt-4 px-4 py-3 rounded-xl text-xs font-mono" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171;">
          {{ importError }}
        </div>

        <!-- Preview table -->
        <div class="max-h-64 overflow-y-auto mx-5 my-4 rounded-xl" style="border: 1px solid rgba(34,211,238,0.08);">
          <table class="w-full text-xs font-mono">
            <thead>
              <tr style="border-bottom: 1px solid rgba(34,211,238,0.08); background: rgba(34,211,238,0.03);">
                <th class="text-left px-3 py-2" style="color: #334155">Data</th>
                <th class="text-left px-3 py-2" style="color: #334155">Horário</th>
                <th class="text-left px-3 py-2" style="color: #334155">Tipo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in importPreview.slice(0, 20)" :key="i" style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                <td class="px-3 py-2" style="color: #64748b">{{ row.displayDate }}</td>
                <td class="px-3 py-2" style="color: #e2e8f0">{{ row.displayTime }}</td>
                <td class="px-3 py-2">
                  <span :style="row.type === 'CLOCK_IN' ? 'color: #22D3EE' : 'color: #f97316'">
                    {{ row.type === "CLOCK_IN" ? "Entrada" : "Saída" }}
                  </span>
                </td>
              </tr>
              <tr v-if="importPreview.length > 20">
                <td colspan="3" class="px-3 py-2 text-center" style="color: #334155">
                  + {{ importPreview.length - 20 }} registros não exibidos
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Actions -->
        <div class="px-5 pb-5 flex gap-3">
          <button @click="closeImport"
            class="flex-1 py-2.5 rounded-xl text-sm transition-all"
            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #64748b;"
          >Cancelar</button>
          <button @click="confirmImport" :disabled="isImporting"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            style="background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.25); color: #22D3EE;"
            onmouseover="if(!this.disabled)this.style.background='rgba(34,211,238,0.18)'"
            onmouseout="this.style.background='rgba(34,211,238,0.1)'"
          >
            {{ isImporting ? "Importando…" : `Confirmar (${importPreview.length})` }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
