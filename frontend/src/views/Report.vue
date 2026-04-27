<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { api } from "../lib/api";

interface AttendanceRecord {
  id: string;
  userId: string;
  type: "CLOCK_IN" | "CLOCK_OUT";
  timestamp: string;
}

interface DaySummary {
  date: Date;
  label: string;
  shortLabel: string;
  shortDate: string;
  records: AttendanceRecord[];
  hours: number;
  entries: number;
  exits: number;
  isToday: boolean;
  isWeekend: boolean;
}

function getWeekStart(offset: number): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calcDayHours(dayRecords: AttendanceRecord[], isToday: boolean): number {
  const sorted = [...dayRecords].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  let totalMs = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].type === "CLOCK_IN" && sorted[i + 1].type === "CLOCK_OUT") {
      totalMs +=
        new Date(sorted[i + 1].timestamp).getTime() -
        new Date(sorted[i].timestamp).getTime();
    }
  }
  const last = sorted[sorted.length - 1];
  if (last?.type === "CLOCK_IN" && isToday) {
    totalMs += Date.now() - new Date(last.timestamp).getTime();
  }
  return totalMs / 3600000;
}

function fmtHours(h: number, fallback = "—"): string {
  if (h <= 0) return fallback;
  const hrs = Math.floor(h);
  const min = Math.floor((h - hrs) * 60);
  if (hrs === 0) return `${min}min`;
  return min === 0 ? `${hrs}h` : `${hrs}h ${min}min`;
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_FULL  = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const weekOffset  = ref(0);
const isLoading   = ref(false);
const allRecords  = ref<AttendanceRecord[]>([]);

const weekStartDate = computed(() => getWeekStart(weekOffset.value));
const weekEndDate   = computed(() => {
  const d = new Date(weekStartDate.value);
  d.setDate(d.getDate() + 6);
  return d;
});

const weekLabel = computed(() => {
  const s = weekStartDate.value.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  const e = weekEndDate.value.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  return `${s} – ${e}`;
});

const days = computed<DaySummary[]>(() => {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStartDate.value);
    date.setDate(date.getDate() + i);
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);
    const recs  = allRecords.value.filter(r => {
      const t = new Date(r.timestamp).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    const isToday   = date.toDateString() === today.toDateString();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    return {
      date,
      label:      DAY_FULL[date.getDay()],
      shortLabel: DAY_NAMES[date.getDay()],
      shortDate:  date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      records: recs,
      hours:   calcDayHours(recs, isToday),
      entries: recs.filter(r => r.type === "CLOCK_IN").length,
      exits:   recs.filter(r => r.type === "CLOCK_OUT").length,
      isToday,
      isWeekend,
    };
  });
});

const totalHours  = computed(() => days.value.reduce((s, d) => s + d.hours, 0));
const daysWorked  = computed(() => days.value.filter(d => !d.isWeekend && d.hours > 0).length);
const hoursLeft   = computed(() => Math.max(0, 40 - totalHours.value));
const weekProgress = computed(() => Math.min(totalHours.value / 40 * 100, 100));

async function fetchWeek() {
  isLoading.value = true;
  try {
    const from = weekStartDate.value.toISOString().split("T")[0];
    const to   = weekEndDate.value.toISOString().split("T")[0];
    const params = new URLSearchParams({ from, to: `${to}T23:59:59` });
    const { data } = await api.get<AttendanceRecord[]>(`/attendance/history?${params}`);
    allRecords.value = data;
  } finally {
    isLoading.value = false;
  }
}

function prevWeek() { weekOffset.value--; }
function nextWeek() { if (weekOffset.value < 0) weekOffset.value++; }

watch(weekOffset, fetchWeek);
onMounted(fetchWeek);
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

    <!-- Header -->
    <div class="mb-6 sm:mb-8">
      <p class="text-xs font-mono uppercase tracking-widest mb-1" style="color: rgba(34,211,238,0.5)">// relatório</p>
      <h1 class="text-2xl font-semibold" style="color: #e2e8f0">Resumo Semanal</h1>
    </div>

    <!-- Week navigation -->
    <div class="rounded-2xl px-4 py-3 mb-5 flex items-center justify-between" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
      <button @click="prevWeek"
        class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
        style="color: #475569; border: 1px solid rgba(255,255,255,0.06);"
        onmouseover="this.style.color='#22D3EE';this.style.borderColor='rgba(34,211,238,0.2)'"
        onmouseout="this.style.color='#475569';this.style.borderColor='rgba(255,255,255,0.06)'"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <div class="text-center">
        <p class="text-sm font-medium" style="color: #e2e8f0">{{ weekLabel }}</p>
        <p class="text-xs font-mono mt-0.5" style="color: rgba(34,211,238,0.35)">
          {{ weekOffset === 0 ? 'semana atual' : weekOffset === -1 ? 'semana passada' : `${Math.abs(weekOffset)} semanas atrás` }}
        </p>
      </div>
      <button @click="nextWeek" :disabled="weekOffset >= 0"
        class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 disabled:opacity-25 disabled:cursor-not-allowed"
        style="color: #475569; border: 1px solid rgba(255,255,255,0.06);"
        onmouseover="if(!this.disabled){this.style.color='#22D3EE';this.style.borderColor='rgba(34,211,238,0.2)'}"
        onmouseout="this.style.color='#475569';this.style.borderColor='rgba(255,255,255,0.06)'"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      </button>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-3 gap-3 mb-5">
      <div class="rounded-2xl p-4 text-center" style="background: #080c14; border-top: 1px solid rgba(34,211,238,0.08); border-right: 1px solid rgba(34,211,238,0.08); border-bottom: 1px solid rgba(34,211,238,0.08); border-left: 2px solid rgba(34,211,238,0.35);">
        <p class="text-xs font-mono uppercase tracking-widest mb-1.5" style="color: #475569">Total</p>
        <p class="text-lg font-bold font-mono leading-none" style="color: #22D3EE">{{ fmtHours(totalHours, '0h') }}</p>
      </div>
      <div class="rounded-2xl p-4 text-center" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
        <p class="text-xs font-mono uppercase tracking-widest mb-1.5" style="color: #475569">Dias</p>
        <p class="text-lg font-bold font-mono leading-none" style="color: #e2e8f0">{{ daysWorked }}<span class="text-sm font-normal" style="color: #334155">/5</span></p>
      </div>
      <div class="rounded-2xl p-4 text-center" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
        <p class="text-xs font-mono uppercase tracking-widest mb-1.5" style="color: #475569">Faltam</p>
        <p class="text-lg font-bold font-mono leading-none" :style="hoursLeft === 0 ? 'color: #22D3EE' : 'color: #e2e8f0'">
          {{ hoursLeft === 0 ? '✓' : fmtHours(hoursLeft) }}
        </p>
      </div>
    </div>

    <!-- Week progress bar -->
    <div class="rounded-xl px-4 py-3 mb-5" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-mono" style="color: #334155">progresso semanal</span>
        <span class="text-xs font-mono" style="color: #475569">{{ Math.round(weekProgress) }}% de 40h</span>
      </div>
      <div class="h-1.5 rounded-full" style="background: rgba(255,255,255,0.04);">
        <div class="h-full rounded-full transition-all duration-500"
          :style="`width: ${weekProgress}%; background: ${weekProgress >= 100 ? '#22D3EE' : weekProgress >= 60 ? 'rgba(34,211,238,0.7)' : 'rgba(34,211,238,0.4)'};`"
        />
      </div>
    </div>

    <!-- Days list -->
    <div v-if="isLoading" class="rounded-2xl p-10 text-center" style="background: #080c14; border: 1px solid rgba(34,211,238,0.08);">
      <p class="text-sm font-mono" style="color: #334155">Carregando...</p>
    </div>

    <div v-else class="space-y-2">
      <div v-for="day in days" :key="day.shortDate"
        class="rounded-xl px-4 py-3.5 flex items-center gap-3 sm:gap-4"
        :style="day.isToday
          ? 'background: #080c14; border: 1px solid rgba(34,211,238,0.2);'
          : day.isWeekend && day.hours === 0
          ? 'background: transparent; border: 1px solid rgba(255,255,255,0.03);'
          : 'background: #080c14; border: 1px solid rgba(34,211,238,0.06);'"
      >
        <!-- Day label -->
        <div class="w-16 sm:w-20 flex-shrink-0">
          <p class="text-xs font-mono font-medium"
            :style="day.isToday ? 'color: #22D3EE' : day.isWeekend && day.hours === 0 ? 'color: #1e293b' : 'color: #475569'"
          >{{ day.shortLabel }}</p>
          <p class="text-xs font-mono"
            :style="day.isToday ? 'color: rgba(34,211,238,0.5)' : day.isWeekend && day.hours === 0 ? 'color: #1e293b' : 'color: #334155'"
          >{{ day.shortDate }}</p>
        </div>

        <!-- Bar -->
        <div class="flex-1 min-w-0">
          <div v-if="day.hours > 0">
            <div class="h-1 rounded-full mb-1.5 overflow-hidden" style="background: rgba(255,255,255,0.04);">
              <div class="h-full rounded-full"
                :style="`width: ${Math.min(day.hours / 8 * 100, 100)}%; background: ${day.hours >= 8 ? '#22D3EE' : day.hours >= 4 ? 'rgba(34,211,238,0.55)' : 'rgba(34,211,238,0.3)'};`"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-mono font-semibold"
                :style="day.isToday ? 'color: #22D3EE' : 'color: #e2e8f0'"
              >{{ fmtHours(day.hours) }}</span>
              <span class="text-xs font-mono" style="color: #334155">
                {{ day.entries }}↑ {{ day.exits }}↓
              </span>
            </div>
          </div>
          <div v-else-if="day.isWeekend">
            <!-- weekend empty - nothing shown -->
          </div>
          <div v-else>
            <p class="text-xs font-mono" style="color: #1e293b">sem registros</p>
          </div>
        </div>

        <!-- Hours pill (desktop) -->
        <div class="hidden sm:block flex-shrink-0 text-right w-16">
          <span v-if="day.hours > 0" class="text-xs font-mono px-2 py-0.5 rounded-full"
            :style="day.hours >= 8
              ? 'background: rgba(34,211,238,0.08); color: #22D3EE;'
              : 'background: rgba(255,255,255,0.04); color: #475569;'"
          >{{ fmtHours(day.hours) }}</span>
        </div>
      </div>
    </div>

  </div>
</template>
