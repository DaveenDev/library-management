import { useRef, useState } from "react";
import { api } from "../api.ts";
import { usePaginated, paginationProps } from "../hooks.ts";
import { Card, Badge, statusKind, Pagination, useToast } from "../components/ui.tsx";
import { Icon } from "../icons.tsx";
import { thStyle, tdStyle, primaryBtnWide } from "../theme.ts";
import { money, type Loan } from "@lumen/shared";
import { errorMessage } from "../lib/errors.ts";

const scanInput = { border: "none", background: "transparent", fontSize: "14px", flex: 1, color: "#2a2620", fontFamily: "'IBM Plex Mono',monospace" } as const;
const scanBox = { display: "flex", alignItems: "center", gap: "10px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "9px", background: "var(--bg-input, #fffdf7)", padding: "10px 12px" } as const;
const label = { fontSize: "12.5px", fontWeight: 500, color: "#6f6653", display: "block", marginBottom: "6px" } as const;

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit" });

export function Circulation() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [bookBarcode, setBookBarcode] = useState("");
  const [memberCode, setMemberCode] = useState("");
  const [returnBarcode, setReturnBarcode] = useState("");

  // A USB scanner is a keyboard wedge: it types the code then sends Enter.
  // These refs let one scan hand off to the next field so a full check-out is
  // scan-book → scan-member with no clicking in between.
  const bookRef = useRef<HTMLInputElement>(null);
  const memberRef = useRef<HTMLInputElement>(null);
  const returnRef = useRef<HTMLInputElement>(null);

  const { data, refresh } = usePaginated((p) => api.loans({ ...p, status: "active" }), { page, pageSize, status: "active" }, [page, pageSize]);

  const checkout = async () => {
    if (!bookBarcode.trim()) { bookRef.current?.focus(); return; }
    if (!memberCode.trim()) { memberRef.current?.focus(); return; }
    try {
      const loan = await api.checkout({ bookBarcode: bookBarcode.trim(), memberCode: memberCode.trim() });
      toast(`Checked out “${loan.bookTitle}” to ${loan.memberName}`);
      setBookBarcode(""); setMemberCode(""); refresh();
      bookRef.current?.focus();
    } catch (e) { toast(errorMessage(e), "bad"); }
  };
  const checkin = async () => {
    if (!returnBarcode.trim()) { returnRef.current?.focus(); return; }
    try {
      const r = await api.checkin(returnBarcode.trim());
      toast(r.amount > 0 ? `Returned · fine ${money(r.amount)} (${r.days} days late)` : "Returned — no fine");
      setReturnBarcode(""); refresh();
      returnRef.current?.focus();
    } catch (e) { toast(errorMessage(e), "bad"); }
  };

  // Enter on the book field jumps to the member field unless it is already
  // filled, in which case the scan completes the transaction.
  const onBookKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (memberCode.trim()) checkout();
    else memberRef.current?.focus();
  };
  const onMemberKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (bookBarcode.trim()) checkout();
    else bookRef.current?.focus();
  };
  const onReturnKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    checkin();
  };
  const renew = async (l: Loan) => {
    try { const nl = await api.renewLoan(l.id); toast(`Renewed — due ${fmt(nl.dueAt)}`); refresh(); }
    catch (e) { toast(errorMessage(e), "bad"); }
  };
  const ret = async (l: Loan) => {
    try { const r = await api.returnLoan(l.id); toast(r.amount > 0 ? `Returned · fine ${money(r.amount)}` : "Returned — no fine"); refresh(); }
    catch (e) { toast(errorMessage(e), "bad"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <Card style={{ padding: "20px 22px" }}>
          <h3 style={{ margin: "0 0 4px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Check Out</h3>
          <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#8a8069" }}>Scan the book and the member ID</p>
          <label style={label}>Book barcode</label>
          <div style={{ ...scanBox, marginBottom: "14px" }}><Icon name="scan" color="#8a8069" size={17} /><input ref={bookRef} value={bookBarcode} onChange={(e) => setBookBarcode(e.target.value)} onKeyDown={onBookKey} placeholder="Scan or type LIB-000000" style={scanInput} autoFocus /></div>
          <label style={label}>Member ID</label>
          <div style={{ ...scanBox, marginBottom: "18px" }}><Icon name="scan" color="#8a8069" size={17} /><input ref={memberRef} value={memberCode} onChange={(e) => setMemberCode(e.target.value)} onKeyDown={onMemberKey} placeholder="Scan or type S-0000" style={scanInput} /></div>
          <button onClick={checkout} style={primaryBtnWide}><Icon name="check" color="var(--bg-card,#fbf7ee)" size={16} /><span>Confirm Check Out</span></button>
        </Card>
        <Card style={{ padding: "20px 22px" }}>
          <h3 style={{ margin: "0 0 4px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Check In / Return</h3>
          <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#8a8069" }}>Scan a returning book to log it</p>
          <label style={label}>Book barcode</label>
          <div style={{ ...scanBox, marginBottom: "14px" }}><Icon name="scan" color="#8a8069" size={17} /><input ref={returnRef} value={returnBarcode} onChange={(e) => setReturnBarcode(e.target.value)} onKeyDown={onReturnKey} placeholder="Scan or type LIB-000000" style={scanInput} /></div>
          <div style={{ background: "var(--bg-soft, #f3edda)", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "9px", padding: "12px 14px", marginBottom: "18px", fontSize: "13px", color: "#6f6653" }}>
            Late returns automatically compute a fine at the configured daily rate.
          </div>
          <button onClick={checkin} style={primaryBtnWide}><Icon name="check" color="var(--bg-card,#fbf7ee)" size={16} /><span>Confirm Return</span></button>
        </Card>
      </div>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 6px" }}><h3 style={{ margin: 0, fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Active Loans</h3></div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Book", "Borrower", "Borrowed", "Due Date", "Status", ""].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id} className="lm-row">
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{l.bookTitle}</span></td>
                  <td style={tdStyle}>{l.memberName}</td>
                  <td style={tdStyle}>{fmt(l.borrowedAt)}</td>
                  <td style={tdStyle}>{fmt(l.dueAt)}</td>
                  <td style={tdStyle}><Badge kind={statusKind(l.status)}>{l.status}</Badge></td>
                  <td style={tdStyle}><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button onClick={() => renew(l)} style={{ padding: "7px 13px", borderRadius: "8px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-input, #fffdf7)", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500, color: "#3a352c", cursor: "pointer" }}>Renew</button>
                    <button onClick={() => ret(l)} style={{ padding: "7px 13px", borderRadius: "8px", border: "1px solid var(--accent, #3d6b53)", background: "var(--accent-soft, #e3ebdd)", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 600, color: "var(--accent, #3d6b53)", cursor: "pointer" }}>Return</button>
                  </div></td>
                </tr>
              ))}
              {data.items.length === 0 && <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#a89d82", padding: "28px" }}>No active loans.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination {...paginationProps(data.total, page, pageSize, setPage, setPageSize)} />
      </Card>
    </div>
  );
}
