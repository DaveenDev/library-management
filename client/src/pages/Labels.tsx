import { useId, useState } from "react";
import { api } from "../api.ts";
import { useAsync } from "../hooks.ts";
import { Card } from "../components/ui.tsx";
import { Barcode, QrCode } from "../components/Barcode.tsx";
import { Icon } from "../icons.tsx";
import { primaryBtnWide, inputStyle, labelStyle } from "../theme.ts";
import { LIBRARY } from "../branding.ts";

type Source = "books" | "borrowers";
type LabelType = "spine" | "qr";

/** What a label needs, regardless of whether it came from a book or a member. */
interface LabelData {
  code: string;
  primary: string;
  secondary: string;
  callNo: string;
}

const callNumber = (subject: string, author: string) =>
  `${subject.slice(0, 3).toUpperCase()} ${(author.split(" ").slice(-1)[0] ?? "").slice(0, 3).toUpperCase()}`;

export function Labels() {
  const fieldIds = useId();
  const [source, setSource] = useState<Source>("books");
  const [type, setType] = useState<LabelType>("spine");
  const [qty, setQty] = useState(12);
  const [bookId, setBookId] = useState<number | null>(null);
  const [memberId, setMemberId] = useState<number | null>(null);

  const { data: bookData } = useAsync(() => api.books({ pageSize: 200 }), []);
  const { data: memberData } = useAsync(() => api.members({ pageSize: 200 }), []);
  const books = bookData?.items ?? [];
  const members = memberData?.items ?? [];

  const book = books.find((b) => b.id === bookId) ?? books[0];
  const member = members.find((m) => m.id === memberId) ?? members[0];

  const item: LabelData | null =
    source === "books"
      ? book
        ? {
            code: book.barcode,
            primary: book.title,
            secondary: `${book.author} · ${book.subject}`,
            callNo: callNumber(book.subject, book.author),
          }
        : null
      : member
        ? {
            code: member.memberCode,
            primary: member.name,
            secondary: `${member.type}${member.gradeOrDept ? ` · ${member.gradeOrDept}` : ""}`,
            callNo: member.memberCode,
          }
        : null;

  // Clamp so a typo can't try to paint 10,000 labels.
  const count = Math.max(1, Math.min(120, qty || 1));
  const copies = Array.from({ length: count });
  const perPage = type === "spine" ? 24 : 40;
  const pages = Math.ceil(count / perPage);

  // These were <span onClick>, which no keyboard can reach and no screen
  // reader announces as a control. They are real buttons now; `pill` carries
  // the resets a button needs to keep looking like a pill.
  const pill = (active: boolean) => ({
    flex: 1,
    fontFamily: "inherit" as const,
    textAlign: "center" as const,
    padding: "9px",
    borderRadius: "9px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
    border: active ? "1px solid var(--accent, #3d6b53)" : "1px solid var(--border-input, #ddd2b8)",
    background: active ? "var(--accent-soft, #e3ebdd)" : "var(--bg-input, #fffdf7)",
    color: active ? "var(--accent, #3d6b53)" : "#6f6653",
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "20px", alignItems: "start" }}>
      <Card style={{ padding: "20px 22px" }} className="lm-no-print">
        <h3 style={{ margin: "0 0 4px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Generate Labels</h3>
        <p style={{ margin: "0 0 18px", fontSize: "12.5px", color: "#8a8069" }}>Scannable Code 128 and QR labels</p>

        {/* A group of buttons, not a form control — a <label> here would point
            at nothing, so it labels the group instead. */}
        <div id={`${fieldIds}-source`} style={labelStyle}>Label for</div>
        <div role="group" aria-labelledby={`${fieldIds}-source`} style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          <button type="button" aria-pressed={source === "books"} onClick={() => setSource("books")} style={pill(source === "books")}>Books</button>
          <button type="button" aria-pressed={source === "borrowers"} onClick={() => setSource("borrowers")} style={pill(source === "borrowers")}>Borrower IDs</button>
        </div>

        {source === "books" ? (
          <>
            <label htmlFor={`${fieldIds}-book`} style={labelStyle}>Title</label>
            <select id={`${fieldIds}-book`} value={book?.id ?? ""} onChange={(e) => setBookId(Number(e.target.value))} style={{ ...inputStyle, marginBottom: "14px" }}>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title} — {b.author}</option>)}
            </select>
          </>
        ) : (
          <>
            <label htmlFor={`${fieldIds}-member`} style={labelStyle}>Borrower</label>
            <select id={`${fieldIds}-member`} value={member?.id ?? ""} onChange={(e) => setMemberId(Number(e.target.value))} style={{ ...inputStyle, marginBottom: "14px" }}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.memberCode} — {m.name}</option>)}
            </select>
          </>
        )}

        <div id={`${fieldIds}-type`} style={labelStyle}>Label type</div>
        <div role="group" aria-labelledby={`${fieldIds}-type`} style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          <button type="button" aria-pressed={type === "spine"} onClick={() => setType("spine")} style={pill(type === "spine")}>Spine + Barcode</button>
          <button type="button" aria-pressed={type === "qr"} onClick={() => setType("qr")} style={pill(type === "qr")}>QR Pocket</button>
        </div>

        <label htmlFor={`${fieldIds}-qty`} style={labelStyle}>Quantity</label>
        <input id={`${fieldIds}-qty`} type="number" min={1} max={120} value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ ...inputStyle, marginBottom: "8px" }} />
        <p style={{ margin: "0 0 18px", fontSize: "12px", color: "#8a8069" }}>
          {count} label{count === 1 ? "" : "s"} · {perPage} per sheet · {pages} page{pages === 1 ? "" : "s"}
        </p>

        <button onClick={() => window.print()} disabled={!item} style={{ ...primaryBtnWide, opacity: item ? 1 : 0.5 }}>
          <Icon name="printer" color="var(--bg-card,#fbf7ee)" size={16} /><span>Print Sheet</span>
        </button>
      </Card>

      <Card style={{ padding: "22px" }}>
        <div className="lm-no-print" style={{ fontSize: "12.5px", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#a89d82", marginBottom: "14px" }}>
          Sheet Preview
        </div>
        <div className="lm-print-area" style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignContent: "flex-start" }}>
          {item && copies.map((_, i) =>
            type === "spine"
              ? <SpineLabel key={i} item={item} />
              : <PocketLabel key={i} item={item} />,
          )}
          {!item && <div style={{ fontSize: "13px", color: "#a89d82" }}>Nothing to label yet.</div>}
        </div>
      </Card>
    </div>
  );
}

const labelBase = {
  border: "1px solid #d8ccae",
  borderRadius: "6px",
  background: "#fff",
  color: "#1d1a15",
} as const;

function SpineLabel({ item }: { item: LabelData }) {
  return (
    <div className="lm-label" style={{ ...labelBase, padding: "12px 14px", width: "232px" }}>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px", color: "#8a8069", letterSpacing: ".05em" }}>
        CALL NO. {item.callNo}
      </div>
      <div style={{ fontFamily: "Spectral,serif", fontSize: "15px", fontWeight: 600, marginTop: "5px", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.primary}
      </div>
      <div style={{ fontSize: "11px", color: "#6f6653", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.secondary}
      </div>
      <div style={{ marginTop: "10px" }}><Barcode value={item.code} height={38} barWidth={1.4} /></div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", textAlign: "center", letterSpacing: ".16em", marginTop: "4px" }}>
        {item.code}
      </div>
    </div>
  );
}

function PocketLabel({ item }: { item: LabelData }) {
  return (
    <div className="lm-label" style={{ ...labelBase, padding: "12px", width: "150px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontFamily: "Spectral,serif", fontSize: "12.5px", fontWeight: 600, textAlign: "center", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
        {item.primary}
      </div>
      <div style={{ fontSize: "10px", color: "#6f6653", margin: "2px 0 9px" }}>{LIBRARY.name}</div>
      <QrCode value={item.code} size={88} />
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px", letterSpacing: ".12em", marginTop: "8px" }}>
        {item.code}
      </div>
    </div>
  );
}
