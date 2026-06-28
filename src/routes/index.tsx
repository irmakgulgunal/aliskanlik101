import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  Bell,
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
  currentStreak,
  dailyRates,
  formatToday,
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
  const [filter, setFilter] = useState<Category | "all">("all");
  const [view, setView] = useState<"home" | "stats">("home");
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
    () => habits.filter((h) => currentStreak(h) >= 7).length,
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
          <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
            <Bell className="size-5 text-primary" />
          </div>
        </div>
      </header>

      {view === "home" ? (
        <>
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

          {/* Micro tip */}
          <div className="mt-6 p-4 bg-accent/20 rounded-3xl flex items-center gap-4 animate-in" style={{ animationDelay: "500ms" }}>
            <div className="size-10 bg-accent rounded-2xl flex-shrink-0 flex items-center justify-center">
              <Sparkles className="size-5 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-mono uppercase text-foreground/60">Mikro Öneri</p>
              <p className="text-sm font-semibold">{todaysTip()}</p>
            </div>
          </div>
        </>
      ) : (
        <StatsView habits={habits} />
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
        <NavBtn onClick={() => setView("home")} aria-label="Rozetler">
          <Award className="size-5" />
        </NavBtn>
        <NavBtn onClick={() => setView("home")} aria-label="Profil">
          <Heart className="size-5" />
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

function FilterChipDuplicate({
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
              {habit.reminder ? ` • ${habit.reminder}` : ""}
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
      <h3 className="font-semibold mb-1">Henüz alışkanlık yok</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Küçük bir adımla başla. Günde 2 sayfa kitap, 1 bardak su.
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

function AddHabitDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (h: { name: string; microGoal: string; category: Category; reminder?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [micro, setMicro] = useState("");
  const [cat, setCat] = useState<Category>("saglik");
  const [reminder, setReminder] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      microGoal: micro.trim() || "Mikro adımla başla",
      category: cat,
      reminder: reminder || undefined,
    });
    setName("");
    setMicro("");
    setCat("saglik");
    setReminder("");
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
          <div className="space-y-1.5">
            <Label htmlFor="reminder">Hatırlatıcı saati (opsiyonel)</Label>
            <Input id="reminder" type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />
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
