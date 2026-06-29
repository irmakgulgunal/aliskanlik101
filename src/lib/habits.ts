import { useEffect, useState } from "react";

export type Category = "saglik" | "uretkenlik" | "gelisim";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "saglik", label: "Sağlık" },
  { id: "uretkenlik", label: "Üretkenlik" },
  { id: "gelisim", label: "Kişisel Gelişim" },
];

export type Habit = {
  id: string;
  name: string;
  microGoal: string;
  category: Category;
  /** Geriye dönük: tek hatırlatma saati. Yeni kayıtlarda `reminders` kullanılır. */
  reminder?: string;
  /** Gün içinde gönderilecek hatırlatıcı saatleri ("HH:MM"). */
  reminders?: string[];
  createdAt: string; // ISO date
  completions: string[]; // YYYY-MM-DD list
};

export const STORAGE_KEY = "zincir.habits.v1";

export const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const dateKey = (d: Date) => todayKey(d);

const SEED: Habit[] = [
  {
    id: "seed-1",
    name: "Su İç",
    microGoal: "Hedef: 2.5 Litre",
    category: "saglik",
    reminders: ["09:00", "13:00", "17:00", "20:00"],
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    completions: Array.from({ length: 12 }, (_, i) =>
      todayKey(new Date(Date.now() - (i + 1) * 86400000)),
    ),
  },
  {
    id: "seed-2",
    name: "Kitap Oku",
    microGoal: "Mikro: Sadece 2 sayfa",
    category: "gelisim",
    reminders: ["22:30"],
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    completions: [todayKey(), ...Array.from({ length: 8 }, (_, i) => todayKey(new Date(Date.now() - (i + 1) * 86400000)))],
  },
  {
    id: "seed-3",
    name: "Meditasyon",
    microGoal: "5 Dakika nefes",
    category: "saglik",
    reminders: ["08:30"],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    completions: Array.from({ length: 3 }, (_, i) => todayKey(new Date(Date.now() - (i + 1) * 86400000))),
  },
];

const load = (): Habit[] => {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    return JSON.parse(raw);
  } catch {
    return SEED;
  }
};

const save = (habits: Habit[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
};

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>(SEED);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHabits(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save(habits);
  }, [habits, hydrated]);

  const toggleToday = (id: string) => {
    const k = todayKey();
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              completions: h.completions.includes(k)
                ? h.completions.filter((c) => c !== k)
                : [k, ...h.completions],
            }
          : h,
      ),
    );
  };

  const addHabit = (h: Omit<Habit, "id" | "createdAt" | "completions">) => {
    setHabits((prev) => [
      {
        ...h,
        id: `h-${Date.now()}`,
        createdAt: new Date().toISOString(),
        completions: [],
      },
      ...prev,
    ]);
  };

  const removeHabit = (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  };

  return { habits, hydrated, toggleToday, addHabit, removeHabit };
}

export function currentStreak(h: Habit): number {
  const set = new Set(h.completions);
  let streak = 0;
  const d = new Date();
  // If today not done, start from yesterday so streak still counts.
  if (!set.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(todayKey(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function last7Days(): Date[] {
  const out: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}

export function weeklyCompletionRate(habits: Habit[]): number {
  if (habits.length === 0) return 0;
  const days = last7Days();
  let done = 0;
  let total = 0;
  for (const d of days) {
    const k = dateKey(d);
    for (const h of habits) {
      total += 1;
      if (h.completions.includes(k)) done += 1;
    }
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function dailyRates(habits: Habit[]): number[] {
  return last7Days().map((d) => {
    const k = dateKey(d);
    if (habits.length === 0) return 0;
    const done = habits.filter((h) => h.completions.includes(k)).length;
    return done / habits.length;
  });
}

export function lastNDays(n: number): Date[] {
  const out: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}

export function monthlyDailyRates(habits: Habit[], days = 30): number[] {
  return lastNDays(days).map((d) => {
    const k = dateKey(d);
    if (habits.length === 0) return 0;
    const done = habits.filter((h) => h.completions.includes(k)).length;
    return done / habits.length;
  });
}

export function monthlyCompletionRate(habits: Habit[], days = 30): number {
  const rates = monthlyDailyRates(habits, days);
  if (rates.length === 0) return 0;
  const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
  return Math.round(avg * 100);
}

// Weekly aggregation across the last `weeks` weeks (oldest -> newest).
export function weeklyTrend(habits: Habit[], weeks = 8): { label: string; rate: number }[] {
  const out: { label: string; rate: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - (w * 7 + i));
      days.push(d);
    }
    let done = 0;
    let total = 0;
    for (const d of days) {
      const k = dateKey(d);
      for (const h of habits) {
        total += 1;
        if (h.completions.includes(k)) done += 1;
      }
    }
    const rate = total === 0 ? 0 : done / total;
    const last = days[days.length - 1];
    out.push({ label: `${last.getDate()}/${last.getMonth() + 1}`, rate });
  }
  return out;
}

export const WEEKDAY_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function formatToday(): string {
  const d = new Date();
  const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  return `${d.getDate()} ${months[d.getMonth()]}, ${days[d.getDay()]}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

export const MICRO_TIPS = [
  "Bugün sadece 2 sayfa oku — gerisi bonus.",
  "Su şişeni görebileceğin bir yere koy.",
  "5 dakika nefes egzersizi yeter, fazlası lüks.",
  "Yürüyüşe çıkmak için harika bir hava.",
  "Küçük adım, büyük zincir. Başlamak yeterli.",
];

export function todaysTip(): string {
  const idx = new Date().getDate() % MICRO_TIPS.length;
  return MICRO_TIPS[idx];
}

/** Hatırlatıcı saatlerini normalize eder (eski `reminder` alanını da kapsar). */
export function getReminderTimes(h: Habit): string[] {
  if (h.reminders && h.reminders.length > 0) return h.reminders;
  if (h.reminder) return [h.reminder];
  return [];
}

/** Verilen sayıda hatırlatıcıyı 09:00 - 21:00 arasında eşit dağıtır. */
export function defaultReminderTimes(count: number): string[] {
  if (count <= 0) return [];
  const startMin = 9 * 60;
  const endMin = 21 * 60;
  const out: string[] = [];
  if (count === 1) {
    out.push(formatMinutes(Math.round((startMin + endMin) / 2)));
    return out;
  }
  const step = (endMin - startMin) / (count - 1);
  for (let i = 0; i < count; i++) {
    out.push(formatMinutes(Math.round(startMin + i * step)));
  }
  return out;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}