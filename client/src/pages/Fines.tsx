import { useState } from "react";
import { api } from "../api.ts";
import { usePaginated, paginationProps, useAsync } from "../hooks.ts";
import { Card, Badge, statusKind, Pagination, useToast } from "../components/ui.tsx";
import { thStyle, tdStyle } from "../theme.ts";
import { money, type Fine } from "@lumen/shared";
import { errorMessage } from "../lib/errors.ts";
import { useAuth } from "../auth.tsx";

export function Fines() {
  const toast = useToast();
  const canWrite = useAuth().can("fines:write");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, refresh } = usePaginated((p) => api.fines(p), { page, pageSize }, [page, pageSize]);
  const { data: summary, refresh: refreshSummary } = useAsync(() => api.finesSummary(), []);
  const { data: settings } = useAsync(() => api.settings(), []);

  const collect = async (f: Fine) => {
    try { await api.collectFine(f.id); toast(`Collected ${money(f.amount)} from ${f.memberName}`); refresh(); refreshSummary(); }
    catch (e) { toast(errorMessage(e), "bad"); }
  };
  const waive = async (f: Fine) => {
    if (!confirm(`Waive the ${money(f.amount)} fine for ${f.memberName}?`)) return;
    try { await api.waiveFine(f.id); toast(`Waived ${money(f.amount)} for ${f.memberName}`); refresh(); refreshSummary(); }
    catch (e) { toast(errorMessage(e), "bad"); }
  };

  const tiles = [
    { label: "Total Outstanding", value: money(summary?.outstanding ?? 0), danger: true },
    { label: "Collected This Month", value: money(summary?.collected ?? 0) },
    { label: "Members With Fines", value: String(summary?.membersWithFines ?? 0) },
    { label: "Daily Rate", value: money(settings?.dailyFineRate ?? 0.5) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(clamp(140px,45%,190px),1fr))", gap: "16px" }}>
        {tiles.map((t) => (
          <Card key={t.label} style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: "13px", color: "#8a8069" }}>{t.label}</div>
            <div style={{ fontFamily: "Spectral,serif", fontSize: "29px", fontWeight: 600, marginTop: "8px", color: t.danger ? "#a4472f" : undefined }}>{t.value}</div>
          </Card>
        ))}
      </div>
      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Member", "Book", "Overdue", "Amount", "Status", ""].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {data.items.map((f) => (
                <tr key={f.id} className="lm-row">
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{f.memberName}</span></td>
                  <td style={tdStyle}>{f.bookTitle}</td>
                  <td style={tdStyle}>{f.daysOverdue ? `${f.daysOverdue} days` : "—"}</td>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{money(f.amount)}</span></td>
                  <td style={tdStyle}><Badge kind={statusKind(f.status)}>{f.status}</Badge></td>
                  <td style={tdStyle}><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    {f.status === "Unpaid" && canWrite && (<>
                      <button onClick={() => waive(f)} style={{ padding: "7px 13px", borderRadius: "8px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-input, #fffdf7)", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500, color: "#6f6653", cursor: "pointer" }}>Waive</button>
                      <button onClick={() => collect(f)} style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--accent, #3d6b53)", background: "var(--accent-soft, #e3ebdd)", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 600, color: "var(--accent, #3d6b53)", cursor: "pointer" }}>Collect</button>
                    </>)}
                  </div></td>
                </tr>
              ))}
              {data.items.length === 0 && <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#a89d82", padding: "28px" }}>No fines.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination {...paginationProps(data.total, page, pageSize, setPage, setPageSize)} />
      </Card>
    </div>
  );
}
