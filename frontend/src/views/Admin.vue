<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "../lib/api";

// ── Types ──────────────────────────────────────────────────
interface Group { id: string; name: string; description: string | null; _count?: { users: number } }
interface AdminUser {
  id: string; username: string; name: string | null; email: string;
  isAdmin: boolean; roles: string[]; groupId: string | null;
  group: { id: string; name: string } | null;
}
interface AdminRecord {
  id: string; userId: string; type: "CLOCK_IN" | "CLOCK_OUT";
  timestamp: string; createdAt: string;
  user: { id: string; username: string; name: string | null };
}
interface SummaryEntry {
  user: { id: string; username: string; name: string | null; group: { id: string; name: string } | null };
  totalHours: number; clockIns: number; clockOuts: number;
}

// ── State ──────────────────────────────────────────────────
function getLast7Days() {
  const end = new Date(); const start = new Date();
  start.setDate(start.getDate() - 6);
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
}
const router  = useRouter();
const def     = getLast7Days();
const isAdmin = ref(false); const isChecking = ref(true);
const activeTab = ref<"summary" | "records" | "users" | "groups">("summary");

// Filters
const users        = ref<AdminUser[]>([]);
const groups       = ref<Group[]>([]);
const records      = ref<AdminRecord[]>([]);
const summary      = ref<SummaryEntry[]>([]);
const selectedUser = ref(""); const selectedGroup = ref("");
const startDate    = ref(def.start); const endDate = ref(def.end);
const isLoading    = ref(false); const error = ref<string | null>(null);

// User edit
const editingUser   = ref<AdminUser | null>(null);
const editRoles     = ref<string>("");
const editGroupId   = ref<string>("");
const editIsAdmin   = ref(false);
const savingUser    = ref(false);

// Group create
const newGroupName  = ref(""); const newGroupDesc = ref("");
const creatingGroup = ref(false); const groupError = ref<string | null>(null);

// ── Helpers ────────────────────────────────────────────────
const ROLES = ["manager", "viewer"];

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtHours(h: number) {
  if (h <= 0) return "0h";
  const hrs = Math.floor(h); const min = Math.floor((h - hrs) * 60);
  return min === 0 ? `${hrs}h` : `${hrs}h ${min}min`;
}
function displayName(u: { username: string; name: string | null }) { return u.name ?? u.username; }

// ── Data fetching ─────────────────────────────────────────
async function checkAdmin() {
  try { await api.get("/admin/check"); isAdmin.value = true; }
  catch { router.replace("/"); return; }
  finally { isChecking.value = false; }
}
async function fetchUsers() {
  const { data } = await api.get<AdminUser[]>("/admin/users"); users.value = data;
}
async function fetchGroups() {
  const { data } = await api.get<Group[]>("/admin/groups"); groups.value = data;
}
async function fetchData() {
  isLoading.value = true; error.value = null;
  try {
    const params = new URLSearchParams({ from: startDate.value, to: endDate.value + "T23:59:59" });
    if (selectedUser.value)  params.set("userId", selectedUser.value);
    if (selectedGroup.value) params.set("groupId", selectedGroup.value);
    const [recRes, sumRes] = await Promise.all([
      api.get<AdminRecord[]>(`/admin/attendance?${params}`),
      api.get<SummaryEntry[]>(`/admin/summary?${params}`),
    ]);
    records.value = recRes.data; summary.value = sumRes.data;
  } catch (err: any) {
    error.value = err.response?.data?.error ?? "Erro ao buscar dados";
  } finally { isLoading.value = false; }
}

// ── CSV Export ────────────────────────────────────────────
function exportRecordsCSV() {
  const header = "Usuário,Data,Horário,Tipo\n";
  const rows = records.value.map(r =>
    `${displayName(r.user)},${formatDate(r.timestamp)},${formatTime(r.timestamp)},${r.type === "CLOCK_IN" ? "Entrada" : "Saída"}`
  ).join("\n");
  const blob = new Blob(["﻿" + header + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `admin-registros-${startDate.value}-${endDate.value}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── User management ───────────────────────────────────────
function openEditUser(u: AdminUser) {
  editingUser.value = { ...u };
  editRoles.value   = u.roles.join(", ");
  editGroupId.value = u.groupId ?? "";
  editIsAdmin.value = u.isAdmin;
}
function closeEditUser() { editingUser.value = null; }

async function saveUser() {
  if (!editingUser.value) return;
  savingUser.value = true;
  try {
    const roles = editRoles.value.split(",").map(r => r.trim()).filter(Boolean);
    const payload = {
      isAdmin: editIsAdmin.value,
      roles,
      groupId: editGroupId.value || null,
    };
    const { data } = await api.patch<AdminUser>(`/admin/users/${editingUser.value.id}`, payload);
    const idx = users.value.findIndex(u => u.id === data.id);
    if (idx !== -1) {
      const updatedGroup = groups.value.find(g => g.id === data.groupId) ?? null;
      users.value[idx] = { ...data, group: updatedGroup };
    }
    closeEditUser();
  } catch (err: any) {
    error.value = err.response?.data?.error ?? "Erro ao salvar usuário";
  } finally { savingUser.value = false; }
}

// ── Group management ──────────────────────────────────────
async function createGroup() {
  if (!newGroupName.value.trim()) return;
  creatingGroup.value = true; groupError.value = null;
  try {
    const { data } = await api.post<Group>("/admin/groups", {
      name: newGroupName.value.trim(),
      description: newGroupDesc.value.trim() || null,
    });
    groups.value.push({ ...data, _count: { users: 0 } });
    newGroupName.value = ""; newGroupDesc.value = "";
  } catch (err: any) {
    groupError.value = err.response?.data?.error ?? "Erro ao criar grupo";
  } finally { creatingGroup.value = false; }
}

async function deleteGroup(id: string) {
  try {
    await api.delete(`/admin/groups/${id}`);
    groups.value = groups.value.filter(g => g.id !== id);
    users.value.forEach(u => { if (u.groupId === id) { u.groupId = null; u.group = null; } });
  } catch (err: any) {
    error.value = err.response?.data?.error ?? "Erro ao excluir grupo";
  }
}

// ── Users filter for dropdown ─────────────────────────────
const usersForFilter = computed(() =>
  selectedGroup.value
    ? users.value.filter(u => u.groupId === selectedGroup.value)
    : users.value
);

onMounted(async () => {
  await checkAdmin();
  if (isAdmin.value) {
    await Promise.all([fetchUsers(), fetchGroups()]);
    await fetchData();
  }
});
</script>

<template>
  <div v-if="isChecking" class="flex items-center justify-center min-h-[60vh]">
    <p class="text-sm font-mono" style="color: #334155">Verificando acesso...</p>
  </div>

  <div v-else-if="isAdmin" class="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

    <!-- Header -->
    <div class="mb-6 sm:mb-8">
      <p class="text-xs font-mono uppercase tracking-widest mb-1" style="color: rgba(248,113,113,0.5)">// admin</p>
      <h1 class="text-2xl font-semibold" style="color: #e2e8f0">Painel Administrativo</h1>
    </div>

    <!-- Tabs -->
    <div class="flex gap-0.5 mb-5 overflow-x-auto" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
      <button v-for="tab in [
        { key: 'summary',  label: 'Resumo' },
        { key: 'records',  label: `Registros (${records.length})` },
        { key: 'users',    label: `Usuários (${users.length})` },
        { key: 'groups',   label: `Grupos (${groups.length})` },
      ]" :key="tab.key"
        @click="activeTab = tab.key as typeof activeTab.value"
        class="px-4 py-2 text-xs sm:text-sm font-mono whitespace-nowrap transition-all"
        :style="activeTab === tab.key
          ? 'color: #f87171; border-bottom: 2px solid #f87171; margin-bottom: -1px;'
          : 'color: #475569;'"
      >{{ tab.label }}</button>
    </div>

    <!-- Error -->
    <div v-if="error" class="rounded-xl px-4 py-3 mb-5 text-sm" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171;">
      {{ error }}
    </div>

    <!-- ── SUMMARY + RECORDS: shared filters ── -->
    <template v-if="activeTab === 'summary' || activeTab === 'records'">
      <div class="rounded-2xl p-4 sm:p-5 mb-5" style="background: #080c14; border: 1px solid rgba(248,113,113,0.08);">
        <div class="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
          <div class="sm:w-40">
            <label class="block text-xs font-mono uppercase tracking-widest mb-1.5" style="color: #475569">Grupo</label>
            <select v-model="selectedGroup" class="w-full rounded-xl px-3 py-2 text-sm outline-none" style="background: #04060d; border: 1px solid rgba(248,113,113,0.12); color: #e2e8f0;">
              <option value="">Todos</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
          <div class="sm:w-44">
            <label class="block text-xs font-mono uppercase tracking-widest mb-1.5" style="color: #475569">Usuário</label>
            <select v-model="selectedUser" class="w-full rounded-xl px-3 py-2 text-sm outline-none" style="background: #04060d; border: 1px solid rgba(248,113,113,0.12); color: #e2e8f0;">
              <option value="">Todos</option>
              <option v-for="u in usersForFilter" :key="u.id" :value="u.id">{{ displayName(u) }}</option>
            </select>
          </div>
          <div class="flex-1 min-w-32">
            <label class="block text-xs font-mono uppercase tracking-widest mb-1.5" style="color: #475569">De</label>
            <input v-model="startDate" type="date" class="w-full rounded-xl px-3 py-2 text-sm outline-none" style="background: #04060d; border: 1px solid rgba(248,113,113,0.12); color: #e2e8f0;"/>
          </div>
          <div class="flex-1 min-w-32">
            <label class="block text-xs font-mono uppercase tracking-widest mb-1.5" style="color: #475569">Até</label>
            <input v-model="endDate" type="date" class="w-full rounded-xl px-3 py-2 text-sm outline-none" style="background: #04060d; border: 1px solid rgba(248,113,113,0.12); color: #e2e8f0;"/>
          </div>
          <button @click="fetchData" :disabled="isLoading"
            class="w-full sm:w-auto px-5 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            style="background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.25); color: #f87171;"
            onmouseover="if(!this.disabled)this.style.background='rgba(248,113,113,0.18)'"
            onmouseout="this.style.background='rgba(248,113,113,0.1)'"
          >{{ isLoading ? "Buscando…" : "Pesquisar" }}</button>
        </div>
      </div>

      <!-- SUMMARY tab -->
      <template v-if="activeTab === 'summary'">
        <div v-if="summary.length === 0 && !isLoading" class="rounded-2xl px-6 py-12 text-center" style="background: #080c14; border: 1px solid rgba(255,255,255,0.04);">
          <p class="text-sm font-mono" style="color: #334155">Nenhum dado neste período.</p>
        </div>
        <div v-else class="rounded-2xl overflow-hidden" style="background: #080c14; border: 1px solid rgba(248,113,113,0.08);">
          <div class="sm:hidden divide-y" style="border-color: rgba(255,255,255,0.04);">
            <div v-for="e in summary" :key="e.user.id" class="px-4 py-4">
              <div class="flex items-center justify-between mb-1">
                <div>
                  <span class="text-sm font-medium" style="color: #e2e8f0">{{ displayName(e.user) }}</span>
                  <span v-if="e.user.group" class="ml-2 text-xs font-mono px-1.5 py-0.5 rounded" style="background: rgba(248,113,113,0.08); color: rgba(248,113,113,0.6)">{{ e.user.group.name }}</span>
                </div>
                <span class="text-lg font-mono font-bold" style="color: #f87171">{{ fmtHours(e.totalHours) }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-xs font-mono" style="color: #475569">@{{ e.user.username }}</span>
                <span class="text-xs font-mono" style="color: #334155">{{ e.clockIns }}↑ {{ e.clockOuts }}↓</span>
              </div>
            </div>
          </div>
          <table class="hidden sm:table w-full">
            <thead><tr style="border-bottom: 1px solid rgba(248,113,113,0.08);">
              <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Usuário</th>
              <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Grupo</th>
              <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Horas</th>
              <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Entradas</th>
              <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Saídas</th>
            </tr></thead>
            <tbody>
              <tr v-for="e in summary" :key="e.user.id" style="border-bottom: 1px solid rgba(255,255,255,0.03);"
                onmouseover="this.style.background='rgba(248,113,113,0.02)'" onmouseout="this.style.background=''">
                <td class="px-6 py-3.5">
                  <p class="text-sm font-medium" style="color: #e2e8f0">{{ displayName(e.user) }}</p>
                  <p class="text-xs font-mono" style="color: #334155">@{{ e.user.username }}</p>
                </td>
                <td class="px-6 py-3.5">
                  <span v-if="e.user.group" class="text-xs font-mono px-2 py-0.5 rounded-full" style="background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.15); color: rgba(248,113,113,0.7)">{{ e.user.group.name }}</span>
                  <span v-else class="text-xs font-mono" style="color: #1e293b">—</span>
                </td>
                <td class="px-6 py-3.5 text-sm font-mono font-bold" style="color: #f87171">{{ fmtHours(e.totalHours) }}</td>
                <td class="px-6 py-3.5 text-sm font-mono" style="color: #22D3EE">{{ e.clockIns }}</td>
                <td class="px-6 py-3.5 text-sm font-mono" style="color: #f97316">{{ e.clockOuts }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- RECORDS tab -->
      <template v-else>
        <div v-if="records.length > 0" class="flex justify-end mb-3">
          <button @click="exportRecordsCSV"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono transition-all"
            style="background: rgba(248,113,113,0.06); border: 1px solid rgba(248,113,113,0.15); color: rgba(248,113,113,0.6);"
            onmouseover="this.style.background='rgba(248,113,113,0.12)';this.style.color='#f87171'"
            onmouseout="this.style.background='rgba(248,113,113,0.06)';this.style.color='rgba(248,113,113,0.6)'"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Exportar CSV ({{ records.length }})
          </button>
        </div>
        <div v-if="records.length === 0 && !isLoading" class="rounded-2xl px-6 py-12 text-center" style="background: #080c14; border: 1px solid rgba(255,255,255,0.04);">
          <p class="text-sm font-mono" style="color: #334155">Nenhum registro neste período.</p>
        </div>
        <template v-else>
          <!-- Mobile cards -->
          <div class="sm:hidden rounded-2xl overflow-hidden" style="background: #080c14; border: 1px solid rgba(248,113,113,0.08);">
            <div v-for="r in records" :key="r.id" class="px-4 py-4 flex items-center gap-3" style="border-bottom: 1px solid rgba(255,255,255,0.03);">
              <span class="w-2 h-2 rounded-full flex-shrink-0" :style="r.type === 'CLOCK_IN' ? 'background:#22D3EE' : 'background:#f97316'"></span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-mono font-semibold" style="color: #e2e8f0">{{ formatTime(r.timestamp) }}</p>
                <p class="text-xs font-mono" style="color: #475569">{{ formatDate(r.timestamp) }} · {{ displayName(r.user) }}</p>
              </div>
              <span class="text-xs font-mono" :style="r.type === 'CLOCK_IN' ? 'color:#22D3EE' : 'color:#f97316'">{{ r.type === "CLOCK_IN" ? "Entrada" : "Saída" }}</span>
            </div>
          </div>
          <!-- Desktop table -->
          <div class="hidden sm:block rounded-2xl overflow-hidden" style="background: #080c14; border: 1px solid rgba(248,113,113,0.08);">
            <table class="w-full">
              <thead><tr style="border-bottom: 1px solid rgba(248,113,113,0.08);">
                <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Usuário</th>
                <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Data</th>
                <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Horário</th>
                <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Tipo</th>
              </tr></thead>
              <tbody>
                <tr v-for="r in records" :key="r.id" style="border-bottom: 1px solid rgba(255,255,255,0.03);"
                  onmouseover="this.style.background='rgba(248,113,113,0.02)'" onmouseout="this.style.background=''">
                  <td class="px-6 py-3.5">
                    <p class="text-sm font-medium" style="color: #e2e8f0">{{ displayName(r.user) }}</p>
                    <p class="text-xs font-mono" style="color: #334155">@{{ r.user.username }}</p>
                  </td>
                  <td class="px-6 py-3.5 text-sm font-mono" style="color: #64748b">{{ formatDate(r.timestamp) }}</td>
                  <td class="px-6 py-3.5 text-sm font-mono font-medium" style="color: #e2e8f0">{{ formatTime(r.timestamp) }}</td>
                  <td class="px-6 py-3.5">
                    <span class="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full"
                      :style="r.type === 'CLOCK_IN'
                        ? 'background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.2); color: #22D3EE;'
                        : 'background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.2); color: #f97316;'"
                    >
                      <span class="w-1.5 h-1.5 rounded-full" :style="r.type === 'CLOCK_IN' ? 'background:#22D3EE' : 'background:#f97316'"></span>
                      {{ r.type === "CLOCK_IN" ? "Entrada" : "Saída" }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>
    </template>

    <!-- ── USERS tab ── -->
    <template v-else-if="activeTab === 'users'">
      <div class="rounded-2xl overflow-hidden" style="background: #080c14; border: 1px solid rgba(248,113,113,0.08);">
        <!-- Mobile cards -->
        <div class="sm:hidden divide-y" style="border-color: rgba(255,255,255,0.04);">
          <div v-for="u in users" :key="u.id" class="px-4 py-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-medium" style="color: #e2e8f0">{{ displayName(u) }}</span>
                  <span v-if="u.isAdmin" class="text-xs font-mono px-1.5 py-0.5 rounded" style="background: rgba(248,113,113,0.1); color: #f87171;">admin</span>
                  <span v-for="r in u.roles" :key="r" class="text-xs font-mono px-1.5 py-0.5 rounded" style="background: rgba(34,211,238,0.08); color: rgba(34,211,238,0.6);">{{ r }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-xs font-mono" style="color: #475569">@{{ u.username }}</span>
                  <span v-if="u.group" class="text-xs font-mono" style="color: rgba(248,113,113,0.5)">· {{ u.group.name }}</span>
                </div>
              </div>
              <button @click="openEditUser(u)" class="p-1.5 rounded-lg flex-shrink-0" style="color: #334155; border: 1px solid rgba(255,255,255,0.06);"
                onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='#334155'">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <!-- Desktop table -->
        <table class="hidden sm:table w-full">
          <thead><tr style="border-bottom: 1px solid rgba(248,113,113,0.08);">
            <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Usuário</th>
            <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Grupo</th>
            <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Roles</th>
            <th class="text-left text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Admin</th>
            <th class="text-right text-xs font-mono uppercase tracking-widest px-6 py-3.5" style="color: #334155">Ações</th>
          </tr></thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" style="border-bottom: 1px solid rgba(255,255,255,0.03);"
              onmouseover="this.style.background='rgba(248,113,113,0.02)'" onmouseout="this.style.background=''">
              <td class="px-6 py-3.5">
                <p class="text-sm font-medium" style="color: #e2e8f0">{{ displayName(u) }}</p>
                <p class="text-xs font-mono" style="color: #334155">@{{ u.username }}</p>
              </td>
              <td class="px-6 py-3.5">
                <span v-if="u.group" class="text-xs font-mono px-2 py-0.5 rounded-full" style="background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.15); color: rgba(248,113,113,0.7)">{{ u.group.name }}</span>
                <span v-else class="text-xs font-mono" style="color: #1e293b">—</span>
              </td>
              <td class="px-6 py-3.5">
                <div class="flex gap-1 flex-wrap">
                  <span v-for="r in u.roles" :key="r" class="text-xs font-mono px-1.5 py-0.5 rounded" style="background: rgba(34,211,238,0.08); color: rgba(34,211,238,0.6);">{{ r }}</span>
                  <span v-if="!u.roles.length" class="text-xs font-mono" style="color: #1e293b">—</span>
                </div>
              </td>
              <td class="px-6 py-3.5">
                <span v-if="u.isAdmin" class="text-xs font-mono px-2 py-0.5 rounded-full" style="background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); color: #f87171;">root</span>
                <span v-else class="text-xs font-mono" style="color: #1e293b">—</span>
              </td>
              <td class="px-6 py-3.5 text-right">
                <button @click="openEditUser(u)" class="p-1.5 rounded-lg" style="color: #334155;"
                  onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='#334155'">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ── GROUPS tab ── -->
    <template v-else-if="activeTab === 'groups'">
      <!-- Create group form -->
      <div class="rounded-2xl p-5 mb-5" style="background: #080c14; border: 1px solid rgba(248,113,113,0.08);">
        <p class="text-xs font-mono uppercase tracking-widest mb-4" style="color: rgba(248,113,113,0.4)">// novo grupo</p>
        <div class="flex flex-col sm:flex-row gap-3">
          <input v-model="newGroupName" type="text" placeholder="Nome do grupo"
            class="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
            style="background: #04060d; border: 1px solid rgba(248,113,113,0.12); color: #e2e8f0;"
            @keyup.enter="createGroup"
          />
          <input v-model="newGroupDesc" type="text" placeholder="Descrição (opcional)"
            class="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
            style="background: #04060d; border: 1px solid rgba(248,113,113,0.12); color: #e2e8f0;"
          />
          <button @click="createGroup" :disabled="creatingGroup || !newGroupName.trim()"
            class="px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            style="background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.25); color: #f87171;"
            onmouseover="if(!this.disabled)this.style.background='rgba(248,113,113,0.18)'"
            onmouseout="this.style.background='rgba(248,113,113,0.1)'"
          >{{ creatingGroup ? "Criando…" : "Criar" }}</button>
        </div>
        <p v-if="groupError" class="text-xs font-mono mt-3" style="color: #f87171">{{ groupError }}</p>
      </div>

      <!-- Groups list -->
      <div v-if="groups.length === 0" class="rounded-2xl px-6 py-12 text-center" style="background: #080c14; border: 1px solid rgba(255,255,255,0.04);">
        <p class="text-sm font-mono" style="color: #334155">Nenhum grupo criado ainda.</p>
      </div>
      <div v-else class="space-y-2">
        <div v-for="g in groups" :key="g.id"
          class="rounded-xl px-5 py-4 flex items-center justify-between gap-4"
          style="background: #080c14; border: 1px solid rgba(248,113,113,0.06);"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium" style="color: #e2e8f0">{{ g.name }}</p>
            <p class="text-xs font-mono" style="color: #334155">
              {{ g._count?.users ?? 0 }} usuário{{ (g._count?.users ?? 0) !== 1 ? 's' : '' }}
              <span v-if="g.description"> · {{ g.description }}</span>
            </p>
          </div>
          <button @click="deleteGroup(g.id)"
            class="p-1.5 rounded-lg flex-shrink-0 transition-colors"
            style="color: #334155;"
            onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='#334155'"
            title="Excluir grupo"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
            </svg>
          </button>
        </div>
      </div>
    </template>

  </div>

  <!-- ── Edit User Modal ── -->
  <Teleport to="body">
    <div v-if="editingUser" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style="background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);">
      <div class="w-full sm:max-w-md rounded-2xl overflow-hidden" style="background: #080c14; border: 1px solid rgba(248,113,113,0.15);">
        <div class="px-5 py-4 flex items-center justify-between" style="border-bottom: 1px solid rgba(248,113,113,0.06);">
          <div>
            <p class="text-xs font-mono uppercase tracking-widest" style="color: rgba(248,113,113,0.4)">// editar usuário</p>
            <p class="text-sm font-medium mt-0.5" style="color: #e2e8f0">@{{ editingUser.username }}</p>
          </div>
          <button @click="closeEditUser" class="p-1.5 rounded-lg" style="color: #475569;"
            onmouseover="this.style.color='#e2e8f0'" onmouseout="this.style.color='#475569'">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="px-5 py-5 space-y-4">
          <!-- Admin toggle -->
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium" style="color: #e2e8f0">Admin (root)</p>
              <p class="text-xs font-mono" style="color: #475569">Acesso total ao sistema</p>
            </div>
            <button @click="editIsAdmin = !editIsAdmin"
              class="w-11 h-6 rounded-full transition-all relative"
              :style="editIsAdmin ? 'background: rgba(248,113,113,0.4);' : 'background: rgba(255,255,255,0.08);'"
            >
              <span class="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                :style="`${editIsAdmin ? 'left: 22px; background: #f87171;' : 'left: 2px; background: #334155;'}`"
              ></span>
            </button>
          </div>

          <!-- Group -->
          <div>
            <label class="block text-xs font-mono uppercase tracking-widest mb-2" style="color: #475569">Grupo</label>
            <select v-model="editGroupId" class="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style="background: #04060d; border: 1px solid rgba(248,113,113,0.12); color: #e2e8f0;">
              <option value="">Sem grupo</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>

          <!-- Roles -->
          <div>
            <label class="block text-xs font-mono uppercase tracking-widest mb-2" style="color: #475569">Roles</label>
            <div class="flex gap-2 mb-2">
              <button v-for="r in ROLES" :key="r"
                @click="editRoles = editRoles.split(',').map(x=>x.trim()).includes(r)
                  ? editRoles.split(',').map(x=>x.trim()).filter(x=>x&&x!==r).join(', ')
                  : [editRoles, r].filter(Boolean).join(', ')"
                class="text-xs font-mono px-2.5 py-1.5 rounded-lg transition-all"
                :style="editRoles.split(',').map(x=>x.trim()).includes(r)
                  ? 'background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.3); color: #22D3EE;'
                  : 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #475569;'"
              >{{ r }}</button>
            </div>
            <input v-model="editRoles" type="text" placeholder="ou escreva roles separadas por vírgula"
              class="w-full rounded-xl px-3 py-2 text-xs font-mono outline-none"
              style="background: #04060d; border: 1px solid rgba(255,255,255,0.06); color: #64748b;"
            />
          </div>
        </div>

        <div class="px-5 pb-5 flex gap-3">
          <button @click="closeEditUser" class="flex-1 py-2.5 rounded-xl text-sm transition-all"
            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #64748b;">Cancelar</button>
          <button @click="saveUser" :disabled="savingUser"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            style="background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.25); color: #f87171;"
            onmouseover="if(!this.disabled)this.style.background='rgba(248,113,113,0.18)'"
            onmouseout="this.style.background='rgba(248,113,113,0.1)'"
          >{{ savingUser ? "Salvando…" : "Salvar" }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
