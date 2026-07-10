import { useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../api.ts";
import { usePaginated, paginationProps } from "../hooks.ts";
import { Card, Badge, statusKind, Pagination, Modal, Field, useToast } from "../components/ui.tsx";
import { Icon } from "../icons.tsx";
import { thStyle, tdStyle, tdMonoStyle, primaryBtn, inputStyle, iconBtn, ghostBtn } from "../theme.ts";
import { useAsync } from "../hooks.ts";
import type { Book, BookInput } from "@lumen/shared";

const SUBJECTS = ["All", "Fiction", "Non-Fiction", "Science", "History", "Technology", "Self-Help", "Biography", "Classic", "Memoir", "Science Fiction", "Reference"];

export function Catalog() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);

  const { data, loading, refresh } = usePaginated(
    (p) => api.books(p),
    { q, subject, page, pageSize },
    [q, subject, page, pageSize],
  );

  const del = async (b: Book) => {
    if (!confirm(`Delete “${b.title}”?`)) return;
    try { await api.deleteBook(b.id); toast(`Deleted ${b.title}`); refresh(); }
    catch (e: any) { toast(e.message, "bad"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <Card style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: "13px", display: "flex" }}><Icon name="search" color="#a89d82" size={16} /></span>
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by title, author, or subject" style={{ width: "340px", padding: "11px 14px 11px 40px", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "9px", background: "var(--bg-input, #fffdf7)", fontSize: "14px", color: "#2a2620" }} />
          </div>
          <span style={{ fontSize: "13px", color: "#8a8069" }}>{data.total} titles</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
            {["All", "Fiction", "Science", "History"].map((s) => {
              const active = subject === s;
              return (
                <span key={s} onClick={() => { setSubject(s); setPage(1); }} style={{ padding: "7px 13px", borderRadius: "20px", fontSize: "12.5px", cursor: "pointer", border: active ? "1px solid var(--accent, #3d6b53)" : "1px solid var(--border-input, #ddd2b8)", background: active ? "var(--accent-soft, #e3ebdd)" : "var(--bg-input, #fffdf7)", color: active ? "var(--accent, #3d6b53)" : "#6f6653" }}>{s}</span>
              );
            })}
          </div>
          <button onClick={() => setShowAdd(true)} style={primaryBtn}><Icon name="plus" color="var(--bg-card,#fbf7ee)" size={16} /><span>Add Book</span></button>
        </div>
      </Card>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["Barcode", "Title", "Author", "Subject", "Available", "Shelf", "Status", ""].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.items.map((b) => {
                const status = b.availableCopies > 0 ? "Available" : "All out";
                return (
                  <tr key={b.id} className="lm-row">
                    <td style={tdMonoStyle}>{b.barcode}</td>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{b.title}</span></td>
                    <td style={tdStyle}>{b.author}</td>
                    <td style={tdStyle}>{b.subject}</td>
                    <td style={tdStyle}>{b.availableCopies} / {b.totalCopies}</td>
                    <td style={tdMonoStyle}>{b.shelf ?? "—"}</td>
                    <td style={tdStyle}><Badge kind={statusKind(status)}>{status}</Badge></td>
                    <td style={tdStyle}><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button style={iconBtn} onClick={() => setEditing(b)}><Icon name="edit" color="#6f6653" size={15} /></button>
                      <button style={iconBtn} onClick={() => del(b)}><Icon name="trash" color="#a4472f" size={15} /></button>
                    </div></td>
                  </tr>
                );
              })}
              {!loading && data.items.length === 0 && (
                <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "#a89d82", padding: "28px" }}>No books found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...paginationProps(data.total, page, pageSize, setPage, setPageSize)} />
      </Card>

      {(showAdd || editing) && (
        <BookModal
          book={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function BookModal({ book, onClose, onSaved }: { book: Book | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data: settings } = useAsync(() => api.settings(), []);
  const [form, setForm] = useState<BookInput>({
    title: book?.title ?? "", author: book?.author ?? "", subject: book?.subject ?? "Fiction",
    isbn: book?.isbn ?? "", totalCopies: book?.totalCopies ?? 1, shelf: book?.shelf ?? "",
    publicationYear: book?.publicationYear ?? null, publisher: book?.publisher ?? "", description: book?.description ?? "",
    barcode: book?.barcode ?? "",
  });
  const set = (k: keyof BookInput, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title || !form.author) { toast("Title and author are required", "bad"); return; }
    setSaving(true);
    try {
      if (book) { await api.updateBook(book.id, form); toast(`Updated ${form.title}`); }
      else { await api.createBook(form); toast(`Added ${form.title}`); }
      onSaved();
    } catch (e: any) { toast(e.message, "bad"); setSaving(false); }
  };

  const subjects = settings?.lists.subjects ?? ["Fiction"];

  return (
    <Modal
      title={book ? "Edit Book" : "Add New Book"}
      subtitle={book ? "Update this catalog entry" : "Add a new title to the catalog"}
      width={660}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={save} disabled={saving} style={primaryBtn}><Icon name="check" color="var(--bg-card,#fbf7ee)" size={16} /><span>{book ? "Save Changes" : "Save Book"}</span></button>
      </>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Field label="Title *"><input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Dune" style={inputStyle} /></Field>
        <Field label="Author *"><input value={form.author} onChange={(e) => set("author", e.target.value)} placeholder="e.g. Frank Herbert" style={inputStyle} /></Field>
        <Field label="Subject / Category">
          <select value={form.subject} onChange={(e) => set("subject", e.target.value)} style={inputStyle}>
            {subjects.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="ISBN"><input value={form.isbn ?? ""} onChange={(e) => set("isbn", e.target.value)} placeholder="9780441013593" style={{ ...inputStyle, fontFamily: "'IBM Plex Mono',monospace" }} /></Field>
        <Field label="Total Copies"><input type="number" min={1} value={form.totalCopies} onChange={(e) => set("totalCopies", Number(e.target.value))} style={inputStyle} /></Field>
        <Field label="Shelf Location"><input value={form.shelf ?? ""} onChange={(e) => set("shelf", e.target.value)} placeholder="e.g. E-07" style={{ ...inputStyle, fontFamily: "'IBM Plex Mono',monospace" }} /></Field>
        <Field label="Publication Year"><input type="number" value={form.publicationYear ?? ""} onChange={(e) => set("publicationYear", e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 1965" style={inputStyle} /></Field>
        <Field label="Publisher"><input value={form.publisher ?? ""} onChange={(e) => set("publisher", e.target.value)} placeholder="e.g. Ace Books" style={inputStyle} /></Field>
      </div>
      <Field label="Barcode"><input value={form.barcode ?? ""} onChange={(e) => set("barcode", e.target.value)} placeholder="Auto-generated on save (LIB-000xxx)" style={{ ...inputStyle, fontFamily: "'IBM Plex Mono',monospace" }} /></Field>
      <Field label="Description / Notes"><textarea rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Short description or shelving notes (optional)" style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" } as CSSProperties} /></Field>
    </Modal>
  );
}
