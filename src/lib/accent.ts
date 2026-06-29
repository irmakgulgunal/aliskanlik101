import { useEffect, useState } from "react";

export type AccentId = "orange" | "rose" | "violet" | "emerald" | "sky" | "amber";

export type Accent = {
  id: AccentId;
  label: string;
  swatch: string;
  primary: string;
  accent: string;
  ring: string;
};

export const ACCENTS: Accent[] = [
  {
    id: "orange",
    label: "Turuncu",
    swatch: "#f97316",
    primary: "oklch(0.72 0.17 45)",
    accent: "oklch(0.85 0.16 90)",
    ring: "oklch(0.72 0.17 45)",
  },
  {
    id: "rose",
    label: "Gül",
    swatch: "#f43f5e",
    primary: "oklch(0.68 0.2 10)",
    accent: "oklch(0.86 0.1 350)",
    ring: "oklch(0.68 0.2 10)",
  },
  {
    id: "violet",
    label: "Mor",
    swatch: "#8b5cf6",
    primary: "oklch(0.62 0.2 290)",
    accent: "oklch(0.85 0.1 300)",
    ring: "oklch(0.62 0.2 290)",
  },
  {
    id: "emerald",
    label: "Yeşil",
    swatch: "#10b981",
    primary: "oklch(0.66 0.16 155)",
    accent: "oklch(0.86 0.13 135)",
    ring: "oklch(0.66 0.16 155)",
  },
  {
    id: "sky",
    label: "Gök",
    swatch: "#0ea5e9",
    primary: "oklch(0.65 0.16 235)",
    accent: "oklch(0.85 0.09 225)",
    ring: "oklch(0.65 0.16 235)",
  },
  {
    id: "amber",
    label: "Kehribar",
    swatch: "#eab308",
    primary: "oklch(0.78 0.16 80)",
    accent: "oklch(0.88 0.14 95)",
    ring: "oklch(0.78 0.16 80)",
  },
];

const KEY = "zincir.accent";

function applyAccent(id: AccentId) {
  if (typeof document === "undefined") return;
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0];
  const r = document.documentElement.style;
  r.setProperty("--primary", a.primary);
  r.setProperty("--accent", a.accent);
  r.setProperty("--ring", a.ring);
  r.setProperty("--chart-1", a.primary);
}

export function useAccent() {
  const [accent, setAccentState] = useState<AccentId>("orange");

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as AccentId | null) ?? "orange";
    setAccentState(stored);
    applyAccent(stored);
  }, []);

  const setAccent = (id: AccentId) => {
    localStorage.setItem(KEY, id);
    setAccentState(id);
    applyAccent(id);
  };

  return { accent, setAccent };
}