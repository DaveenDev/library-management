import { useState } from "react";
import { api } from "../api.ts";
import { useAsync } from "../hooks.ts";
import { Modal, Field, useToast } from "./ui.tsx";
import { Icon } from "../icons.tsx";
import { primaryBtn, inputStyle, ghostBtn } from "../theme.ts";
import type { Book } from "@lumen/shared";

/**
 * Places a hold. Pass a `book` when the caller already knows the title
 * (Front Desk, Catalog); pass null to let the user pick one (Reservations).
 */
export function ReserveModal({
  book,
  onClose,
  onDone,
}: {
  book: Book | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [memberCode, setMemberCode] = useState("");
  const [bookId, setBookId] = useState<number | null>(book?.id ?? null);
  const [saving, setSaving] = useState(false);
  const { data: bookData } = useAsync(() => (book ? Promise.resolve(null) : api.books({ pageSize: 200 })), [book]);
  const books = bookData?.items ?? [];

  const chosenId = book?.id ?? bookId;

  const submit = async () => {
    if (!chosenId) { toast("Pick a title to reserve", "bad"); return; }
    if (!memberCode.trim()) { toast("Enter a member ID", "bad"); return; }
    setSaving(true);
    try {
      await api.createReservation({ bookId: chosenId, memberCode: memberCode.trim() });
      toast("Hold placed");
      onDone();
    } catch (e: any) {
      toast(e.message, "bad");
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Reserve a Book"
      subtitle={book ? book.title : "Place a hold on a title that is out"}
      width={460}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={submit} disabled={saving} style={primaryBtn}>
          <Icon name="check" color="var(--bg-card,#fbf7ee)" size={16} /><span>Place Hold</span>
        </button>
      </>}
    >
      {!book && (
        <Field label="Title">
          <select value={bookId ?? ""} onChange={(e) => setBookId(Number(e.target.value))} style={inputStyle}>
            <option value="">Select a title…</option>
            {books.map((b) => <option key={b.id} value={b.id}>{b.title} — {b.author}</option>)}
          </select>
        </Field>
      )}
      <Field label="Member ID">
        <input
          value={memberCode}
          onChange={(e) => setMemberCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder="Scan or type S-1042"
          style={{ ...inputStyle, fontFamily: "'IBM Plex Mono',monospace" }}
          autoFocus
        />
      </Field>
    </Modal>
  );
}
