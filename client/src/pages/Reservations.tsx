import { useState } from "react";
import { api } from "../api.ts";
import { usePaginated, paginationProps } from "../hooks.ts";
import { Card, Badge, statusKind, Pagination, useToast } from "../components/ui.tsx";
import { ReserveModal } from "../components/ReserveModal.tsx";
import { Icon } from "../icons.tsx";
import { thStyle, tdStyle, primaryBtn } from "../theme.ts";
import type { Reservation } from "@lumen/shared";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit" });

export function Reservations() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showNew, setShowNew] = useState(false);
  const { data, refresh } = usePaginated((p) => api.reservations(p), { page, pageSize }, [page, pageSize]);

  const fulfill = async (r: Reservation) => {
    try { await api.fulfillReservation(r.id); toast(`Fulfilled hold on “${r.bookTitle}”`); refresh(); }
    catch (e: any) { toast(e.message, "bad"); }
  };
  const cancel = async (r: Reservation) => {
    try { await api.cancelReservation(r.id); toast(`Cancelled hold on “${r.bookTitle}”`); refresh(); }
    catch (e: any) { toast(e.message, "bad"); }
  };

  const queueLabel = (r: Reservation) => (r.queuePosition <= 1 ? "—" : `${r.queuePosition}${r.queuePosition === 2 ? "nd" : r.queuePosition === 3 ? "rd" : "th"} in queue`);
  const isOpen = (r: Reservation) => r.status === "Waiting" || r.status === "Ready for pickup";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 6px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Holds Queue</h3>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#8a8069" }}>Reserved titles awaiting pickup or in line</p>
          </div>
          <button onClick={() => setShowNew(true)} style={primaryBtn}>
            <Icon name="plus" color="var(--bg-card,#fbf7ee)" size={16} /><span>New Hold</span>
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Book", "Reserved By", "Reserved On", "Queue", "Status", ""].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} className="lm-row">
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{r.bookTitle}</span></td>
                  <td style={tdStyle}>{r.memberName}</td>
                  <td style={tdStyle}>{fmt(r.reservedAt)}</td>
                  <td style={tdStyle}>{queueLabel(r)}</td>
                  <td style={tdStyle}><Badge kind={statusKind(r.status)}>{r.status}</Badge></td>
                  <td style={tdStyle}><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    {isOpen(r) && (<>
                      <button onClick={() => fulfill(r)} style={{ padding: "7px 13px", borderRadius: "8px", border: "1px solid var(--accent, #3d6b53)", background: "var(--accent-soft, #e3ebdd)", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 600, color: "var(--accent, #3d6b53)", cursor: "pointer" }}>Fulfill</button>
                      <button onClick={() => cancel(r)} style={{ padding: "7px 13px", borderRadius: "8px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-input, #fffdf7)", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500, color: "#a4472f", cursor: "pointer" }}>Cancel</button>
                    </>)}
                  </div></td>
                </tr>
              ))}
              {data.items.length === 0 && <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#a89d82", padding: "28px" }}>No reservations.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination {...paginationProps(data.total, page, pageSize, setPage, setPageSize)} />
      </Card>

      {showNew && (
        <ReserveModal book={null} onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); refresh(); }} />
      )}
    </div>
  );
}
