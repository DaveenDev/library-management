import { createContext, useContext, useState, useCallback, type ReactNode, type CSSProperties } from "react";
import type { BadgeKind } from "@lumen/shared";
import { badge } from "../theme.ts";
import { Icon } from "../icons.tsx";

// ---------- Badge ----------
export function Badge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  return <span style={badge(kind)}>{children}</span>;
}

export function statusKind(status: string): BadgeKind {
  const s = status.toLowerCase();
  if (["available", "active", "paid", "ready for pickup", "fulfilled"].includes(s)) return "good";
  if (["overdue", "all out", "suspended", "unpaid", "cancelled", "disabled"].includes(s)) return "bad";
  if (["due soon", "waiting", "waived"].includes(s)) return "warn";
  return "neutral";
}

// ---------- Card ----------
export function Card({ children, style, ...rest }: { children: ReactNode; style?: CSSProperties } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{ background: "var(--bg-card, #fbf7ee)", border: "1px solid var(--border-card, #e4dcc6)", borderRadius: "13px", ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---------- Pagination ----------
export function Pagination({
  from, to, total, pageSize, disablePrev, disableNext, onPrev, onNext, onPageSize,
}: {
  from: number; to: number; total: number; pageSize: number;
  disablePrev: boolean; disableNext: boolean;
  onPrev: () => void; onNext: () => void; onPageSize: (n: number) => void;
}) {
  const navBtn: CSSProperties = { width: "30px", height: "30px", borderRadius: "7px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-input, #fffdf7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", color: "#3a352c" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", borderTop: "1px solid var(--border-card, #e4dcc6)", flexWrap: "wrap", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#6f6653" }}>
        <span>Show</span>
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} style={{ padding: "6px 10px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "7px", background: "var(--bg-input, #fffdf7)", fontSize: "13px", color: "#2a2620" }}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span>per page</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "13px", color: "#6f6653" }}>
        <span>{from}–{to} of {total}</span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={onPrev} disabled={disablePrev} style={{ ...navBtn, opacity: disablePrev ? 0.45 : 1 }}>‹</button>
          <button onClick={onNext} disabled={disableNext} style={{ ...navBtn, opacity: disableNext ? 0.45 : 1 }}>›</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Modal ----------
export function Modal({
  title, subtitle, width = 560, onClose, children, footer,
}: {
  title: string; subtitle?: string; width?: number; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(38,34,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-card, #fbf7ee)", borderRadius: "16px", boxShadow: "0 24px 64px rgba(30,26,20,.38)", width: `${width}px`, maxWidth: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--border-card, #e4dcc6)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flex: "none" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "Spectral,serif", fontSize: "20px", fontWeight: 600 }}>{title}</h2>
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#8a8069" }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ width: "34px", height: "34px", borderRadius: "9px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-input, #fffdf7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
            <Icon name="x" color="#6f6653" size={17} />
          </button>
        </div>
        <div style={{ padding: "22px 26px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>{children}</div>
        {footer && (
          <div style={{ padding: "16px 26px", borderTop: "1px solid var(--border-card, #e4dcc6)", display: "flex", justifyContent: "flex-end", gap: "10px", flex: "none" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Toast ----------
interface Toast { id: number; message: string; kind: "good" | "bad"; }
const ToastCtx = createContext<(message: string, kind?: "good" | "bad") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: "good" | "bad" = "good") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: "fixed", bottom: "24px", right: "24px", display: "flex", flexDirection: "column", gap: "10px", zIndex: 100 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: "12px 18px", borderRadius: "11px", background: t.kind === "good" ? "var(--accent, #3d6b53)" : "#a4472f", color: "#fff", fontSize: "13.5px", fontWeight: 500, boxShadow: "0 10px 30px rgba(30,26,20,.28)", maxWidth: "340px" }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Field ----------
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: "12.5px", fontWeight: 500, color: "#6f6653", display: "block", marginBottom: "6px" }}>{label}</label>
      {children}
    </div>
  );
}
