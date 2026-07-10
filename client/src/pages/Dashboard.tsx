import type { CSSProperties } from "react";
import { useAsync } from "../hooks.ts";
import { api } from "../api.ts";
import { Card } from "../components/ui.tsx";
import { Icon, type IconName } from "../icons.tsx";
import type { PageProps } from "../App.tsx";
import type { Section } from "../nav.ts";

const money = (n: number) => `$${n.toFixed(2)}`;
const num = (n: number) => n.toLocaleString();

function Stat({ label, value, note, dot, danger }: { label: string; value: string; note: string; dot: string; danger?: boolean }) {
  return (
    <Card style={{ padding: "18px 20px", ...(danger ? { border: "1px solid #e6c9bd" } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "13px", color: "#8a8069", fontWeight: 500 }}>{label}</span>
        <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: dot }} />
      </div>
      <div style={{ fontFamily: "Spectral,serif", fontSize: "31px", fontWeight: 600, marginTop: "12px", color: danger ? "#a4472f" : undefined }}>{value}</div>
      <div style={{ fontSize: "12px", color: danger ? "#a4472f" : "#8a8069", marginTop: "5px" }}>{note}</div>
    </Card>
  );
}

export function Dashboard({ navigate }: PageProps) {
  const { data, loading } = useAsync(() => api.dashboard(), []);
  if (loading || !data) return <div style={{ color: "#8a8069" }}>Loading dashboard…</div>;

  const maxb = Math.max(1, ...data.mostBorrowed.map((m) => m.count));
  const accent = "var(--accent, #3d6b53)";
  const quick: [string, string, IconName, Section][] = [
    ["Check out a book", "Circulation", "scan", "circulation"],
    ["Add a new title", "Catalog", "book", "catalog"],
    ["Register a member", "Borrowers", "users", "borrowers"],
    ["Generate labels", "Labels", "tag", "labels"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(196px,1fr))", gap: "16px" }}>
        <Stat label="Total Titles" value={num(data.totalTitles)} note={`+${data.titlesThisMonth} catalogued this month`} dot={accent} />
        <Stat label="Copies in Stock" value={num(data.copiesInStock)} note={`${num(data.copiesAvailable)} available now`} dot="#b3a888" />
        <Stat label="Active Loans" value={num(data.activeLoans)} note={`${data.checkedOutToday} checked out today`} dot={accent} />
        <Stat label="Overdue" value={num(data.overdue)} note="Needs follow-up" dot="#a4472f" danger />
        <Stat label="Fines Outstanding" value={money(data.finesOutstanding)} note={`Across ${data.membersWithFines} members`} dot="#8a6a1e" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "20px", alignItems: "start" }}>
        <Card style={{ padding: "20px 22px" }}>
          <h3 style={{ margin: "0 0 4px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Recent Activity</h3>
          <p style={{ margin: "0 0 14px", fontSize: "12.5px", color: "#8a8069" }}>Latest transactions across the desk</p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.recentActivity.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", padding: "11px 0", borderBottom: i < data.recentActivity.length - 1 ? "1px solid var(--border-row, #efe8d5)" : "none" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: a.kind === "good" ? accent : a.kind === "bad" ? "#a4472f" : a.kind === "warn" ? "#8a6a1e" : "#b3a888", marginTop: "6px", flex: "none" }} />
                <div style={{ flex: 1, fontSize: "14px" }}>{a.text}</div>
                <span style={{ fontSize: "12px", color: "#a89d82", whiteSpace: "nowrap" }}>{a.when}</span>
              </div>
            ))}
            {data.recentActivity.length === 0 && <div style={{ fontSize: "13.5px", color: "#a89d82" }}>No recent activity.</div>}
          </div>
        </Card>
        <Card style={{ padding: "20px 22px" }}>
          <h3 style={{ margin: "0 0 4px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Due Soon</h3>
          <p style={{ margin: "0 0 14px", fontSize: "12.5px", color: "#8a8069" }}>Next returns expected</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {data.dueSoon.map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "13.5px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: "12px", color: "#8a8069" }}>{d.member}</div>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#6f6653", whiteSpace: "nowrap" }}>{d.due}</span>
              </div>
            ))}
            {data.dueSoon.length === 0 && <div style={{ fontSize: "13.5px", color: "#a89d82" }}>Nothing due.</div>}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "20px", alignItems: "start" }}>
        <Card style={{ padding: "20px 22px" }}>
          <h3 style={{ margin: "0 0 16px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Most Borrowed</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {data.mostBorrowed.map((m, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13.5px", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 500 }}>{m.title}</span>
                  <span style={{ color: "#8a8069" }}>{m.count}</span>
                </div>
                <div style={{ height: "8px", background: "var(--border-row, #efe8d5)", borderRadius: "6px" }}>
                  <div style={{ height: "8px", width: `${Math.round((m.count / maxb) * 100)}%`, background: accent, borderRadius: "6px" }} />
                </div>
              </div>
            ))}
            {data.mostBorrowed.length === 0 && <div style={{ fontSize: "13.5px", color: "#a89d82" }}>No loans yet.</div>}
          </div>
        </Card>
        <Card style={{ padding: "20px 22px" }}>
          <h3 style={{ margin: "0 0 14px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Quick Actions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {quick.map(([label, , icon, target]) => (
              <button key={label} onClick={() => navigate(target)} style={{ display: "flex", alignItems: "center", gap: "11px", width: "100%", padding: "12px 14px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "10px", background: "var(--bg-soft, #f3edda)", cursor: "pointer", fontFamily: "inherit", fontSize: "14px", fontWeight: 500, color: "#2a2620", textAlign: "left" }}>
                <Icon name={icon} color="#6f6653" size={17} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
