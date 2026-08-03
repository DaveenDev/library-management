import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
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
  const sizeId = useId();
  const navBtn: CSSProperties = { width: "30px", height: "30px", borderRadius: "7px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-input, #fffdf7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", color: "#3a352c" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", borderTop: "1px solid var(--border-card, #e4dcc6)", flexWrap: "wrap", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#6f6653" }}>
        <label htmlFor={sizeId}>Show</label>
        <select id={sizeId} value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} style={{ padding: "6px 10px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "7px", background: "var(--bg-input, #fffdf7)", fontSize: "13px", color: "#2a2620" }}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span>per page</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "13px", color: "#6f6653" }}>
        {/* Announced when the page changes, so a screen reader user gets the
            new range without having to go hunting for it. */}
        <span role="status">{from}–{to} of {total}</span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button aria-label="Previous page" onClick={onPrev} disabled={disablePrev} style={{ ...navBtn, opacity: disablePrev ? 0.45 : 1 }}>
            <span aria-hidden="true">‹</span>
          </button>
          <button aria-label="Next page" onClick={onNext} disabled={disableNext} style={{ ...navBtn, opacity: disableNext ? 0.45 : 1 }}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Modal ----------
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title, subtitle, width = 560, onClose, children, footer,
}: {
  title: string; subtitle?: string; width?: number; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Where focus was before the dialog opened, so closing can put it back
    // rather than dumping the user at the top of the document.
    const previous = document.activeElement as HTMLElement | null;
    const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Without this, Tab walks straight out of the dialog and into the page
      // behind it, which is still visible but not meant to be reachable.
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement === edge || !dialog.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(38,34,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ background: "var(--bg-card, #fbf7ee)", borderRadius: "16px", boxShadow: "0 24px 64px rgba(30,26,20,.38)", width: `${width}px`, maxWidth: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", outline: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--border-card, #e4dcc6)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flex: "none" }}>
          <div>
            <h2 id={titleId} style={{ margin: 0, fontFamily: "Spectral,serif", fontSize: "20px", fontWeight: 600 }}>{title}</h2>
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#8a8069" }}>{subtitle}</p>}
          </div>
          <button aria-label="Close dialog" onClick={onClose} style={{ width: "34px", height: "34px", borderRadius: "9px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-input, #fffdf7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}>
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
      {/* The live region has to be in the document before a message arrives —
          a container that appears along with its first toast is not announced.
          Polite, because a toast confirms what the user just did rather than
          interrupting them. */}
      <div
        role="status"
        aria-live="polite"
        style={{ position: "fixed", bottom: "24px", right: "24px", display: "flex", flexDirection: "column", gap: "10px", zIndex: 100 }}
      >
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
/**
 * Label a form control.
 *
 * The generated id is pushed onto the child element rather than asked for at
 * every call site, so every form in the app gets a real label/control
 * association without 29 call sites having to remember one. A child that
 * already carries an id keeps it.
 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const generatedId = useId();
  const child = isValidElement(children) ? (children as ReactElement<{ id?: string }>) : null;
  const controlId = child?.props.id ?? (child ? generatedId : undefined);

  return (
    <div>
      {/* htmlFor is omitted when there is no single element to point at, since
          a label referencing nothing is worse than a plain one. */}
      <label htmlFor={controlId} style={{ fontSize: "12.5px", fontWeight: 500, color: "#6f6653", display: "block", marginBottom: "6px" }}>
        {label}
      </label>
      {child ? cloneElement(child, { id: controlId }) : children}
    </div>
  );
}
