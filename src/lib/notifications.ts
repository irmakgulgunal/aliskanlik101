import { useEffect, useState, useCallback } from "react";
import { getReminderTimes, todayKey, type Habit } from "./habits";

const ENABLED_KEY = "zincir.notifications.enabled";
const FIRED_KEY = "zincir.notifications.fired"; // { date: "YYYY-MM-DD", ids: string[] }

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

export function getPermission(): NotifPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotifPermission;
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

function fireNotification(title: string, body: string) {
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
        fireNotification(`⏰ ${h.name}`, h.microGoal || "Küçük bir adım at, zincirini koru.");
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
    const cleanup = scheduleForToday(habits);
    // Reschedule when tab regains focus (in case system slept)
    const onFocus = () => {
      cleanup();
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

  const testNotification = useCallback(() => {
    if (getPermission() === "granted") {
      fireNotification("🔔 Zincir", "Bildirimler çalışıyor. Zincirini koru!");
    }
  }, []);

  return { enabled, permission, enable, disable, testNotification };
}