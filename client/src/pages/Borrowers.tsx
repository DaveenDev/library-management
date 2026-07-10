import { useState } from "react";
import { api } from "../api.ts";
import { usePaginated, paginationProps, useAsync } from "../hooks.ts";
import { Card, Badge, statusKind, Pagination, Modal, Field, useToast } from "../components/ui.tsx";
import { Icon } from "../icons.tsx";
import { thStyle, tdStyle, tdMonoStyle, primaryBtn, inputStyle, iconBtn, ghostBtn } from "../theme.ts";
import type { Member, MemberInput, MemberType } from "@lumen/shared";

export function Borrowers() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const { data, loading, refresh } = usePaginated((p) => api.members(p), { q, page, pageSize }, [q, page, pageSize]);

  const del = async (m: Member) => {
    if (!confirm(`Delete member ${m.name}?`)) return;
    try { await api.deleteMember(m.id); toast(`Deleted ${m.name}`); refresh(); }
    catch (e: any) { toast(e.message, "bad"); }
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
                  <td style={tdStyle}>${m.finesDue.toFixed(2)}</td>
                  <td style={tdStyle}><Badge kind={statusKind(m.status)}>{m.status}</Badge></td>
                  <td style={tdStyle}><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button style={iconBtn} onClick={() => setEditing(m)}><Icon name="edit" color="#6f6653" size={15} /></button>
                    <button style={iconBtn} onClick={() => del(m)}><Icon name="trash" color="#a4472f" size={15} /></button>
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
    </div>
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
    } catch (e: any) { toast(e.message, "bad"); setSaving(false); }
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
