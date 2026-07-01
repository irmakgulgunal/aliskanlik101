import { useEffect, useState, useCallback } from "react";
import { currentStreak, getReminderTimes, todayKey, type Habit } from "./habits";

const ENABLED_KEY = "zincir.notifications.enabled";
const FIRED_KEY = "zincir.notifications.fired"; // { date: "YYYY-MM-DD", ids: string[] }

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

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

function motivateFor(h: Habit): string {
  const streak = currentStreak(h);
  if (streak >= 21) return `${streak} gündür süren zincirini bugün de büyüt.`;
  if (streak >= 7) return `${streak} günlük zincirini kırma — sen yaparsın!`;
  if (streak >= 3) return `${streak} gündür ara vermedin. Bugün de devam!`;
  if (h.microGoal) return h.microGoal;
  return MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)];
}

export function getPermission(): NotifPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotifPermission;
}

async function getSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/sw.js");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

async function syncScheduleToSW(habits: Habit[]) {
  const reg = await getSW();
  const ctrl = reg?.active || reg?.waiting || reg?.installing;
  if (!ctrl) return;
  const payload = habits.map((h) => ({
    id: h.id,
    name: h.name,
    microGoal: motivateFor(h),
    times: getReminderTimes(h),
    completedDates: h.completions,
    streak: currentStreak(h),
  }));
  ctrl.postMessage({ type: "SET_SCHEDULE", habits: payload });
  // Immediately check in case a reminder time already passed within window.
  ctrl.postMessage({ type: "CHECK_NOW" });
}

async function tryPeriodicSync() {
  const reg = await getSW();
  if (!reg) return;
  // periodicSync — requires PWA installation + user engagement. Best effort.
  const anyReg = reg as unknown as {
    periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    sync?: { register: (tag: string) => Promise<void> };
  };
  try {
    // 15 minutes is the practical floor Chrome enforces.
    await anyReg.periodicSync?.register("zincir-check", { minInterval: 15 * 60 * 1000 });
  } catch {}
  try {
    await anyReg.sync?.register("zincir-check");
  } catch {}
}

function loadFired(): { date: string; ids: string[] } {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return { date: todayKey(), ids: [] };
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayKey()) return { date: todayKey(), ids: [] };
    return parsed;
  } catch {
    return { date: todayKey(), ids: [] };
  }
}

function saveFired(data: { date: string; ids: string[] }) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(data));
  } catch {}
}

async function fireNotification(title: string, body: string) {
  // Prefer the SW so notifications work even if the tab is backgrounded.
  const reg = await getSW().catch(() => null);
  if (reg) {
    try {
      await reg.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `zincir-${title}`,
      });
      return;
    } catch {}
  }
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `zincir-${title}`,
    });
    setTimeout(() => n.close(), 10000);
  } catch {}
}

function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

/**
 * Schedules browser notifications for all habit reminder times remaining today.
 * Returns a cleanup function that clears pending timers.
 */
function scheduleForToday(habits: Habit[]): () => void {
  const timers: number[] = [];
  if (typeof window === "undefined" || getPermission() !== "granted") return () => {};
  const now = new Date();
  const fired = loadFired();

  for (const h of habits) {
    const times = getReminderTimes(h);
    times.forEach((t, idx) => {
      const parsed = parseHHMM(t);
      if (!parsed) return;
      const when = new Date();
      when.setHours(parsed.h, parsed.m, 0, 0);
      const key = `${h.id}@${t}#${idx}`;
      if (fired.ids.includes(key)) return;
      const delay = when.getTime() - now.getTime();
      if (delay < 0) return;
      // setTimeout cap ~24.8 days; safe here since same-day scheduling.
      const id = window.setTimeout(() => {
        // Don't notify if already completed today
        if (h.completions.includes(todayKey())) return;
        fireNotification(`⏰ ${h.name}`, motivateFor(h));
        const f = loadFired();
        if (!f.ids.includes(key)) {
          f.ids.push(key);
          saveFired(f);
        }
      }, delay);
      timers.push(id);
    });
  }

  // Schedule a re-run just after midnight to pick up next day's reminders.
  const midnight = new Date();
  midnight.setHours(24, 0, 30, 0);
  const midId = window.setTimeout(() => {
    saveFired({ date: todayKey(new Date()), ids: [] });
  }, midnight.getTime() - now.getTime());
  timers.push(midId);

  return () => timers.forEach((id) => clearTimeout(id));
}

export function useNotifications(habits: Habit[]) {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [permission, setPermissionState] = useState<NotifPermission>("default");

  useEffect(() => {
    setPermissionState(getPermission());
    try {
      setEnabled(localStorage.getItem(ENABLED_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (getPermission() !== "granted") return;
    // Register SW + push schedule so notifications fire even when the tab is closed.
    syncScheduleToSW(habits);
    tryPeriodicSync();
    const cleanup = scheduleForToday(habits);
    // Reschedule when tab regains focus (in case system slept)
    const onFocus = () => {
      cleanup();
      syncScheduleToSW(habits);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cleanup();
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, habits]);

  const enable = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermissionState("unsupported");
      return false;
    }
    let perm = Notification.permission as NotifPermission;
    if (perm === "default") {
      perm = (await Notification.requestPermission()) as NotifPermission;
    }
    setPermissionState(perm);
    if (perm === "granted") {
      try {
        localStorage.setItem(ENABLED_KEY, "1");
      } catch {}
      setEnabled(true);
      await getSW();
      await tryPeriodicSync();
      return true;
    }
    return false;
  }, []);

  const disable = useCallback(() => {
    try {
      localStorage.setItem(ENABLED_KEY, "0");
    } catch {}
    setEnabled(false);
  }, []);

  const testNotification = useCallback(async () => {
    if (getPermission() !== "granted") return;
    await fireNotification("🔔 Zincir", "Bildirimler çalışıyor. Zincirini koru!");
  }, []);

  return { enabled, permission, enable, disable, testNotification };
}