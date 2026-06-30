self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "GreenSoil Telemetria", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "GreenSoil Telemetria", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag || "telemetria-alarm",
      data: payload.data || {},
      requireInteraction: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/mobile";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes("/mobile"));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
