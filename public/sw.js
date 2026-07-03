// Zincir service worker — Web Push + in-tab fallback
// Uygulama kapalıyken Supabase'den gelen push mesajlarını karşılar.

const CACHE_NAME = "zincir-state-v1";
const SCHEDULE_URL = "/__zincir__/schedule.json";
const FIRED_URL    = "/__zincir__/fired.json";

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
  if (streak >= 7)  return `${streak} günlük zincirini kırma — sen yaparsın!`;
  if (streak >= 3)  return `${streak} gündür ara vermedin. Bugün de devam!`;
  if (habit.microGoal) return habit.microGoal;
  return MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)];
}

// ─── Cache helpers ──────────────────────────────────────────────────────────

async function readJSON(url, fallback) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(url);
    if (!res) return fallback;
    return await res.json();
  } catch { return fallback; }
}

async function writeJSON(url, data) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(url, new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  }));
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── In-tab schedule check (fallback for when push is not available) ─────────

async function checkAndFire() {
  const schedule = await readJSON(SCHEDULE_URL, { habits: [], maxPerDay: 0 });
  let fired = await readJSON(FIRED_URL, { date: todayKey(), ids: [] });
  if (fired.date !== todayKey()) fired = { date: todayKey(), ids: [] };

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const maxPerDay = Number(schedule.maxPerDay) || 0;

  const pending = [];
  for (const habit of schedule.habits || []) {
    if ((habit.completedDates || []).includes(todayKey())) continue;
    for (let i = 0; i < (habit.times || []).length; i++) {
      const t = habit.times[i];
      const mt = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
      if (!mt) continue;
      const reminderMin = Number(mt[1]) * 60 + Number(mt[2]);
      const key = `${habit.id}@${t}#${i}`;
      if (fired.ids.includes(key)) continue;
      const diff = nowMin - reminderMin;
      // Sadece son ~20 dk içindeki bildirimler (saatine yakın olsun).
      if (diff < -1 || diff > 20) continue;
      pending.push({ habit, t, key, reminderMin });
    }
  }
  pending.sort((a, b) => a.reminderMin - b.reminderMin);

  for (const p of pending) {
    if (maxPerDay > 0 && fired.ids.length >= maxPerDay) break;
    await self.registration.showNotification(`⏰ ${p.habit.name}`, {
      body: pickMessage(p.habit),
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: `zincir-${p.habit.id}-${p.t}`,
      data: { url: "/", habitId: p.habit.id },
      requireInteraction: false,
    });
    fired.ids.push(p.key);
  }
  await writeJSON(FIRED_URL, fired);
}

// ─── Web Push event (uygulama kapalıyken Supabase'den gelir) ─────────────────

self.addEventListener("push", (event) => {
  let data = { title: "Zincir", body: "Alışkanlığını unutma! 🔥", habitId: null };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Zincir", {
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.habitId ? `zincir-push-${data.habitId}` : "zincir-push",
      data: { url: "/", habitId: data.habitId },
      requireInteraction: false,
      vibrate: [200, 100, 200],
    })
  );
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────

self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ─── Messages from the page ──────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SET_SCHEDULE") {
    event.waitUntil(writeJSON(SCHEDULE_URL, { habits: msg.habits || [], maxPerDay: Number(msg.maxPerDay) || 0 }));
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

// ─── Background sync (PWA kuruluysa) ─────────────────────────────────────────

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "zincir-check") e.waitUntil(checkAndFire());
});

self.addEventListener("sync", (e) => {
  if (e.tag === "zincir-check") e.waitUntil(checkAndFire());
});

// ─── Bildirime tıklanınca uygulamayı aç ──────────────────────────────────────

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
