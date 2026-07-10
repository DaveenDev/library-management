// Ported from the design's theme definitions (parchment / sepia / sage + accents).
import type { CSSProperties } from "react";
import type { BadgeKind } from "@lumen/shared";

export type ThemeKey = "parchment" | "sepia" | "sage";

interface ThemeTokens {
  bgPage: string;
  bgSidebar: string;
  borderSidebar: string;
  bgCard: string;
  borderCard: string;
  borderInput: string;
  bgInput: string;
  bgSoft: string;
  bgHover: string;
  bgActive: string;
  bgRowHover: string;
  borderRow: string;
  ink: string;
  swatch: string;
}

export const THEMES: Record<ThemeKey, ThemeTokens> = {
  parchment: { bgPage: "#f4eede", bgSidebar: "#eae1cb", borderSidebar: "#dbd0b5", bgCard: "#fbf7ee", borderCard: "#e4dcc6", borderInput: "#ddd2b8", bgInput: "#fffdf7", bgSoft: "#f3edda", bgHover: "#f2ecda", bgActive: "#f6f1e4", bgRowHover: "#f7f1e3", borderRow: "#efe8d5", ink: "#2a2620", swatch: "#eae1cb" },
  sepia: { bgPage: "#f2e6d2", bgSidebar: "#e8d6b3", borderSidebar: "#d9c093", bgCard: "#faf1de", borderCard: "#e3d0a8", borderInput: "#ddc79c", bgInput: "#fdf6ea", bgSoft: "#f2e3c4", bgHover: "#efdcb8", bgActive: "#f5e7c8", bgRowHover: "#f6ecd6", borderRow: "#ecdcb9", ink: "#2e2418", swatch: "#e8d6b3" },
  sage: { bgPage: "#eef0e6", bgSidebar: "#dde3d0", borderSidebar: "#cbd4ba", bgCard: "#f7f9f1", borderCard: "#dbe2cc", borderInput: "#cdd6bc", bgInput: "#fbfdf7", bgSoft: "#e7ecdc", bgHover: "#e2e9d5", bgActive: "#eaf0df", bgRowHover: "#eef2e5", borderRow: "#dfe6d1", ink: "#242920", swatch: "#dde3d0" },
};

export const ACCENTS = [
  { key: "green", color: "#3d6b53" },
  { key: "brown", color: "#8a5a2b" },
  { key: "navy", color: "#4a5a8a" },
  { key: "oxblood", color: "#7a3b52" },
];

export const DEFAULT_ACCENT = "#3d6b53";

export function themeVars(themeKey: ThemeKey, accent: string): CSSProperties {
  const t = THEMES[themeKey] ?? THEMES.parchment;
  const accentSoft = `color-mix(in srgb, ${accent} 16%, white)`;
  return {
    background: t.bgPage,
    color: t.ink,
    // CSS custom properties
    ["--bg-page" as any]: t.bgPage,
    ["--bg-sidebar" as any]: t.bgSidebar,
    ["--border-sidebar" as any]: t.borderSidebar,
    ["--bg-card" as any]: t.bgCard,
    ["--border-card" as any]: t.borderCard,
    ["--border-input" as any]: t.borderInput,
    ["--bg-input" as any]: t.bgInput,
    ["--bg-soft" as any]: t.bgSoft,
    ["--bg-hover" as any]: t.bgHover,
    ["--bg-active" as any]: t.bgActive,
    ["--bg-rowhover" as any]: t.bgRowHover,
    ["--border-row" as any]: t.borderRow,
    ["--accent" as any]: accent,
    ["--accent-soft" as any]: accentSoft,
  };
}

export function badge(kind: BadgeKind): CSSProperties {
  const map: Record<BadgeKind, CSSProperties> = {
    good: { background: "var(--accent-soft, #e3ebdd)", color: "var(--accent, #3d6b53)" },
    bad: { background: "#f3e0d8", color: "#a4472f" },
    warn: { background: "#efe5cd", color: "#8a6a1e" },
    neutral: { background: "#ebe4d2", color: "#6f6653" },
  };
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 11px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
    ...map[kind],
  };
}

// Shared style tokens used across tables & buttons
export const thStyle: CSSProperties = { padding: "9px 18px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#a0967d", borderBottom: "1px solid var(--border-card, #e4dcc6)", whiteSpace: "nowrap", background: "var(--bg-rowhover, #f7f1e3)" };
export const tdStyle: CSSProperties = { padding: "8px 18px", fontSize: "14px", color: "#3a352c", borderBottom: "1px solid var(--border-row, #efe8d5)", verticalAlign: "middle" };
export const tdMonoStyle: CSSProperties = { ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#6f6653" };
export const primaryBtn: CSSProperties = { background: "var(--accent, #3d6b53)", color: "var(--bg-card, #fbf7ee)", border: "none", borderRadius: "9px", padding: "10px 16px", fontFamily: "inherit", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" };
export const primaryBtnWide: CSSProperties = { ...primaryBtn, width: "100%", justifyContent: "center", padding: "12px 16px" };
export const cardStyle: CSSProperties = { background: "var(--bg-card, #fbf7ee)", border: "1px solid var(--border-card, #e4dcc6)", borderRadius: "13px" };
export const inputStyle: CSSProperties = { width: "100%", padding: "11px 14px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "9px", background: "var(--bg-input, #fffdf7)", fontSize: "14px", color: "#2a2620" };
export const labelStyle: CSSProperties = { fontSize: "12.5px", fontWeight: 500, color: "#6f6653", display: "block", marginBottom: "6px" };
export const ghostBtn: CSSProperties = { padding: "11px 18px", borderRadius: "9px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-input, #fffdf7)", fontFamily: "inherit", fontSize: "14px", fontWeight: 500, color: "#3a352c", cursor: "pointer" };
export const iconBtn: CSSProperties = { width: "31px", height: "31px", borderRadius: "8px", border: "1px solid var(--border-card, #e4dcc6)", background: "var(--bg-input, #fffdf7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
