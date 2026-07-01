import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  Bell,
  BellOff,
  Book,
  Brain,
  Briefcase,
  Check,
  Droplet,
  Footprints,
  Heart,
  Home,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORIES,
  type Category,
  type Habit,
  STORAGE_KEY,
  currentStreak,
  dailyRates,
  defaultReminderTimes,
  formatToday,
  getReminderTimes,
  greeting,
  last7Days,
  monthlyCompletionRate,
  monthlyDailyRates,
  todayKey,
  todaysTip,
  useHabits,
  WEEKDAY_TR,
  weeklyCompletionRate,
  weeklyTrend,
} from "@/lib/habits";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/lib/theme";
import { ACCENTS, useAccent } from "@/lib/accent";
import { BADGE_DAYS, badgeProgress, earnedBadgeCount } from "@/lib/badges";
import { useNotifications } from "@/lib/notifications";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zincir — Alışkanlık Takip" },
      {
        name: "description",
        content:
          "Mikro alışkanlıklarla başla, zincirini koru. Tek dokunuşla işaretle, kategorilere ayır, haftalık ilerlemeni gör.",
      },
      { property: "og:title", content: "Zincir — Alışkanlık Takip" },
      {
        property: "og:description",
        content: "Mikro alışkanlıklarla başla, zincirini koru.",
      },
    ],
  }),
  component: Index,
});

const ICONS_FOR_CATEGORY: Record<Category, React.ComponentType<{ className?: string }>> = {
  saglik: Heart,
  uretkenlik: Briefcase,
  gelisim: Brain,
};

function pickIcon(name: string): React.ComponentType<{ className?: string }> {
  const n = name.toLocaleLowerCase("tr");
  if (n.includes("su")) return Droplet;
  if (n.includes("kitap") || n.includes("oku")) return Book;
  if (n.includes("medita") || n.includes("nefes")) return Sparkles;
  if (n.includes("yürü") || n.includes("yuru") || n.includes("koş") || n.includes("kos")) return Footprints;
  return Heart;
}

function Index() {
  const { habits, toggleToday, addHabit, removeHabit } = useHabits();
  useAccent();
  useNotifications(habits);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [view, setView] = useState<"home" | "stats" | "badges" | "settings">("home");
  const [open, setOpen] = useState(false);

  const visible = useMemo(
    () => (filter === "all" ? habits : habits.filter((h) => h.category === filter)),
    [habits, filter],
  );

  const today = todayKey();
  const rate = weeklyCompletionRate(habits);
  const rates = dailyRates(habits);
  const bestStreak = useMemo(
    () => habits.reduce((m, h) => Math.max(m, currentStreak(h)), 0),
    [habits],
  );
  const badgesEarned = useMemo(
    () => earnedBadgeCount(habits),
    [habits],
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-display p-5 pb-32 md:max-w-md md:mx-auto">
      {/* Header */}
      <header className="flex justify-between items-end mb-8 animate-in">
        <div>
          <p suppressHydrationWarning className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
            {formatToday()}
          </p>
          <h1 suppressHydrationWarning className="text-3xl font-extrabold tracking-tight text-balance">
            {greeting()}.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setView("settings")}
            aria-label="Ayarlar"
            className={cn(
              "size-10 rounded-2xl flex items-center justify-center transition-colors border",
              view === "settings"
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-card text-foreground/80 hover:text-foreground",
            )}
          >
            <SettingsIcon className="size-5" />
          </button>
        </div>
      </header>

        {view === "home" ? (
        <>
          {/* Micro tip */}
          <div className="mb-6 p-4 bg-accent/20 rounded-3xl flex items-center gap-4 animate-in" style={{ animationDelay: "50ms" }}>
            <div className="size-10 bg-accent rounded-2xl flex-shrink-0 flex items-center justify-center">
              <Sparkles className="size-5 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-mono uppercase text-foreground/60">Mikro Öneri</p>
              <p className="text-sm font-semibold">{todaysTip()}</p>
            </div>
          </div>

          {/* Bento Stats */}
          <section className="grid grid-cols-2 gap-3 mb-8 animate-in" style={{ animationDelay: "100ms" }}>
            <div className="col-span-2 p-5 bg-card rounded-[2rem] border shadow-sm flex flex-col justify-between aspect-[2/1]">
              <div className="flex justify-between items-start">
                <span className="text-sm font-semibold">Haftalık İlerleme</span>
                <span className="text-xs font-mono bg-accent/30 px-2 py-0.5 rounded-full">
                  %{rate}
                </span>
              </div>
              <div className="flex gap-1.5 items-end h-16">
                {rates.map((r, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-16 flex items-end">
                      <div
                        className="w-full bg-primary rounded-t-lg transition-all"
                        style={{
                          height: `${Math.max(6, r * 100)}%`,
                          opacity: 0.35 + r * 0.65,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {WEEKDAY_TR[(new Date().getDay() + 6 - (6 - i)) % 7]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 bg-primary text-primary-foreground rounded-[2rem] shadow-lg shadow-primary/20 flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase opacity-80">En Uzun Zincir</span>
              <span className="text-4xl font-extrabold tracking-tighter">{bestStreak}</span>
              <span className="text-xs font-medium">Gün kesintisiz</span>
            </div>
            <div className="p-5 bg-card rounded-[2rem] border flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Rozetler</span>
              <span className="text-4xl font-extrabold tracking-tighter">{badgesEarned}</span>
              <div className="size-9 bg-accent/30 rounded-full flex items-center justify-center mt-auto">
                <Award className="size-5 text-accent-foreground" />
              </div>
            </div>
          </section>

          {/* Category Filters */}
          <nav className="flex gap-2 overflow-x-auto pb-6 animate-in no-scrollbar" style={{ animationDelay: "200ms" }}>
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              Hepsi
            </FilterChip>
            {CATEGORIES.map((c) => (
              <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
                {c.label}
              </FilterChip>
            ))}
          </nav>

          {/* Habit List */}
          <section className="space-y-3 animate-in" style={{ animationDelay: "300ms" }}>
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
              Bugünün Odağı
            </h2>
            {visible.length === 0 ? (
              <EmptyState onAdd={() => setOpen(true)} />
            ) : (
              visible.map((h) => (
                <HabitCard
                  key={h.id}
                  habit={h}
                  done={h.completions.includes(today)}
                  onToggle={() => toggleToday(h.id)}
                  onRemove={() => removeHabit(h.id)}
                />
              ))
            )}
          </section>
        </>
      ) : view === "stats" ? (
        <StatsView habits={habits} />
      ) : view === "badges" ? (
        <BadgesView habits={habits} />
      ) : (
        <SettingsView habits={habits} />
      )}

      {/* Add Habit Dialog */}
      <AddHabitDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(h) => {
          addHabit(h);
          setOpen(false);
        }}
      />

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-[360px] bg-foreground/95 backdrop-blur-md rounded-full px-3 py-2.5 flex justify-between items-center shadow-2xl z-40">
        <NavBtn active={view === "home"} onClick={() => setView("home")} aria-label="Anasayfa">
          <Home className="size-5" />
        </NavBtn>
        <NavBtn active={view === "stats"} onClick={() => setView("stats")} aria-label="İstatistikler">
          <BarChart3 className="size-5" />
        </NavBtn>
        <button
          onClick={() => setOpen(true)}
          className="size-11 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          aria-label="Yeni alışkanlık ekle"
        >
          <Plus className="size-5" />
        </button>
        <NavBtn active={view === "badges"} onClick={() => setView("badges")} aria-label="Rozetler">
          <Award className="size-5" />
        </NavBtn>
      </nav>
    </div>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-card border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ThemeToggle() {
  const { theme, cycle } = useTheme();
  const label: Record<Theme, string> = { light: "Aydınlık", dark: "Karanlık", system: "Sistem" };
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      onClick={cycle}
      aria-label={`Tema: ${label[theme]} — değiştir`}
      title={`Tema: ${label[theme]}`}
      className="size-10 rounded-2xl bg-card border flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors"
    >
      <Icon className="size-5" />
    </button>
  );
}



function NavBtn({
  active,
  children,
  onClick,
  ...rest
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "size-10 flex items-center justify-center rounded-full transition-colors",
        active ? "text-background" : "text-background/40 hover:text-background/70",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function HabitCard({
  habit,
  done,
  onToggle,
  onRemove,
}: {
  habit: Habit;
  done: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const Icon = pickIcon(habit.name);
  const CatIcon = ICONS_FOR_CATEGORY[habit.category];
  const streak = currentStreak(habit);
  const reminders = getReminderTimes(habit);
  const reminderLabel =
    reminders.length === 0
      ? ""
      : reminders.length === 1
        ? reminders[0]
        : `${reminders.length}× ${reminders.join(" · ")}`;

  return (
    <div
      className={cn(
        "group p-4 rounded-[1.5rem] border flex items-center justify-between transition-all duration-300",
        done ? "bg-accent/10 border-accent/30" : "bg-card hover:shadow-md",
      )}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className={cn(
          "size-12 rounded-2xl flex items-center justify-center shrink-0",
          done ? "bg-card" : "bg-secondary",
        )}>
          <Icon className="size-5 text-foreground/70" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-base leading-tight truncate">{habit.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <CatIcon className="size-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground truncate">
              {habit.microGoal}
              {reminderLabel ? ` • 🔔 ${reminderLabel}` : ""}
            </p>
          </div>
          {streak > 0 && (
            <p className="text-[10px] font-mono uppercase tracking-wider text-primary mt-1">
              🔥 {streak} gün zincir
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onRemove}
          className="size-8 rounded-xl text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
          aria-label="Sil"
        >
          <Trash2 className="size-4" />
        </button>
        <button
          onClick={onToggle}
          className={cn(
            "size-12 rounded-2xl flex items-center justify-center transition-all active:scale-90",
            done
              ? "bg-accent text-accent-foreground"
              : "bg-secondary hover:bg-primary hover:text-primary-foreground",
          )}
          aria-label={done ? "Geri al" : "Tamamla"}
        >
          {done ? <Check className="size-5" strokeWidth={3} /> : <div className="size-3 border-2 border-current rounded-full" />}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="p-8 bg-card rounded-[1.5rem] border text-center">
      <div className="size-12 mx-auto bg-accent/30 rounded-2xl flex items-center justify-center mb-3">
        <Sparkles className="size-5 text-accent-foreground" />
      </div>
      <h3 className="font-semibold mb-1">Hoş geldin.</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Hayatını daha verimli hale getirmek için alışkanlık ekle.
      </p>
      <button
        onClick={onAdd}
        className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold"
      >
        İlk alışkanlığını ekle
      </button>
    </div>
  );
}

function StatsView({ habits }: { habits: Habit[] }) {
  const days = last7Days();
  const monthRates = monthlyDailyRates(habits, 30);
  const monthRate = monthlyCompletionRate(habits, 30);
  const trend = weeklyTrend(habits, 8);
  const maxWeek = Math.max(0.0001, ...trend.map((t) => t.rate));
  return (
    <section className="space-y-6 animate-in">
      {/* Monthly heatmap */}
      <div className="p-5 bg-card rounded-[2rem] border">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-sm font-semibold">Son 30 Gün</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Günlük tamamlanma yoğunluğu</p>
          </div>
          <span className="text-xs font-mono bg-accent/30 px-2 py-0.5 rounded-full">
            %{monthRate}
          </span>
        </div>
        <div className="grid grid-cols-10 gap-1.5">
          {monthRates.map((r, i) => (
            <div
              key={i}
              className="aspect-square rounded-md bg-primary"
              style={{ opacity: 0.12 + r * 0.88 }}
              title={`Gün ${i + 1}: %${Math.round(r * 100)}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] font-mono text-muted-foreground">
          <span>az</span>
          {[0.15, 0.35, 0.6, 0.85, 1].map((o) => (
            <div key={o} className="size-2.5 rounded-sm bg-primary" style={{ opacity: o }} />
          ))}
          <span>çok</span>
        </div>
      </div>

      {/* Weekly trend over 8 weeks */}
      <div className="p-5 bg-card rounded-[2rem] border">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-sm font-semibold">Aylık Trend</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Son 8 haftanın ortalaması</p>
          </div>
        </div>
        <div className="flex gap-2 items-end h-24">
          {trend.map((t, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full h-full flex items-end">
                <div
                  className="w-full bg-primary rounded-t-lg transition-all"
                  style={{
                    height: `${Math.max(6, (t.rate / maxWeek) * 100)}%`,
                    opacity: 0.4 + (t.rate / maxWeek) * 0.6,
                  }}
                />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Alışkanlık Bazlı Zincirler
      </h2>
      {habits.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
      ) : (
        habits.map((h) => {
          const Icon = pickIcon(h.name);
          const streak = currentStreak(h);
          return (
            <div key={h.id} className="p-4 bg-card rounded-[1.5rem] border">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-2xl bg-secondary flex items-center justify-center">
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{h.name}</h3>
                  <p className="text-xs text-muted-foreground">🔥 {streak} gün</p>
                </div>
              </div>
              <div className="flex gap-1">
                {days.map((d, i) => {
                  const ok = h.completions.includes(todayKey(d));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          "w-full aspect-square rounded-lg",
                          ok ? "bg-primary" : "bg-secondary",
                        )}
                      />
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {WEEKDAY_TR[(d.getDay() + 6) % 7]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}

function BadgesView({ habits }: { habits: Habit[] }) {
  const progress = badgeProgress(habits);
  const earned = progress.filter((p) => p.earned);
  const locked = progress.filter((p) => !p.earned);
  return (
    <section className="space-y-6 animate-in">
      <div className="p-5 bg-primary text-primary-foreground rounded-[2rem] shadow-lg shadow-primary/20 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase opacity-80">Toplam Rozet</p>
          <p className="text-4xl font-extrabold tracking-tighter leading-none mt-1">
            {earned.length}
            <span className="text-lg opacity-70">/{progress.length}</span>
          </p>
          <p className="text-xs mt-2 opacity-90">Her rozet {BADGE_DAYS} günlük zincirle kazanılır.</p>
        </div>
        <Award className="size-12 opacity-90" />
      </div>

      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Kazanılan Rozetler
        </h2>
        {earned.length === 0 ? (
          <div className="p-5 bg-card rounded-[1.5rem] border text-sm text-muted-foreground">
            Henüz rozet yok. {BADGE_DAYS} gün üst üste sürdürdüğün ilk alışkanlık ilk rozetini açacak.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {earned.map((p) => (
              <BadgeCard key={p.badge.id} progress={p} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Yolda Olanlar
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {locked.map((p) => (
            <BadgeCard key={p.badge.id} progress={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BadgeCard({ progress }: { progress: ReturnType<typeof badgeProgress>[number] }) {
  const pct = Math.min(100, Math.round((progress.bestStreak / BADGE_DAYS) * 100));
  return (
    <div
      className={cn(
        "p-4 rounded-[1.5rem] border flex flex-col gap-2 transition-all",
        progress.earned
          ? "bg-accent/20 border-accent/40"
          : "bg-card opacity-90",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "size-11 rounded-2xl flex items-center justify-center text-2xl",
            progress.earned ? "bg-accent/40" : "bg-secondary grayscale",
          )}
        >
          <span aria-hidden>{progress.badge.emoji}</span>
        </div>
        {progress.earned ? (
          <span className="text-[9px] font-mono uppercase bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            Açıldı
          </span>
        ) : (
          <span className="text-[9px] font-mono uppercase text-muted-foreground">
            {progress.bestStreak}/{BADGE_DAYS}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-sm leading-tight">{progress.badge.title}</h3>
      <p className="text-[11px] text-muted-foreground leading-snug">
        {progress.badge.description}
      </p>
      {!progress.earned && (
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {progress.sourceHabit && (
        <p className="text-[10px] font-mono text-muted-foreground truncate">
          {progress.earned ? "✓ " : "→ "}
          {progress.sourceHabit}
        </p>
      )}
    </div>
  );
}

function AddHabitDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (h: {
    name: string;
    microGoal: string;
    category: Category;
    reminders?: string[];
  }) => void;
}) {
  const [name, setName] = useState("");
  const [micro, setMicro] = useState("");
  const [cat, setCat] = useState<Category>("saglik");
  const [count, setCount] = useState(1);
  const [times, setTimes] = useState<string[]>(defaultReminderTimes(1));

  const setCountSafe = (n: number) => {
    const c = Math.max(0, Math.min(6, n));
    setCount(c);
    setTimes(defaultReminderTimes(c));
  };

  const updateTime = (idx: number, val: string) => {
    setTimes((prev) => prev.map((t, i) => (i === idx ? val : t)));
  };

  const submit = () => {
    if (!name.trim()) return;
    const cleaned = times.filter((t) => t && /^\d{2}:\d{2}$/.test(t));
    onSubmit({
      name: name.trim(),
      microGoal: micro.trim() || "Mikro adımla başla",
      category: cat,
      reminders: cleaned.length > 0 ? cleaned : undefined,
    });
    setName("");
    setMicro("");
    setCat("saglik");
    setCount(1);
    setTimes(defaultReminderTimes(1));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni alışkanlık</DialogTitle>
          <DialogDescription>
            Küçük başla. Günde 2 sayfa kitap, 1 bardak su — zincir buradan büyür.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">İsim</Label>
            <Input id="name" placeholder="Örn. Su iç" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="micro">Mikro hedef</Label>
            <Input id="micro" placeholder="Örn. Sadece 2 sayfa" value={micro} onChange={(e) => setMicro(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.id)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-semibold transition-colors",
                    cat === c.id
                      ? "bg-foreground text-background"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Günlük hatırlatıcı sayısı</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCountSafe(count - 1)}
                  className="size-8 rounded-full bg-secondary text-foreground font-bold active:scale-90"
                  aria-label="Azalt"
                >
                  −
                </button>
                <span className="font-mono text-sm w-6 text-center">{count}</span>
                <button
                  type="button"
                  onClick={() => setCountSafe(count + 1)}
                  className="size-8 rounded-full bg-secondary text-foreground font-bold active:scale-90"
                  aria-label="Artır"
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {count === 0
                ? "Hatırlatıcı yok — sessiz mod."
                : `Günde ${count} kez bildirim alacaksın. Saatleri özelleştirebilirsin.`}
            </p>
            {count > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {times.map((t, i) => (
                  <div key={i} className="space-y-1">
                    <Label htmlFor={`time-${i}`} className="text-[11px] text-muted-foreground">
                      {i + 1}. hatırlatma
                    </Label>
                    <Input
                      id={`time-${i}`}
                      type="time"
                      value={t}
                      onChange={(e) => updateTime(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={submit}
            className="w-full bg-primary text-primary-foreground rounded-full py-3 font-semibold active:scale-95 transition-transform"
          >
            Ekle
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsView({ habits }: { habits: Habit[] }) {
  const { accent, setAccent } = useAccent();
  const { theme, setTheme } = useTheme();
  const { enabled, permission, enable, disable, testNotification } = useNotifications(habits);
  const [confirming, setConfirming] = useState(false);

  const reset = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem("zincir.theme");
      window.localStorage.removeItem("zincir.accent");
      window.localStorage.setItem(STORAGE_KEY, "[]");
    } catch {}
    window.location.reload();
  };

  const themeOptions: { id: Theme; label: string }[] = [
    { id: "light", label: "Aydınlık" },
    { id: "dark", label: "Karanlık" },
    { id: "system", label: "Sistem" },
  ];

  return (
    <section className="space-y-6 animate-in">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight mb-1">Ayarlar</h2>
        <p className="text-sm text-muted-foreground">Görünümü kişiselleştir veya uygulamayı sıfırla.</p>
      </div>

      {/* Accent color */}
      <div className="p-5 bg-card rounded-[2rem] border">
        <h3 className="text-sm font-semibold mb-1">Vurgu Rengi</h3>
        <p className="text-xs text-muted-foreground mb-4">Arka plan ve butonlar bu renge göre değişir.</p>
        <div className="grid grid-cols-3 gap-3">
          {ACCENTS.map((a) => {
            const active = accent === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                aria-label={a.label}
                aria-pressed={active}
                className={cn(
                  "group flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                  active ? "border-foreground/40 bg-secondary" : "border-transparent hover:bg-secondary/50",
                )}
              >
                <span
                  className={cn(
                    "size-10 rounded-full shadow-sm flex items-center justify-center",
                    active && "ring-2 ring-offset-2 ring-offset-card ring-foreground/40",
                  )}
                  style={{ background: a.swatch }}
                >
                  {active && <Check className="size-4 text-white" strokeWidth={3} />}
                </span>
                <span className="text-xs font-medium">{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme */}
      <div className="p-5 bg-card rounded-[2rem] border">
        <h3 className="text-sm font-semibold mb-1">Tema</h3>
        <p className="text-xs text-muted-foreground mb-4">Aydınlık, karanlık veya cihazına uy.</p>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((o) => {
            const Icon = o.id === "light" ? Sun : o.id === "dark" ? Moon : Monitor;
            const active = theme === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setTheme(o.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-2xl border text-xs font-medium transition-colors",
                  active
                    ? "bg-foreground text-background border-transparent"
                    : "bg-secondary border-transparent text-foreground/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset */}
      {/* Notifications */}
      <div className="p-5 bg-card rounded-[2rem] border">
        <h3 className="text-sm font-semibold mb-1">Bildirimler</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Alışkanlıklarına ayarladığın saatlerde tarayıcı bildirimi al. Uygulama açık (veya arka planda sekme olarak) olmalıdır.
        </p>
        {permission === "unsupported" ? (
          <p className="text-xs text-destructive">Bu tarayıcı bildirimleri desteklemiyor.</p>
        ) : permission === "denied" ? (
          <p className="text-xs text-destructive">
            Bildirim izni reddedildi. Tarayıcı site ayarlarından izin vermelisin.
          </p>
        ) : enabled && permission === "granted" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-primary">
              <Bell className="size-4" /> Bildirimler açık
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={testNotification}
                className="bg-secondary rounded-full py-3 text-sm font-semibold active:scale-95 transition-transform"
              >
                Test bildirimi
              </button>
              <button
                onClick={disable}
                className="bg-secondary rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <BellOff className="size-4" /> Kapat
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={enable}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-full py-3 text-sm font-semibold active:scale-95 transition-transform"
          >
            <Bell className="size-4" />
            Bildirimleri aç
          </button>
        )}
      </div>

      <div className="p-5 bg-card rounded-[2rem] border">
        <h3 className="text-sm font-semibold mb-1">Uygulamayı Sıfırla</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Tüm alışkanlıkların, zincirlerin ve tercihlerin silinir. Bu işlem geri alınamaz.
        </p>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full flex items-center justify-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-full py-3 text-sm font-semibold hover:bg-destructive/15 transition-colors"
          >
            <RotateCcw className="size-4" />
            Uygulamayı sıfırla
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-center font-semibold text-destructive">Emin misin? Bu işlem geri alınamaz.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="bg-secondary rounded-full py-3 text-sm font-semibold"
              >
                Vazgeç
              </button>
              <button
                onClick={reset}
                className="bg-destructive text-destructive-foreground rounded-full py-3 text-sm font-semibold active:scale-95 transition-transform"
              >
                Evet, sıfırla
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
