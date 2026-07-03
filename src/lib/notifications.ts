import { useEffect, useState, useCallback } from "react";
import { currentStreak, getReminderTimes, todayKey, type Habit } from "./habits";

// ─── Sabitler ────────────────────────────────────────────────────────────────

const ENABLED_KEY   = "zincir.notifications.enabled";
const FIRED_KEY     = "zincir.notifications.fired";
const DEVICE_ID_KEY = "zincir.device.id";
const MAX_PER_DAY_KEY = "zincir.notifications.maxPerDay";
const DEFAULT_MAX_PER_DAY = 0; // 0 = sınırsız

export function loadMaxPerDay(): number {
  if (typeof window === "undefined") return DEFAULT_MAX_PER_DAY;
  try {
    const raw = localStorage.getItem(MAX_PER_DAY_KEY);
    if (raw == null) return DEFAULT_MAX_PER_DAY;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_PER_DAY;
  } catch { return DEFAULT_MAX_PER_DAY; }
}

function saveMaxPerDay(n: number) {
  try { localStorage.setItem(MAX_PER_DAY_KEY, String(Math.max(0, Math.floor(n)))); } catch {}
}

// ⚠️  Supabase projenizi bağladıktan sonra bu iki değeri doldurun.
// Supabase Dashboard → Project Settings → API kısmından alabilirsiniz.
const SUPABASE_URL      = (import.meta.env.VITE_SUPABASE_URL as string)      || "https://hsvefmxggizbdwbgaucb.supabase.co/functions/v1/send-reminders";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzdmVmbXhnZ2l6YmR3YmdhdWNiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjg5Nzc4MCwiZXhwIjoyMDk4NDczNzgwfQ.DV0_cgQFVsk-2PCZLj0rU2UG29WVetAamXrQq5hBTcU";

// VAPID public key (Supabase secret'taki private key ile eşleşmeli)
const VAPID_PUBLIC_KEY = "BJzqru9UuJbj17cHlLBuUZtBiEEI1tKZXvhz6wgirLk6c2Zz3RNTrNitFveHxpxiHnge2Fn5IqWThW61olCRc9Y";

// ─── Tip tanımları ────────────────────────────────────────────────────────────

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function getPermission(): NotifPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotifPermission;
}

// ─── Service Worker ───────────────────────────────────────────────────────────

async function getSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/sw.js");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch { return null; }
}

// ─── Supabase push subscription kaydı ────────────────────────────────────────

async function savePushSubscription(sub: PushSubscription): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  const json     = sub.toJSON();
  const deviceId = getDeviceId();
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey:          SUPABASE_ANON_KEY,
      Authorization:  `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer:          "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      device_id: deviceId,
      endpoint:  json.endpoint,
      p256dh:    json.keys?.p256dh,
      auth:      json.keys?.auth,
    }),
  }).catch(() => {});
}

async function deletePushSubscription(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  const deviceId = getDeviceId();
  await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?device_id=eq.${deviceId}`,
    {
      method: "DELETE",
      headers: {
        apikey:         SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  ).catch(() => {});
}

// ─── Supabase habit reminder senkronizasyonu ──────────────────────────────────

export async function syncHabitReminders(habit: Habit): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  const deviceId    = getDeviceId();
  const times       = getReminderTimes(habit);
  const timezone    = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul";

  // Önce bu habit'in eski kayıtlarını sil
  await fetch(
    `${SUPABASE_URL}/rest/v1/habit_reminders?device_id=eq.${deviceId}&habit_id=eq.${habit.id}`,
    {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    }
  ).catch(() => {});

  if (times.length === 0) return;

  await fetch(`${SUPABASE_URL}/rest/v1/habit_reminders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey:          SUPABASE_ANON_KEY,
      Authorization:  `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer:          "resolution=merge-duplicates",
    },
    body: JSON.stringify(
      times.map((t) => ({
        device_id:    deviceId,
        habit_id:     habit.id,
        habit_title:  habit.name,
        reminder_time: t,
        timezone,
      }))
    ),
  }).catch(() => {});
}

export async function deleteHabitReminders(habitId: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  const deviceId = getDeviceId();
  await fetch(
    `${SUPABASE_URL}/rest/v1/habit_reminders?device_id=eq.${deviceId}&habit_id=eq.${habitId}`,
    {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    }
  ).catch(() => {});
}

// ─── Push subscription oluşturma ──────────────────────────────────────────────

async function subscribeToPush(): Promise<PushSubscription | null> {
  const reg = await getSW();
  if (!reg) return null;
  await navigator.serviceWorker.ready;
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }
    await savePushSubscription(sub);
    return sub;
  } catch { return null; }
}

// ─── In-tab zamanlayıcı (sekme açıkken yedek olarak çalışır) ─────────────────

const MOTIVATION = [
  "Bugün küçük bir adım, yarın büyük bir zincir. Hadi başla!",
  "Zincirini kırma — sadece bir dakikanı ayır.",
  "Küçük ama düzenli. En iyi versiyonuna bir adım daha yaklaş.",
  "Sadece başla; gerisi kendiliğinden gelir.",
  "Bugünün seni yarın gururlandıracak.",
  "Motivasyon değil, disiplin. Şimdi tam zamanı.",
  "Kendine verdiğin sözü tut. ",
  "İki dakika. Sadece iki dakika ayır, yeter.",
  "Zincirin uzuyor — bugünü de ekle!",
  "Küçük tutarlılık, büyük dönüşüm.",
];

function motivateFor(h: Habit): string {
  const streak = currentStreak(h);
  if (streak >= 21) return `${streak} gündür süren zincirini bugün de büyüt.`;
  if (streak >= 7)  return `${streak} günlük zincirini kırma — sen yaparsın!`;
  if (streak >= 3)  return `${streak} gündür ara vermedin. Bugün de devam!`;
  if (h.microGoal)  return h.microGoal;
  return MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)];
}

function loadFired(): { date: string; ids: string[] } {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return { date: todayKey(), ids: [] };
    const p = JSON.parse(raw);
    if (p.date !== todayKey()) return { date: todayKey(), ids: [] };
    return p;
  } catch { return { date: todayKey(), ids: [] }; }
}

function saveFired(data: { date: string; ids: string[] }) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(data)); } catch {}
}

async function fireNotification(title: string, body: string) {
  const reg = await getSW().catch(() => null);
  if (reg) {
    try {
      await reg.showNotification(title, {
        body, icon: "/favicon.ico", badge: "/favicon.ico",
        tag: `zincir-${title}`,
      });
      return;
    } catch {}
  }
  try {
    const n = new Notification(title, { body, icon: "/favicon.ico" });
    setTimeout(() => n.close(), 10000);
  } catch {}
}

async function syncScheduleToSW(habits: Habit[]) {
  const reg  = await getSW();
  const ctrl = reg?.active || reg?.waiting || reg?.installing;
  if (!ctrl) return;
  const payload = habits.map((h) => ({
    id: h.id, name: h.name, microGoal: motivateFor(h),
    times: getReminderTimes(h), completedDates: h.completions,
    streak: currentStreak(h),
  }));
  ctrl.postMessage({ type: "SET_SCHEDULE", habits: payload, maxPerDay: loadMaxPerDay() });
  ctrl.postMessage({ type: "CHECK_NOW" });
}

function scheduleForToday(habits: Habit[]): () => void {
  const timers: number[] = [];
  if (typeof window === "undefined" || getPermission() !== "granted") return () => {};
  const now   = new Date();
  const fired = loadFired();
  const maxPerDay = loadMaxPerDay();

  // Tüm bildirimleri saate göre sırala; en erken olanlar önceliklidir.
  type Item = { key: string; when: Date; habit: Habit };
  const items: Item[] = [];
  for (const h of habits) {
    const times = getReminderTimes(h);
    times.forEach((t, idx) => {
      const mt = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
      if (!mt) return;
      const when = new Date();
      when.setHours(Number(mt[1]), Number(mt[2]), 0, 0);
      const key   = `${h.id}@${t}#${idx}`;
      items.push({ key, when, habit: h });
    });
  }
  items.sort((a, b) => a.when.getTime() - b.when.getTime());

  for (const it of items) {
    if (fired.ids.includes(it.key)) continue;
    const delay = it.when.getTime() - now.getTime();
    if (delay < 0) continue;
    const id = window.setTimeout(() => {
      if (it.habit.completions.includes(todayKey())) return;
      const f = loadFired();
      const limit = loadMaxPerDay();
      if (limit > 0 && f.ids.length >= limit) return;
      if (f.ids.includes(it.key)) return;
      fireNotification(`⏰ ${it.habit.name}`, motivateFor(it.habit));
      f.ids.push(it.key);
      saveFired(f);
    }, delay);
    timers.push(id);
  }
  void maxPerDay;

  const midnight = new Date();
  midnight.setHours(24, 0, 30, 0);
  timers.push(
    window.setTimeout(
      () => saveFired({ date: todayKey(new Date()), ids: [] }),
      midnight.getTime() - now.getTime()
    )
  );
  return () => timers.forEach(clearTimeout);
}

// ─── Ana hook ─────────────────────────────────────────────────────────────────

export function useNotifications(habits: Habit[]) {
  const [enabled, setEnabled]         = useState(false);
  const [permission, setPermission]   = useState<NotifPermission>("default");
  const [maxPerDay, setMaxPerDayState] = useState<number>(DEFAULT_MAX_PER_DAY);

  useEffect(() => {
    setPermission(getPermission());
    try { setEnabled(localStorage.getItem(ENABLED_KEY) === "1"); } catch {}
    setMaxPerDayState(loadMaxPerDay());
  }, []);

  useEffect(() => {
    if (!enabled || getPermission() !== "granted") return;
    syncScheduleToSW(habits);
    const cleanup = scheduleForToday(habits);
    const onFocus = () => { cleanup(); syncScheduleToSW(habits); };
    window.addEventListener("focus", onFocus);
    return () => { cleanup(); window.removeEventListener("focus", onFocus); };
  }, [enabled, habits, maxPerDay]);

  const updateMaxPerDay = useCallback((n: number) => {
    saveMaxPerDay(n);
    setMaxPerDayState(n);
  }, []);

  // Bildirimleri etkinleştir
  const enable = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return false;
    }
    let perm = Notification.permission as NotifPermission;
    if (perm === "default") {
      perm = (await Notification.requestPermission()) as NotifPermission;
    }
    setPermission(perm);
    if (perm !== "granted") return false;

    try { localStorage.setItem(ENABLED_KEY, "1"); } catch {}
    setEnabled(true);

    // Push subscription oluştur ve Supabase'e kaydet
    await subscribeToPush();

    // Mevcut habit'lerin reminder saatlerini Supabase'e yaz
    for (const h of habits) {
      await syncHabitReminders(h);
    }

    return true;
  }, [habits]);

  // Bildirimleri kapat
  const disable = useCallback(async () => {
    try { localStorage.setItem(ENABLED_KEY, "0"); } catch {}
    setEnabled(false);

    // Push subscription'ı iptal et
    try {
      const reg = await getSW();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {}

    await deletePushSubscription();
  }, []);

  // Test bildirimi
  const testNotification = useCallback(async () => {
    if (getPermission() !== "granted") return;
    await fireNotification("🔔 Zincir", "Bildirimler çalışıyor. Zincirini koru!");
  }, []);

  return { enabled, permission, enable, disable, testNotification, maxPerDay, setMaxPerDay: updateMaxPerDay };
}
