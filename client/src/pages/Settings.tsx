import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { useAsync } from "../hooks.ts";
import { Card, Field, useToast } from "../components/ui.tsx";
import { Icon } from "../icons.tsx";
import { primaryBtn, inputStyle } from "../theme.ts";
import { CURRENCY_SYMBOL, type LookupLists } from "@lumen/shared";
import { errorMessage } from "../lib/errors.ts";
import { useAuth } from "../auth.tsx";

export function Settings() {
  const toast = useToast();
  const canWrite = useAuth().can("settings:write");
  const { data, loading } = useAsync(() => api.settings(), []);
  const [form, setForm] = useState({ dailyFineRate: "0.50", gracePeriodDays: "2", maxFineCap: "15.00", autoSuspendDays: "14", emailReminders: true, loanPeriodDays: "14" });
  const [lists, setLists] = useState<LookupLists>({ shelves: [], subjects: [], grades: [], sections: [] });

  useEffect(() => {
    if (data) {
      setForm({
        dailyFineRate: data.dailyFineRate.toFixed(2), gracePeriodDays: String(data.gracePeriodDays),
        maxFineCap: data.maxFineCap.toFixed(2), autoSuspendDays: String(data.autoSuspendDays),
        emailReminders: data.emailReminders, loanPeriodDays: String(data.loanPeriodDays),
      });
      setLists(data.lists);
    }
  }, [data]);

  const saveFines = async () => {
    try {
      await api.saveSettings({
        dailyFineRate: Number(form.dailyFineRate), gracePeriodDays: Number(form.gracePeriodDays),
        maxFineCap: Number(form.maxFineCap), autoSuspendDays: Number(form.autoSuspendDays),
        emailReminders: form.emailReminders, loanPeriodDays: Number(form.loanPeriodDays),
      });
      toast("Fine settings saved");
    } catch (e) { toast(errorMessage(e), "bad"); }
  };

  // Read-only rather than hidden: knowing the library's fine rate is useful
  // to anyone at the desk, even if only an Admin may change it.
  const policyInput = canWrite ? inputStyle : { ...inputStyle, background: "var(--bg-soft, #f3edda)", color: "#6f6653" };

  if (loading) return <div style={{ color: "#8a8069" }}>Loading settings…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Card style={{ padding: "20px 22px" }}>
        <h3 style={{ margin: "0 0 4px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>Fines &amp; Penalties</h3>
        <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#8a8069" }}>Configure how overdue fines are calculated and enforced</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "16px" }}>
          <Field label={`Daily Fine Rate (${CURRENCY_SYMBOL})`}><input value={form.dailyFineRate} onChange={(e) => setForm({ ...form, dailyFineRate: e.target.value })} disabled={!canWrite} style={policyInput} /></Field>
          <Field label="Grace Period (days)"><input value={form.gracePeriodDays} onChange={(e) => setForm({ ...form, gracePeriodDays: e.target.value })} disabled={!canWrite} style={policyInput} /></Field>
          <Field label={`Maximum Fine Cap (${CURRENCY_SYMBOL})`}><input value={form.maxFineCap} onChange={(e) => setForm({ ...form, maxFineCap: e.target.value })} disabled={!canWrite} style={policyInput} /></Field>
          <Field label="Loan Period (days)"><input value={form.loanPeriodDays} onChange={(e) => setForm({ ...form, loanPeriodDays: e.target.value })} disabled={!canWrite} style={policyInput} /></Field>
          <Field label="Auto-suspend After (days overdue)"><input value={form.autoSuspendDays} onChange={(e) => setForm({ ...form, autoSuspendDays: e.target.value })} disabled={!canWrite} style={policyInput} /></Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "18px", fontSize: "13.5px", color: "#3a352c", cursor: "pointer" }}>
          <input type="checkbox" checked={form.emailReminders} onChange={(e) => setForm({ ...form, emailReminders: e.target.checked })} disabled={!canWrite} style={{ width: "17px", height: "17px", accentColor: "var(--accent, #3d6b53)" }} />
          Send automatic email reminders before the due date
        </label>
        <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid var(--border-row, #efe8d5)", display: "flex", justifyContent: "flex-end" }}>
          {canWrite ? (
            <button onClick={saveFines} style={primaryBtn}><Icon name="check" color="var(--bg-card,#fbf7ee)" size={16} /><span>Save Fine Settings</span></button>
          ) : (
            <p style={{ margin: 0, fontSize: "12.5px", color: "#8a8069" }}>Only an administrator can change fine policy.</p>
          )}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
        <ChipCard title="Book Shelves" note="Shelf codes used for physical placement" kind="shelf" mono editable={canWrite} values={lists.shelves} onChange={(v) => setLists({ ...lists, shelves: v })} placeholder="e.g. G-11" />
        <ChipCard title="Subject / Category" note="Classifications used across the catalog" kind="subject" editable={canWrite} values={lists.subjects} onChange={(v) => setLists({ ...lists, subjects: v })} placeholder="e.g. Poetry" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
        <ChipCard title="Grade List" note="Grade levels available when registering students" kind="grade" editable={canWrite} values={lists.grades} onChange={(v) => setLists({ ...lists, grades: v })} placeholder="e.g. Grade 13" />
        <ChipCard title="Section List" note="Homeroom / class sections within each grade" kind="section" editable={canWrite} values={lists.sections} onChange={(v) => setLists({ ...lists, sections: v })} placeholder="e.g. Section E" />
      </div>
    </div>
  );
}

function ChipCard({ title, note, kind, values, onChange, placeholder, mono, editable }: {
  title: string; note: string; kind: string; values: string[];
  onChange: (v: string[]) => void; placeholder: string; mono?: boolean; editable: boolean;
}) {
  const toast = useToast();
  const [input, setInput] = useState("");

  const add = async () => {
    const v = input.trim();
    if (!v) return;
    try { const lists = await api.addLookup(kind, v); onChange(lists[pluralOf(kind)]); setInput(""); }
    catch (e) { toast(errorMessage(e), "bad"); }
  };
  const remove = async (val: string) => {
    try { const lists = await api.removeLookup(kind, val); onChange(lists[pluralOf(kind)]); }
    catch (e) { toast(errorMessage(e), "bad"); }
  };

  return (
    <Card style={{ padding: "20px 22px" }}>
      <h3 style={{ margin: "0 0 4px", fontFamily: "Spectral,serif", fontSize: "17px", fontWeight: 600 }}>{title}</h3>
      <p style={{ margin: "0 0 14px", fontSize: "12.5px", color: "#8a8069" }}>{note}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {values.map((text) => (
          <span key={text} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 6px 6px 12px", borderRadius: "20px", background: "var(--bg-soft, #f3edda)", border: "1px solid var(--border-input, #ddd2b8)", fontSize: "13px", color: "#3a352c", fontFamily: mono ? "'IBM Plex Mono',monospace" : "inherit" }}>
            {text}
            {editable && <button onClick={() => remove(text)} aria-label={`Remove ${text}`} style={{ width: "18px", height: "18px", borderRadius: "50%", border: "none", background: "var(--border-card, #e4dcc6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><Icon name="x" color="#6f6653" size={11} /></button>}
          </span>
        ))}
      </div>
      {editable && <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
        <input value={input} aria-label={`Add to ${title}`} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "8px", background: "var(--bg-input, #fffdf7)", fontSize: "13.5px", color: "#2a2620", fontFamily: mono ? "'IBM Plex Mono',monospace" : "inherit" }} />
        <button onClick={add} style={{ padding: "0 14px", borderRadius: "8px", border: "1px solid var(--accent, #3d6b53)", background: "var(--accent-soft, #e3ebdd)", color: "var(--accent, #3d6b53)", fontFamily: "inherit", fontSize: "13.5px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Icon name="plus" color="var(--accent, #3d6b53)" size={14} /><span>Add</span></button>
      </div>}
    </Card>
  );
}

function pluralOf(kind: string): keyof LookupLists {
  return ({ shelf: "shelves", subject: "subjects", grade: "grades", section: "sections" } as const)[kind as "shelf"];
}
