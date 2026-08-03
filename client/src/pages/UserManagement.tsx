import { useState } from "react";
import { api } from "../api.ts";
import { usePaginated, paginationProps } from "../hooks.ts";
import { Card, Badge, statusKind, Pagination, Modal, Field, useToast } from "../components/ui.tsx";
import { Icon } from "../icons.tsx";
import { thStyle, tdStyle, primaryBtn, inputStyle, iconBtn, ghostBtn } from "../theme.ts";
import type { StaffUser, StaffRole } from "@lumen/shared";
import { LIBRARY } from "../branding.ts";
import { errorMessage } from "../lib/errors.ts";
import { useAuth } from "../auth.tsx";
import { ROLE_PERMISSIONS } from "@lumen/shared";

/**
 * What each permission actually lets someone do, in the words a librarian
 * would use. Driven off ROLE_PERMISSIONS rather than a hand-written list, so
 * this card cannot describe a role the server does not enforce.
 */
const PERMISSION_LABELS: Record<string, string> = {
  "catalog:write": "Add, edit and remove books",
  "members:write": "Register and edit borrowers",
  "circulation:write": "Check out, return, renew and hold",
  "fines:write": "Collect and waive fines",
  "settings:write": "Change fine policy and lists",
  "users:manage": "Manage staff accounts",
};

const fmtLast = (iso: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 21) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
};

export function UserManagement() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showAdd, setShowAdd] = useState(false);
  const { data, loading, refresh } = usePaginated((p) => api.users(p), { q, page, pageSize }, [q, page, pageSize]);

  const del = async (u: StaffUser) => {
    if (!confirm(`Remove ${u.name}?`)) return;
    try { await api.deleteUser(u.id); toast(`Removed ${u.name}`); refresh(); }
    catch (e) { toast(errorMessage(e), "bad"); }
  };

  const setPassword = async (u: StaffUser) => {
    const next = prompt(`New password for ${u.name} (at least 10 characters)`);
    if (!next) return;
    try { await api.updateUser(u.id, { password: next }); toast(`Password updated for ${u.name}`); }
    catch (e) { toast(errorMessage(e), "bad"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <Card style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: "13px", display: "flex" }}><Icon name="search" color="#a89d82" size={16} /></span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search staff by name or email" style={{ width: "340px", padding: "11px 14px 11px 40px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "9px", background: "var(--bg-input, #fffdf7)", fontSize: "14px", color: "#2a2620" }} />
        </div>
        <button onClick={() => setShowAdd(true)} style={primaryBtn}><Icon name="plus" color="var(--bg-card,#fbf7ee)" size={16} /><span>Add User</span></button>
      </Card>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Name", "Email", "Role", "Status", "Last Active", ""].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="lm-row">
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{u.name}</span></td>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}>{u.role}</td>
                  <td style={tdStyle}><Badge kind={statusKind(u.status)}>{u.status}</Badge></td>
                  <td style={tdStyle}>{fmtLast(u.lastActiveAt)}</td>
                  <td style={tdStyle}><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button style={iconBtn} title="Set password" onClick={() => setPassword(u)}><Icon name="shield" color="#6f6653" size={15} /></button>
                    {/* Removing your own account is refused by the server; not
                        offering the button is friendlier than the error. */}
                    {u.id !== me?.id && (
                      <button style={iconBtn} title="Remove user" onClick={() => del(u)}><Icon name="trash" color="#a4472f" size={15} /></button>
                    )}
                  </div></td>
                </tr>
              ))}
              {!loading && data.items.length === 0 && <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#a89d82", padding: "28px" }}>No staff users.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination {...paginationProps(data.total, page, pageSize, setPage, setPageSize)} />
      </Card>

      <Card style={{ padding: "20px 22px" }}>
        <h3 style={{ margin: "0 0 4px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Roles &amp; Permissions</h3>
        <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#8a8069" }}>What each role can access by default</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "16px" }}>
          {(Object.keys(ROLE_PERMISSIONS) as StaffRole[]).map((role) => (
            <div key={role} style={{ border: "1px solid var(--border-card, #e4dcc6)", borderRadius: "11px", padding: "16px 18px" }}>
              <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "10px" }}>{role}</div>
              <div style={{ fontSize: "13px", color: "#6f6653", lineHeight: 2 }}>
                <div>Read every screen</div>
                {ROLE_PERMISSIONS[role].map((p) => <div key={p}>{PERMISSION_LABELS[p] ?? p}</div>)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {showAdd && <UserModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refresh(); }} />}
    </div>
  );
}

function UserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Assistant" as StaffRole, status: "Active" as "Active" | "Disabled" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.name || !form.email) { toast("Name and email are required", "bad"); return; }
    if (form.password.length < 10) { toast("Password must be at least 10 characters", "bad"); return; }
    setSaving(true);
    try { await api.createUser(form); toast(`Added ${form.name}`); onSaved(); }
    catch (e) { toast(errorMessage(e), "bad"); setSaving(false); }
  };
  return (
    <Modal title="Add User" subtitle="Create a staff account" width={520} onClose={onClose}
      footer={<>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={save} disabled={saving} style={primaryBtn}><Icon name="check" color="var(--bg-card,#fbf7ee)" size={16} /><span>Create User</span></button>
      </>}>
      <Field label="Full Name *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Marcus Lee" style={inputStyle} /></Field>
      <Field label="Email *"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={`name@${LIBRARY.emailDomain}`} style={inputStyle} /></Field>
      <Field label="Password *"><input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 10 characters" style={inputStyle} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Field label="Role"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })} style={inputStyle}><option>Admin</option><option>Librarian</option><option>Assistant</option></select></Field>
        <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "Active" | "Disabled" })} style={inputStyle}><option>Active</option><option>Disabled</option></select></Field>
      </div>
    </Modal>
  );
}
