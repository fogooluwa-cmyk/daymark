self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() ?? "A task is due." }; }
  const title = data.title || "Daymark reminder";
  const options = {
    body: data.body || "A task is ready when you are.",
    tag: data.tag || data.taskId || "daymark-reminder",
    renotify: false,
    data: { url: data.url || "/today" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/today", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === destination);
    if (existing) return existing.focus();
    return self.clients.openWindow(destination);
  }));
});
