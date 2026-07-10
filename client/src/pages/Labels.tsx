import { useState } from "react";
import { api } from "../api.ts";
import { useAsync } from "../hooks.ts";
import { Card } from "../components/ui.tsx";
import { Icon } from "../icons.tsx";
import { primaryBtnWide, inputStyle, labelStyle } from "../theme.ts";

const barcodeBg = "repeating-linear-gradient(90deg,#231e17 0px,#231e17 3px,var(--bg-input, #fffdf7) 3px,var(--bg-input, #fffdf7) 5px,#231e17 5px,#231e17 6px,var(--bg-input, #fffdf7) 6px,var(--bg-input, #fffdf7) 9px,#231e17 9px,#231e17 12px,var(--bg-input, #fffdf7) 12px,var(--bg-input, #fffdf7) 14px,#231e17 14px,#231e17 15px,var(--bg-input, #fffdf7) 15px,var(--bg-input, #fffdf7) 18px)";

export function Labels() {
  const { data } = useAsync(() => api.books({ pageSize: 100 }), []);
  const books = data?.items ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [type, setType] = useState<"spine" | "qr">("spine");
  const [qty, setQty] = useState(12);

  const book = books.find((b) => b.id === selectedId) ?? books[0];
  const callNo = book ? `${book.subject.slice(0, 3).toUpperCase()} ${book.author.split(" ").slice(-1)[0].slice(0, 3).toUpperCase()}` : "823.92 HER";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: "20px", alignItems: "start" }}>
      <Card style={{ padding: "20px 22px" }}>
        <h3 style={{ margin: "0 0 4px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Generate Labels</h3>
        <p style={{ margin: "0 0 18px", fontSize: "12.5px", color: "#8a8069" }}>Print barcode and QR labels for the catalog</p>
        <label style={labelStyle}>Title</label>
        <select value={book?.id ?? ""} onChange={(e) => setSelectedId(Number(e.target.value))} style={{ ...inputStyle, marginBottom: "14px" }}>
          {books.map((b) => <option key={b.id} value={b.id}>{b.title} — {b.author}</option>)}
        </select>
        <label style={labelStyle}>Label type</label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          {(["spine", "qr"] as const).map((t) => {
            const active = type === t;
            return (
              <span key={t} onClick={() => setType(t)} style={{ flex: 1, textAlign: "center", padding: "9px", borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: active ? 600 : 400, border: active ? "1px solid var(--accent, #3d6b53)" : "1px solid var(--border-input, #ddd2b8)", background: active ? "var(--accent-soft, #e3ebdd)" : "var(--bg-input, #fffdf7)", color: active ? "var(--accent, #3d6b53)" : "#6f6653" }}>{t === "spine" ? "Spine + Barcode" : "QR Pocket"}</span>
            );
          })}
        </div>
        <label style={labelStyle}>Quantity</label>
        <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ ...inputStyle, marginBottom: "18px" }} />
        <button onClick={() => window.print()} style={primaryBtnWide}><Icon name="printer" color="var(--bg-card,#fbf7ee)" size={16} /><span>Print Sheet</span></button>
      </Card>

      <Card style={{ padding: "22px" }}>
        <div style={{ fontSize: "12.5px", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#a89d82", marginBottom: "14px" }}>Preview</div>
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
          <div style={{ border: "1px solid #d8ccae", borderRadius: "9px", padding: "16px 18px", background: "var(--bg-input, #fffdf7)", width: "250px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", color: "#8a8069", letterSpacing: ".05em" }}>CALL NO. {callNo}</div>
            <div style={{ fontFamily: "Spectral,serif", fontSize: "20px", fontWeight: 600, marginTop: "8px", lineHeight: 1.15 }}>{book?.title ?? "Dune"}</div>
            <div style={{ fontSize: "12.5px", color: "#6f6653", marginTop: "3px" }}>{book?.author ?? "Frank Herbert"} · {book?.subject ?? "Science Fiction"}</div>
            <div style={{ marginTop: "14px", height: "46px", borderRadius: "2px", backgroundImage: barcodeBg }} />
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", textAlign: "center", letterSpacing: ".18em", marginTop: "6px", color: "#231e17" }}>{book?.barcode ?? "LIB-000845"}</div>
          </div>
          <div style={{ border: "1px solid #d8ccae", borderRadius: "9px", padding: "16px 18px", background: "var(--bg-input, #fffdf7)", width: "190px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontFamily: "Spectral,serif", fontSize: "15px", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>{book?.title ?? "Dune"}</div>
            <div style={{ fontSize: "11.5px", color: "#6f6653", margin: "3px 0 12px" }}>Lumen Library</div>
            <div style={{ width: "104px", height: "104px", border: "1px solid #d8ccae", borderRadius: "6px", backgroundColor: "var(--bg-input, #fffdf7)", backgroundImage: "repeating-linear-gradient(45deg,#231e17 0 4px,transparent 4px 9px),repeating-linear-gradient(-45deg,#231e17 0 4px,transparent 4px 9px)", backgroundBlendMode: "multiply" }} />
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".14em", marginTop: "10px", color: "#231e17" }}>{book?.barcode ?? "LIB-000845"}</div>
          </div>
        </div>
        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border-row, #efe8d5)", fontSize: "12.5px", color: "#8a8069" }}>Sheet layout: <strong style={{ color: "#2a2620" }}>3 × 8</strong> · Avery-compatible · 24 labels per page</div>
      </Card>
    </div>
  );
}
