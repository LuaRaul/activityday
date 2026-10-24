self.addEventListener("push", (event) => {
  let data = { title: "ActivityDay — lembrete", body: "Tens uma actividade agendada.", url: "/reminders" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) { if (event.data) data.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(data.title || "ActivityDay — lembrete", {
    body: data.body || "Tens uma actividade agendada.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: data.url || "/reminders" },
    tag: data.tag || "activityday-reminder",
    renotify: false,
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/reminders", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) { existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});
