import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { useAsync } from "../hooks.ts";
import { Card, Badge, statusKind, Modal, Field, useToast } from "../components/ui.tsx";
import { Icon } from "../icons.tsx";
import { primaryBtn, inputStyle, ghostBtn } from "../theme.ts";
import type { Book } from "@lumen/shared";
import type { PageProps } from "../App.tsx";

export function Home({ navigate }: PageProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [borrowBook, setBorrowBook] = useState<Book | null>(null);
  const { data: dash } = useAsync(() => api.dashboard(), []);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.books({ q, pageSize: 5 }).then((r) => { if (!cancelled) setResults(r.items); }).catch(() => {});
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const accent = "var(--accent, #3d6b53)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px", maxWidth: "920px", margin: "0 auto" }}>
      <Card style={{ padding: "30px 34px", textAlign: "center", borderRadius: "16px" }}>
        <h2 style={{ margin: "0 0 4px", fontFamily: "Spectral,serif", fontSize: "22px", fontWeight: 600 }}>Find a book</h2>
        <p style={{ margin: "0 0 20px", fontSize: "13.5px", color: "#8a8069" }}>Search by title, author, subject, or scan a barcode</p>
        <div style={{ position: "relative", display: "flex", alignItems: "center", maxWidth: "640px", margin: "0 auto" }}>
          <span style={{ position: "absolute", left: "18px", display: "flex" }}><Icon name="search" color="#a89d82" size={18} /></span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the catalog, e.g. “Dune” or LIB-000845" style={{ width: "100%", padding: "16px 50px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "12px", background: "var(--bg-input, #fffdf7)", fontSize: "16px", color: "#2a2620" }} />
          {query && (
            <button onClick={() => setQuery("")} style={{ position: "absolute", right: "14px", width: "28px", height: "28px", borderRadius: "50%", border: "none", background: "var(--border-row, #efe8d5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><Icon name="x" color="#6f6653" size={14} /></button>
          )}
        </div>
      </Card>

      {query.trim() && (
        <Card style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 22px 4px" }}><h3 style={{ margin: 0, fontFamily: "Spectral,serif", fontSize: "16px", fontWeight: 600 }}>Results</h3></div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {results.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "14px 22px", borderTop: "1px solid var(--border-row, #efe8d5)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "14.5px", fontWeight: 600 }}>{b.title}</div>
                  <div style={{ fontSize: "12.5px", color: "#8a8069", marginTop: "2px" }}>{b.author} · {b.subject} · Shelf {b.shelf ?? "—"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "none" }}>
                  <Badge kind={statusKind(b.availableCopies > 0 ? "Available" : "All out")}>{b.availableCopies} available</Badge>
                  <button disabled={b.availableCopies <= 0} onClick={() => setBorrowBook(b)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid var(--accent, #3d6b53)", background: "var(--accent-soft, #e3ebdd)", color: "var(--accent, #3d6b53)", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, cursor: b.availableCopies > 0 ? "pointer" : "not-allowed", opacity: b.availableCopies > 0 ? 1 : 0.5 }}>Borrow</button>
                </div>
              </div>
            ))}
            {results.length === 0 && <div style={{ padding: "16px 22px", fontSize: "13.5px", color: "#a89d82", borderTop: "1px solid var(--border-row, #efe8d5)" }}>No matches.</div>}
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <button onClick={() => navigate("circulation")} style={{ background: "var(--bg-card, #fbf7ee)", border: "1px solid var(--border-card, #e4dcc6)", borderRadius: "13px", padding: "26px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          <div style={{ width: "46px", height: "46px", borderRadius: "11px", background: "var(--accent-soft, #e3ebdd)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="swap" color={accent} size={22} /></div>
          <div style={{ fontFamily: "Spectral,serif", fontSize: "18px", fontWeight: 600, color: "#2a2620" }}>Borrow a Book</div>
          <div style={{ fontSize: "13px", color: "#8a8069" }}>Scan a title and a member ID to check out</div>
        </button>
        <button onClick={() => navigate("circulation")} style={{ background: "var(--bg-card, #fbf7ee)", border: "1px solid var(--border-card, #e4dcc6)", borderRadius: "13px", padding: "26px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          <div style={{ width: "46px", height: "46px", borderRadius: "11px", background: "var(--accent-soft, #e3ebdd)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="book" color={accent} size={22} /></div>
          <div style={{ fontFamily: "Spectral,serif", fontSize: "18px", fontWeight: 600, color: "#2a2620" }}>Return a Book</div>
          <div style={{ fontSize: "13px", color: "#8a8069" }}>Scan a returning title to check it back in</div>
        </button>
      </div>

      <Card style={{ padding: "18px 22px" }}>
        <h3 style={{ margin: "0 0 12px", fontFamily: "Spectral,serif", fontSize: "15px", fontWeight: 600 }}>Just Happened</h3>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {(dash?.recentActivity ?? []).slice(0, 4).map((a, i, arr) => (
            <div key={i} style={{ display: "flex", gap: "12px", padding: "9px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border-row, #efe8d5)" : "none" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: a.kind === "good" ? accent : a.kind === "bad" ? "#a4472f" : "#b3a888", marginTop: "6px", flex: "none" }} />
              <div style={{ flex: 1, fontSize: "13.5px" }}>{a.text}</div>
              <span style={{ fontSize: "11.5px", color: "#a89d82", whiteSpace: "nowrap" }}>{a.when}</span>
            </div>
          ))}
          {!dash?.recentActivity?.length && <div style={{ fontSize: "13.5px", color: "#a89d82" }}>No recent activity.</div>}
        </div>
      </Card>

      {borrowBook && <BorrowModal book={borrowBook} onClose={() => setBorrowBook(null)} onDone={() => { setBorrowBook(null); toast("Checked out"); setQuery(query); }} />}
    </div>
  );
}

function BorrowModal({ book, onClose, onDone }: { book: Book; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [memberCode, setMemberCode] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!memberCode.trim()) { toast("Enter a member ID", "bad"); return; }
    setSaving(true);
    try { await api.checkout({ bookId: book.id, memberCode: memberCode.trim() }); toast(`Checked out “${book.title}”`); onDone(); }
    catch (e: any) { toast(e.message, "bad"); setSaving(false); }
  };
  return (
    <Modal title="Borrow a Book" subtitle={book.title} width={460} onClose={onClose}
      footer={<>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={submit} disabled={saving} style={primaryBtn}><Icon name="check" color="var(--bg-card,#fbf7ee)" size={16} /><span>Confirm</span></button>
      </>}>
      <Field label="Member ID"><input value={memberCode} onChange={(e) => setMemberCode(e.target.value)} placeholder="e.g. S-1042" style={{ ...inputStyle, fontFamily: "'IBM Plex Mono',monospace" }} autoFocus /></Field>
    </Modal>
  );
}
