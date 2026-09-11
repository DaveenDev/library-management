import { useId, useState, type KeyboardEvent } from "react";
import { Icon } from "../icons.tsx";
import { inputStyle, labelStyle } from "../theme.ts";

/** What the list shows for one record, whatever kind of record it is. */
export interface PickerLabels {
  primary: string;
  secondary: string;
}

/**
 * Search-as-you-type picker over a paginated endpoint, paired with
 * `useRecordSearch`.
 *
 * Presentational on purpose: the query and the matches belong to the caller,
 * so the chosen record stays derived from the visible matches rather than
 * being a second copy of state kept in step by an effect.
 */
export function RecordPicker<T extends { id: number }>({
  label,
  placeholder,
  query,
  onQuery,
  results,
  loading,
  value,
  onPick,
  describe,
  emptyText,
}: {
  label: string;
  placeholder: string;
  query: string;
  onQuery: (q: string) => void;
  results: T[];
  loading: boolean;
  value: T | null;
  onPick: (item: T) => void;
  describe: (item: T) => PickerLabels;
  emptyText: string;
}) {
  const ids = useId();
  const listId = `${ids}-list`;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  // Clamped on read rather than reset by an effect when the matches change.
  const active = results.length ? Math.min(cursor, results.length - 1) : -1;

  const choose = (item: T) => {
    onPick(item);
    // Leaving the chosen title in the box keeps it among the matches, so an
    // idle keystroke elsewhere cannot swap the selection out from under it.
    onQuery(describe(item).primary);
    setOpen(false);
    setCursor(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setCursor((c) =>
        results.length ? (Math.min(c, results.length - 1) + step + results.length) % results.length : 0,
      );
      return;
    }
    if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      choose(results[active]);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div style={{ position: "relative", marginBottom: "14px" }}>
      <label htmlFor={ids} style={labelStyle}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: "13px",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
          }}
        >
          <Icon name="search" color="#a89d82" size={15} />
        </span>
        <input
          id={ids}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            onQuery(e.target.value);
            setOpen(true);
            setCursor(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          style={{ ...inputStyle, paddingLeft: "37px" }}
        />
      </div>

      {/* Announces the match count to a screen reader, which cannot see the
          list appear under the box. */}
      <span aria-live="polite" style={srOnly}>
        {loading ? "Searching" : `${results.length} match${results.length === 1 ? "" : "es"}`}
      </span>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 30,
            margin: 0,
            padding: "5px",
            listStyle: "none",
            maxHeight: "244px",
            overflowY: "auto",
            background: "var(--bg-card, #fbf7ee)",
            border: "1px solid var(--border-card, #e4dcc6)",
            borderRadius: "11px",
            boxShadow: "0 14px 34px rgba(30,26,20,.2)",
          }}
        >
          {results.map((item, i) => {
            const { primary, secondary } = describe(item);
            const isActive = i === active;
            return (
              <li key={item.id} role="option" id={`${listId}-${i}`} aria-selected={value?.id === item.id}>
                <button
                  type="button"
                  tabIndex={-1}
                  // Without this the input blurs and closes the list before
                  // the click ever lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(item)}
                  onMouseEnter={() => setCursor(i)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 11px",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: isActive ? "var(--accent-soft, #e3ebdd)" : "transparent",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: "13.5px",
                      color: "#2a2620",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {primary}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "11.5px",
                      color: "#8a8069",
                      fontFamily: "'IBM Plex Mono',monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {secondary}
                  </span>
                </button>
              </li>
            );
          })}
          {!results.length && (
            <li style={{ padding: "10px 11px", fontSize: "13px", color: "#a89d82" }}>
              {loading ? "Searching…" : emptyText}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Visually hidden, still read aloud. */
const srOnly = {
  position: "absolute" as const,
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap" as const,
  border: 0,
};
