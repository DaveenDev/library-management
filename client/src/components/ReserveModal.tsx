import { useCallback, useState } from "react";
import { api } from "../api.ts";
import { useRecordSearch } from "../hooks.ts";
import { Modal, Field, useToast } from "./ui.tsx";
import { RecordPicker } from "./RecordPicker.tsx";
import { Icon } from "../icons.tsx";
import { primaryBtn, inputStyle, ghostBtn } from "../theme.ts";
import type { Book } from "@lumen/shared";
import { errorMessage } from "../lib/errors.ts";

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
  // Skipped entirely when the caller already knows the title, as the picker
  // is not rendered then and the request would be wasted.
  const bookSearch = useRecordSearch(
    useCallback(
      (p) => (book ? Promise.resolve({ items: [], total: 0, page: 1, pageSize: 0 }) : api.books(p)),
      [book],
    ),
  );

  const chosenId = book?.id ?? bookId;
  const chosen = bookSearch.results.find((b) => b.id === bookId) ?? null;

  const submit = async () => {
    if (!chosenId) { toast("Pick a title to reserve", "bad"); return; }
    if (!memberCode.trim()) { toast("Enter a member ID", "bad"); return; }
    setSaving(true);
    try {
      await api.createReservation({ bookId: chosenId, memberCode: memberCode.trim() });
      toast("Hold placed");
      onDone();
    } catch (e) {
      toast(errorMessage(e), "bad");
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
        <RecordPicker
          label="Title"
          placeholder="Search title, author or barcode"
          emptyText="No titles match that search."
          query={bookSearch.query}
          onQuery={bookSearch.setQuery}
          results={bookSearch.results}
          loading={bookSearch.loading}
          value={chosen}
          onPick={(b) => setBookId(b.id)}
          describe={(b) => ({ primary: b.title, secondary: `${b.author} · ${b.barcode}` })}
        />
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
