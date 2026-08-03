import { useState } from "react";
import { api } from "../api.ts";
import { usePaginated, paginationProps, useAsync } from "../hooks.ts";
import { Card, Badge, statusKind, Pagination, Modal, Field, useToast } from "../components/ui.tsx";
import { Icon } from "../icons.tsx";
import { thStyle, tdStyle, tdMonoStyle, primaryBtn, inputStyle, iconBtn, ghostBtn } from "../theme.ts";
import { money, type Member, type MemberInput, type MemberType } from "@lumen/shared";
import { errorMessage } from "../lib/errors.ts";

export function Borrowers() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [viewing, setViewing] = useState<Member | null>(null);

  const { data, loading, refresh } = usePaginated((p) => api.members(p), { q, page, pageSize }, [q, page, pageSize]);

  const del = async (m: Member) => {
    if (!confirm(`Delete member ${m.name}?`)) return;
    try { await api.deleteMember(m.id); toast(`Deleted ${m.name}`); refresh(); }
    catch (e) { toast(errorMessage(e), "bad"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <Card style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: "13px", display: "flex" }}><Icon name="search" color="#a89d82" size={16} /></span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search members by name or ID" style={{ width: "340px", padding: "11px 14px 11px 40px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "9px", background: "var(--bg-input, #fffdf7)", fontSize: "14px", color: "#2a2620" }} />
        </div>
        <button onClick={() => setShowAdd(true)} style={primaryBtn}><Icon name="plus" color="var(--bg-card,#fbf7ee)" size={16} /><span>New Member</span></button>
      </Card>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["Member ID", "Name", "Type", "Grade / Dept", "Books Out", "Fines Due", "Status", ""].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id} className="lm-row">
                  <td style={tdMonoStyle}>{m.memberCode}</td>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{m.name}</span></td>
                  <td style={tdStyle}>{m.type}</td>
                  <td style={tdStyle}>{m.gradeOrDept ?? "—"}</td>
                  <td style={tdStyle}>{m.booksOut}</td>
                  <td style={tdStyle}>{money(m.finesDue)}</td>
                  <td style={tdStyle}><Badge kind={statusKind(m.status)}>{m.status}</Badge></td>
                  <td style={tdStyle}><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button style={iconBtn} title="Borrowing history" onClick={() => setViewing(m)}><Icon name="file" color="#6f6653" size={15} /></button>
                    <button style={iconBtn} title="Edit" onClick={() => setEditing(m)}><Icon name="edit" color="#6f6653" size={15} /></button>
                    <button style={iconBtn} title="Delete" onClick={() => del(m)}><Icon name="trash" color="#a4472f" size={15} /></button>
                  </div></td>
                </tr>
              ))}
              {!loading && data.items.length === 0 && (
                <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "#a89d82", padding: "28px" }}>No members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...paginationProps(data.total, page, pageSize, setPage, setPageSize)} />
      </Card>

      {(showAdd || editing) && (
        <MemberModal member={editing} onClose={() => { setShowAdd(false); setEditing(null); }} onSaved={() => { setShowAdd(false); setEditing(null); refresh(); }} />
      )}

      {viewing && <HistoryModal member={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

function HistoryModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const { data, loading } = useAsync(() => api.memberHistory(member.id), [member.id]);

  const tiles = [
    { label: "Total Loans", value: String(data?.totalLoans ?? 0) },
    { label: "Currently Out", value: String(data?.openLoans ?? 0) },
    { label: "Unpaid Fines", value: money(data?.unpaidFines ?? 0) },
    { label: "Fines Paid", value: money(data?.paidFines ?? 0) },
  ];

  return (
    <Modal
      title={member.name}
      subtitle={`${member.memberCode} · ${member.type}${member.gradeOrDept ? ` · ${member.gradeOrDept}` : ""}`}
      width={780}
      onClose={onClose}
      footer={<button onClick={onClose} style={ghostBtn}>Close</button>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ border: "1px solid var(--border-card, #e4dcc6)", borderRadius: "10px", padding: "12px 14px", background: "var(--bg-input, #fffdf7)" }}>
            <div style={{ fontSize: "11.5px", color: "#8a8069" }}>{t.label}</div>
            <div style={{ fontFamily: "Spectral,serif", fontSize: "21px", fontWeight: 600, marginTop: "4px" }}>{t.value}</div>
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid var(--border-card, #e4dcc6)", borderRadius: "10px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Book", "Borrowed", "Due", "Returned", "Status"].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {(data?.history ?? []).map((h) => (
              <tr key={h.id} className="lm-row">
                <td style={tdStyle}><span style={{ fontWeight: 600 }}>{h.bookTitle}</span></td>
                <td style={tdStyle}>{fmtDate(h.borrowedAt)}</td>
                <td style={tdStyle}>{fmtDate(h.dueAt)}</td>
                <td style={tdStyle}>{h.returnedAt ? fmtDate(h.returnedAt) : "—"}</td>
                <td style={tdStyle}>
                  <Badge kind={statusKind(h.status)}>{h.status}</Badge>
                  {h.returnedAt && h.daysLate > 0 && <span style={{ fontSize: "11.5px", color: "#a4472f", marginLeft: "8px" }}>{h.daysLate}d late</span>}
                </td>
              </tr>
            ))}
            {!loading && (data?.history?.length ?? 0) === 0 && (
              <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#a89d82", padding: "24px" }}>No borrowing history yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function MemberModal({ member, onClose, onSaved }: { member: Member | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data: settings } = useAsync(() => api.settings(), []);
  const [form, setForm] = useState<MemberInput>({
    name: member?.name ?? "", type: member?.type ?? "Student",
    gradeOrDept: member?.gradeOrDept ?? "", email: member?.email ?? "", status: member?.status ?? "Active",
  });
  const set = (k: keyof MemberInput, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) { toast("Name is required", "bad"); return; }
    setSaving(true);
    try {
      if (member) { await api.updateMember(member.id, form); toast(`Updated ${form.name}`); }
      else { await api.createMember(form); toast(`Registered ${form.name}`); }
      onSaved();
    } catch (e) { toast(errorMessage(e), "bad"); setSaving(false); }
  };

  const grades = settings?.lists.grades ?? [];
  return (
    <Modal
      title={member ? "Edit Member" : "New Member"}
      subtitle={member ? "Update membership details" : "Register a student or faculty member"}
      width={560}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={save} disabled={saving} style={primaryBtn}><Icon name="check" color="var(--bg-card,#fbf7ee)" size={16} /><span>{member ? "Save Changes" : "Register Member"}</span></button>
      </>}
    >
      <Field label="Full Name *"><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Amara Okonkwo" style={inputStyle} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Field label="Type">
          <select value={form.type} onChange={(e) => set("type", e.target.value as MemberType)} style={inputStyle}>
            <option>Student</option><option>Faculty</option>
          </select>
        </Field>
        <Field label="Grade / Department">
          {form.type === "Student" && grades.length ? (
            <select value={form.gradeOrDept ?? ""} onChange={(e) => set("gradeOrDept", e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {grades.map((g) => <option key={g}>{g}</option>)}
            </select>
          ) : (
            <input value={form.gradeOrDept ?? ""} onChange={(e) => set("gradeOrDept", e.target.value)} placeholder="e.g. Sciences" style={inputStyle} />
          )}
        </Field>
      </div>
      <Field label="Email"><input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="name@school.org" style={inputStyle} /></Field>
      <Field label="Status">
        <select value={form.status} onChange={(e) => set("status", e.target.value)} style={inputStyle}>
          <option>Active</option><option>Suspended</option>
        </select>
      </Field>
    </Modal>
  );
}
