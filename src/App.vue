<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { supabase } from "./supabase";
const route = useRoute();
const view = computed(() => ({ "/dashboard": "dashboard", "/activities": "tasks", "/calendar": "calendar", "/reminders": "reminders", "/account": "account", "/export": "export", "/habits": "habits", "/goals": "goals", "/reports": "reports" }[route.path] || "dashboard"));
const user = ref(null),
  loading = ref(true),
  busy = ref(false),
  message = ref(""),
  messageType = ref("");
const authMode = ref("login"),
  email = ref(""),
  password = ref(""),
  confirmPassword = ref("");
const tasks = ref([]),
  habits = ref([]),
  habitLogs = ref([]),
  goals = ref([]), goalTitle = ref(""), goalDescription = ref(""), goalDueDate = ref(""), goalTarget = ref(""), goalBusy = ref(false),
  habitTitle = ref(""),
  habitFrequency = ref("Diária"),
  habitWeekdays = ref([1, 2, 3, 4, 5, 6, 0]),
  habitBusy = ref(false),
  title = ref(""),
  category = ref("Pessoais"),
  frequency = ref("Diária"),
  dueDate = ref(""),
  reminderTime = ref(""),
  priority = ref("Normal");
const filter = ref("Todas"),
  search = ref(""),
  calendarMonth = ref(new Date()),
  notificationsAllowed = ref(typeof Notification !== "undefined" && Notification.permission === "granted"),
  selectedTasks = ref([]),
  realtimeChannel = ref(null),
  reminderTimer = ref(null),
  notifiedReminders = new Set();
const cats = [
  ["Pessoais", "👤"],
  ["Familiares", "❤️"],
  ["Educacionais", "📚"],
  ["Espirituais", "🙏"],
  ["Laborais", "💼"],
  ["Saúde", "✚"],
  ["Financeiras", "💰"],
  ["Casa", "🏠"],
  ["Sociais", "🤝"],
  ["Lazer", "🎯"],
];
const authTitle = computed(
  () =>
    ({
      login: "Entrar na tua conta",
      signup: "Criar conta",
      reset: "Recuperar palavra-passe",
      update: "Definir nova palavra-passe",
    }[authMode.value])
);
const authSub = computed(
  () =>
    ({
      login: "Usa o teu e-mail e palavra-passe.",
      signup: "Cria uma conta para sincronizar os teus dispositivos.",
      reset: "Enviaremos um link para o teu e-mail.",
      update: "Escolhe uma nova palavra-passe segura.",
    }[authMode.value])
);
const filtered = computed(() =>
  tasks.value.filter(
    (t) =>
      (filter.value === "Todas" || t.category === filter.value) &&
      (!search.value || t.title.toLowerCase().includes(search.value.toLowerCase()))
  )
);
const completed = computed(() => tasks.value.filter((t) => t.done).length);
const progress = computed(() =>
  tasks.value.length ? Math.round((completed.value / tasks.value.length) * 100) : 0
);
const monthLabel = computed(() =>
  calendarMonth.value.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })
);
const calendarDays = computed(() => {
  const d = new Date(
    calendarMonth.value.getFullYear(),
    calendarMonth.value.getMonth(),
    1
  );
  const offset = (d.getDay() + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    const iso = fmt(x);
    return {
      iso,
      day: x.getDate(),
      other: x.getMonth() !== calendarMonth.value.getMonth(),
      items: tasks.value.filter((t) => t.due_date === iso),
    };
  });
});
function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function notify(text, type = "info") {
  message.value = text;
  messageType.value = type;
}
function mode(m) {
  authMode.value = m;
  password.value = "";
  confirmPassword.value = "";
  notify("");
}
async function loadTasks() {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) notify(error.message, "error");
  else tasks.value = data || [];
}

const habitTodayKey = computed(() => fmt(new Date()));
const todayHabitLogs = computed(() => habitLogs.value.filter((log) => log.log_date === habitTodayKey.value && log.completed));
const reportPeriod = ref("30");
const showReportPreview = ref(false);
const reportStart = computed(() => { const d = new Date(); d.setDate(d.getDate() - Number(reportPeriod.value) + 1); return fmt(d); });
const reportTasks = computed(() => tasks.value.filter(t => { const date = String(t.created_at || t.due_date || "").slice(0,10); return date >= reportStart.value && date <= habitTodayKey.value; }));
const reportCompletedTasks = computed(() => reportTasks.value.filter(t => t.done).length);
const reportCompletionRate = computed(() => reportTasks.value.length ? Math.round(reportCompletedTasks.value / reportTasks.value.length * 100) : 0);
const reportLogs = computed(() => habitLogs.value.filter(log => log.log_date >= reportStart.value && log.log_date <= habitTodayKey.value));
const reportCompletedLogs = computed(() => reportLogs.value.filter(log => log.completed).length);
const reportHabitRate = computed(() => reportLogs.value.length ? Math.round(reportCompletedLogs.value / reportLogs.value.length * 100) : 0);
const reportGoals = computed(() => goals.value.filter(goal => !goal.archived));
const reportGoalsCompleted = computed(() => reportGoals.value.filter(goal => goal.completed).length);
const reportOverdueGoals = computed(() => reportGoals.value.filter(goal => !goal.completed && goal.target_date && goal.target_date < habitTodayKey.value).length);
const reportCategoryRows = computed(() => { const counts = {}; reportTasks.value.forEach(t => { const k = t.category || "Sem categoria"; if (!counts[k]) counts[k] = { name:k, total:0, done:0 }; counts[k].total++; if (t.done) counts[k].done++; }); return Object.values(counts).sort((a,b) => b.total-a.total); });
const reportExportRows = computed(() => ([
  ...reportTasks.value.map(t => ({ type: "Actividade", title: t.title || "Sem título", date: t.due_date || String(t.created_at || "").slice(0,10) || "—", status: t.done ? "Concluída" : "Pendente", detail: t.category || "—" })),
  ...reportLogs.value.map(log => ({ type: "Hábito", title: habits.value.find(h => h.id === log.habit_id)?.title || `Hábito ${log.habit_id}`, date: log.log_date || "—", status: log.completed ? "Concluído" : "Não concluído", detail: "Registo de hábito" })),
  ...reportGoals.value.map(g => ({ type: "Meta", title: g.title || "Sem título", date: g.target_date || "—", status: g.completed ? "Concluída" : (g.target_date && g.target_date < habitTodayKey.value ? "Atrasada" : "Em curso"), detail: g.target_value ? `${g.current_value || 0} / ${g.target_value}` : (g.description || "—") }))
]));
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
function exportReportPdf() {
  const rows = reportExportRows.value;
  const generatedAt = new Date().toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
  const categoryHtml = reportCategoryRows.value.length ? reportCategoryRows.value.map(row => `<tr><td>${escapeHtml(row.name)}</td><td>${row.total}</td><td>${row.done}</td><td>${row.total ? Math.round(row.done / row.total * 100) : 0}%</td></tr>`).join("") : '<tr><td colspan="4">Sem actividades por categoria neste período.</td></tr>';
  const tableRows = rows.length ? rows.map(row => `<tr><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.date)}</td><td><span class="status">${escapeHtml(row.status)}</span></td><td>${escapeHtml(row.detail)}</td></tr>`).join("") : '<tr><td colspan="5">Não existem registos para apresentar no período seleccionado.</td></tr>';
  const goalsHtml = reportGoals.value.length ? reportGoals.value.map(goal => { const pct = goal.target_value ? Math.min(100, Math.round(Number(goal.current_value || 0) / Number(goal.target_value) * 100)) : (goal.completed ? 100 : 0); return `<div class="goal"><div class="goal-line"><strong>${escapeHtml(goal.title)}</strong><span>${goal.completed ? "Concluída" : (goal.target_date && goal.target_date < habitTodayKey.value ? "Atrasada" : "Em curso")}</span></div>${goal.target_date ? `<p>Prazo: ${escapeHtml(goal.target_date)}</p>` : ""}${goal.target_value ? `<div class="track"><i style="width:${pct}%"></i></div><small>${escapeHtml(goal.current_value || 0)} de ${escapeHtml(goal.target_value)} (${pct}%)</small>` : ""}</div>`; }).join("") : '<p class="empty">Não existem metas activas.</p>';
  const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório ActivityDay · ${escapeHtml(habitTodayKey.value)}</title><style>
  :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#172033;font:14px/1.5 Arial,Helvetica,sans-serif}.toolbar{max-width:1000px;margin:20px auto;display:flex;justify-content:flex-end;gap:10px}.toolbar button{border:0;border-radius:8px;padding:11px 16px;font-weight:700;cursor:pointer;background:#1d4ed8;color:#fff}.toolbar .secondary{background:#fff;color:#334155;border:1px solid #cbd5e1}.page{max-width:1000px;margin:0 auto 28px;background:#fff;padding:42px;box-shadow:0 10px 40px #0f172a12}.brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2563eb;padding-bottom:22px}.brand-name{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#2563eb;font-weight:800}.brand h1{font-size:30px;margin:6px 0 3px;letter-spacing:-.7px}.sub{color:#64748b;margin:0}.meta{text-align:right;color:#64748b;font-size:12px}.period{display:inline-block;margin-top:18px;background:#eff6ff;color:#1d4ed8;border-radius:6px;padding:7px 10px;font-weight:700}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0}.card{border:1px solid #e2e8f0;border-radius:10px;padding:15px;background:#fbfdff}.card span{display:block;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}.card strong{display:block;font-size:26px;margin-top:5px;color:#0f172a}.card small{color:#64748b}.section{margin-top:25px;break-inside:avoid}.section h2{font-size:16px;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0}.section p{color:#64748b}.goal{padding:10px 0;border-bottom:1px solid #eef2f7;break-inside:avoid}.goal-line{display:flex;justify-content:space-between;gap:12px}.goal-line span,.status{font-size:11px;color:#1d4ed8;background:#eff6ff;padding:3px 7px;border-radius:20px;white-space:nowrap}.goal p{margin:4px 0;font-size:12px}.track{height:6px;border-radius:20px;background:#e2e8f0;margin:8px 0 4px;overflow:hidden}.track i{display:block;height:100%;background:#2563eb}table{width:100%;border-collapse:collapse;font-size:11px}th{text-align:left;background:#f1f5f9;color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:.4px}th,td{padding:9px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}td:nth-child(2){font-weight:600;max-width:250px;overflow-wrap:anywhere}.empty{color:#64748b;padding:14px 0}.footer{border-top:1px solid #e2e8f0;margin-top:28px;padding-top:12px;display:flex;justify-content:space-between;color:#94a3b8;font-size:10px}.hint{max-width:1000px;margin:0 auto 24px;color:#64748b;font-size:12px}@media(max-width:700px){.page{padding:22px;margin:0 8px 20px}.cards{grid-template-columns:repeat(2,1fr)}.brand{gap:12px;flex-direction:column}.meta{text-align:left}.toolbar{margin:10px;flex-wrap:wrap}}@page{size:A4 portrait;margin:14mm}@media print{body{background:#fff;font-size:11px}.toolbar,.hint{display:none!important}.page{max-width:none;margin:0;padding:0;box-shadow:none}.cards{grid-template-columns:repeat(4,1fr)}.card{padding:10px}.card strong{font-size:22px}.section{break-inside:avoid}table{font-size:9px}th,td{padding:6px 5px}.brand h1{font-size:26px}.footer{position:relative}}
  </style></head><body><div class="toolbar"><button class="secondary" onclick="window.close()">Fechar pré-visualização</button><button onclick="window.print()">Imprimir / Guardar PDF</button></div><p class="hint">Pré-visualização de impressão: escolhe “Guardar como PDF” na janela de impressão para descarregar o documento.</p><main class="page"><header class="brand"><div><div class="brand-name">ActivityDay</div><h1>Relatório de produtividade</h1><p class="sub">Resumo de actividades, hábitos e metas</p><div class="period">Período: ${escapeHtml(reportStart.value)} — ${escapeHtml(habitTodayKey.value)}</div></div><div class="meta">Gerado em<br><strong>${escapeHtml(generatedAt)}</strong><br>Documento pessoal</div></header><section class="cards"><div class="card"><span>Actividades</span><strong>${reportTasks.value.length}</strong><small>${reportCompletedTasks.value} concluídas</small></div><div class="card"><span>Conclusão</span><strong>${reportCompletionRate.value}%</strong><small>Taxa de conclusão</small></div><div class="card"><span>Hábitos</span><strong>${reportCompletedLogs.value}/${reportLogs.value.length}</strong><small>${reportHabitRate.value}% concluídos</small></div><div class="card"><span>Metas activas</span><strong>${reportGoals.value.length}</strong><small>${reportGoalsCompleted.value} concluídas · ${reportOverdueGoals.value} atrasadas</small></div></section><section class="section"><h2>Actividades por categoria</h2><table><thead><tr><th>Categoria</th><th>Total</th><th>Concluídas</th><th>Conclusão</th></tr></thead><tbody>${categoryHtml}</tbody></table></section><section class="section"><h2>Progresso das metas</h2>${goalsHtml}</section><section class="section"><h2>Registos incluídos no relatório</h2><table><thead><tr><th>Tipo</th><th>Título</th><th>Data</th><th>Estado</th><th>Detalhe</th></tr></thead><tbody>${tableRows}</tbody></table></section><footer class="footer"><span>ActivityDay · As tuas actividades, organizadas.</span><span>Relatório gerado a partir dos dados disponíveis na aplicação</span></footer></main><script>window.addEventListener('load',()=>{document.title='ActivityDay - Relatório ${escapeHtml(habitTodayKey.value)}'});<\/script></body></html>`;
  const win = window.open("", "_blank");
  if (!win) { notify("O navegador bloqueou a janela. Permite pop-ups para pré-visualizar o PDF.", "error"); return; }
  win.document.open(); win.document.write(html); win.document.close();
}
function exportReportCsv() {
 const rows = [["Tipo","Título","Data","Estado","Categoria/Detalhe"], ...reportTasks.value.map(t => ["Actividade",t.title,t.due_date || String(t.created_at || "").slice(0,10),t.done ? "Concluída" : "Pendente",t.category || ""]), ...reportLogs.value.map(log => ["Hábito",habits.value.find(h => h.id === log.habit_id)?.title || `Hábito ${log.habit_id}`,log.log_date,log.completed ? "Concluído" : "Não concluído",""]), ...reportGoals.value.map(g => ["Meta",g.title,g.target_date || "",g.completed ? "Concluída" : "Em curso",g.target_value ? `${g.current_value || 0}/${g.target_value}` : ""] )];
 const csv = rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\r\n");
 const blob = new Blob(["\uFEFF",csv], {type:"text/csv;charset=utf-8;"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=`activityday-relatorio-${habitTodayKey.value}.csv`; a.click(); URL.revokeObjectURL(url);
}
const activeGoals = computed(() => goals.value.filter((goal) => !goal.archived));
const activeHabits = computed(() => habits.value.filter((habit) => !habit.archived));
const archivedHabits = computed(() => habits.value.filter((habit) => Boolean(habit.archived)));
// O progresso diário é histórico: arquivar um hábito não apaga uma realização já registada.
const completedHabitsToday = computed(() => {
  const completedIds = new Set(
    habitLogs.value
      .filter((log) => log.log_date === habitTodayKey.value && log.completed)
      .map((log) => log.habit_id)
  );
  return completedIds.size;
});
const scheduledActiveHabitsToday = computed(() => activeHabits.value.filter(habitIsScheduledToday).length);
const archivedCompletedToday = computed(() => archivedHabits.value.filter((habit) => {
  const log = habitLogs.value.find((item) => item.habit_id === habit.id && item.log_date === habitTodayKey.value);
  return Boolean(log?.completed);
}).length);
const habitCompletionDenominator = computed(() => scheduledActiveHabitsToday.value + archivedCompletedToday.value);
const habitCompletionRate = computed(() => habitCompletionDenominator.value
  ? Math.min(100, Math.round(completedHabitsToday.value / habitCompletionDenominator.value * 100))
  : 0);
function habitIsScheduledToday(habit) {
  if (habit.frequency === "Diária") return true;
  if (habit.frequency === "Semanal") {
    const days = Array.isArray(habit.weekdays) && habit.weekdays.length ? habit.weekdays : [1,2,3,4,5,6,0];
    return days.includes(new Date().getDay());
  }
  return true;
}
function habitLogForToday(habitId) {
  return habitLogs.value.find((log) => log.habit_id === habitId && log.log_date === habitTodayKey.value);
}
async function loadGoals() {
  if (!user.value) return;
  const { data, error } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
  if (error) { if (error.code === "42P01" || /does not exist/i.test(error.message || "")) notify("Executa supabase_goals_migration.sql no Supabase.", "error"); else notify(error.message, "error"); return; }
  goals.value = data || [];
}
async function createGoal() {
  if (!goalTitle.value.trim()) return notify("Escreve o nome da meta.", "error");
  goalBusy.value = true;
  const row = { user_id: user.value.id, title: goalTitle.value.trim(), description: goalDescription.value.trim() || null, target_date: goalDueDate.value || null, target_value: goalTarget.value === "" ? null : Number(goalTarget.value), current_value: 0, archived: false, completed: false };
  const { data, error } = await supabase.from("goals").insert(row).select().single(); goalBusy.value = false;
  if (error) return notify(error.message, "error");
  goals.value.unshift(data); goalTitle.value = ""; goalDescription.value = ""; goalDueDate.value = ""; goalTarget.value = ""; notify("Meta criada.", "success");
}
async function changeGoalProgress(goal, delta) {
  const target = Number(goal.target_value || 0), next = Math.max(0, Math.min(target > 0 ? target : Number.MAX_SAFE_INTEGER, Number(goal.current_value || 0) + delta));
  const { data, error } = await supabase.from("goals").update({ current_value: next, completed: target > 0 ? next >= target : Boolean(goal.completed), updated_at: new Date().toISOString() }).eq("id", goal.id).select().single();
  if (error) return notify(error.message, "error"); Object.assign(goal, data);
}
async function toggleGoalCompleted(goal) {
  const { data, error } = await supabase.from("goals").update({ completed: !goal.completed, updated_at: new Date().toISOString() }).eq("id", goal.id).select().single();
  if (error) return notify(error.message, "error"); Object.assign(goal, data); notify(goal.completed ? "Meta concluída." : "Meta reaberta.", "success");
}
async function archiveGoal(goal) {
  if (!confirm(`Arquivar a meta "${goal.title}"? Podes restaurá-la depois.`)) return;
  const { data, error } = await supabase.from("goals").update({ archived: true, updated_at: new Date().toISOString() }).eq("id", goal.id).select().single();
  if (error) return notify(error.message, "error"); Object.assign(goal, data);
}
async function restoreGoal(goal) {
  const { data, error } = await supabase.from("goals").update({ archived: false, updated_at: new Date().toISOString() }).eq("id", goal.id).select().single();
  if (error) return notify(error.message, "error"); Object.assign(goal, data);
}
async function loadHabits() {
  if (!user.value) return;
  const [habitResult, logResult] = await Promise.all([
    supabase.from("habits").select("*").order("created_at", { ascending: false }),
    supabase.from("habit_logs").select("*").gte("log_date", fmt(new Date(Date.now() - 45 * 86400000))).order("log_date", { ascending: false }),
  ]);
  if (habitResult.error || logResult.error) {
    const err = habitResult.error || logResult.error;
    if (err.code === "42P01" || /does not exist/i.test(err.message || "")) {
      notify("A base de dados ainda não tem as tabelas de hábitos. Executa o ficheiro supabase_habits_migration.sql no SQL Editor do Supabase.", "error");
    } else notify(err.message, "error");
    return;
  }
  habits.value = habitResult.data || [];
  habitLogs.value = logResult.data || [];
}
async function createHabit() {
  if (!habitTitle.value.trim()) return notify("Escreve o nome do hábito.", "error");
  habitBusy.value = true;
  const payload = {
    user_id: user.value.id,
    title: habitTitle.value.trim(),
    frequency: habitFrequency.value,
    weekdays: habitFrequency.value === "Semanal" ? [...habitWeekdays.value].sort((a,b) => a-b) : [],
    archived: false,
  };
  const { data, error } = await supabase.from("habits").insert(payload).select().single();
  habitBusy.value = false;
  if (error) return notify(error.message, "error");
  habits.value.unshift(data);
  habitTitle.value = "";
  notify("Hábito criado com sucesso.", "success");
}
async function toggleHabitToday(habit) {
  const existing = habitLogForToday(habit.id);
  if (existing?.completed) {
    const { data, error } = await supabase.from("habit_logs").update({ completed: false, completed_at: null }).eq("id", existing.id).select().single();
    if (error) return notify(error.message, "error");
    Object.assign(existing, data);
    notify("Registo de hoje desmarcado.", "success");
    return;
  }
  if (existing) {
    const { data, error } = await supabase.from("habit_logs").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", existing.id).select().single();
    if (error) return notify(error.message, "error");
    Object.assign(existing, data);
  } else {
    const { data, error } = await supabase.from("habit_logs").insert({
      user_id: user.value.id, habit_id: habit.id, log_date: habitTodayKey.value, completed: true, completed_at: new Date().toISOString()
    }).select().single();
    if (error) return notify(error.message, "error");
    habitLogs.value.unshift(data);
  }
  notify("Hábito registado para hoje.", "success");
}
async function archiveHabit(habit) {
  if (!confirm(`Arquivar o hábito "${habit.title}"? O histórico será preservado.`)) return;
  const { data, error } = await supabase.from("habits").update({ archived: true }).eq("id", habit.id).select().single();
  if (error) return notify(error.message, "error");
  Object.assign(habit, data);
  notify("Hábito arquivado. O histórico foi preservado.", "success");
}
async function restoreHabit(habit) {
  if (!confirm(`Restaurar o hábito "${habit.title}" para a lista activa?`)) return;
  const { data, error } = await supabase.from("habits").update({ archived: false }).eq("id", habit.id).select().single();
  if (error) return notify(error.message, "error");
  Object.assign(habit, data);
  notify("Hábito restaurado.", "success");
}

async function authSubmit() {
  if (busy.value) return;
  busy.value = true;
  notify("");
  try {
    if (authMode.value === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      });
      if (error) throw error;
    } else if (authMode.value === "signup") {
      if (password.value !== confirmPassword.value)
        throw Error("As palavras-passe não coincidem.");
      const { error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: { emailRedirectTo: location.origin },
      });
      if (error) throw error;
      notify("Conta criada. Verifica o teu e-mail para confirmar o registo.", "success");
      authMode.value = "login";
    } else if (authMode.value === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
        redirectTo: location.origin,
      });
      if (error) throw error;
      notify("Enviámos um link de recuperação para o teu e-mail.", "success");
    } else {
      if (password.value !== confirmPassword.value)
        throw Error("As palavras-passe não coincidem.");
      if (password.value.length < 6) throw Error("Usa pelo menos 6 caracteres.");
      const { error } = await supabase.auth.updateUser({ password: password.value });
      if (error) throw error;
      await supabase.auth.signOut();
      history.replaceState(null, "", location.pathname);
      mode("login");
      notify("Palavra-passe alterada. Entra com a nova palavra-passe.", "success");
    }
  } catch (e) {
    notify(e.message || "Ocorreu um erro.", "error");
  } finally {
    busy.value = false;
  }
}
async function saveTask() {
  if (!title.value.trim()) return notify("Escreve o nome da actividade.", "error");
  const row = {
    user_id: user.value.id,
    title: title.value.trim(),
    category: category.value,
    frequency: frequency.value,
    done: false,
    due_date: dueDate.value || null,
    reminder_time: reminderTime.value || null,
    priority: priority.value,
  };
  const { data, error } = await supabase.from("activities").insert(row).select().single();
  if (error) notify(error.message, "error");
  else {
    tasks.value.unshift(data);
    title.value = "";
    dueDate.value = "";
    reminderTime.value = "";
    notify("Actividade guardada.", "success");
  }
}
function nextOccurrenceDate(dateString, frequency) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  if (frequency === "Diária") next.setDate(next.getDate() + 1);
  else if (frequency === "Semanal") next.setDate(next.getDate() + 7);
  else if (frequency === "Mensal") {
    // Keep the day of month where possible; clamp to the last day of shorter months.
    const targetDay = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(targetDay, lastDay));
  } else return null;
  return fmt(next);
}
async function toggleTask(t) {
  if (t.done) {
    const { data, error } = await supabase
      .from("activities")
      .update({ done: false })
      .eq("id", t.id)
      .select()
      .single();
    if (error) notify(error.message, "error");
    else Object.assign(t, data);
    return;
  }

  const { data, error } = await supabase
    .from("activities")
    .update({ done: true })
    .eq("id", t.id)
    .eq("done", false)
    .select()
    .single();
  if (error) {
    notify(error.message, "error");
    return;
  }
  Object.assign(t, data);

  if (!["Diária", "Semanal", "Mensal"].includes(t.frequency)) return;
  const nextDate = nextOccurrenceDate(t.due_date, t.frequency);
  if (!nextDate) {
    notify("Actividade concluída. Para criar a próxima ocorrência, define primeiro uma data e usa frequência diária, semanal ou mensal.", "info");
    return;
  }

  const nextRow = {
    user_id: user.value.id,
    title: t.title,
    category: t.category,
    frequency: t.frequency,
    done: false,
    due_date: nextDate,
    reminder_time: t.reminder_time || null,
    priority: t.priority || "Normal",
  };
  const { data: nextData, error: nextError } = await supabase
    .from("activities")
    .insert(nextRow)
    .select()
    .single();
  if (nextError) {
    notify("Actividade concluída, mas não foi possível criar a próxima ocorrência: " + nextError.message, "error");
    return;
  }
  tasks.value.unshift(nextData);
  notify("Actividade concluída. Próxima ocorrência criada para " + nextDate + ".", "success");
}
async function deleteTask(t) {
  if (!confirm(`Apagar "${t.title}"?`)) return;
  const { error } = await supabase.from("activities").delete().eq("id", t.id);
  if (error) notify(error.message, "error");
  else tasks.value = tasks.value.filter((x) => x.id !== t.id);
}
async function deleteSelectedTasks() {
  if (!selectedTasks.value.length) return notify("Selecciona pelo menos uma actividade.", "error");
  if (!confirm(`Apagar ${selectedTasks.value.length} actividade(s) seleccionada(s)?`)) return;
  const ids = [...selectedTasks.value];
  const { error } = await supabase.from("activities").delete().in("id", ids);
  if (error) return notify(error.message, "error");
  tasks.value = tasks.value.filter((t) => !ids.includes(t.id));
  selectedTasks.value = [];
  notify("Actividades seleccionadas apagadas.", "success");
}
async function deleteAllTasks() {
  if (!tasks.value.length) return notify("Não existem actividades para apagar.", "error");
  if (!confirm("Tens a certeza de que pretendes apagar permanentemente todas as tuas actividades?")) return;
  const { error } = await supabase.from("activities").delete().eq("user_id", user.value.id);
  if (error) return notify(error.message, "error");
  tasks.value = [];
  selectedTasks.value = [];
  notify("Todas as tuas actividades foram apagadas.", "success");
}
async function enableNotifications() {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return notify("Este navegador não suporta notificações push. Usa uma versão recente do Chrome ou Edge em HTTPS.", "error");
  }
  if (!user.value) return notify("Inicia sessão antes de activar os lembretes push.", "error");
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey) return notify("Falta configurar VITE_VAPID_PUBLIC_KEY no ambiente local/Netlify e voltar a publicar.", "error");
  try {
    const permission = await Notification.requestPermission();
    notificationsAllowed.value = permission === "granted";
    if (!notificationsAllowed.value) return notify("As notificações não foram autorizadas pelo navegador.", "error");
    const registration = await navigator.serviceWorker.register("/service-worker.js");
    const ready = await navigator.serviceWorker.ready;
    const subscription = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/.netlify/functions/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível registar este dispositivo.");
    notify("Notificações push activadas neste dispositivo. Os lembretes podem chegar com o site fechado.", "success");
  } catch (error) {
    notify(error.message || "Falha ao activar notificações push.", "error");
  }
}
function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
async function sendPasswordReset() {
  if (!user.value?.email) return notify("Não foi possível identificar o e-mail da conta.", "error");
  const { error } = await supabase.auth.resetPasswordForEmail(user.value.email, { redirectTo: location.origin });
  if (error) notify(error.message, "error");
  else notify("Enviámos um link para alterar a palavra-passe para o teu e-mail.", "success");
}
const todayKey = computed(() => fmt(new Date()));
const todayTasks = computed(() => tasks.value.filter((t) => t.due_date === todayKey.value));
const todayCompleted = computed(() => todayTasks.value.filter((t) => t.done).length);
const todayProgress = computed(() => todayTasks.value.length ? Math.round((todayCompleted.value / todayTasks.value.length) * 100) : 0);
const overdueTasks = computed(() => {
  const today = todayKey.value;
  return tasks.value.filter((t) => !t.done && t.due_date && t.due_date < today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
});
const weekTasks = computed(() => {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return tasks.value.filter((t) => t.due_date && t.due_date >= fmt(monday) && t.due_date <= fmt(sunday));
});
const weekCompleted = computed(() => weekTasks.value.filter((t) => t.done).length);
const greeting = computed(() => {
  const hour = new Date().getHours();
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
});
const upcomingTasks = computed(() => {
  const now = new Date();
  const today = fmt(now);
  return tasks.value.filter((t) => !t.done && t.due_date && t.due_date >= today)
    .sort((a, b) => (a.due_date + (a.reminder_time || "23:59")).localeCompare(b.due_date + (b.reminder_time || "23:59")))
    .slice(0, 10);
});
async function checkReminders() {
  if (!notificationsAllowed.value || document.visibilityState === "hidden") return;
  // Evita duplicados: se este dispositivo tem uma subscrição push, o servidor é responsável pelo envio.
  try { const registration = await navigator.serviceWorker?.getRegistration("/"); if (await registration?.pushManager?.getSubscription()) return; } catch (_) { /* fallback local */ }
  const now = new Date();
  tasks.value.forEach((t) => {
    if (t.done || !t.due_date || !t.reminder_time) return;
    const target = new Date(`${t.due_date}T${t.reminder_time}`);
    const key = `${t.id}:${t.due_date}:${t.reminder_time}`;
    if (target <= now && now - target < 60000 && !notifiedReminders.has(key)) {
      new Notification("ActivityDay — lembrete", { body: t.title });
      notifiedReminders.add(key);
    }
  });
}
function subscribeRealtime() {
  if (!user.value) return;
  if (realtimeChannel.value) supabase.removeChannel(realtimeChannel.value);
  realtimeChannel.value = supabase.channel(`activities-${user.value.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `user_id=eq.${user.value.id}` }, () => loadTasks())
    .subscribe();
}
async function logout() {
  await supabase.auth.signOut();
  user.value = null;
  tasks.value = [];
  habits.value = [];
  habitLogs.value = [];
  mode("login");
}
function moveMonth(n) {
  calendarMonth.value = new Date(
    calendarMonth.value.getFullYear(),
    calendarMonth.value.getMonth() + n,
    1
  );
}
function exportJson() {
  const blob = new Blob([JSON.stringify(tasks.value, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "activityday-actividades.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
let authSubscription;
onMounted(async () => {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get("type") === "recovery") authMode.value = "update";
  const { data } = await supabase.auth.getSession();
  user.value = data.session?.user || null;
  if (user.value) {
    await loadTasks();
    await loadHabits();
    await loadGoals();
    subscribeRealtime();
  }
  reminderTimer.value = window.setInterval(checkReminders, 15000);
  const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
    user.value = session?.user || null;
    if (event === "PASSWORD_RECOVERY") {
      authMode.value = "update";
      user.value = session?.user || null;
    } else if (user.value) {
      await loadTasks();
      await loadHabits();
      await loadGoals();
      subscribeRealtime();
    } else {
      tasks.value = [];
      if (realtimeChannel.value) supabase.removeChannel(realtimeChannel.value);
      realtimeChannel.value = null;
    }
  });
  authSubscription = listener.subscription;
  loading.value = false;
});
onBeforeUnmount(() => {
  authSubscription?.unsubscribe();
  if (reminderTimer.value) window.clearInterval(reminderTimer.value);
  if (realtimeChannel.value) supabase.removeChannel(realtimeChannel.value);
});
</script>
<template>
  <main class="wrap">
    <header class="hero">
      <div>
        <div class="eyebrow">ORGANIZA • REALIZA • EVOLUI</div>
        <h1>ActivityDay</h1>
        <p>Organiza as tuas actividades, um dia de cada vez.</p>
      </div>
      <div class="mark">✓</div>
    </header>
    <div v-if="message" class="msg" :class="messageType">
      {{ message }} <button class="close" @click="message = ''">×</button>
    </div>
    <section v-if="loading" class="panel center">A carregar…</section>
    <section v-else-if="!user" class="authbox panel">
      <h2>{{ authTitle }}</h2>
      <p class="muted">{{ authSub }}</p>
      <form class="authform" @submit.prevent="authSubmit">
        <label v-if="authMode !== 'update'"
          >E-mail<input
            v-model.trim="email"
            class="field"
            type="email"
            autocomplete="email"
            required
        /></label>
        <label v-if="authMode !== 'reset'"
          >Palavra-passe<input
            v-model="password"
            class="field"
            type="password"
            :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'"
            minlength="6"
            required
        /></label>
        <label v-if="authMode === 'signup' || authMode === 'update'"
          >Confirmar palavra-passe<input
            v-model="confirmPassword"
            class="field"
            type="password"
            autocomplete="new-password"
            minlength="6"
            required
        /></label>
        <button class="btn" :disabled="busy">
          {{
            busy
              ? "A processar…"
              : {
                  login: "Entrar",
                  signup: "Criar conta",
                  reset: "Enviar link de recuperação",
                  update: "Guardar nova palavra-passe",
                }[authMode]
          }}
        </button>
      </form>
      <div class="authlinks">
        <button v-if="authMode === 'login'" class="linkbtn" @click="mode('signup')">
          Criar conta</button
        ><button v-if="authMode === 'login'" class="linkbtn" @click="mode('reset')">
          Esqueci a palavra-passe</button
        ><button v-if="authMode !== 'login'" class="linkbtn" @click="mode('login')">
          Voltar ao login
        </button>
      </div>
    </section>
    <template v-else>
      <section class="welcome row">
        <div>
          <span class="muted">Bem-vindo(a)</span>
          <h2>{{ user.email }}</h2>
        </div>
        <button class="btn outline" @click="logout">Terminar sessão</button>
      </section>
      <section class="stats">
        <div class="stat">
          <small>Total de actividades</small><strong>{{ tasks.length }}</strong>
        </div>
        <div class="stat">
          <small>Concluídas</small><strong>{{ completed }}</strong>
        </div>
        <div class="stat">
          <small>Progresso</small><strong>{{ progress }}%</strong>
        </div>
      </section>
      <div class="progress">
        <div class="bar" :style="{ width: progress + '%' }"></div>
      </div>
      <nav class="tabs app-navigation" aria-label="Navegação principal">
        <RouterLink class="tab nav-primary" :class="{ active: view === 'dashboard' }" to="/dashboard"><span class="nav-icon">⌂</span><span>Painel</span></RouterLink>
        <RouterLink class="tab nav-primary" :class="{ active: view === 'tasks' }" to="/activities"><span class="nav-icon">✓</span><span>Actividades</span></RouterLink>
        <RouterLink class="tab nav-primary" :class="{ active: view === 'habits' }" to="/habits"><span class="nav-icon">↗</span><span>Hábitos</span></RouterLink>
        <RouterLink class="tab nav-primary" :class="{ active: view === 'calendar' }" to="/calendar"><span class="nav-icon">▦</span><span>Calendário</span></RouterLink>
        <details class="nav-more">
          <summary class="tab" :class="{ active: ['goals','reports','reminders','account','export'].includes(view) }"><span class="nav-icon">•••</span><span>Mais</span></summary>
          <div class="nav-more-menu">
            <RouterLink class="tab" :class="{ active: view === 'goals' }" to="/goals">Metas</RouterLink>
            <RouterLink class="tab" :class="{ active: view === 'reports' }" to="/reports">Relatórios</RouterLink>
            <RouterLink class="tab" :class="{ active: view === 'reminders' }" to="/reminders">Lembretes</RouterLink>
            <RouterLink class="tab" :class="{ active: view === 'account' }" to="/account">Conta e privacidade</RouterLink>
            <RouterLink class="tab" :class="{ active: view === 'export' }" to="/export">Exportar JSON</RouterLink>
          </div>
        </details>
      </nav>
      <section v-if="view === 'dashboard'" class="dashboard-view">
        <div class="dashboard-heading">
          <div><span class="muted">{{ new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" }) }}</span><h2>{{ greeting }}, vamos organizar o teu dia.</h2><p class="muted">Aqui está o resumo das tuas actividades.</p></div>
          <RouterLink class="btn" to="/activities">+ Nova actividade</RouterLink>
        </div>
        <div class="dashboard-cards">
          <article class="dashboard-card"><span class="dashboard-icon">☀️</span><small>Actividades de hoje</small><strong>{{ todayTasks.length }}</strong><span class="muted">{{ todayCompleted }} concluída(s)</span></article>
          <article class="dashboard-card"><span class="dashboard-icon">✅</span><small>Concluídas no total</small><strong>{{ completed }}</strong><span class="muted">de {{ tasks.length }} actividade(s)</span></article>
          <article class="dashboard-card" :class="{ 'attention-card': overdueTasks.length }"><span class="dashboard-icon">⏰</span><small>Em atraso</small><strong>{{ overdueTasks.length }}</strong><span class="muted">por concluir</span></article>
          <article class="dashboard-card"><span class="dashboard-icon">📈</span><small>Progresso geral</small><strong>{{ progress }}%</strong><span class="muted">{{ todayProgress }}% do dia concluído</span></article>
        </div>
        <div class="dashboard-progress panel"><div class="row"><div><h3>Progresso de hoje</h3><p class="muted">{{ todayCompleted }} de {{ todayTasks.length }} actividades concluídas</p></div><strong>{{ todayProgress }}%</strong></div><div class="progress"><div class="bar" :style="{ width: todayProgress + '%' }"></div></div></div>
        <div class="dashboard-columns">
          <section class="panel"><div class="row"><h3>Próximas actividades</h3><RouterLink class="text-link" to="/activities">Ver todas</RouterLink></div>
            <div v-if="!upcomingTasks.length" class="empty">Não tens actividades futuras pendentes com data definida.</div>
            <div v-else class="dashboard-list"><article v-for="t in upcomingTasks.slice(0, 5)" :key="t.id" class="dashboard-task"><span class="task-dot" :class="{ high: t.priority === 'Alta' }"></span><div class="taskbody"><strong>{{ t.title }}</strong><div class="meta"><span class="pill">{{ t.due_date === todayKey ? 'Hoje' : t.due_date }}</span><span class="pill">{{ t.category }}</span><span v-if="t.reminder_time" class="pill">⏰ {{ t.reminder_time }}</span></div></div></article></div>
          </section>
          <section class="panel"><div class="row"><h3>Esta semana</h3><RouterLink class="text-link" to="/calendar">Calendário</RouterLink></div><div class="week-summary"><div><strong>{{ weekTasks.length }}</strong><span>com data esta semana</span></div><div><strong>{{ weekCompleted }}</strong><span>concluídas</span></div><div><strong>{{ weekTasks.length - weekCompleted }}</strong><span>por concluir</span></div></div><div v-if="overdueTasks.length" class="overdue-preview"><h4>Precisam de atenção</h4><p v-for="t in overdueTasks.slice(0, 3)" :key="t.id">{{ t.title }} <span>· {{ t.due_date }}</span></p><RouterLink class="text-link" to="/activities">Rever actividades em atraso</RouterLink></div><div v-else class="empty compact-empty">Nenhuma actividade atrasada. Continua assim!</div></section>
        </div>
      </section>
      <section v-if="view === 'tasks'" class="panel">
        <h2>Nova actividade</h2>
        <p class="muted">As actividades diárias, semanais ou mensais com data definida criam a próxima ocorrência quando as marcas como concluídas.</p>
        <form @submit.prevent="saveTask" class="formgrid">
          <input
            v-model="title"
            class="field titlefield"
            placeholder="O que precisas de fazer?"
            required
          /><select v-model="category" class="field">
            <option v-for="c in cats" :key="c[0]">{{ c[0] }}</option></select
          ><select v-model="frequency" class="field">
            <option>Diária</option>
            <option>Semanal</option>
            <option>Mensal</option>
            <option>Única</option></select
          ><input v-model="dueDate" class="field" type="date" /><input
            v-model="reminderTime"
            class="field"
            type="time"
          /><select v-model="priority" class="field">
            <option>Baixa</option>
            <option>Normal</option>
            <option>Alta</option></select
          ><button class="btn">Adicionar actividade</button>
        </form>
      </section>
      <section v-if="view === 'tasks'" class="panel">
        <div class="row">
          <h2>As minhas actividades</h2>
          <span class="muted">{{ filtered.length }} item(ns)</span>
        </div>
        <div class="filters">
          <input
            v-model="search"
            class="field search"
            placeholder="Pesquisar actividade"
          /><select v-model="filter" class="field">
            <option>Todas</option>
            <option v-for="c in cats" :key="c[0]">{{ c[0] }}</option>
          </select>
        </div>
        <div class="filters">
          <button class="btn outline" @click="selectedTasks = filtered.map(t => t.id)">Seleccionar visíveis</button>
          <button class="btn outline" @click="selectedTasks = []">Limpar selecção</button>
          <button class="btn danger" :disabled="!selectedTasks.length" @click="deleteSelectedTasks">Apagar seleccionadas ({{ selectedTasks.length }})</button>
        </div>
        <div v-if="!filtered.length" class="empty">
          Ainda não tens actividades nesta lista.
        </div>
        <div class="list">
          <article
            v-for="t in filtered"
            :key="t.id"
            class="task"
            :class="{ done: t.done }"
          >
            <input type="checkbox" :checked="selectedTasks.includes(t.id)" @change="selectedTasks = $event.target.checked ? [...selectedTasks, t.id] : selectedTasks.filter(id => id !== t.id)" aria-label="Seleccionar actividade" />
            <input type="checkbox" :checked="t.done" @change="toggleTask(t)" aria-label="Marcar como concluída" />
            <div class="taskbody">
              <div class="tasktitle">{{ t.title }}</div>
              <div class="meta">
                <span class="pill">{{ t.category }}</span
                ><span class="pill">{{ t.frequency }}</span
                ><span v-if="t.due_date" class="pill">{{ t.due_date }}</span
                ><span v-if="t.reminder_time" class="pill">⏰ {{ t.reminder_time }}</span
                ><span class="pill" :class="t.priority === 'Alta' ? 'error' : ''">{{
                  t.priority || "Normal"
                }}</span>
              </div>
            </div>
            <button class="del" title="Apagar actividade" @click="deleteTask(t)">
              ×
            </button>
          </article>
        </div>
      </section>

      <section v-if="view === 'goals'" class="panel">
<div class="row"><div><h2>As minhas metas</h2><p class="muted">Define objectivos, prazos e acompanha o progresso.</p></div><span class="pill">{{ activeGoals.length }} activa(s)</span></div>
<form class="goal-form" @submit.prevent="createGoal">
<label>Nome da meta<input v-model.trim="goalTitle" class="field" maxlength="160" placeholder="Ex.: Ler 12 livros este ano" required /></label>
<label>Descrição<textarea v-model.trim="goalDescription" class="field" rows="2" maxlength="1000" placeholder="Como vais alcançar este objectivo?"></textarea></label>
<div class="goal-fields"><label>Prazo<input v-model="goalDueDate" class="field" type="date" /></label><label>Alvo numérico (opcional)<input v-model="goalTarget" class="field" type="number" min="1" step="1" placeholder="Ex.: 12 livros" /></label></div>
<button class="btn" :disabled="goalBusy">{{ goalBusy ? "A guardar…" : "Criar meta" }}</button></form>
<h3>Metas activas</h3><div v-if="!activeGoals.length" class="empty muted">Ainda não tens metas activas. Cria a primeira acima.</div>
<article v-for="goal in activeGoals" :key="goal.id" class="goal-card"><div class="row goal-title-row"><div><h3>{{ goal.title }}</h3><p v-if="goal.description" class="muted">{{ goal.description }}</p></div><span v-if="goal.completed" class="pill habit-done">Concluída</span></div>
<div class="goal-meta"><span v-if="goal.target_date" class="pill">Prazo: {{ goal.target_date }}</span><span v-if="goal.target_value" class="pill">{{ goal.current_value || 0 }} / {{ goal.target_value }}</span><span v-if="goal.target_date && !goal.completed && goal.target_date < habitTodayKey" class="pill overdue-pill">Atrasada</span></div>
<div v-if="goal.target_value" class="progress"><div class="bar" :style="{ width: Math.min(100, Math.round(Number(goal.current_value || 0) / Number(goal.target_value) * 100)) + '%' }"></div></div><p v-if="goal.target_value" class="muted">{{ Math.min(100, Math.round(Number(goal.current_value || 0) / Number(goal.target_value) * 100)) }}% concluído</p>
<div class="goal-actions"><template v-if="goal.target_value && !goal.completed"><button class="btn outline" @click="changeGoalProgress(goal, -1)" :disabled="Number(goal.current_value || 0) <= 0">− 1</button><button class="btn outline" @click="changeGoalProgress(goal, 1)">+ 1 progresso</button></template><button class="btn outline" @click="toggleGoalCompleted(goal)">{{ goal.completed ? "Reabrir meta" : "Marcar concluída" }}</button><button class="btn outline" @click="archiveGoal(goal)">Arquivar</button></div></article>
<div v-if="goals.some(goal => goal.archived)" class="archived-goals"><h3>Metas arquivadas</h3><article v-for="goal in goals.filter(goal => goal.archived)" :key="goal.id" class="goal-card archived-card"><strong>{{ goal.title }}</strong><button class="btn outline" @click="restoreGoal(goal)">Restaurar</button></article></div>
</section>

<section v-if="view === 'habits'" class="panel">
        <div class="row habit-heading"><div><h2>Os meus hábitos</h2><p class="muted">Regista a consistência dos teus hábitos. Cada dia fica guardado no histórico.</p></div><span class="pill">{{ activeHabits.length }} activo(s)</span></div>
        <div class="habit-summary">
          <div class="stat"><small>Hábitos activos</small><strong>{{ activeHabits.length }}</strong></div>
          <div class="stat"><small>Concluídos hoje</small><strong>{{ completedHabitsToday }}</strong></div>
          <div class="stat"><small>Consistência de hoje</small><strong>{{ habitCompletionRate }}%</strong></div>
        </div>
        <div class="progress"><div class="bar" :style="{ width: habitCompletionRate + '%' }"></div></div>
        <form class="habit-form" @submit.prevent="createHabit">
          <label>Nome do hábito<input v-model.trim="habitTitle" class="field" maxlength="120" placeholder="Ex.: Ler 20 minutos" required /></label>
          <label>Frequência<select v-model="habitFrequency" class="field"><option>Diária</option><option>Semanal</option></select></label>
          <fieldset v-if="habitFrequency === 'Semanal'" class="habit-days"><legend>Dias da semana</legend>
            <label v-for="day in [{v:1,t:'Seg'},{v:2,t:'Ter'},{v:3,t:'Qua'},{v:4,t:'Qui'},{v:5,t:'Sex'},{v:6,t:'Sáb'},{v:0,t:'Dom'}]" :key="day.v"><input type="checkbox" :value="day.v" v-model="habitWeekdays" /> {{ day.t }}</label>
          </fieldset>
          <button class="btn" :disabled="habitBusy">{{ habitBusy ? 'A guardar…' : 'Adicionar hábito' }}</button>
        </form>
        <h3>Registo de hoje</h3>
        <div v-if="!activeHabits.length" class="empty">Ainda não tens hábitos. Cria o primeiro no formulário acima.</div>
        <div v-else class="list">
          <article v-for="habit in activeHabits" :key="habit.id" class="task habit-task">
            <input type="checkbox" :checked="Boolean(habitLogForToday(habit.id)?.completed)" :disabled="!habitIsScheduledToday(habit)" @change="toggleHabitToday(habit)" :aria-label="'Registar hábito ' + habit.title" />
            <div class="taskbody"><div class="tasktitle">{{ habit.title }}</div><div class="meta"><span class="pill">{{ habit.frequency }}</span><span class="pill">{{ habitIsScheduledToday(habit) ? 'Previsto para hoje' : 'Não previsto para hoje' }}</span><span v-if="habitLogForToday(habit.id)?.completed" class="pill habit-done">✓ Concluído hoje</span></div></div>
            <button class="btn outline archive-btn" type="button" title="Arquivar este hábito e preservar o histórico" @click="archiveHabit(habit)">Arquivar</button>
          </article>
        </div>
        <p class="muted habit-note">Arquivar retira o hábito da lista activa, mas não elimina o histórico. As realizações já concluídas hoje continuam a contar nos indicadores. Podes restaurar hábitos abaixo.</p>
        <section v-if="archivedHabits.length" class="archived-habits">
          <h3>Hábitos arquivados ({{ archivedHabits.length }})</h3>
          <div class="list">
            <article v-for="habit in archivedHabits" :key="habit.id" class="task habit-task archived-habit">
              <div class="taskbody">
                <div class="tasktitle">{{ habit.title }}</div>
                <div class="meta"><span class="pill">{{ habit.frequency }}</span><span class="pill">Arquivado</span></div>
              </div>
              <button class="btn outline archive-btn" type="button" @click="restoreHabit(habit)">Restaurar</button>
            </article>
          </div>
        </section>
      </section>

      <section v-if="view === 'reports'" class="panel reports-panel">
        <div class="row reports-heading"><div><h2>Relatórios e estatísticas</h2><p class="muted">Acompanha as actividades, os registos de hábitos e as metas.</p></div><div class="report-export-actions"><button class="btn outline" @click="exportReportCsv">Exportar CSV</button><button class="btn" @click="showReportPreview = true">Pré-visualizar PDF</button></div></div>
        <label class="report-period-label">Período do relatório<select v-model="reportPeriod" class="field"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="45">Últimos 45 dias</option></select></label>
        <p class="muted report-range">De {{ reportStart }} até {{ habitTodayKey }}. Os relatórios de hábitos usam o histórico carregado pela aplicação (até 45 dias).</p>
        <div class="report-cards">
          <article class="stat"><small>Actividades no período</small><strong>{{ reportTasks.length }}</strong><span>{{ reportCompletedTasks }} concluídas</span></article>
          <article class="stat"><small>Taxa de conclusão</small><strong>{{ reportCompletionRate }}%</strong><div class="progress"><div class="bar" :style="{width: reportCompletionRate + '%'}"></div></div></article>
          <article class="stat"><small>Registos de hábitos</small><strong>{{ reportCompletedLogs }}/{{ reportLogs.length }}</strong><span>{{ reportHabitRate }}% concluídos</span></article>
          <article class="stat"><small>Metas activas</small><strong>{{ reportGoals.length }}</strong><span>{{ reportGoalsCompleted }} concluída(s) · {{ reportOverdueGoals }} atrasada(s)</span></article>
        </div>
        <section class="report-section"><h3>Actividades por categoria</h3><div v-if="!reportCategoryRows.length" class="empty muted">Não há actividades no período seleccionado.</div><div v-else class="report-category-list"><div v-for="row in reportCategoryRows" :key="row.name" class="report-category"><div class="row"><strong>{{ row.name }}</strong><span>{{ row.done }}/{{ row.total }} concluída(s)</span></div><div class="progress"><div class="bar" :style="{width: (row.total ? row.done / row.total * 100 : 0) + '%'}"></div></div></div></div></section>
        <section class="report-section"><h3>Metas activas</h3><div v-if="!reportGoals.length" class="empty muted">Ainda não existem metas activas.</div><div v-for="goal in reportGoals" :key="goal.id" class="report-goal"><div class="row"><strong>{{ goal.title }}</strong><span class="pill" :class="goal.completed ? 'habit-done' : ''">{{ goal.completed ? 'Concluída' : (goal.target_date && goal.target_date < habitTodayKey ? 'Atrasada' : 'Em curso') }}</span></div><p v-if="goal.target_date" class="muted">Prazo: {{ goal.target_date }}</p><div v-if="goal.target_value" class="progress"><div class="bar" :style="{width: Math.min(100, Number(goal.current_value || 0) / Number(goal.target_value) * 100) + '%'}"></div></div><small v-if="goal.target_value">{{ goal.current_value || 0 }} / {{ goal.target_value }}</small></div></section>
        <p class="muted report-footnote">Nota: as actividades são agrupadas pela data de criação (com alternativa para a data prevista). O CSV inclui actividades do período, registos de hábitos carregados e metas activas.</p>
      </section>

      <section v-if="view === 'calendar'" class="panel">
        <div class="row">
          <button class="btn outline" @click="moveMonth(-1)">‹</button>
          <h2>{{ monthLabel }}</h2>
          <button class="btn outline" @click="moveMonth(1)">›</button>
        </div>
        <div class="calendar">
          <div
            v-for="d in ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']"
            :key="d"
            class="weekday"
          >
            {{ d }}
          </div>
          <div
            v-for="d in calendarDays"
            :key="d.iso"
            class="day"
            :class="{ other: d.other, has: d.items.length }"
          >
            <b>{{ d.day }}</b
            ><small v-for="t in d.items.slice(0, 2)" :key="t.id">{{ t.title }}</small>
          </div>
        </div>
      </section>
      <section v-if="view === 'reminders'" class="panel">
        <h2>Lembretes</h2>
        <p class="muted">Activa as notificações push para receber lembretes mesmo quando o site estiver fechado. Requer HTTPS, permissão do navegador e configuração do serviço no Netlify e Supabase.</p>
        <button class="btn" @click="enableNotifications">Activar notificações push neste dispositivo</button>
        <div class="msg" :class="notificationsAllowed ? 'success' : ''">{{ notificationsAllowed ? "As notificações estão autorizadas neste navegador." : "As notificações não foram autorizadas." }}</div>
        <h3>Próximas actividades</h3>
        <div v-if="!upcomingTasks.length" class="empty">Não tens actividades futuras com data definida.</div>
        <div v-else class="list">
          <article v-for="t in upcomingTasks" :key="t.id" class="task">
            <div class="taskbody"><div class="tasktitle">{{ t.title }}</div><div class="meta"><span class="pill">{{ t.due_date }}</span><span v-if="t.reminder_time" class="pill">⏰ {{ t.reminder_time }}</span><span class="pill">{{ t.category }}</span></div></div>
          </article>
        </div>
      </section>
      <section v-if="view === 'export'" class="panel">
        <h2>Exportar actividades</h2>
        <p class="muted">Descarrega uma cópia das tuas actividades em formato JSON para guardar ou importar noutra ferramenta.</p>
        <div class="export-summary">
          <div class="stat"><small>Total de actividades</small><strong>{{ tasks.length }}</strong></div>
          <div class="stat"><small>Concluídas</small><strong>{{ completed }}</strong></div>
          <div class="stat"><small>Pendentes</small><strong>{{ tasks.length - completed }}</strong></div>
        </div>
        <button class="btn" :disabled="!tasks.length" @click="exportJson">Descarregar ficheiro JSON</button>
        <p v-if="!tasks.length" class="muted">Ainda não existem actividades para exportar.</p>
        <p class="muted">O ficheiro contém apenas as actividades carregadas da tua conta. Não contém palavras-passe nem tokens de autenticação.</p>
      </section>
      <section v-if="view === 'account'" class="panel">
        <h2>Conta e privacidade</h2>
        <p class="muted">Sessão iniciada como: {{ user.email }}</p>
        <div class="msg">Cada conta só pode ler e alterar as suas próprias actividades através das políticas de segurança RLS da base de dados.</div>
        <button class="btn outline" @click="sendPasswordReset">Enviar link para alterar palavra-passe</button>
        <hr class="separator" />
        <button class="btn outline" @click="exportJson">Exportar actividades (JSON)</button>
        <button class="btn danger" @click="deleteAllTasks">Apagar todas as minhas actividades</button>
        <p class="muted">A eliminação das actividades é permanente. A conta de autenticação não é apagada por este botão.</p>
        <button class="linkbtn" @click="logout">Terminar sessão</button>
      </section>
    </template>
    <div v-if="showReportPreview" class="preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-preview-title" @click.self="showReportPreview = false">
      <section class="preview-modal">
        <div class="row preview-modal-heading"><div><span class="eyebrow">DOCUMENTO PARA EXPORTAÇÃO</span><h2 id="report-preview-title">Pré-visualização do relatório</h2><p class="muted">Confirma os dados e o período antes de guardar o PDF.</p></div><button class="btn outline" aria-label="Fechar pré-visualização" @click="showReportPreview = false">Fechar</button></div>
        <div class="pdf-preview-sheet">
          <header class="pdf-preview-brand"><div><span>ACTIVITYDAY</span><h1>Relatório de produtividade</h1><p>Resumo de actividades, hábitos e metas</p></div><div class="pdf-preview-date">Gerado em<br><strong>{{ new Date().toLocaleDateString('pt-PT') }}</strong></div></header>
          <div class="pdf-preview-period">Período: {{ reportStart }} — {{ habitTodayKey }}</div>
          <div class="pdf-preview-stats"><div><small>Actividades</small><strong>{{ reportTasks.length }}</strong><span>{{ reportCompletedTasks }} concluídas</span></div><div><small>Taxa de conclusão</small><strong>{{ reportCompletionRate }}%</strong><span>Actividades concluídas</span></div><div><small>Hábitos</small><strong>{{ reportCompletedLogs }}/{{ reportLogs.length }}</strong><span>{{ reportHabitRate }}% concluídos</span></div><div><small>Metas activas</small><strong>{{ reportGoals.length }}</strong><span>{{ reportGoalsCompleted }} concluídas · {{ reportOverdueGoals }} atrasadas</span></div></div>
          <section class="pdf-preview-section"><h3>Actividades por categoria</h3><table class="pdf-preview-table"><thead><tr><th>Categoria</th><th>Total</th><th>Concluídas</th></tr></thead><tbody><tr v-for="row in reportCategoryRows" :key="row.name"><td>{{ row.name }}</td><td>{{ row.total }}</td><td>{{ row.done }}</td></tr><tr v-if="!reportCategoryRows.length"><td colspan="3">Sem actividades no período seleccionado.</td></tr></tbody></table></section>
          <section class="pdf-preview-section"><h3>Progresso das metas</h3><div v-for="goal in reportGoals" :key="goal.id" class="pdf-preview-goal"><div class="row"><strong>{{ goal.title }}</strong><span>{{ goal.completed ? 'Concluída' : (goal.target_date && goal.target_date < habitTodayKey ? 'Atrasada' : 'Em curso') }}</span></div><div v-if="goal.target_value" class="pdf-preview-track"><i :style="{width: Math.min(100, Number(goal.current_value || 0) / Number(goal.target_value) * 100) + '%'}"></i></div><small v-if="goal.target_value">{{ goal.current_value || 0 }} / {{ goal.target_value }}</small></div><p v-if="!reportGoals.length" class="muted">Não existem metas activas.</p></section>
          <section class="pdf-preview-section"><h3>Registos incluídos ({{ reportExportRows.length }})</h3><div class="pdf-preview-table-wrap"><table class="pdf-preview-table"><thead><tr><th>Tipo</th><th>Título</th><th>Data</th><th>Estado</th><th>Detalhe</th></tr></thead><tbody><tr v-for="(item, index) in reportExportRows.slice(0, 12)" :key="`${item.type}-${item.title}-${index}`"><td>{{ item.type }}</td><td>{{ item.title }}</td><td>{{ item.date }}</td><td>{{ item.status }}</td><td>{{ item.detail }}</td></tr></tbody></table></div><p v-if="reportExportRows.length > 12" class="muted">A pré-visualização mostra os primeiros 12 registos. O PDF inclui todos os {{ reportExportRows.length }} registos.</p><p v-if="!reportExportRows.length" class="muted">Não existem registos para apresentar.</p></section>
          <footer class="pdf-preview-footer">ActivityDay · As tuas actividades, organizadas.</footer>
        </div>
        <div class="preview-modal-actions"><button class="btn outline" @click="showReportPreview = false">Voltar ao relatório</button><button class="btn" @click="exportReportPdf">Imprimir / Guardar PDF</button></div>
        <p class="muted preview-help">Ao continuar, abre-se a pré-visualização de impressão do navegador. Escolhe <strong>Guardar como PDF</strong> como destino.</p>
      </section>
    </div>
    <footer>ActivityDay · As tuas actividades, organizadas.</footer>
  </main>
</template>
