// Zincir service worker: enables background reminder notifications.
// Persists the reminder schedule in Cache Storage so it survives SW restarts.

const CACHE_NAME = "zincir-state-v1";
const SCHEDULE_URL = "/__zincir__/schedule.json";
const FIRED_URL = "/__zincir__/fired.json";

const MOTIVATION = [
  "Bugün küçük bir adım, yarın büyük bir zincir. Hadi başla!",
  "Zincirini kırma — sadece bir dakikanı ayır.",
  "Küçük ama düzenli. En iyi versiyonuna bir adım daha.",
  "Sadece başla; gerisi kendiliğinden gelir.",
  "Bugünün seni yarın gururlandıracak.",
  "Motivasyon değil, disiplin. Şimdi tam zamanı.",
  "Kendine verdiğin sözü tut. Zincirin seninle gurur duysun.",
  "İki dakika. Sadece iki dakika ayır, yeter.",
  "Zincirin uzuyor — bugünü de ekle!",
  "Küçük tutarlılık, büyük dönüşüm.",
];

function pickMessage(habit) {
  const streak = habit.streak || 0;
  if (streak >= 21) return `${streak} gündür süren zincirini bugün de büyüt.`;
  if (streak >= 7) return `${streak} günlük zincirini kırma — sen yaparsın!`;
  if (streak >= 3) return `${streak} gündür ara vermedin. Bugün de devam!`;
  if (habit.microGoal) return habit.microGoal;
  return MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)];
}

async function readJSON(url, fallback) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(url);
    if (!res) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

async function writeJSON(url, data) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(url, new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } }));
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function checkAndFire() {
  const schedule = await readJSON(SCHEDULE_URL, { habits: [] });
  let fired = await readJSON(FIRED_URL, { date: todayKey(), ids: [] });
  if (fired.date !== todayKey()) fired = { date: todayKey(), ids: [] };

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const habit of schedule.habits || []) {
    if ((habit.completedDates || []).includes(todayKey())) continue;
    for (let i = 0; i < (habit.times || []).length; i++) {
      const t = habit.times[i];
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
      if (!m) continue;
      const reminderMin = Number(m[1]) * 60 + Number(m[2]);
      const key = `${habit.id}@${t}#${i}`;
      if (fired.ids.includes(key)) continue;
      // Fire if we're at or past the reminder time, within a 90-minute window (in case sync was delayed)
      const diff = nowMin - reminderMin;
      if (diff < 0 || diff > 90) continue;
      await self.registration.showNotification(`⏰ ${habit.name}`, {
        body: pickMessage(habit),
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `zincir-${habit.id}-${t}`,
        data: { url: "/", habitId: habit.id },
        requireInteraction: false,
      });
      fired.ids.push(key);
    }
  }
  await writeJSON(FIRED_URL, fired);
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SET_SCHEDULE") {
    event.waitUntil(writeJSON(SCHEDULE_URL, { habits: msg.habits || [] }));
  } else if (msg.type === "CHECK_NOW") {
    event.waitUntil(checkAndFire());
  } else if (msg.type === "RESET_FIRED") {
    event.waitUntil(writeJSON(FIRED_URL, { date: todayKey(), ids: [] }));
  } else if (msg.type === "TEST") {
    event.waitUntil(
      self.registration.showNotification("🔔 Zincir", {
        body: "Bildirimler çalışıyor. Zincirini koru!",
        icon: "/favicon.ico",
        tag: "zincir-test",
      })
    );
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "zincir-check") {
    event.waitUntil(checkAndFire());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "zincir-check") {
    event.waitUntil(checkAndFire());
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});