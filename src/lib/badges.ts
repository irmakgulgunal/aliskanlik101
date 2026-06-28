import type { Habit, Category } from "./habits";
import { currentStreak } from "./habits";

export const BADGE_DAYS = 21;

export type Badge = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  /** Match habit by category and/or name keyword (Turkish lowercase). */
  match: (h: Habit) => boolean;
};

const lower = (s: string) => s.toLocaleLowerCase("tr");
const includesAny = (name: string, words: string[]) => {
  const n = lower(name);
  return words.some((w) => n.includes(w));
};
const byCategory = (c: Category) => (h: Habit) => h.category === c;
const byKeyword = (words: string[]) => (h: Habit) => includesAny(h.name, words);

export const BADGES: Badge[] = [
  // Konu (anahtar kelime) bazlı
  {
    id: "hydration",
    title: "Hidrasyon Kahramanı",
    description: "21 gün boyunca su içme alışkanlığını sürdürdün.",
    emoji: "💧",
    match: byKeyword(["su"]),
  },
  {
    id: "bookworm",
    title: "Kitap Kurdu",
    description: "21 gün boyunca her gün kitap okudun.",
    emoji: "📚",
    match: byKeyword(["kitap", "oku"]),
  },
  {
    id: "zen",
    title: "Zihin Berraklığı",
    description: "21 gün meditasyon / nefes pratiği — zihnin parlak.",
    emoji: "🧘",
    match: byKeyword(["medita", "nefes", "mindful"]),
  },
  {
    id: "steps",
    title: "Adım Adım",
    description: "21 gün yürüyüş veya koşu zinciri.",
    emoji: "🚶",
    match: byKeyword(["yürü", "yuru", "koş", "kos", "adım", "adim"]),
  },
  {
    id: "fit",
    title: "Form Tutkunu",
    description: "21 gün spor / egzersiz alışkanlığı.",
    emoji: "💪",
    match: byKeyword(["spor", "egzersiz", "antren", "fitness", "yoga"]),
  },
  {
    id: "sleep",
    title: "Uyku Disiplini",
    description: "21 gün düzenli uyku rutini.",
    emoji: "🌙",
    match: byKeyword(["uyku", "uyu", "yat"]),
  },
  {
    id: "journal",
    title: "Günlük Yazarı",
    description: "21 gün boyunca günlük tutma alışkanlığı.",
    emoji: "📓",
    match: byKeyword(["günlük", "gunluk", "yaz", "journal"]),
  },
  {
    id: "learn",
    title: "Öğrenme Tutkunu",
    description: "21 gün boyunca yeni bir şey öğrenmeye devam ettin.",
    emoji: "🎓",
    match: byKeyword(["öğren", "ogren", "ders", "kurs", "dil"]),
  },
  // Kategori bazlı (genel)
  {
    id: "cat-saglik",
    title: "Sağlık Şampiyonu",
    description: "Sağlık kategorisinde 21 günlük bir zincir tamamladın.",
    emoji: "🩺",
    match: byCategory("saglik"),
  },
  {
    id: "cat-uretkenlik",
    title: "Üretkenlik Ustası",
    description: "Üretkenlik kategorisinde 21 günlük zincir.",
    emoji: "🚀",
    match: byCategory("uretkenlik"),
  },
  {
    id: "cat-gelisim",
    title: "Gelişim Yolcusu",
    description: "Kişisel Gelişim kategorisinde 21 gün kesintisiz.",
    emoji: "🧠",
    match: byCategory("gelisim"),
  },
];

export type BadgeProgress = {
  badge: Badge;
  earned: boolean;
  /** En yakın eşleşen alışkanlığın mevcut zinciri. */
  bestStreak: number;
  /** Rozeti tetikleyen alışkanlığın adı (varsa). */
  sourceHabit?: string;
};

export function badgeProgress(habits: Habit[]): BadgeProgress[] {
  return BADGES.map((b) => {
    const matching = habits.filter(b.match);
    let best = 0;
    let src: string | undefined;
    for (const h of matching) {
      const s = currentStreak(h);
      if (s > best) {
        best = s;
        src = h.name;
      }
    }
    return {
      badge: b,
      earned: best >= BADGE_DAYS,
      bestStreak: best,
      sourceHabit: src,
    };
  });
}

export function earnedBadgeCount(habits: Habit[]): number {
  return badgeProgress(habits).filter((p) => p.earned).length;
}