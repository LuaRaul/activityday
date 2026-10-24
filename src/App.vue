<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { supabase } from "./supabase";
const route = useRoute();
const view = computed(() => ({ "/activities": "tasks", "/calendar": "calendar", "/reminders": "reminders", "/account": "account", "/export": "export" }[route.path] || "tasks"));
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
async function toggleTask(t) {
  const { data, error } = await supabase
    .from("activities")
    .update({ done: !t.done })
    .eq("id", t.id)
    .select()
    .single();
  if (error) notify(error.message, "error");
  else Object.assign(t, data);
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
  if (!("Notification" in window)) return notify("Este navegador não suporta notificações.", "error");
  const permission = await Notification.requestPermission();
  notificationsAllowed.value = permission === "granted";
  notify(notificationsAllowed.value ? "Notificações activadas neste navegador." : "As notificações não foram autorizadas.", notificationsAllowed.value ? "success" : "error");
}
async function sendPasswordReset() {
  if (!user.value?.email) return notify("Não foi possível identificar o e-mail da conta.", "error");
  const { error } = await supabase.auth.resetPasswordForEmail(user.value.email, { redirectTo: location.origin });
  if (error) notify(error.message, "error");
  else notify("Enviámos um link para alterar a palavra-passe para o teu e-mail.", "success");
}
const upcomingTasks = computed(() => {
  const now = new Date();
  const today = fmt(now);
  return tasks.value.filter((t) => !t.done && t.due_date && t.due_date >= today)
    .sort((a, b) => (a.due_date + (a.reminder_time || "23:59")).localeCompare(b.due_date + (b.reminder_time || "23:59")))
    .slice(0, 10);
});
function checkReminders() {
  if (!notificationsAllowed.value || document.visibilityState === "hidden") return;
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
      <nav class="tabs" aria-label="Navegação principal">
        <RouterLink class="tab" :class="{ active: view === 'tasks' }" to="/activities">Actividades</RouterLink>
        <RouterLink class="tab" :class="{ active: view === 'calendar' }" to="/calendar">Calendário</RouterLink>
        <RouterLink class="tab" :class="{ active: view === 'reminders' }" to="/reminders">Lembretes</RouterLink>
        <RouterLink class="tab" :class="{ active: view === 'account' }" to="/account">Conta e privacidade</RouterLink>
        <RouterLink class="tab" :class="{ active: view === 'export' }" to="/export">Exportar JSON</RouterLink>
      </nav>
      <section v-if="view === 'tasks'" class="panel">
        <h2>Nova actividade</h2>
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
        <p class="muted">Os lembretes do navegador funcionam enquanto a aplicação está aberta. Para notificações com a aplicação fechada, seria necessário um serviço de notificações push.</p>
        <button class="btn" @click="enableNotifications">Activar notificações</button>
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
    <footer>ActivityDay · As tuas actividades, organizadas.</footer>
  </main>
</template>
