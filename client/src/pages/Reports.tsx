import { useState, type CSSProperties } from "react";
import { api } from "../api.ts";
import { useAsync } from "../hooks.ts";
import { Icon } from "../icons.tsx";

const TABS: [string, string][] = [
  ["overdue", "Overdue Report"],
  ["fines", "Fines & Penalties"],
  ["books", "List of Books"],
  ["borrowed", "Most Borrowed"],
  ["inventory", "Inventory"],
  ["members", "Member Activity"],
];

// [key, header, align]
const COLUMNS: Record<string, [string, string, "left" | "right"][]> = {
  overdue: [["book", "Book", "left"], ["borrower", "Borrower", "left"], ["due", "Due Date", "left"], ["days", "Days Late", "left"], ["amount", "Fine", "right"]],
  fines: [["borrower", "Member", "left"], ["book", "Book", "left"], ["days", "Days Overdue", "left"], ["status", "Status", "left"], ["amount", "Amount", "right"]],
  books: [["barcode", "Barcode", "left"], ["title", "Title", "left"], ["author", "Author", "left"], ["subject", "Subject", "left"], ["shelf", "Shelf", "left"], ["availText", "Copies", "right"]],
  borrowed: [["rank", "Rank", "left"], ["title", "Title", "left"], ["count", "Times Borrowed", "right"]],
  inventory: [["category", "Category", "left"], ["count", "Count", "right"]],
  members: [["name", "Member", "left"], ["id", "ID", "left"], ["loans", "Loans", "left"], ["overdue", "Overdue", "left"], ["fines", "Fines", "right"]],
};

const MONO = new Set(["barcode", "shelf", "id", "rank"]);

const paperTh = (align: "left" | "right"): CSSProperties => ({ padding: "8px 10px", textAlign: align, fontSize: "11px", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#1d1a15", borderBottom: "1.5px solid #1d1a15", whiteSpace: "nowrap" });
const paperTd = (align: "left" | "right", mono: boolean): CSSProperties => ({ padding: "9px 10px", fontSize: "13px", textAlign: align, color: "#1d1a15", borderBottom: "1px solid #e7e1d4", ...(mono ? { fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px" } : {}) });

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtLabel = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function Reports() {
  const [tab, setTab] = useState("overdue");
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())));
  const [to, setTo] = useState(iso(today));
  const [showPill, setShowPill] = useState(false);
  const { data, loading } = useAsync(() => api.report(tab, from, to), [tab, from, to]);

  const cols = COLUMNS[tab];
  const pillBtn: CSSProperties = { display: "flex", alignItems: "center", gap: "8px", padding: "9px 15px", borderRadius: "20px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-input, #fffdf7)", fontFamily: "inherit", fontSize: "13px", fontWeight: 500, color: "#3a352c", cursor: "pointer" };
  const title = TABS.find(([k]) => k === tab)?.[1] ?? "Report";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {TABS.map(([key, label]) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)} style={{ padding: "9px 16px", borderRadius: "20px", fontSize: "13px", fontFamily: "inherit", fontWeight: active ? 600 : 500, cursor: "pointer", whiteSpace: "nowrap", border: active ? "1px solid var(--accent, #3d6b53)" : "1px solid var(--border-input, #ddd2b8)", background: active ? "var(--accent-soft, #e3ebdd)" : "var(--bg-input, #fffdf7)", color: active ? "var(--accent, #3d6b53)" : "#6f6653" }}>{label}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowPill((v) => !v)} style={{ ...pillBtn, fontWeight: 600 }}><Icon name="calendar" color="#3a352c" size={15} /><span>{fmtLabel(from)} – {fmtLabel(to)}</span></button>
            {showPill && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowPill(false)} />
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 41, background: "var(--bg-card, #fbf7ee)", border: "1px solid var(--border-card, #e4dcc6)", borderRadius: "13px", boxShadow: "0 16px 40px rgba(30,26,20,.22)", padding: "16px 18px", width: "250px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#a89d82", marginBottom: "10px" }}>Report Period</div>
                  <label style={{ fontSize: "12.5px", color: "#6f6653", display: "block", marginBottom: "5px" }}>From</label>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "8px", background: "var(--bg-input, #fffdf7)", fontSize: "13px", color: "#2a2620", marginBottom: "12px" }} />
                  <label style={{ fontSize: "12.5px", color: "#6f6653", display: "block", marginBottom: "5px" }}>To</label>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "8px", background: "var(--bg-input, #fffdf7)", fontSize: "13px", color: "#2a2620" }} />
                </div>
              </>
            )}
          </div>
          <button onClick={() => window.print()} style={pillBtn}><Icon name="printer" color="#3a352c" size={15} /><span>Print</span></button>
        </div>
      </div>

      <div style={{ background: "#ffffff", maxWidth: "880px", width: "100%", margin: "0 auto", borderRadius: "4px", boxShadow: "0 1px 3px rgba(30,26,20,.14), 0 14px 44px rgba(30,26,20,.13)", padding: "52px 58px", color: "#1d1a15" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", borderBottom: "2.5px solid #1d1a15", paddingBottom: "18px" }}>
          <div>
            <div style={{ fontFamily: "Spectral,serif", fontSize: "21px", fontWeight: 700 }}>Lumen Library</div>
            <div style={{ fontSize: "12px", color: "#6b655a", marginTop: "3px" }}>128 Alder Street · lumenlibrary.org</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "Spectral,serif", fontSize: "16px", fontWeight: 600 }}>{title}</div>
            <div style={{ fontSize: "12px", color: "#6b655a", marginTop: "3px" }}>{fmtLabel(from)} — {fmtLabel(to)}</div>
            <div style={{ fontSize: "11px", color: "#9a9284", marginTop: "2px" }}>Generated {today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · by Bill Higham</div>
          </div>
        </div>

        <div style={{ paddingTop: "26px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{cols.map(([, header, align]) => <th key={header} style={paperTh(align)}>{header}</th>)}</tr></thead>
            <tbody>
              {(data?.items ?? []).map((row, i) => (
                <tr key={i}>{cols.map(([key, , align]) => <td key={key} style={paperTd(align, MONO.has(key))}>{row[key] ?? "—"}</td>)}</tr>
              ))}
              {!loading && (data?.items?.length ?? 0) === 0 && (
                <tr><td colSpan={cols.length} style={{ ...paperTd("left", false), textAlign: "center", color: "#9a9284", padding: "24px" }}>No data for this period.</td></tr>
              )}
            </tbody>
          </table>
          {data?.footer && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px", paddingTop: "12px", borderTop: "1.5px solid #1d1a15", fontSize: "13.5px", fontWeight: 600 }}>{data.footer}</div>}
        </div>

        <div style={{ marginTop: "40px", paddingTop: "14px", borderTop: "1px solid #d9d3c6", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9a9284" }}>
          <span>Lumen Library System</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
}
